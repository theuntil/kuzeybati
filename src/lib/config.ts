/**
 * ÇALIŞMA ANINDA YAPILANDIRMA
 *
 * `NEXT_PUBLIC_*` değişkenleri Next.js tarafından DERLEME anında
 * koda gömülür. Docker'da bu iki sorun çıkarır:
 *
 *   • Dokploy compose-interpolation sırasında değişkeni her zaman
 *     vermez → "variable is not set" → BOŞ değer imaja gömülür ve
 *     site sessizce Supabase'e bağlanamaz
 *   • Değer değişince imajı yeniden derlemek gerekir
 *
 * Panelde (kuzeybati-admin) bu sorun `window.__KB_CONFIG` ile
 * çözülmüştü; site tarafında aynısı yapılmamıştı. Bu dosya onu
 * kapatıyor.
 *
 * Bu modül İZOMORFİKTİR — hem sunucu hem tarayıcı tarafında
 * import edilebilir:
 *   • tarayıcıda  → sayfaya gömülen `window.__KB_CONFIG`
 *   • sunucuda    → ortam değişkenleri (önek YOK, runtime okunur)
 *
 * Geriye dönük uyum: `NEXT_PUBLIC_*` hâlâ yedek olarak okunuyor,
 * yani mevcut .env dosyaları bozulmadan çalışmaya devam eder.
 */
export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  cdnBase: string;
}

declare global {
  interface Window {
    __KB_CONFIG?: PublicConfig;
  }
}

const strip = (s: string) => s.replace(/\/+$/, "");

/** Ortam değişkenini güvenle oku — tarayıcıda `process` olmayabilir. */
function fromEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name] || undefined;
}

export function publicConfig(): PublicConfig {
  // Tarayıcı: sunucunun gömdüğü değer kesin doğrudur.
  if (typeof window !== "undefined" && window.__KB_CONFIG) {
    return window.__KB_CONFIG;
  }

  return {
    supabaseUrl: strip(
      fromEnv("SUPABASE_URL") ?? fromEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "",
    ),
    supabaseAnonKey:
      fromEnv("SUPABASE_ANON_KEY") ?? fromEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "",
    siteUrl: strip(
      fromEnv("SITE_URL") ??
        fromEnv("NEXT_PUBLIC_SITE_URL") ??
        "https://kuzeybatihaber.com.tr",
    ),
    cdnBase: strip(
      fromEnv("CDN_BASE") ??
        fromEnv("NEXT_PUBLIC_CDN_BASE") ??
        "https://medya.kuzeybatihaber.com.tr",
    ),
  };
}

/**
 * Sayfaya gömülecek script gövdesi.
 *
 * Yalnızca ANON anahtar taşınır — zaten herkese açık bir değerdir
 * ve RLS koruması ona göre kurulmuştur. `service_role` bu pakette
 * hiç bulunmaz.
 *
 * DERLEME SIRASINDA FIRLATMA: Next.js statik sayfaları üretirken
 * ortam değişkenleri henüz verilmemiş olabilir. Eksik değer boş
 * dize olarak geçer; gerçek hata istemci bağlanmaya çalıştığında
 * anlaşılır bir mesajla verilir.
 */
export function configScript(): string {
  const c = publicConfig();
  return `window.__KB_CONFIG=${JSON.stringify(c)};`;
}
