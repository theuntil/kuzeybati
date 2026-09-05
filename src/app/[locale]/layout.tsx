import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { locales, isRtl, localeTags, type Locale, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getSiteSettings, getNav } from "@/lib/settings";
import { createAuthedClient } from "@/lib/supabase/server";
import { getTopCities, getCityOptions } from "@/lib/queries";
import { headers } from "next/headers";
import { getSelectedCitySlug, DEFAULT_CITY } from "@/lib/city";
import ToastProvider from "@/components/ui/Toast";
import CityProvider from "@/components/site/CityProvider";
import { demoNav, demoCities } from "@/lib/demo";
import { assetUrl } from "@/lib/media";
import { publicConfig, configScript } from "@/lib/config";
import Header from "@/components/site/Header";
import { Suspense } from "react";
import SayfaTakip from "@/components/SayfaTakip";
import { CocukModuSaglayici } from "@/components/site/CocukModu";
import { GirisSaglayici } from "@/components/auth/GirisPenceresi";
import Footer from "@/components/site/Footer";
import MobileTabBar from "@/components/site/MobileTabBar";
import ThemeScript from "@/components/site/ThemeScript";
import FontFaces from "@/components/site/FontFaces";
import Maintenance from "@/components/site/Maintenance";
import "../globals.css";
import SehirSenkron from "@/components/site/SehirSenkron";
import KaydirmaSifirla from "@/components/site/KaydirmaSifirla";

export const revalidate = 60;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/*
 * ┌─ TARAYICI ÇUBUĞU DA YANLIŞ RENKTEYDİ ⚠️ ───────────────────┐
 * │ `themeColor` sabit bir liste olduğu için yalnızca İŞLETİM │
 * │ SİSTEMİ tercihine bakıyordu. Sistemi koyu olup siteyi      │
 * │ açık kullanan okurda mobil adres çubuğu koyu kalıyor,     │
 * │ sayfa açıkken üstte koyu bir şerit duruyordu.              │
 * │                                                              │
 * │ Artık çerezdeki tema okunuyor; çerez yoksa eski davranışa │
 * │ dönülüyor (sistem tercihi) — o da doğru varsayım.         │
 * └──────────────────────────────────────────────────────────────┘
 */
