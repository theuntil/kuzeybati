import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { SiteSettings, NavItem } from "@/lib/types";
import { navByLocation } from "@/lib/settings";
import { navLabel, navHref } from "./NavLink";
import { assetUrl } from "@/lib/media";
import SosyalBaglantilar from "./SosyalBaglantilar";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/*
 * ⚠ GİZLİLİK VE KULLANIM ŞARTLARI BURADAN ÇIKARILDI.
 *
 * O metinler artık `policies` tablosunda — sürümlü ve onay
 * takipli. Footer'daki "Politikalar" bağlantısı hepsini
 * listeliyor. Burada da durmaları aynı içeriğin iki ayrı
 * adresten açılması demekti: `/sayfa/gizlilik` (eski, sürümsüz)
 * ve `/politikalar/gizlilik` (yeni). Arama motoru için
 * yinelenen içerik, okur için kafa karışıklığı.
 */
const CORPORATE: { slug: string; label: Record<string, string> }[] = [
  { slug: "hakkimizda", label: { tr: "Hakkımızda", en: "About", ar: "من نحن", ru: "О нас" } },
  { slug: "kunye", label: { tr: "Künye", en: "Imprint", ar: "بيانات الناشر", ru: "Выходные данные" } },
  { slug: "iletisim", label: { tr: "İletişim", en: "Contact", ar: "اتصل بنا", ru: "Контакты" } },
  { slug: "reklam", label: { tr: "Reklam", en: "Advertise", ar: "إعلن معنا", ru: "Реклама" } },
];

