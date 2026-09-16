import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { SiteSettings, NavItem, CityRow } from "@/lib/types";
import { navByLocation } from "@/lib/settings";
import { assetUrl } from "@/lib/media";
import { fetchQuotes } from "@/lib/markets";
import { demoQuotes } from "@/lib/demo";
import TickerBar from "./TickerBar";
import HeaderTools from "./HeaderTools";
import ProgressBar from "./ProgressBar";
import { navLabel, navHref } from "./NavLink";
import { getKategoriAdlari } from "@/lib/queries";
import NavPills from "./NavPills";
import HeaderDaralt from "./HeaderDaralt";
import Link from "next/link";
/**
 * Header — prototipteki yapının birebir karşılığı.
 *
 * Sıra: ilerleme çubuğu → piyasa şeridi → üst bar (logo, menü,
 * araçlar) → şehir şeridi (masaüstü) → menü pilleri (mobil).
 *
 * Server Component: menü, logo ve piyasa verisi sunucuda çözülür;
 * tarayıcıya yalnızca etkileşimli parçalar iner.
 */
/**
 * Header satırları TAM GENİŞLİK.
 *
 * Gövde içeriği %70'e sınırlı ama header bu sınıra tabi değil:
 * menü, şehir şeridi ve piyasa şeridi ekranın tamamını kullanır.
 */