export async function generateViewport(): Promise<Viewport> {
  const kutu = await cookies();
  const c = kutu.get("kb-theme")?.value;

  const themeColor =
    c === "light" ? "#FFFFFF"
    : c === "dark" ? "#0F0F0F"
    : [
        { media: "(prefers-color-scheme: dark)", color: "#0F0F0F" },
        { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
      ];

  return { themeColor, width: "device-width", initialScale: 1 };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  const s = await getSiteSettings();
  const base = publicConfig().siteUrl;

  return {
    metadataBase: new URL(base),
    title: { default: s.site_name, template: `%s${s.seo_title_suffix}` },
    description: s.seo_description ?? s.site_tagline ?? undefined,
    /*
     * Favicon — koyu tema için ayrı dosya verilebiliyor.
     * `media` sorgusu tarayıcıya hangisini kullanacağını
     * söylüyor; koyu sürüm yoksa tek dosya her ikisinde kalıyor.
     */
    icons: s.favicon_key
      ? {
          icon: [
            { url: assetUrl(s.favicon_key)!, media: "(prefers-color-scheme: light)" },
            {
              url: assetUrl(s.favicon_dark_key ?? s.favicon_key)!,
              media: "(prefers-color-scheme: dark)",
            },
          ],
        }
      : undefined,
    openGraph: {
      siteName: s.site_name,
      locale: localeTags[locale],
      type: "website",
      images: s.og_image_key ? [assetUrl(s.og_image_key)!] : undefined,
    },
    robots: s.maintenance_mode ? { index: false, follow: false } : undefined,
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [localeTags[l], l === "tr" ? base : `${base}/${l}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  if (!locales.includes(locale)) notFound();

  /**
   * Giriş/kayıt/hesap ekranlarında header ve footer gizlenir.
   * İşareti middleware koyuyor; burada yalnızca okunuyor.
   */
  const h = await headers();
  const bare = h.get("x-kb-bare") === "1";
  /** Panelde header var, footer yok */
  const panel = h.get("x-kb-panel") === "1";

  const [settings, dict, navRows, cityRows, cityOptions, citySlug] = await Promise.all([
    getSiteSettings(),
    getDictionary(locale),
    getNav(),
    getTopCities(14),
    getCityOptions(),
    getSelectedCitySlug(),
  ]);

  /**
   * Menü ve şehir şeridi.
   *
   * `nav_items` boşsa header çıplak kalır. Bu YAPILANDIRMA eksikliği,
   * içerik eksikliği değil — o yüzden demo modundan bağımsız olarak
   * varsayılan menü gösterilir. Panelden bir kayıt girildiği an
   * tamamen devre dışı kalır.
   */
  const nav = navRows.length ? navRows : demoNav;
  const cities = cityRows.length ? cityRows : demoCities;

  const dir = isRtl(locale) ? "rtl" : "ltr";

  /*
   * ┌─ BAKIM MODU KİLİTLEMESİN ⚠️ ────────────────────────────┐
   * │ Eskiden bakım açılınca `<body>` tamamen bakım ekranıyla   │
   * │ değişiyordu — GİRİŞ SAYFASI DAHİL. Yönetici siteye giriş │
   * │ yapamıyor, dolayısıyla bakım modunu kapatamıyordu.       │
   * │ Tek çıkış SQL yazmaktı.                                    │
   * │                                                             │
   * │ İki kapı açık bırakıldı:                                   │
   * │   1. Kimlik sayfaları (giriş, kayıt, şifre) HER ZAMAN      │
   * │      çalışır — kilitli kalmanın önüne geçer.               │
   * │   2. Personel (editör/yönetici) gerçek siteyi görür;       │
   * │      üstte bir uyarı şeridi çıkar. Böylece düzeltmeyi      │
   * │      yayına almadan önce doğrulayabilir.                    │
   * └─────────────────────────────────────────────────────────────┘
   */
  /*
   * Kimlik sayfalarını middleware zaten işaretliyor (`x-kb-bare`):
   * login, signup, reset-password, complete-profile, verify-email.
   * Aynı listeyi burada tekrar yazmak, biri değişince diğerinin
   * unutulması demekti.
   */
  let personel = false;
  if (settings.maintenance_mode && settings.maintenance_bypass_staff) {
    try {
      const authed = await createAuthedClient();
      const { data } = await authed.from("my_profile").select("role").maybeSingle();
      const rol = (data?.role as string | undefined) ?? "";
      personel = rol === "admin" || rol === "editor" || rol === "author";
    } catch {
      // Oturum okunamadıysa ziyaretçi say — bakım ekranı gösterilir
      personel = false;
    }
  }

  const bakim = settings.maintenance_mode && !personel && !bare;

  /*
   * TEMA — SUNUCUDA BELİRLENİYOR
   *
   * ┌─ HER SAYFA GEÇİŞİNDE KOYU YANIP SÖNÜYORDU ⚠️ ─────────────┐
   * │ CSS varsayılanı koyu tema (`:root`), açık tema yalnızca    │
   * │ `[data-theme="light"]` ile geliyor. Bu attribute'ü de      │
   * │ `ThemeScript` tarayıcıda, localStorage okuyarak koyuyordu. │
   * │                                                              │
   * │ Yani sunucudan gelen HTML'de attribute HİÇ YOKTU: tarayıcı │
   * │ ilk baytları ayrıştırırken koyu temayı çiziyor, birkaç ms  │
   * │ sonra script çalışıp açığa çeviriyordu. Açık temadaki      │
   * │ kullanıcı her tam sayfa yüklemesinde siyah bir çakma       │
   * │ görüyordu.                                                   │
   * │                                                              │
   * │ Çözüm: tema çereze de yazılıyor ve sunucu onu okuyup       │
   * │ `<html data-theme>` olarak İLK BAYTA gömüyor. Script yine  │
   * │ duruyor — çerezi olmayan ilk ziyaretçi için.                │
   * └──────────────────────────────────────────────────────────────┘
   */
  const kutu = await cookies();
  const cerezTema = kutu.get("kb-theme")?.value;
  const tema = cerezTema === "light" || cerezTema === "dark" ? cerezTema : null;

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={tema ?? undefined}
      suppressHydrationWarning
    >
      <head>
        {/*
          ┌─ ASIL KOYU ÇAKMA BURADAN GELİYOR ⚠️ ──────────────────┐
          │ Stil dosyası inip uygulanana kadar tarayıcı sayfa    │
          │ tuvalini `color-scheme` değerine göre boyuyor.        │
          │                                                        │
          │ Geçen turda `content="light dark"` yazmıştım — yani  │
          │ "iki temayı da destekliyorum". Tarayıcı bu durumda   │
          │ İŞLETİM SİSTEMİ tercihine uyuyor. Sistemi KOYU olan  │
          │ ama siteyi AÇIK kullanan okur, CSS yüklenene kadar   │
          │ koyu bir tuval görüyordu. Sorunu çözmek yerine       │
          │ görünür hâle getirmişim.                              │
          │                                                        │
          │ Artık çerezden gelen tema doğrudan bildiriliyor:     │
          │ tarayıcı ilk milisaniyeden itibaren doğru rengi      │
          │ kullanıyor. Çerez yoksa sistem tercihi mantıklı      │
          │ varsayılan — CSS de aynı şeyi yapıyor, tutarlı.      │
          └────────────────────────────────────────────────────────┘
        */}
        <meta name="color-scheme" content={tema ?? "light dark"} />
        {/*
          ÇALIŞMA ANI YAPILANDIRMASI — en başta, her şeyden önce.

          Supabase adresi ve anon anahtarı sunucudan buraya gömülür;
          tarayıcı istemcisi `window.__KB_CONFIG` üzerinden okur.
          Böylece `NEXT_PUBLIC_*` derleme anında gömülmek zorunda
          kalmaz ve aynı Docker imajı her ortamda çalışır.

          Yalnızca ANON anahtar var — zaten herkese açık bir değer,
          RLS koruması ona göre kurulu. `service_role` bu pakette
          hiç bulunmaz.
        */}
        {/*
          ⚠ TEMA BETİĞİ HER ŞEYDEN ÖNCE.

          Önce yapılandırma betiği öndeydi. İkisi de senkron ama
          tarayıcı head'i sırayla işliyor: yapılandırma ne kadar
          büyükse tema o kadar geç uygulanıyor. Açık tema kullanan
          okur o aralıkta koyu bir çakma görüyordu.

          Tema ilk boyamayı doğrudan etkileyen tek şey, bu yüzden
          en başta duruyor.
        */}
        {/*
          ┌─ STİL DOSYASI İNENE KADARKİ BOŞLUK ⚠️ ────────────────┐
          │ Ana CSS ayrı bir dosya olarak iniyor. O gelene kadar │
          │ tarayıcının elinde renk yok; sayfanın zemini         │
          │ `color-scheme`e göre boyanıyor ve açık tema kullanan │
          │ okur koyu bir kare görebiliyordu.                     │
          │                                                        │
          │ Bu satır içi stil ilk baytta geliyor — indirme       │
          │ beklemiyor. Yalnızca ZEMİN ve YAZI rengini kuruyor;  │
          │ gerisini asıl dosya devralıyor.                       │
          │                                                        │
          │ ⚠ Yalnızca çerez varken basılıyor. Çerez yoksa       │
          │ tahmin yürütmek ters titremeye yol açardı; o durumu  │
          │ CSS'teki sistem tercihi kuralı zaten karşılıyor.     │
          └────────────────────────────────────────────────────────┘
        */}
        {tema && (
          <style
            dangerouslySetInnerHTML={{
              __html: tema === "light"
                ? ":root{color-scheme:light;background:#FFFFFF;color:#111619}"
                : ":root{color-scheme:dark;background:#0F0F0F;color:#EFF3F4}",
            }}
          />
        )}
        <ThemeScript />
        <script dangerouslySetInnerHTML={{ __html: configScript() }} />
        {/* Yahoo Sans: public/fonts taranıp @font-face üretilir */}
        <FontFaces />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Yalnızca yedek Inter. Newsreader kaldırıldı: haber
            gövdesi de Yahoo Sans kullanıyor. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
        />
      </head>
      <body
        /*
          Varsayılan görsel adresleri: görseli olmayan kartlar
          bunu okuyor. Prop olarak taşımak onlarca bileşenin
          imzasını değiştirmek olurdu.
        */
        data-ph={assetUrl(settings.placeholder_key) ?? undefined}
        data-ph-dark={assetUrl(settings.placeholder_dark_key) ?? undefined}
      >
        {/* Çocuk modu tercihi tüm sayfalarda paylaşılıyor */}
        <GirisSaglayici>
        <CocukModuSaglayici>
        {/*
          PERSONEL UYARI ŞERİDİ.

          Bakım açıkken personel gerçek siteyi görüyor — ama bunu
          BİLMELİ. Yoksa "site açık sanıp" bakımı kapatmayı
          unutuyor ve ziyaretçiler kapalı ekranla kalıyor.
        */}
        {settings.maintenance_mode && personel && (
          <div
            role="status"
            style={{
              background: "var(--orange-soft, #fdf3e3)",
              color: "var(--orange-ink, #8a4d02)",
              padding: "10px 16px", textAlign: "center",
              fontSize: 13.5, fontWeight: 600,
            }}
          >
            Bakım modu açık — ziyaretçiler bu sayfayı göremiyor.
            Sen personel olduğun için gerçek siteyi görüyorsun.
          </div>
        )}

        {bakim ? (
          <Maintenance settings={settings} />
        ) : (
          /**
           * Prototip bir MAKET: tüm sayfa tek bir 1320px kutunun
           * içinde ve geniş ekranda iki yanı boş kalıyor —
           * "sağdan soldan kesilmiş" görüntüsü buradan geliyordu.
           *
           * Gerçek sitede yapı şu: header ve footer'ın ZEMİNİ ekranı
           * baştan başa kaplar, İÇERİKLERİ 1320px'de ortalanır.
           * 1320px'de görüntü prototiple birebir aynı; daha geniş
           * ekranda sayfa kesik durmaz.
           */
          <CityProvider
            cities={
              cityOptions.length
                ? cityOptions
                : demoCities.map((c) => ({ slug: c.slug, name: c.name, plate: c.plate_code }))
            }
            initial={citySlug || DEFAULT_CITY}
            dict={dict}
          >
            <ToastProvider>
              {/* Giriş/kayıt/hesap ekranlarında header ve footer yok:
                  bunlar uygulama ekranı, site sayfası değil. */}
              {!bare && (
                <Header
                  locale={locale}
                  dict={dict}
                  settings={settings}
                  nav={nav}
                  cities={cities}
                />
              )}

              <main
                id="content"
                style={{
                  maxWidth: bare || panel ? "100%" : "var(--max)",
                  marginInline: "auto",
                  width: "100%",
                  position: "relative",
                }}
              >
                {children}
              </main>

              {/*
                Sayfa görüntüleme takibi.

                ⚠ `Suspense` ZORUNLU: bileşen `useSearchParams`
                kullanıyor ve o kanca sarmalanmadan sayfayı
                tamamen istemci tarafına düşürüyor — statik
                üretim bozuluyor.

                Bakım ekranında sayılmıyor: o sayfa gerçek bir
                ziyaret değil.
              */}
              {!bare && (
                <Suspense fallback={null}>
                  <SayfaTakip locale={locale} />
                </Suspense>
              )}

              {/* Panelde footer ve alt sekme yok: uygulama ekranı */}
              {!bare && !panel && (
                <>
                  <Footer locale={locale} dict={dict} settings={settings} nav={nav} />
                  <MobileTabBar locale={locale} dict={dict} nav={nav} />
                </>
              )}
            </ToastProvider>
          </CityProvider>
        )}
              </CocukModuSaglayici>
        </GirisSaglayici>
        {/*
          Anahtar şehri profil ile eşitliyor (mobil uygulamadan
          ya da başka cihazdan değiştirilmişse). Hiçbir şey
          çizmiyor.
        */}
        {/* Sayfa geçişinde başa döner (çapa ve geri tuşu hariç) */}
        <Suspense fallback={null}>
          <KaydirmaSifirla />
        </Suspense>

        <SehirSenkron />
      </body>
    </html>
  );
}
