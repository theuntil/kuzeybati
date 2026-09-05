import type { Metadata } from "next";
import { href, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Article } from "@/lib/types";
import { getSiteSettings } from "@/lib/settings";
import {
  getHero, getMostRead, getLatest, getVideoArticles,
  getByCategory, getCategory, getTopCities, getCity,
} from "@/lib/queries";
import { getSelectedCitySlug } from "@/lib/city";
import { Suspense } from "react";
import {
  TopStripAsync, LeagueTableAsync, TopStripSkeleton,
} from "@/components/home/DisServisler";
import {
  demoHero, demoMostRead, demoFeatured, demoVideos,
  demoByCategory, demoFeed, demoQuotes, demoCategoryNames, demoPrayer,
} from "@/lib/demo";

import HeroRail from "@/components/home/HeroRail";
import MostReadRail from "@/components/home/MostReadRail";
import WeatherPanel from "@/components/home/WeatherPanel";
import SectionHead from "@/components/home/SectionHead";
import FeatureGrid from "@/components/home/FeatureGrid";
import CategoryRail from "@/components/home/CategoryRail";
import VideoRail from "@/components/home/VideoRail";
import ForYou from "@/components/home/ForYou";
import MarketsWidget from "@/components/site/MarketsWidget";
import UygulamaTanitim from "@/components/site/UygulamaTanitim";
import TarihteBugunWidget from "@/components/home/TarihteBugunWidget";
import DepremWidget, { sonDepremler } from "@/components/home/DepremWidget";
import PrayerCard from "@/components/article/PrayerCard";
import Newsletter from "@/components/site/Newsletter";
import AdSlot from "@/components/site/AdSlot";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  const s = await getSiteSettings();
  return {
    title: s.site_name,
    description: s.seo_description ?? s.site_tagline ?? undefined,
    alternates: { canonical: href(locale, "home") },
  };
}

/**
 * Boş listeyi yalnızca DEMO MODU AÇIKKEN örnek içerikle doldur.
 * Kapalıyken (yayın varsayılanı) liste boş kalır ve bölüm
 * render edilmez — uydurma haber göstermek yerine bölümü gizlemek
 * doğru olan.
 */
const fill = <T,>(real: T[], demo: T[], on: boolean) =>
  real.length ? real : on ? demo : [];

/**
 * AYNI HABER SAYFADA İKİ KEZ ÇIKMAZ.
 *
 * Hero'daki haber "Öne çıkanlar"da, oradaki de "Spor" bloğunda
 * tekrar görünüyordu — okur aynı başlığı üç kez geçiyordu.
 * Her bölüm kendinden öncekilerin kullandığı kimlikleri eler.
 *
 * Sıra önemli: yukarıdaki bölüm önceliklidir.
 */
function takeUnique(list: Article[], used: Set<string>, limit: number): Article[] {
  const out: Article[] = [];
  for (const a of list) {
    if (out.length >= limit) break;
    if (used.has(a.id)) continue;
    used.add(a.id);
    out.push(a);
  }
  return out;
}

const PAD = "0 var(--gut)";

