import { headers } from "next/headers";
import Icon from "@/components/ui/Icon";
import { type Locale, serviceHref } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Deprem } from "@/app/api/deprem/route";
import { renk } from "@/components/services/DepremHarita";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   SON DEPREMLER — MİNİ WIDGET

   ⚠ VERİ YOKSA HİÇ BASILMIYOR.
   AFAD zaman zaman cevap vermiyor; boş kutu sayfada delik
   bırakırdı.

   ⚠ BÜYÜKLÜK RENGİ HARİTAYLA AYNI KAYNAKTAN.
   `renk()` fonksiyonu paylaşılıyor; widget ile harita farklı
   renk gösterirse okur hangisine güveneceğini bilemez.
   ══════════════════════════════════════════════════════════════ */

/**
 * Kendi API ucumuz için mutlak adres.
 *
 * ┌─ GÖRELİ ADRES SUNUCUDA ÇÖKÜYOR ⚠️ ────────────────────────┐
 * │ İlk hâli `${NEXT_PUBLIC_SITE_URL ?? ""}/api/deprem` idi.  │
 * │ O değişken tanımlı değilse adres `/api/deprem` oluyor ve   │
 * │ Node'un `fetch`i şu hatayı veriyor:                        │
 * │                                                              │
 * │   TypeError: Failed to parse URL from /api/deprem          │
 * │                                                              │
 * │ `try/catch` bunu yutuyor ve widget SESSİZCE hiç             │
 * │ görünmüyordu — üstelik hata mesajı da yoktu.               │
 * │                                                              │
 * │ Artık ortam değişkeni yoksa isteğin kendi `host` başlığı   │
 * │ kullanılıyor; hiçbir yapılandırma gerekmiyor.              │
 * └──────────────────────────────────────────────────────────────┘
 */
async function tabanAdres(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";

  /* Yerel geliştirmede http, dağıtımda https */
  const sema = h.get("x-forwarded-proto")
    ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${sema}://${host}`;
}

export async function sonDepremler(adet: number): Promise<Deprem[]> {
  const taban = await tabanAdres();

  /*
   * Adres kurulamadıysa istek hiç yapılmıyor: göreli adresle
   * denemek yalnızca yakalanan bir hata üretirdi.
   */
  if (!taban) {
    console.error("[deprem-widget] taban adres belirlenemedi");
    return [];
  }

  try {
    const res = await fetch(`${taban}/api/deprem`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    /*
     * ⚠ ALAN ADI `depremler` — `veri` DEĞİL.
     * Uç noktanın sözleşmesi bu; yanlış ad sessizce boş liste
     * üretir ve widget hiç görünmezdi.
     */
    const j = (await res.json()) as { depremler?: Deprem[] };
    return Array.isArray(j.depremler) ? j.depremler.slice(0, adet) : [];
  } catch {
    return [];
  }
}

export default async function DepremWidget({
  locale, dict, adet = 4, veri,
}: {
  locale: Locale;
  dict: Dictionary;
  adet?: number;
  /*
   * Sayfa veriyi önceden çekmişse tekrar istek atılmıyor.
   * Ana sayfa bunu kullanıyor: yerleşimi kurmadan ÖNCE veri
   * olup olmadığını bilmesi gerekiyor.
   */
  veri?: Deprem[];
}) {
  const liste = veri ?? await sonDepremler(adet);
  if (!liste.length) return null;

  const baslik = (dict.srv as Record<string, string>).earthquake ?? "Son Depremler";

  return (
    <section style={{
      border: "1px solid var(--bd)", borderRadius: 22,
      background: "var(--s1)", padding: 20,
      /*
       * Tanıtım bloğuyla yan yana dururken aynı yüksekliği
       * paylaşıyor; liste kalan alana yayılıyor.
       */
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 10, marginBottom: 14,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 15, fontWeight: 800, letterSpacing: "-.01em",
        }}>
          <Icon name="warn" size={17} />
          {baslik}
        </span>

        <Link href={serviceHref(locale, "earthquake")} style={{
          fontSize: 12.5, fontWeight: 700, color: "var(--ac)",
          textDecoration: "none", flexShrink: 0,
        }}>
          {dict.common.all}
        </Link>
      </div>

      <ul style={{
        listStyle: "none", margin: 0, padding: 0,
        display: "grid", gap: 8, flex: 1, alignContent: "start",
      }}>
        {liste.map((d) => {
          const c = renk(d.buyukluk);
          const saat = (() => {
            const t = new Date(d.tarih.replace(" ", "T"));
            return Number.isFinite(t.getTime())
              ? t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
              : "";
          })();

          return (
            <li key={d.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 13,
              background: "var(--s2)",
              /*
               * Sol kenarda büyüklük rengi: liste hızlıca
               * taranırken şiddetli olanlar hemen ayrışıyor.
               */
              borderInlineStart: `3px solid ${c}`,
            }}>
              {/* Büyüklük — kartın en belirgin bilgisi */}
              <span style={{
                flexShrink: 0, minWidth: 42, height: 34,
                display: "grid", placeItems: "center", borderRadius: 10,
                background: `${c}22`, color: c,
                fontSize: 15, fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              }}>
                {d.buyukluk.toFixed(1)}
              </span>

              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{
                  display: "block", fontSize: 13, fontWeight: 600,
                  lineHeight: 1.3, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {d.ilce ?? d.il ?? d.yer}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--mu)" }}>
                  {d.derinlik.toFixed(0)} km{saat ? ` · ${saat}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
