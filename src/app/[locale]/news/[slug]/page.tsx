import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, localeNames, defaultLocale, assertLocale, type Locale, haberYolu, profilYolu} from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getSiteSettings } from "@/lib/settings";
import { getArticleBySlug, getRelated, getComments, getCity, isArticleSaved } from "@/lib/queries";
import { mediaUrl, posterUrl, pickImage, assetUrl } from "@/lib/media";
import { formatDate, fullDate, articleMinutes, plainText, t, tamTarih, relativeTime} from "@/lib/format";
import type { Comment } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import ArticleHeader from "@/components/article/ArticleHeader";
import ListenBar from "@/components/article/ListenBar";
import ReadingSize from "@/components/article/ReadingSize";
import AiSummary from "@/components/article/AiSummary";
import ArticleMediaArea from "@/components/article/ArticleMediaArea";
import CocukKilit from "@/components/site/CocukKilit";
import IcerikOneri from "@/components/article/IcerikOneri";
import UygulamaButonlari from "@/components/article/UygulamaButonlari";
import WeatherCard from "@/components/article/WeatherCard";
import PrayerCard from "@/components/article/PrayerCard";
import Comments from "@/components/article/Comments";
import Newsletter from "@/components/site/Newsletter";
import MarketsWidget from "@/components/site/MarketsWidget";
import UygulamaTanitim from "@/components/site/UygulamaTanitim";
import BenzerHaberler, { BenzerHaberlerIskelet } from "@/components/article/BenzerHaberler";
import TarihteBugunWidget from "@/components/home/TarihteBugunWidget";
import { LeagueTableAsync } from "@/components/home/DisServisler";
import AdSlot from "@/components/site/AdSlot";
import MostReadRail from "@/components/home/MostReadRail";
import { getMostRead } from "@/lib/queries";
import { demoMostRead } from "@/lib/demo";
import { guvenliJsonLd } from "@/lib/format";
import Link from "next/link";

