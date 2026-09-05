import type { SiteSettings } from "@/lib/types";

/* ══════════════════════════════════════════════════════════════
   SOSYAL HESAP DÜĞMELERİ

   ┌─ TEK KAYNAK, ÜÇ YER ⚠️ ───────────────────────────────────┐
   │ Aynı liste footer'da, Hakkımızda'da ve İletişim'de        │
   │ kullanılıyor. Panelden bir hesap eklendiğinde üçünde       │
   │ birden çıkıyor — üç ayrı yerde elle güncelleme yok.        │
   │                                                              │
   │ ⚠ BOŞ HESAP BASILMIYOR. Doldurulmamış bir platformun      │
   │ düğmesi hiçbir yere gitmez ve güven kaybettirir.           │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

type Hesap = { alan: keyof SiteSettings; ad: string; yol: string };

/*
 * Her platformun kendi simgesi — `Icon` bileşeninde marka
 * ikonları yok, bu yüzden satır içi SVG kullanılıyor.
 */
const SIMGELER: Record<string, React.ReactNode> = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: (
    <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h3l1-4h-4V7.5a1 1 0 0 1 1-1H16V3z" />
  ),
  x: (
    <path d="M3 3l7.5 9.8L3.4 21h2.2l5.8-6.6L16.5 21H21l-7.9-10.3L20.6 3h-2.2l-5.3 6.1L8.5 3H3z"
      fill="currentColor" stroke="none" />
  ),
  youtube: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="4.5" />
      <path d="M10.2 9.2v5.6l4.8-2.8-4.8-2.8z" fill="currentColor" stroke="none" />
    </>
  ),
  linkedin: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" />
      <path d="M7 10v7M7 7v.01M11.5 17v-3.8a2.2 2.2 0 0 1 4.4 0V17" />
    </>
  ),
  tiktok: (
    <path d="M15 3v9.6a3.4 3.4 0 1 1-2.8-3.35M15 3a4.6 4.6 0 0 0 4.4 4.4" />
  ),
  whatsapp: (
    <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.5A8.4 8.4 0 1 1 20.5 11.6z" />
  ),
  telegram: (
    <path d="M21.5 4.3 2.9 11.4c-.9.35-.9.9-.15 1.1l4.6 1.45 1.75 5.35c.2.55.4.55.8.2l2.2-2.05 4.55 3.35c.85.45 1.45.2 1.65-.75l3-14.05c.3-1.15-.45-1.7-1.3-1.35z" />
  ),
};

const HESAPLAR: Hesap[] = [
  { alan: "sosyal_instagram" as keyof SiteSettings, ad: "Instagram", yol: "instagram" },
  { alan: "sosyal_x" as keyof SiteSettings,         ad: "X",         yol: "x" },
  { alan: "sosyal_facebook" as keyof SiteSettings,  ad: "Facebook",  yol: "facebook" },
  { alan: "sosyal_youtube" as keyof SiteSettings,   ad: "YouTube",   yol: "youtube" },
  { alan: "sosyal_tiktok" as keyof SiteSettings,    ad: "TikTok",    yol: "tiktok" },
  { alan: "sosyal_linkedin" as keyof SiteSettings,  ad: "LinkedIn",  yol: "linkedin" },
  { alan: "sosyal_whatsapp" as keyof SiteSettings,  ad: "WhatsApp",  yol: "whatsapp" },
  { alan: "sosyal_telegram" as keyof SiteSettings,  ad: "Telegram",  yol: "telegram" },
];

/** Platform başına, kullanıcı adı girildiğinde kullanılacak taban */
const TABAN: Record<string, string> = {
  instagram: "https://instagram.com/",
  x:         "https://x.com/",
  facebook:  "https://facebook.com/",
  youtube:   "https://youtube.com/@",
  tiktok:    "https://tiktok.com/@",
  linkedin:  "https://linkedin.com/company/",
  whatsapp:  "https://wa.me/",
  telegram:  "https://t.me/",
};

/**
 * Panelden gelen değeri gerçek bir adrese çevirir.
 *
 * ┌─ SOSYAL DÜĞMELER SİTENİN İÇİNE GİDİYORDU ⚠️ ──────────────┐
 * │ Panele `instagram.com/hesap` ya da `@hesap` yazıldığında  │
 * │ değer olduğu gibi `href`e konuyordu. Başında `https://`   │
 * │ olmayan bir adres tarayıcı için GÖRECELİ YOL demek; link  │
 * │ `site.com/yazar/instagram.com/hesap` gibi bir yere        │
 * │ gidiyordu.                                                  │
 * │                                                              │
 * │ Üç biçim de kabul ediliyor:                                │
 * │   https://instagram.com/hesap  → olduğu gibi               │
 * │   instagram.com/hesap          → başına https:// ekleniyor │
 * │   @hesap  ya da  hesap         → platform tabanı ekleniyor │
 * └──────────────────────────────────────────────────────────────┘
 */
function adresle(ham: string, yol: string): string | null {
  const v = ham.trim();
  if (!v) return null;

  /* Tam adres — olduğu gibi */
  if (/^https?:\/\//i.test(v)) return v;

  /*
   * Alan adı yazılmış ama şema yok.
   * Nokta içeriyor ve boşluk yoksa alan adı sayılıyor.
   */
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(v)) return `https://${v}`;

  /* Kullanıcı adı — baştaki @ ve / temizlenip tabana ekleniyor */
  const kullanici = v.replace(/^[@/]+/, "");
  if (!kullanici) return null;

  const taban = TABAN[yol];
  return taban ? `${taban}${kullanici}` : null;
}

export default function SosyalBaglantilar({
  settings, boyut = 36,
}: {
  settings: SiteSettings;
  boyut?: number;
}) {
  const s = settings as SiteSettings & Record<string, string | null>;

  const dolu = HESAPLAR
    .map((h) => ({ ...h, url: adresle(s[h.alan as string] ?? "", h.yol) }))
    .filter((h): h is typeof h & { url: string } => h.url !== null);

  if (dolu.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {dolu.map((h) => (
        <a
          key={h.yol}
          href={h.url}
          target="_blank"
          rel="noopener noreferrer"
          title={h.ad}
          aria-label={h.ad}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: boyut, height: boyut, borderRadius: "50%",
            background: "var(--s2)", border: "1px solid var(--bd)",
            color: "var(--tx)", flexShrink: 0,
          }}
        >
          <svg
            width={Math.round(boyut * 0.46)}
            height={Math.round(boyut * 0.46)}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {SIMGELER[h.yol]}
          </svg>
        </a>
      ))}
    </div>
  );
}