const ROW: React.CSSProperties = { maxWidth: "var(--max-head)", marginInline: "auto", width: "100%" };
export default async function Header({
  locale, dict, settings, nav, cities, active,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  nav: NavItem[];
  cities: CityRow[];
  active?: string;
}) {
  const items = navByLocation(nav, "header");
  let quotes = settings.markets_enabled && settings.ticker_enabled
    ? await fetchQuotes(settings.ticker_symbols)
    : [];
  // Sağlayıcı yanıt vermezse: demo modunda örnek değerler,
  // yayında şerit hiç gösterilmez (uydurma fiyat göstermeyiz).
  if (settings.ticker_enabled && quotes.length === 0 && settings.demo_mode) {
    quotes = demoQuotes;
  }
  const stripCities = settings.city_strip_slugs.length
    ? cities.filter((c) => settings.city_strip_slugs.includes(c.slug))
    : cities;
  /* Kategori adlarının çevirileri — menüde dile göre değişiyor */
  const kategoriAdlari = await getKategoriAdlari();

  const logoLight = assetUrl(settings.logo_light_key);
  const logoDark = assetUrl(settings.logo_dark_key);
  return (
    <header
      style={{
        position: settings.header_sticky ? "sticky" : "static",
        top: 0,
        zIndex: 60,
        background: "color-mix(in srgb, var(--bg) 80%, transparent)",
        backdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid var(--bd)",
      }}
    >
      <HeaderDaralt />
      {settings.header_progress_bar && <ProgressBar />}
      {/*
        Borsa şeridi — kaydırınca kapanıyor.
        `data-daralan` işaretini CSS okuyor; JS yükseklik
        hesaplamıyor, geçiş GPU'da yapılıyor.
      */}
      <div data-daralan>
        <div style={ROW}>
          {quotes.length > 0 && (
            <TickerBar quotes={quotes} speedSec={settings.ticker_speed_sec} locale={locale} />
          )}
        </div>
      </div>
      {/* ---- üst bar ---- */}
      <div
        data-topbar
        style={{
          ...ROW,
          /*
            ⚠ TEK SATIR, SARMA YOK.

            `flexWrap: "wrap"` vardı: dar ekranda içerik ikinci
            satıra taşıyor, header aşağı doğru büyüyor ve dikey
            denge bozuluyordu. Kaydırma modunda şeritler
            kapanınca kalan boşluk da buradan geliyordu.

            Artık sabit yükseklik: üstte ve altta tam olarak
            aynı boşluk kalıyor. Sığmayan öğeler kendi içinde
            kısalıyor (logo ve araçlar `flexShrink: 0`).
          */
          display: "flex", flexWrap: "nowrap", alignItems: "center",
          gap: 14, paddingInline: "var(--gut)", paddingBlock: 0,
          /*
           * Yükseklik CSS değişkeninden geliyor: kaydırma
           * modunda daha kısa oluyor (52 → 48) ve header daha
           * az yer kaplıyor. Satır içi sabit sayı verseydik
           * o davranış mümkün olmazdı.
           */
          height: "var(--topbar-h)",
        }}
      >
        <Link
          href={href(locale, "home")}
          aria-label={settings.site_name}
          style={{ display: "flex", alignItems: "center", flexShrink: 0, height: 28 }}
        >
          {logoLight || logoDark ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-logo-light
                src={logoLight ?? logoDark!}
                alt={settings.site_name}
                style={{ height: 26, width: "auto" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-logo-dark
                src={logoDark ?? logoLight!}
                alt={settings.site_name}
                style={{ height: 26, width: "auto" }}
              />
            </>
          ) : (
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.04em", color: "var(--tx)" }}>
              {settings.site_name}
            </span>
          )}
        </Link>
        {/*
          Aktif sekme adres çubuğundan bulunuyor — sayfaların
          `active` göndermesine gerek yok.
        */}
        <NavPills items={items} locale={locale} dict={dict} kategoriAdlari={kategoriAdlari} />
        <HeaderTools
          locale={locale}
          dict={dict}
          settings={settings}
          nav={nav}
          cities={stripCities}
          kategoriAdlari={kategoriAdlari}
        />
      </div>
      {/* ---- şehir şeridi (masaüstü) ---- */}
      {settings.city_strip_enabled && stripCities.length > 0 && (
        <div data-only="desktop" data-daralan style={{ borderTop: "1px solid var(--bd)" }}>
        <div
          data-hide-sb
          style={{
            ...ROW,
            display: "flex", gap: 22, overflowX: "auto", overflowY: "hidden",
            alignItems: "center", padding: "9px var(--gut) 12px",
          }}
        >
          {stripCities.map((c) => (
            <Link
              key={c.id}
              href={href(locale, "city", c.slug)}
              style={{
                flex: "1 1 auto", minWidth: "max-content",
                fontSize: 13, fontWeight: 500, color: "var(--mu)",
                whiteSpace: "nowrap", textAlign: "center",
              }}
            >
              {c.name}
            </Link>
          ))}
          <Link
            href={href(locale, "city")}
            style={{
              flex: "1 1 auto", minWidth: "max-content", color: "var(--ac)",
              fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", textAlign: "center",
            }}
          >
            {dict.nav.allCities} →
          </Link>
        </div>
        </div>
      )}
      {/* ---- menü pilleri (mobil) — kaydırınca kapanır ---- */}
      {/*
        ⚠ İKİ KATMAN ŞART.
        Kapanma `display: grid` ile yapılıyor. Bu öğede satır içi
        `display: flex` vardı ve grid'i eziyordu — şerit hiç
        kapanmıyor, header yüksekliği aynı kalıyordu. Dıştaki
        katman kapanmayı, içteki yerleşimi yapıyor.
      */}
      <div data-only="mobile" data-daralan>
      <div
        data-hide-sb
        style={{
          ...ROW,
          display: "flex", gap: 7, overflowX: "auto", alignItems: "center",
          padding: "8px var(--gut) 9px",
        }}
      >
        {/*
          ⚠ MASAÜSTÜ MENÜSÜNÜN AYNISI.

          Burada `navByLocation(nav, "mobile")` kullanılıyordu:
          panelde ayrı bir "mobil" listesi tutuluyor ve o liste
          masaüstündekinden farklı doldurulmuş olabiliyordu.
          Sonuç, aynı sitenin iki farklı menüsü — üstelik mobil
          liste boş kalırsa sessizce masaüstüne düşüyor, dolu
          ama eksikse fark edilmiyordu.

          Artık her iki yerde de `items` (header listesi)
          kullanılıyor; menü tek kaynaktan geliyor.
        */}
        {items.map((item) => {
          const on =
            (item.kind === "home" && !active) || active === item.target_slug || active === item.kind;
          return (
            <Link
              key={`m-${item.id}`}
              href={navHref(item, locale)}
              style={{
                padding: "7px 14px", borderRadius: 999, fontSize: 13.5, fontWeight: 700,
                background: on ? "var(--s2)" : "transparent",
                color: on ? "var(--tx)" : "var(--mu)",
                whiteSpace: "nowrap", flexShrink: 0, minHeight: 34,
                display: "flex", alignItems: "center",
              }}
            >
              {navLabel(item, locale, dict, kategoriAdlari)}
            </Link>
          );
        })}
        <Link
          href={href(locale, "city")}
          style={{
            fontSize: 13.5, fontWeight: 700, color: "var(--mu)",
            whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center",
          }}
        >
          {dict.common.city}
        </Link>

        {/*
          Yazarlarımız — masaüstü menüsüyle aynı, şeridin sonunda.
          `nav` listesine bırakılsaydı eklenmesi unutulduğunda
          sayfa menüden erişilemez kalırdı.
        */}
        <Link
          href={href(locale, "yazarlar")}
          style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 13.5,
            fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
            background: "var(--s2)", color: "var(--tx)",
            textDecoration: "none",
          }}
        >
          {dict.footer?.authors ?? "Yazarlarımız"}
        </Link>
      </div>
      </div>
    </header>
  );
}