export const revalidate = 300;

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale);
  const a = await getArticleBySlug(slug, locale);
  if (!a) return { title: "404" };

  const s = await getSiteSettings();
  const img = a.cover
    ? a.cover.type === "video"
      ? posterUrl(a.cover.poster_key, "full")
      : mediaUrl(a.cover.storage_key, "full")
    : null;

  return {
    title: a.seo_title ?? a.title,
    description: a.seo_description ?? a.summary ?? undefined,
    alternates: { canonical: haberYolu(locale, a.slug, a.category_slug) },
    openGraph: {
      title: a.title,
      description: a.summary ?? undefined,
      type: "article",
      publishedTime: a.published_at,
      modifiedTime: a.edited_at ?? undefined,
      images: img ? [img] : undefined,
      siteName: s.site_name,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale) as Locale;

  const [dict, settings, article] = await Promise.all([
    getDictionary(locale),
    getSiteSettings(),
    getArticleBySlug(slug, locale),
  ]);
  if (!article) notFound();

  const [related, comments, city, mostReadR, saved] = await Promise.all([
    getRelated(article, 8, locale)   /* metin arası öneri de aynı listeden besleniyor */,
    settings.comments_enabled ? getComments(article.id) : Promise.resolve([]),
    article.city_slug ? getCity(article.city_slug) : Promise.resolve(null),
    getMostRead(5, locale),
    isArticleSaved(article.id),
  ]);
  const mostRead = mostReadR.length ? mostReadR : demoMostRead;

  const mins = articleMinutes(article);
  const bodyText = plainText(article.body, article.summary);
  /*
   * Video ve görselleri ayır: videolar tam genişlikte, görseller
   * küçük şerit hâlinde; ikisi de galeriye açılır.
   *
   * ┌─ SADECE VİDEOSU OLAN HABERDE VİDEO HİÇ OYNAMIYORDU ⚠️ ────┐
   * │ `rest` kapak olan medyayı dışarıda bırakıyor. Haberde     │
   * │ yalnızca video varsa o video KAPAK seçiliyor, dolayısıyla │
   * │ `rest`ten de eleniyor ve `videos` BOŞ kalıyordu.          │
   * │                                                              │
   * │ `ArticleMediaArea` otomatik oynatan bloğu `videos[0]`      │
   * │ üzerinden basıyor; dizi boş olunca yalnızca durağan poster│
   * │ görünüyordu. Fotoğraf da olan haberlerde kapak fotoğraf   │
   * │ oluyor, video `rest`te kalıyor ve sorun çıkmıyordu —      │
   * │ farkın sebebi buydu.                                        │
   * │                                                              │
   * │ Videolar artık kapaktan bağımsız toplanıyor; görseller    │
   * │ eskisi gibi kapağı hariç tutuyor (kapak zaten üstte).     │
   * └──────────────────────────────────────────────────────────────┘
   */
  const videos = article.media.filter((m) => m.type === "video");
  const gallery = article.media.filter(
    (m) => m.type === "image" && m.id !== article.cover?.id,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary ?? undefined,
    datePublished: article.published_at,
    dateModified: article.edited_at ?? article.published_at,
    author: [{ "@type": "Organization", name: article.byline ?? article.source_name ?? settings.site_name }],
    publisher: { "@type": "Organization", name: settings.site_name },
    articleSection: article.category_name ?? undefined,
    inLanguage: article.shownLocale,
  };

  return (
    <div
      style={{
        maxWidth: 1080, marginInline: "auto",
        padding: "20px var(--gut) 0",
        display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start",
      }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: guvenliJsonLd(jsonLd) }} />

      {/* ================= Ana sütun ================= */}
      <article style={{ flex: "2 1 var(--main)", minWidth: 0 }}>
        <Link
          href={article.category_slug ? href(locale, "category", article.category_slug) : href(locale, "home")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 13, fontWeight: 700, color: "var(--mu)", marginBottom: 16,
          }}
        >
          <Icon name="chevronLeft" size={15} />
          {article.category_name ?? dict.nav.home}
        </Link>

        {/*
          ⚠ SON DAKİKA ROZETİ KALDIRILDI.
          Kategori bağlantısının hemen altında duruyordu ve
          iki etiket üst üste binerek başlığı aşağı itiyordu.
          Etiket listelerde zaten görünüyor.
        */}

        <h1
          style={{
            overflowWrap: "anywhere", fontSize: "var(--h1)", lineHeight: 1.08,
            fontWeight: 800, letterSpacing: "-.04em", textWrap: "balance",
          }}
        >
          {article.title}
        </h1>


        {/*
          Çocuk uyarısı KÜNYE SATIRININ ALTINDA (ArticleHeader).
          Bir ara burada da vardı ve sayfada iki kez çıkıyordu.
        */}

        <ArticleHeader
          articleId={article.id}
          /*
            Künye tıklanabilir: yazar varsa yazar sayfasına,
            yoksa yayıncı sayfasına gidiyor. İkisi de yoksa
            düz metin kalıyor.
          */
          /*
           * ⚠ VARSAYILAN DİLDE ÖNEK YOK.
           * `/${locale}/yayinci/iha` yazıyordum; `tr` varsayılan
           * dil olduğu için adres `/tr/yayinci/iha` oluyordu ve
           * middleware onu tanımıyordu — 404.
           * `profilYolu` diğer bağlantılarla aynı kuralı
           * kullanıyor.
           */
          profilHref={
            article.author_username
              ? profilYolu(locale, "yazar", article.author_username)
              : article.source_slug
                ? profilYolu(locale, "yayinci", article.source_slug)
                : null
          }
          cocukGuvenli={article.cocuk_guvenli}
          /*
            ⚠ YAZAR VARSA ONUN KİMLİĞİ GÖSTERİLİYOR.

            Önce her koşulda kaynak logosu basılıyordu; haberi bir
            yazar yazmış olsa bile ajansın ya da sitenin logosu
            çıkıyor, avatarı hiç görünmüyordu.

            Sıra: yazar avatarı → kaynak logosu. Ad tarafında da
            aynı mantık: `byline` yazarın adını taşıyor, o yoksa
            kaynağın adı kullanılıyor.
          */
          sourceName={
            article.author_name
            ?? article.byline
            ?? article.source_name
            ?? settings.site_name
          }
          sourceLogo={
            assetUrl(article.author_avatar) ?? assetUrl(article.source_logo)
          }
          avatarMi={Boolean(article.author_avatar)}
          /*
            ⚠ TEK TARİH.
            İki ayrı tarih gösteriliyordu (biri gg.aa.yyyy,
            diğeri "2 Eyl 11:56") — aynı bilgi iki kez.
            Şimdi tam tarih, yanında göreli süre.
          */
          meta={article.published_at
            ? `${tamTarih(article.published_at, locale)} · ${relativeTime(article.published_at, locale)}`
            : ""}
          locale={locale}
          dict={dict}
          initialLikes={article.stats?.like_count ?? 0}
          likesEnabled={settings.likes_enabled}
          initialSaved={saved}
        />

        {/* Çeviri yoksa okuru bilgilendir */}
        {locale !== defaultLocale && !article.translated && (
          <p
            style={{
              margin: "0 0 16px", padding: "10px 13px", borderRadius: 12,
              background: "var(--s2)", fontSize: 13, color: "var(--mu)",
            }}
          >
            {t(dict.article.translationMissing, { lang: localeNames[locale] })}
          </p>
        )}

        {/*
          ⚠ TEK PERDE.

          Önce her bölüm ayrı sarılıyordu: görseller, sesli
          anlatım, AI özeti, metin. Sonuç, sayfa boyunca
          tekrarlanan dört ayrı "gizlendi" kutusuydu — hem
          çirkin hem gereksiz.

          Artık başlık ve künye dışındaki HER ŞEY tek perdenin
          altında: kapak, sesli anlatım, yazı boyutu, AI özeti,
          özet ve metin. Bir kez açıklanıyor, bir kez açılıyor.
        */}
        <CocukKilit guvenli={article.cocuk_guvenli}>
          <ArticleMediaArea
            cover={article.cover}
            gallery={gallery}
            videos={videos}
            dict={dict}
            part="cover"
          />

          <ListenBar text={bodyText} dict={dict} enabled={settings.tts_enabled} />

          {/*
            Sesli anlatımın altındaki satır: solda okuma süresi
            ve yazı boyutu, sağda uygulama düğmeleri.
          */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 12,
              marginTop: 12, flexWrap: "wrap",
            }}
          >
            {/*
              Sıra: uygulama düğmeleri solda, okuma süresi ve
              yazı boyutu sağda. Yazı boyutu en sonda çünkü
              metnin hemen üstünde durması gerekiyor.
            */}
            <UygulamaButonlari
              appStore={settings.app_store_url ?? null}
              playStore={settings.play_store_url ?? null}
              appBadge={settings.app_store_badge_key ?? null}
              playBadge={settings.play_store_badge_key ?? null}
            />
            <span
              style={{
                marginInlineStart: "auto",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <span style={{ fontSize: 12.5, color: "var(--mu)", whiteSpace: "nowrap" }}>
                {t(dict.article.readingTime, { n: mins })}
              </span>
              <ReadingSize dict={dict} />
            </span>
          </div>

          {settings.ai_summary_enabled && (
            <AiSummary ai={article.ai} dict={dict} />
          )}

          {/* ---- gövde ---- */}
          <div
            style={{
              fontSize: "calc(var(--lead) * var(--read-scale))",
              lineHeight: 1.72, marginTop: 26,
              display: "flex", flexDirection: "column", gap: 20,
            }}
          >
            {/*
              ⚠ ÖNERİ BLOĞU METNİN ORTASINA GİRİYOR.

              Uzun haberlerde okur sonuna kadar inmiyor ve
              sayfa altındaki ilgili haberleri hiç görmüyor.
              Blok, yeterince uzun metinlerde ortadaki paragraf
              sınırına yerleşiyor — cümle ortasında kesmiyor.
            */}
            {(article.body ?? []).map((b, i) => {
              const bloklar = article.body ?? [];
              /* En az 6 paragraf varsa ortaya bir öneri koy */
              const oneriNoktasi = bloklar.length >= 6
                ? Math.floor(bloklar.length / 2)
                : -1;
              const oneriGoster = i === oneriNoktasi && related.length >= 2;

              if (b.type === "heading") {
                return (
                  <h3
                    key={i}
                    style={{
                      fontSize: "calc(20px * var(--read-scale))",
                      fontWeight: 800, letterSpacing: "-.02em",
                    }}
                  >
                    {b.text}
                  </h3>
                );
              }
              if (b.type === "media") return null;
              return (
                <div key={i}>
                  <p style={{ overflowWrap: "anywhere" }}>{b.text}</p>
                  {oneriGoster && (
                    <IcerikOneri
                      items={related.slice(0, 4)}
                      locale={locale}
                      dict={dict}
                      kategori={article.category_name ?? null}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <ArticleMediaArea
            cover={article.cover}
            gallery={gallery}
            videos={videos}
            dict={dict}
            part="rest"
          />
        {/* ---- etiketler ---- */}
        {article.tags && article.tags.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 24 }}>
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`${href(locale, "search")}?q=${encodeURIComponent(tag)}`}
                style={{
                  padding: "7px 14px", borderRadius: 999, background: "var(--s2)",
                  fontSize: 12.5, fontWeight: 600, color: "var(--mu)",
                }}
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/*
          Alt medya alanı yukarıda, tek perdenin içinde çiziliyor.
          Burada ikinci kez çağrılınca aynı görseller iki kez
          çıkıyordu.
        */}

        <AdSlot placement="article-mid" locale={locale} enabled={settings.ads_enabled} />

        {/* Uygulama tanıtımı — yorumların hemen üstünde */}
        <UygulamaTanitim settings={settings} />

        {/*
          ⚠ YORUMLAR DA PERDENİN ALTINDA.

          Perde daha önce medya alanından sonra kapanıyordu;
          etiketler, reklam ve YORUMLAR dışarıda kalıyordu.
          Yorumlar haberin en denetimsiz bölümü — okurlar
          yazıyor — yani çocuk modunda gizlenmesi gereken ilk
          şey oydu. Perde artık yorumlardan sonra kapanıyor.
        */}
        <Comments
          articleId={article.id}
          initial={comments as Comment[]}
          locale={locale}
          dict={dict}
          enabled={settings.comments_enabled}
          requireApproval={settings.comments_require_approval}
          maxLen={settings.comments_max_len}
        />
        {/*
          Benzer haberler — yorumların altında.
          `Suspense`: sorgu sayfanın açılmasını geciktirmesin;
          iskelet gerçek kartla aynı ölçüde olduğu için veri
          gelince yerleşim zıplamıyor.
        */}
        <Suspense fallback={<BenzerHaberlerIskelet />}>
          <BenzerHaberler article={article} locale={locale} />
        </Suspense>
        </CocukKilit>
      </article>

      {/* ================= Yan sütun ================= */}
      <aside
        style={{
          flex: "1 1 var(--side)", minWidth: 0,
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        {settings.weather_enabled && article.city_name && (
          <WeatherCard
            city={article.city_name}
            lat={city?.latitude}
            lon={city?.longitude}
            dict={dict}
            demo={settings.demo_mode}
          />
        )}

        {/* Hava durumunun hemen altında — aynı görsel dil */}
        {settings.prayer_enabled && article.city_name && (
          <PrayerCard city={article.city_name} dict={dict} />
        )}

        {/*
          Yan sütun metin arasında kullanılmayanları gösteriyor;
          aynı haberler iki kez çıkmasın.
        */}
        {related.length > 4 && (
          <div
            style={{
              background: "var(--s1)", border: "1px solid var(--bd)",
              borderRadius: 18, padding: 18,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>
              {dict.article.related}
            </h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {related.slice(4).map((r, i) => {
                const img = pickImage(r.cover, "thumb");
                return (
                  <Link
                    key={r.id}
                    href={haberYolu(locale, r.slug, r.category_slug)}
                    style={{
                      display: "flex", gap: 10, alignItems: "center", width: "100%",
                      padding: i === 0 ? "0 0 11px" : "11px 0",
                      borderBottom: i === related.slice(4).length - 1 ? undefined : "1px solid var(--bd)",
                      color: "var(--tx)",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>
                      {r.title}
                    </span>
                    {img && (
                      <span style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" loading="lazy" />
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/*
          Piyasalar ve skor tablosu — ana sayfadakiyle aynı
          bileşenler. Haber okuyan biri de kur ve maç sonucuna
          bakmak istiyor; yeniden yazmak yerine aynı bileşenler
          kullanılıyor, ayarlar da ortak.

          `Suspense`: skor verisi dış servisten geliyor; yavaş
          olursa sayfanın kalanı beklemiyor.
        */}
        <Suspense fallback={null}>
          <LeagueTableAsync dict={dict} locale={locale} />
        </Suspense>
        <MarketsWidget settings={settings} dict={dict} locale={locale} />

        <MostReadRail articles={mostRead} locale={locale} dict={dict} hideOnMobile={false} />
        <Newsletter locale={locale} dict={dict} source="article" />

        {/* Bültenin hemen altında — okuma sonrası ilgi çekici içerik */}
        {settings.onthisday_enabled && (
          <Suspense fallback={null}>
            <TarihteBugunWidget locale={locale} dict={dict} />
          </Suspense>
        )}
        <AdSlot placement="sidebar" locale={locale} enabled={settings.ads_enabled} />
      </aside>
    </div>
  );
}
