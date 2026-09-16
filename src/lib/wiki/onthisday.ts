import "server-only";
import { wikiFetch, WikiError } from "./http";
import {
  FEED_BASE, REST_BASE, WIKI_LANG, WIKI_FALLBACK_LANG,
  REVALIDATE_FEED, REVALIDATE_SUMMARY,
} from "./config";

/*
 * ══════════════════════════════════════════════════════════════
 *  TARİHTE BUGÜN — VERİ KATMANI
 *
 *  ┌─ ŞEMA ELLE DOĞRULANIYOR ⚠️ ───────────────────────────────┐
 *  │ Belge `zod` öneriyor ama projede kurulu değil. Yalnızca   │
 *  │ bu özellik için bir bağımlılık eklemek dağıtıma sürüm     │
 *  │ riski katardı. Doğrulama elle yapılıyor: beklenmeyen bir  │
 *  │ alan gelirse o kayıt atlanıyor, sayfa çökmüyor.           │
 *  └──────────────────────────────────────────────────────────────┘
 * ══════════════════════════════════════════════════════════════
 */

export interface WikiGorsel { source: string; width?: number; height?: number }

export interface WikiSayfa {
  title: string;
  normalizedtitle?: string;
  description?: string;
  extract?: string;
  thumbnail?: WikiGorsel;
  originalimage?: WikiGorsel;
  content_urls?: { desktop?: { page?: string } };
  lang?: string;
}

export interface OlayKaydi {
  text: string;
  year?: number;
  pages?: WikiSayfa[];
}

export type FeedTuru =
  | "selected" | "events" | "births" | "deaths" | "holidays" | "all";

/* ---------- yardımcılar ---------- */

export const stripHtml = (s?: string) =>
  (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/*
 * ┌─ BAŞLIKTAKİ EĞİK ÇİZGİ ROTAYI KIRIYOR ⚠️ ──────────────────┐
 * │ "AC/DC" ya da "S/2004 N 1" gibi başlıklar Next'in yol      │
 * │ bölütünü ikiye ayırıyor ve detay sayfası 404 veriyor.      │
 * │                                                              │
 * │ Çözüm: eğik çizgi güvenli bir işaretçiye çevriliyor, sonra │
 * │ tamamı bir kez daha kodlanıyor. Okurken tersi yapılıyor.   │
 * └──────────────────────────────────────────────────────────────┘
 */
const EGIK_ISARET = "~-~";

export const basligiKodla = (t: string) =>
  encodeURIComponent((t ?? "").trim().replace(/ /g, "_").replace(/\//g, EGIK_ISARET));

export const basligiCoz = (s: string) => {
  let ham = s ?? "";
  try { ham = decodeURIComponent(ham); } catch { /* zaten çözülmüş */ }
  return ham.split(EGIK_ISARET).join("/").replace(/_/g, " ").trim();
};

/** Wikipedia adresi için başlık (eğik çizgi korunuyor) */
const wikiApiBaslik = (t: string) =>
  encodeURIComponent((t ?? "").trim().replace(/ /g, "_"));

export function enIyiSayfa(pages?: WikiSayfa[] | null): WikiSayfa | null {
  const dizi = Array.isArray(pages) ? pages : [];
  if (!dizi.length) return null;
  /* Görseli olan tercih ediliyor — kart boş kalmasın */
  return dizi.find((p) => p.thumbnail?.source) ?? dizi[0];
}

/* ---------- şema doğrulama ---------- */

function gorselOku(v: unknown): WikiGorsel | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return typeof o.source === "string"
    ? {
        source: o.source,
        width: typeof o.width === "number" ? o.width : undefined,
        height: typeof o.height === "number" ? o.height : undefined,
      }
    : undefined;
}

function sayfaOku(v: unknown): WikiSayfa | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) return null;

  const cu = o.content_urls as Record<string, unknown> | undefined;
  const masaustu = cu?.desktop as Record<string, unknown> | undefined;

  return {
    title: o.title,
    normalizedtitle: typeof o.normalizedtitle === "string" ? o.normalizedtitle : undefined,
    description: typeof o.description === "string" ? o.description : undefined,
    extract: typeof o.extract === "string" ? o.extract : undefined,
    thumbnail: gorselOku(o.thumbnail),
    originalimage: gorselOku(o.originalimage),
    content_urls: typeof masaustu?.page === "string"
      ? { desktop: { page: masaustu.page } } : undefined,
    lang: typeof o.lang === "string" ? o.lang : undefined,
  };
}

