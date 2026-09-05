/**
 * Dil yapılandırması ve URL şeması.
 *
 * Türkçe sitenin ANA dili: ön ek yok.  /haber/slug
 * Diğer diller ön ekli:              /en/news/slug
 *
 * Yol parçaları da çevrilir; middleware bunları kanonik
 * segmentlere (news/category/city/...) çevirip App Router'a verir.
 */

export const locales = ["tr", "en", "ar", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

export const localeNames: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  ar: "العربية",
  ru: "Русский",
};

/** Dil seçicide gösterilen bayrak (flagcdn, tasarımdaki gibi) */
export const localeFlags: Record<Locale, string> = {
  tr: "tr",
  en: "gb",
  ar: "sa",
  ru: "ru",
};

/** Arapça sağdan sola akar; layout `dir` bunu okur. */
export const rtlLocales: Locale[] = ["ar"];
export const isRtl = (l: Locale) => rtlLocales.includes(l);

/** Tarih/sayı biçimlendirmesi için tam BCP-47 etiketi */
export const localeTags: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-GB",
  ar: "ar",
  ru: "ru-RU",
};

/**
 * Kanonik segment → dile göre görünen segment.
 * Soldaki isim App Router klasör adıdır, değiştirilmemeli.
 */
export const segments = {
  news: { tr: "haber", en: "news", ar: "khabar", ru: "novosti" },
  category: { tr: "kategori", en: "category", ar: "qism", ru: "rubrika" },
  city: { tr: "sehir", en: "city", ar: "madina", ru: "gorod" },
  search: { tr: "arama", en: "search", ar: "bahth", ru: "poisk" },
  video: { tr: "video", en: "video", ar: "video", ru: "video" },
  /* Reels — her dilde aynı; marka adı gibi kullanılıyor */
  reels: { tr: "reels", en: "reels", ar: "reels", ru: "reels" },
  account: { tr: "hesabim", en: "account", ar: "hisabi", ru: "akkaunt" },
  login: { tr: "giris", en: "login", ar: "dukhul", ru: "vhod" },
  signup: { tr: "kayit", en: "signup", ar: "tasjil", ru: "registraciya" },
  // OAuth ile gelen kullanıcıda şehir bilgisi olmaz; eksikleri
  // tamamlatan ekran
  "complete-profile": {
    tr: "profil-tamamla", en: "complete-profile",
    ar: "ikmal-almilaf", ru: "zapolnit-profil",
  },
  page: { tr: "sayfa", en: "page", ar: "safha", ru: "stranica" },
  /* Politika listesi — footer'dan buraya geliniyor */
  politikalar: { tr: "politikalar", en: "policies", ar: "policies", ru: "policies" },
  /* Yazarlarımız — panelden görünür işaretlenenler */
  yazarlar: { tr: "yazarlar", en: "authors", ar: "authors", ru: "authors" },
  // Şifre sıfırlama (6 haneli kod)
  "reset-password": {
    tr: "sifre-sifirla", en: "reset-password",
    ar: "istiadat-kalima", ru: "sbros-parolya",
  },
  // Maildeki doğrulama bağlantısı
  "verify-email": {
    tr: "eposta-dogrula", en: "verify-email",
    ar: "tawthiq-albarid", ru: "podtverdit-pochtu",
  },
  services: { tr: "hizmetler", en: "services", ar: "khadamat", ru: "servisy" },
} as const;

export type CanonicalSegment = keyof typeof segments;

/**
 * HİZMET ALT SAYFALARI
 *
 * Her hizmetin KENDİ sayfası var: /hizmetler/hava-durumu,
 * /hizmetler/piyasalar … Tek sayfada sekme yerine ayrı adres,
 * çünkü bunlar paylaşılabilir ve arama motorlarınca ayrı ayrı
 * indekslenmesi gereken içerikler.
 */