export default async function HomePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  const [dict, s] = await Promise.all([getDictionary(locale), getSiteSettings()]);

  const [heroR, mostReadR, featuredR, videosR, feedR, cities] = await Promise.all([
    /**
     * FAZLADAN ÇEK — TEKRAR ENGELİ LİSTEYİ TÜKETİYOR.
     *
     * `takeUnique` üstteki bölümlerde kullanılan haberleri eler.
     * "Öne çıkanlar" da hero ile aynı havuzdan (en yeni haberler)
     * geldiği için elemeden sonra 6 karttan 1 tanesi kalıyordu.
     *
     * Kural: takeUnique'e giren her liste, istenen sayının
     * KATLARINI çeker. Fazlası atılır, eksik kalmaz.
     */
    getHero(s.home_hero_count * 3, locale),
    getMostRead(s.home_mostread_count, locale),
    getLatest(s.home_featured_count * 5, locale),
    getVideoArticles((s.home_video_count + 1) * 3, locale),
    getLatest(s.home_feed_count * 2, locale, s.home_featured_count, true),
    getTopCities(1),
  ]);

  const demo = s.demo_mode;

  // Tekrar engeli: hero → öne çıkanlar → video → kategori → akış
  const used = new Set<string>();
  const hero = takeUnique(fill(heroR, demoHero, demo), used, s.home_hero_count);
  const featured = takeUnique(fill(featuredR, demoFeatured, demo), used, s.home_featured_count);
  /**
   * Videolar: ilki hero üstündeki şeride gider, kalanı raya.
   * Aynı videoyu iki yerde göstermek tekrar olurdu.
   */
  const videoAll = takeUnique(
    fill(videosR, demoVideos, demo), used, s.home_video_count + 1,
  );
  const stripVideo = videoAll[0] ?? null;
  const videos = videoAll.slice(1);
  const feed = takeUnique(fill(feedR, demoFeed, demo), used, s.home_feed_count);

  // "En çok okunanlar" tekrar engelinden MUAF: orası bir sıralama,
  // içerik bloğu değil. Aynı haberin hem manşette hem listede
  // olması doğaldır.
  const mostRead = fill(mostReadR, demoMostRead, demo);

  /**
   * Kategori blokları. Her blok için iki sorgu var; ikisi de
   * `Promise.all` ile paralel çalışır. Eskiden `await` art arda
   * geliyordu: 4 blok × 2 sorgu = 8 tur, biri bitmeden diğeri
   * başlamıyordu.
   */
  /*
   * ⚠ KATEGORİ BLOKLARI ANA AKIŞI BEKLETMİYOR.
   *
   * Dört blok × iki sorgu = sekiz sorgu daha. Manşet hazır
   * olmasına rağmen sayfa bunları bekliyordu.
   *
   * `Suspense` içine alınamadı çünkü `used` kümesi (tekrar
   * engeli) manşet ve akıştan sonra hesaplanıyor ve bloklar ona
   * bağlı. Bunun yerine sorgular hafifletildi: her blok için
   * çekilen fazladan kayıt sayısı düşürüldü.
   */
  const blocks = await Promise.all(
    s.home_category_slugs.map(async (slug) => {
      // Bloklar sırayla eleneceği için fazladan çekiyoruz:
      // üsttekilerde kullanılanlar düşünce yine 8 kart kalsın.
      const [items, category] = await Promise.all([
        getByCategory(slug, s.home_category_count * 3, locale),
        getCategory(slug),
      ]);
      return {
        slug,
        name: category?.name ?? demoCategoryNames[slug] ?? slug,
        raw: fill(items, demoByCategory[slug] ?? demoFeatured, demo),
      };
    }),
  );

  // Kategori blokları sırayla elenir
  const blocksUnique = blocks.map((b) => ({
    slug: b.slug,
    name: b.name,
    items: takeUnique(b.raw, used, s.home_category_count),
  }));

  /**
   * Hero üstü şerit — hepsi SEÇİLİ ŞEHRE bağlı.
   * Sıra: maç → eczane → piyasa → namaz → video.
   */
  const citySlug = await getSelectedCitySlug();
  const selected = await getCity(citySlug);
  const cityName = selected?.name ?? "İstanbul";

  /*
   * ⚠ VERİ YERLEŞİMDEN ÖNCE ÇEKİLİYOR.
   *
   * Tanıtım bloğu ile deprem kutusu yan yana duracak. Ama
   * deprem verisi yoksa (hizmet kapalı ya da AFAD cevap
   * vermiyor) ikinci sütun boş kalırdı.
   *
   * `:has()` ile CSS'ten çözmeyi denedim; kırılgan. Veri
   * burada çekiliyor ve sütun sayısına KESİN karar veriliyor.
   *
   * Hata durumunda boş liste dönüyor: tanıtım tek başına tam
   * genişliği kaplıyor, sayfa bozulmuyor.
   */
  const depremler = s.earthquake_enabled
    ? await sonDepremler(5).catch(() => [])
    : [];

  /*
   * Yan sütun widget'ları tek yerde kuruluyor: hem masaüstü
   * kenar çubuğu hem mobil akış arası aynı listeyi kullanıyor,
   * böylece ikisi birbirinden ayrışamıyor.
   *
   * Kapalı hizmetler listeye hiç girmiyor — `null` girseydi
   * mobilde boş bir aralık oluşurdu.
   */
  const yanWidgetlar = [
    s.onthisday_enabled ? (
      <Suspense key="tb" fallback={null}>
        <TarihteBugunWidget locale={locale} dict={dict} />
      </Suspense>
    ) : null,
    s.prayer_enabled ? (
      <Suspense key="nz" fallback={null}>
        <PrayerCard city={cityName} dict={dict} />
      </Suspense>
    ) : null,
    s.earthquake_enabled ? (
      <Suspense key="dp" fallback={null}>
        <DepremWidget locale={locale} dict={dict} />
      </Suspense>
    ) : null,
  ].filter(Boolean) as React.ReactNode[];
  const mainCity = selected ?? cities[0];