function olayOku(v: unknown): OlayKaydi | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.text !== "string" || !stripHtml(o.text)) return null;

  const sayfalar = Array.isArray(o.pages)
    ? o.pages.map(sayfaOku).filter((p): p is WikiSayfa => p !== null)
    : undefined;

  return {
    text: o.text,
    year: typeof o.year === "number" && Number.isFinite(o.year) ? o.year : undefined,
    pages: sayfalar,
  };
}

/* ---------- ana çekim ---------- */

export async function tarihteBugun({
  month, day, type = "all", lang = WIKI_LANG,
  limit = 24, fallback = true,
}: {
  month: string; day: string;
  type?: FeedTuru; lang?: string; limit?: number; fallback?: boolean;
}): Promise<{ olaylar: OlayKaydi[]; lang: string; bozuk: boolean }> {

  const url = `${FEED_BASE}/${lang}/onthisday/${type}/${month}/${day}`;

  try {
    const ham = await wikiFetch(url, { revalidate: REVALIDATE_FEED });
    if (!ham || typeof ham !== "object") {
      return { olaylar: [], lang, bozuk: true };
    }

    const d = ham as Record<string, unknown>;
    const dizi = (k: string) => Array.isArray(d[k]) ? (d[k] as unknown[]) : [];

    /*
     * ⚠ `selected` ÖNCE.
     * Editoryal olarak seçilmiş olaylar; `events`'e göre çok
     * daha haber değeri taşıyor.
     */
    const birlesik = [...dizi("selected"), ...dizi("events")]
      .map(olayOku)
      .filter((e): e is OlayKaydi => e !== null);

    /* Aynı olay iki listede birden olabiliyor */
    const gorulen = new Set<string>();
    const olaylar = birlesik
      .filter((e) => {
        const anahtar = `${e.year ?? ""}|${stripHtml(e.text).slice(0, 80)}`;
        if (gorulen.has(anahtar)) return false;
        gorulen.add(anahtar);
        return true;
      })
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))   // yeniden eskiye
      .slice(0, limit);

    return { olaylar, lang, bozuk: false };

  } catch (e) {
    /* 501: dil desteklenmiyor → İngilizceye düş */
    if (fallback && e instanceof WikiError && e.kind === "unsupported"
        && lang !== WIKI_FALLBACK_LANG) {
      console.warn(`[tarihte-bugun] ${lang} desteklenmiyor, ${WIKI_FALLBACK_LANG} deneniyor`);
      return tarihteBugun({
        month, day, type, lang: WIKI_FALLBACK_LANG, limit, fallback: false,
      });
    }

    /* 404: o güne kayıt yok — hata değil */
    if (e instanceof WikiError && e.kind === "notfound") {
      return { olaylar: [], lang, bozuk: false };
    }

    console.error("[tarihte-bugun] veri alınamadı:", e);
    return { olaylar: [], lang, bozuk: true };
  }
}

/* ---------- madde özeti ---------- */

export async function wikiOzet(
  title: string, lang: string = WIKI_LANG,
): Promise<WikiSayfa | null> {
  const url = `${REST_BASE(lang)}/page/summary/${wikiApiBaslik(title)}`;
  try {
    const ham = await wikiFetch(url, {
      revalidate: REVALIDATE_SUMMARY, retries: 1,
    });
    return sayfaOku(ham);
  } catch {
    return null;
  }
}