export const serviceSlugs = {
  weather:  { tr: "hava-durumu",     en: "weather",      ar: "taqs",      ru: "pogoda" },
  markets:  { tr: "piyasalar",       en: "markets",      ar: "aswaq",     ru: "rynki" },
  prayer:   { tr: "namaz-vakitleri", en: "prayer-times", ar: "mawaqit",   ru: "namaz" },
  scores:   { tr: "skorlar",         en: "scores",       ar: "nataij",    ru: "schet" },
  pharmacy: { tr: "nobetci-eczane",  en: "pharmacy",     ar: "saydaliya", ru: "apteka" },
  traffic:  { tr: "trafik",          en: "traffic",      ar: "murur",     ru: "probki" },
  /* AFAD verisiyle son depremler */
  earthquake: { tr: "deprem",        en: "earthquake",   ar: "zilzal",    ru: "zemletryasenie" },
  /* Wikimedia "On this day" — tarihte bugün ne oldu */
  onthisday: { tr: "tarihte-bugun",  en: "on-this-day",  ar: "fi-hadha-alyawm", ru: "v-etot-den" },
} as const;

export type ServiceKey = keyof typeof serviceSlugs;

/**
 * HESAP ALT SAYFALARI
 * /hesabim/yeni · /hesabim/duzenle/{id}
 */
export const accountSlugs = {
  new:  { tr: "yeni",     en: "new",  ar: "jadid",  ru: "novaya" },
  edit:  { tr: "duzenle",   en: "edit",  ar: "tadil",  ru: "izmenit" },
  stats: { tr: "istatistik", en: "stats", ar: "ihsaiyat", ru: "statistika" },
} as const;

export type AccountSection = keyof typeof accountSlugs;

export function accountHref(locale: Locale, key: AccountSection, id?: string): string {
  const base = `${href(locale, "account")}/${accountSlugs[key][locale]}`;
  return id ? `${base}/${id}` : base;
}

/** "yeni" → "new"; tanınmazsa null */
export function accountFromSlug(locale: Locale, slug: string): AccountSection | null {
  for (const key of Object.keys(accountSlugs) as AccountSection[]) {
    if (accountSlugs[key][locale] === slug) return key;
    if ((Object.values(accountSlugs[key]) as string[]).includes(slug)) return key;
  }
  return null;
}

/**
 * Dile göre yazılmış hizmet adresi: /tr/hava-durumu
 *
 * ┌─ ADRES KISALDI ⚠️ ────────────────────────────────────────┐
 * │ Önce `/tr/hizmetler/hava-durumu` idi. "hizmetler" ara     │
 * │ segmenti kullanıcıya hiçbir şey söylemiyor, adresi        │
 * │ uzatıyor ve paylaşıldığında hantal duruyordu.             │
 * │                                                              │
 * │ ⚠ ESKİ ADRESLER KIRILMIYOR. `/tr/hizmetler/hava-durumu`   │
 * │ middleware'de 301 ile yenisine yönlendiriliyor; arama     │
 * │ motorlarındaki kayıtlar ve paylaşılmış bağlantılar        │
 * │ çalışmaya devam ediyor ve SEO değeri yeni adrese taşınıyor.│
 * └──────────────────────────────────────────────────────────────┘
 */
export function serviceHref(locale: Locale, key: ServiceKey): string {
  return `/${locale}/${serviceSlugs[key][locale]}`;
}

/**
 * Bir yol parçası hizmet adresi mi?
 *
 * Middleware ve rota çözümü bunu kullanıyor; hizmet slug'ları
 * artık kökte olduğu için kategori/şehir adresleriyle
 * karışmaması gerekiyor.
 */
export function isServiceSlug(slug: string): boolean {
  for (const key of Object.keys(serviceSlugs) as ServiceKey[]) {
    if ((Object.values(serviceSlugs[key]) as string[]).includes(slug)) return true;
  }
  return false;
}