/** Prototipteki footer: tek satır bağlantı dizisi + telif */
export default function Footer({
  locale, dict, settings, nav,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  nav: NavItem[];
}) {
  const items = navByLocation(nav, "footer");

  /*
   * MAĞAZA BAĞLANTILARI
   *
   * ⚠ YALNIZCA DOLU OLANLAR.
   * Panelden girilmemiş mağazanın kartı basılmıyor; boş bir
   * düğme kullanıcıyı hiçbir yere götürmez ve güven kaybettirir.
   * Üçü de boşsa şerit tamamen gizleniyor.
   */
  const magazalar = ([
    {
      ad: "App Store", alt: "iPhone ve iPad",
      url: settings.app_store_url,
      rozet: settings.app_store_badge_key,
    },
    {
      ad: "Google Play", alt: "Android",
      url: settings.play_store_url,
      rozet: settings.play_store_badge_key,
    },
    {
      ad: "AppGallery", alt: "Huawei",
      url: settings.app_gallery_url,
      rozet: settings.app_gallery_badge_key,
    },
  ] as const).filter((m) => m.url);

  /*
   * WHATSAPP İHBAR HATTI
   *
   * ⚠ NUMARA İKİ KAYNAKTAN.
   * Öncelik `sosyal_whatsapp`; yalnızca telefon girilmişse
   * `contact_phone` kullanılıyor. İkisi de boşsa kart çıkmıyor.
   *
   * `wa.me` yalnızca rakam kabul ediyor — boşluk, parantez ve
   * tire temizleniyor. Baştaki 0 atılıp 90 ekleniyor; yoksa
   * bağlantı yurt dışından açılmıyor.
   */
  const waHam = (settings.sosyal_whatsapp ?? settings.contact_phone ?? "").trim();
  const waRakam = waHam.replace(/[^0-9]/g, "");
  const waNumara = waRakam
    ? (waRakam.startsWith("90") ? waRakam
       : waRakam.startsWith("0") ? `90${waRakam.slice(1)}`
       : `90${waRakam}`)
    : null;

  /* Ekranda gösterilecek okunur biçim */
  /*
   * ⚠ EKRANDA `90` ÖNEKİ GÖSTERİLMİYOR.
   * `wa.me` bağlantısı ülke koduyla çalışmak zorunda ama okur
   * numarayı yerel biçimde tanıyor: 0533… Gösterim ve bağlantı
   * ayrı tutuluyor.
   */
  const waGosterim = (() => {
    const r = waRakam.startsWith("90") ? waRakam.slice(2) : waRakam;
    const yerel = r.startsWith("0") ? r : `0${r}`;
    /* 0533 443 49 78 biçimi */
    return yerel.length === 11
      ? `${yerel.slice(0, 4)} ${yerel.slice(4, 7)} ${yerel.slice(7, 9)} ${yerel.slice(9)}`
      : yerel;
  })();

  return (
    <footer style={{ borderTop: "1px solid var(--bd)", marginTop: 40 }}>
      {/*
        UYGULAMA ŞERİDİ

        ⚠ MASAÜSTÜNDE YATAY, MOBİLDE ALT ALTA.
        Yan yana üç geniş kart footer'ın yarısını kaplıyordu;
        alt alta dizince de masaüstünde gereksiz uzuyordu.
        Şimdi kartlar küçük ve `flex-wrap` ile geniş ekranda
        yan yana, dar ekranda alt alta geçiyor.
      */}
      {(magazalar.length > 0 || waNumara) && (
        <div style={{
          maxWidth: "var(--max-head)", marginInline: "auto",
          padding: "22px var(--gut) 0",
        }}>
          <div className="kb-footer-kartlar" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {magazalar.map((m) => {
              const r = assetUrl(m.rozet);
              return (
                <a
                  key={m.ad}
                  href={m.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 13px", borderRadius: 12,
                    background: "var(--s1)", border: "1px solid var(--bd)",
                    textDecoration: "none", color: "var(--tx)",
                    flex: "0 1 auto",
                  }}
                >
                  <span style={{
                    display: "grid", placeItems: "center",
                    height: 22, minWidth: 22, flexShrink: 0,
                  }}>
                    {r ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r} alt="" style={{ height: 22, width: "auto", display: "block" }} />
                    ) : (
                      <Icon name="grid" size={16} />
                    )}
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <span style={{
                      display: "block", fontSize: 12.5, fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>
                      {m.ad}
                    </span>
                    <span style={{
                      display: "block", fontSize: 11, color: "var(--mu)", marginTop: 1,
                      whiteSpace: "nowrap",
                    }}>
                      {m.alt}
                    </span>
                  </span>
                </a>
              );
            })}

            {/*
              İHBAR HATTI

              ⚠ MASAÜSTÜNDE EN SONDA, MOBİLDE EN ÜSTTE.
              Mağaza kartlarıyla aynı ölçüde. Mobilde okur
              footer'a indiğinde ilk bunu görsün diye sıra
              CSS ile ters çevriliyor (`order`).
            */}
            {waNumara && (
              <a
                href={`https://wa.me/${waNumara}`}
                target="_blank"
                rel="noopener noreferrer"
                className="kb-footer-wa"
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 13px", borderRadius: 12,
                  background: "var(--s1)", border: "1px solid var(--bd)",
                  textDecoration: "none", color: "var(--tx)",
                  flex: "0 1 auto",
                }}
              >
                {/*
                  ⚠ İKİ AYRI DÜZEN.

                  Masaüstü: mağaza kartlarıyla birebir aynı —
                  solda ikon, sağda "WhatsApp", altında numara.
                  "İhbar hattı" yazısı kartı diğerlerinden geniş
                  yapıyordu.

                  Mobil: ikon ve etiket üstte, numara altta büyük
                  ve ortalı (CSS ile).
                */}
                <span className="kb-wa-ikon" style={{
                  display: "grid", placeItems: "center",
                  height: 22, minWidth: 22, flexShrink: 0,
                  color: "#25D366",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden>
                    <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.5A8.4 8.4 0 1 1 20.5 11.6z" />
                  </svg>
                </span>

                <span className="kb-wa-metin" style={{ minWidth: 0 }}>
                  <span className="kb-wa-etiket" style={{
                    display: "block", fontSize: 12.5, fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}>
                    WhatsApp
                  </span>
                  {/*
                    ⚠ NUMARA YEŞİL — ETİKET NORMAL METİN RENGİ.
                    Numara gri (`--mu`) idi ve ikincil bilgi gibi
                    duruyordu; ihbar hattında asıl aranan o.
                  */}
                  <span className="kb-wa-numara" style={{
                    display: "block", fontSize: 11, color: "#25D366",
                    fontWeight: 700, marginTop: 1, whiteSpace: "nowrap",
                  }}>
                    {waGosterim}
                  </span>
                </span>
              </a>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: "var(--max-head)", marginInline: "auto",
          padding: "18px var(--gut) 22px",
        }}
        className="kb-footer-alt"
      >
        {/*
          ⚠ SOSYAL DÜĞMELER BAĞLANTILARIN BAŞINDA.
          Ayrı bir şerit olarak üstte duruyordu; footer üç
          katmanlı görünüyordu. Masaüstünde aynı satırın
          başına alındı, mobilde bağlantıların ALTINA
          geçiyor (CSS ile).
        */}
        <div className="kb-footer-sosyal">
          <SosyalBaglantilar settings={settings} boyut={32} />
        </div>

        <div className="kb-footer-linkler">
      {items.length
        ? items.map((i) => (
            <Link key={i.id} href={navHref(i, locale)} style={{ color: "var(--mu)" }}>
              {navLabel(i, locale, dict)}
            </Link>
          ))
        : CORPORATE.map((c) => (
            <Link
              key={c.slug}
              href={href(locale, "page", c.slug)}
              style={{ color: "var(--mu)" }}
            >
              {c.label[locale] ?? c.label.tr}
            </Link>
          ))}

      {/*
        ⚠ POLİTİKALAR VE YAZARLAR SABİT.
        Bunlar panelden yönetilen içeriğe açılan iki liste
        sayfası; `nav_items`'a bırakılsaydı yönetici silmeyi
        unutunca ya da eklemeyi atlayınca yasal metinlere
        erişim tamamen kapanabilirdi.
      */}
      <Link href={href(locale, "politikalar")} style={{ color: "var(--mu)" }}>
        {dict.footer?.policies ?? "Politikalar"}
      </Link>
      <Link href={href(locale, "yazarlar")} style={{ color: "var(--mu)" }}>
        {dict.footer?.authors ?? "Yazarlarımız"}
      </Link>

        </div>

        <span className="kb-footer-telif">
          © {new Date().getFullYear()} {settings.site_name}
        </span>
      </div>
    </footer>
  );
}