/*
   * ⚠ DIŞ SERVİSLER BURADA BEKLENMİYOR.
   *
   * Borsa, namaz, maç, puan durumu ve eczane — beşi de üçüncü
   * taraf. Biri yavaşsa tüm sayfa bekliyordu ve haberler hazır
   * olmasına rağmen 4-5 saniye boş ekran görünüyordu.
   *
   * Artık `<Suspense>` içinde kendi verilerini çekiyorlar.
   */

  return (
    <>
      {/* ---- hero üstü hizmet şeridi ---- */}
      <div style={{ padding: "var(--g) var(--gut) 0" }}>
        <Suspense fallback={<TopStripSkeleton />}>
          <TopStripAsync
            locale={locale}
            dict={dict}
            settings={s}
            cityName={cityName}
            citySlug={citySlug}
            video={stripVideo}
            demo={demo}
          />
        </Suspense>
      </div>

      {/* ---- hero + hava paneli ---- */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "var(--g)",
          padding: "var(--g) var(--gut) 0", alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "3 1 var(--main)", minWidth: 0 }}>
          <HeroRail articles={hero} locale={locale} dict={dict} />

          {/* hero altı: üç kart */}
          {featured.length > 0 && (
            <div style={{ marginTop: "var(--g)" }}>
              <FeatureGrid articles={featured.slice(0, 3)} locale={locale} dict={dict} />
            </div>
          )}
        </div>

        <div
          style={{
            flex: "1 1 var(--side)", minWidth: 0,
            display: "flex", flexDirection: "column", gap: "var(--g)",
          }}
        >
          {s.weather_enabled && (
            <WeatherPanel
              city={cityName}
              lat={mainCity?.latitude}
              lon={mainCity?.longitude}
              locale={locale}
              dict={dict}
              demo={demo}
            />
          )}
          <AdSlot placement="home-top" locale={locale} enabled={s.ads_enabled} />
          <MostReadRail articles={mostRead} locale={locale} dict={dict} />
        </div>
      </div>

      {/* ---- öne çıkanlar (kalanı) ---- */}
      {featured.length > 3 && (
        <div style={{ padding: "calc(var(--g) + 20px) var(--gut) 0" }}>
          <SectionHead title={dict.home.featured} moreLabel={dict.common.all} />
          <FeatureGrid articles={featured.slice(3)} locale={locale} dict={dict} />
        </div>
      )}

      {/* ---- video haberler ---- */}
      {videos.length > 0 && (
        <div style={{ padding: "calc(var(--g) + 34px) var(--gut) 0" }}>
          <SectionHead
            title={dict.home.videoNews}
            more={href(locale, "video")}
            moreLabel={dict.common.all}
          />
          <VideoRail articles={videos} locale={locale} />
        </div>
      )}

      {/* ---- kategori blokları ---- */}
      {blocksUnique.map((b) => (
        <div key={b.slug} style={{ padding: "calc(var(--g) + 34px) var(--gut) 0" }}>
          <SectionHead
            title={b.name}
            more={href(locale, "category", b.slug)}
            moreLabel={dict.common.all}
          />
          <CategoryRail articles={b.items} locale={locale} dict={dict} />
        </div>
      ))}

      {/*
        UYGULAMA TANITIMI + SON DEPREMLER

        ⚠ YAN YANA.
        Tanıtım tek başına tam genişlikteyken içinde büyük boş
        alanlar kalıyordu; başlık ve kartlar sola yığılıp sağ
        taraf boşa gidiyordu.

        Şimdi masaüstünde ikisi yan yana: tanıtım solda, son
        depremler sağda. Mobilde alt alta — dar ekranda yan yana
        ikisi de okunmaz olurdu.

        Deprem hizmeti kapalıysa tanıtım eskisi gibi tam
        genişliği kaplıyor; boş bir sütun bırakılmıyor.
      */}
      <div
        className={`kb-tanitim-satir${depremler.length ? " kb-iki-sutun" : ""}`}
        style={{ padding: "0 var(--gut)" }}
      >
        <UygulamaTanitim settings={s} />
        {depremler.length > 0 && (
          <DepremWidget locale={locale} dict={dict} veri={depremler} />
        )}
      </div>

      {/* ---- sana özel ---- */}
      {feed.length > 0 && (
      <div style={{ padding: "calc(var(--g) + 14px) var(--gut) 0" }}>
        <div
          style={{
            display: "flex", flexWrap: "wrap", gap: "var(--g)",
            alignItems: "flex-start",
          }}
        >
          <div
            data-home-wrap
            style={{
              flex: "2 1 var(--main)", minWidth: 0, maxWidth: "var(--feedMax)",
            }}
          >
            {/*
              ⚠ AYNI WIDGET'LAR İKİ YERDE.
              Masaüstünde yan sütunda, mobilde akışın arasında.
              CSS ile biri gizleniyor; ikisi aynı anda görünmüyor.

              Sunucu bileşenleri olduğu ve Wikimedia/AFAD
              istekleri istek başına önbelleklendiği için ikinci
              çizim ek ağ maliyeti getirmiyor.
            */}
            <ForYou
              articles={feed}
              locale={locale}
              dict={dict}
              title={dict.home.forYou}
              mobilAralar={yanWidgetlar}
            />
            <AdSlot placement="home-feed" locale={locale} enabled={s.ads_enabled} />
          </div>

          <aside
            className="kb-yan-sutun"
            style={{
              flex: "1 1 var(--side)", minWidth: 0, marginTop: 58,
              display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            <Newsletter locale={locale} dict={dict} source="home" />
            <Suspense fallback={null}>
              <LeagueTableAsync dict={dict} locale={locale} />
            </Suspense>
            <MarketsWidget settings={s} dict={dict} locale={locale} />

            {/*
              Piyasaların altında: tarihte bugün, namaz vakti,
              son depremler. Her biri ayrı `Suspense` içinde —
              biri yavaşlarsa diğerleri beklemiyor.
            */}
            {/*
              ⚠ SARMALAYICI GEREKLİ.
              Mobilde bu widget'lar akışın arasına taşınıyor;
              burada gizlenebilmeleri için ortak bir sınıf
              taşımaları gerekiyor.
            */}
            <div className="kb-yan-widget" style={{
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {yanWidgetlar}
            </div>

            <AdSlot placement="sidebar" locale={locale} enabled={s.ads_enabled} />
          </aside>
        </div>
      </div>

      )}

      {/* Hiç içerik yoksa okuru boş sayfayla baş başa bırakma */}
      {hero.length === 0 && featured.length === 0 && feed.length === 0 && (
        <div style={{ padding: "60px var(--gut)", textAlign: "center" }}>
          <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            {dict.common.loading}
          </p>
          <p style={{ color: "var(--mu)", fontSize: 14 }}>
            {dict.search.noResults}
          </p>
        </div>
      )}

      <div style={{ height: 40 }} />
    </>
  );
}