/** "hava-durumu" → "weather"; tanınmazsa null */
export function serviceFromSlug(locale: Locale, slug: string): ServiceKey | null {
  for (const key of Object.keys(serviceSlugs) as ServiceKey[]) {
    if (serviceSlugs[key][locale] === slug) return key;
    // Başka dilin yazımıyla gelen adresi de kabul et (paylaşılan bağlantı)
    if ((Object.values(serviceSlugs[key]) as string[]).includes(slug)) return key;
  }
  return null;
}

/** "haber" → "news" (middleware bunu kullanır) */
export function canonicalFromLocalized(
  locale: Locale,
  seg: string,
): CanonicalSegment | null {
  for (const key of Object.keys(segments) as CanonicalSegment[]) {
    if (segments[key][locale] === seg) return key;
  }
  return null;
}

/**
 * Uygulama içinde link üretmenin TEK yolu.
 * Elle string birleştirme yapma; dil ön ekini burası hallediyor.
 */
/*
 * ⚠ KATEGORİ VE ŞEHİR ÖNEKSİZ.
 *
 * Eskiden `/kategori/egitim` ve `/sehir/bursa` idi. Artık
 * doğrudan `/egitim` ve `/bursa` — daha kısa, paylaşılabilir
 * ve arama motorları için daha iyi.
 *
 * Yönlendirme middleware'de yapılıyor: gelen adresin kategori
 * mi şehir mi olduğu, veritabanından alınan ve bellekte
 * tutulan haritadan bakılıyor.
 */
const ONEKSIZ: readonly string[] = ["category", "city"];

export function href(
  locale: Locale,
  seg: CanonicalSegment | "home",
  slug?: string,
): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  if (seg === "home") return prefix || "/";

  if (slug && ONEKSIZ.includes(seg)) {
    return `${prefix}/${slug}`;
  }

  const s = segments[seg][locale];
  return slug ? `${prefix}/${s}/${slug}` : `${prefix}/${s}`;
}

/**
 * Haberin adresi — kategori altında.
 *
 * `/haber/deprem` yerine `/asayis/deprem`. Okur adrese bakınca
 * haberin hangi bölümde olduğunu görüyor.
 *
 * ⚠ Kategori yoksa eski biçime düşülüyor. Kategorisiz haber
 * nadir ama var; adresi kırmak yerine `/haber/slug` kalıyor
 * ve middleware onu da tanıyor.
 */
export function haberYolu(
  locale: Locale,
  slug: string,
  kategoriSlug?: string | null,
): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  if (kategoriSlug) return `${prefix}/${kategoriSlug}/${slug}`;
  return `${prefix}/${segments.news[locale]}/${slug}`;
}

/** Aynı sayfanın başka dildeki karşılığı (dil seçici için) */
export function switchLocalePath(
  target: Locale,
  seg: CanonicalSegment | "home",
  slug?: string,
): string {
  return href(target, seg, slug);
}

/**
 * Next 15'te dinamik segmentler `string` olarak gelir; union tipe
 * doğrudan atanamaz. Sayfalar ham değeri buradan geçirir: geçerliyse
 * daraltılmış Locale döner, değilse varsayılana düşer (404'ü sayfanın
 * kendi içeriği verir, dil yüzünden 404 atmak yanlış olurdu).
 */
export function assertLocale(value: string): Locale {
  return (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : defaultLocale;
}


/**
 * Yazar ve yayıncı sayfalarının adresi.
 *
 * ⚠ Bu iki segment dile göre DEĞİŞMİYOR — her dilde `yazar` ve
 * `yayinci`. Ama dil öneki kuralı aynı: varsayılan dilde önek
 * yok. Elle `/${locale}/yayinci/...` yazınca `tr` için
 * `/tr/yayinci/...` çıkıyor ve o adres tanınmıyordu.
 */
export function profilYolu(
  locale: Locale,
  tur: "yazar" | "yayinci",
  slug: string,
): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/${tur}/${slug}`;
}
