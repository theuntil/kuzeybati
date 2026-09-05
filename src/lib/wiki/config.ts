/*
 * ══════════════════════════════════════════════════════════════
 *  WIKIMEDIA "TARİHTE BUGÜN" — YAPILANDIRMA
 *
 *  Tüm adresler ve sabitler tek yerde: Wikimedia 2026-2027
 *  arasında RESTBase uçlarını kaldırmayı planlıyor, o gün
 *  gelince yalnızca bu dosya değişecek.
 * ══════════════════════════════════════════════════════════════
 */

export const WIKI_LANG = process.env.NEXT_PUBLIC_WIKI_LANG ?? "tr";
export const WIKI_FALLBACK_LANG = "en";

/*
 * ⚠ SİTE SAAT DİLİMİ — KRİTİK.
 *
 * Konteynerde `TZ` genelde UTC. 4 Eylül 01:30 (TR) anında sunucu
 * hâlâ 3 Eylül 22:30 (UTC) görüyor ve okura BİR GÜN ÖNCEKİ
 * olaylar gidiyordu. Gün hesabı bu dilime göre yapılıyor.
 */
export const SITE_TZ = process.env.SITE_TZ ?? "Europe/Istanbul";

export const FEED_BASE =
  process.env.WIKI_FEED_BASE ?? "https://api.wikimedia.org/feed/v1/wikipedia";

export const REST_BASE = (lang: string) =>
  process.env.WIKI_REST_BASE?.replace("{lang}", lang) ??
  `https://${lang}.wikipedia.org/api/rest_v1`;

/*
 * ⚠ İLETİŞİM BİLGİSİ ZORUNLU.
 * Wikimedia politikası kimliksiz istemcileri kısıtlıyor ya da
 * engelliyor. Alan adı ve e-posta içermeyen bir User-Agent
 * kalıcı blok riski taşıyor.
 */
export const USER_AGENT =
  process.env.WIKI_USER_AGENT ??
  "KuzeybatiHaber/1.0 (https://kuzeybatihaber.com; iletisim@kuzeybatihaber.com)";

/** Gün içinde değişmiyor; saatlik yenileme yeterli */
export const REVALIDATE_FEED = 60 * 60;

/** Madde özetleri nadiren değişiyor */
export const REVALIDATE_SUMMARY = 60 * 60 * 6;

/*
 * ┌─ SAYFA 15 SANİYE AÇILIYORDU ⚠️ ────────────────────────────┐
 * │ 8 saniye × 3 deneme + bekleme ≈ 25 saniye. Wikimedia       │
 * │ yavaşladığında ya da erişilemediğinde okur boş ekrana      │
 * │ bakıyordu.                                                   │
 * │                                                              │
 * │ Bu bir HABER SİTESİ; tarihte bugün kutusu hoş bir ek,      │
 * │ sayfanın açılmasını geciktirecek kadar önemli değil.       │
 * │ Bütçe 3 saniye, tek yeniden deneme: en kötü ~6.5 saniye    │
 * │ ve o da yalnızca arka planda, Suspense içinde.              │
 * └──────────────────────────────────────────────────────────────┘
 */
export const FETCH_TIMEOUT_MS = 3000;

/**
 * Bugünün gün/ay bilgisi — site saat dilimine göre.
 *
 * `Intl` kullanılıyor çünkü `new Date().getDate()` konteynerin
 * saat dilimine bakıyor ve yanlış gün veriyordu.
 */
export function dayMonthNow(tz: string = SITE_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());

  const al = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = al("year"), month = al("month"), day = al("day");

  return { year, month, day, isoDate: `${year}-${month}-${day}` };
}

/** "2026-09-04" → "4 Eylül" */
export function gunAyEtiketi(isoDate: string, locale = "tr-TR") {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  /*
   * ⚠ UTC ile kuruluyor ve UTC ile biçimleniyor.
   * Yerel saat dilimiyle kurulsaydı gün kayabilirdi.
   */
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    timeZone: "UTC", day: "numeric", month: "long",
  });
}
