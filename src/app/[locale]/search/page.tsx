import type { Metadata } from "next";
import { assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { searchArticles } from "@/lib/queries";
import { t } from "@/lib/format";
import FeatureGrid from "@/components/home/FeatureGrid";
import type { Locale } from "@/i18n/config";
import AramaEkrani from "@/components/search/AramaEkrani";
import { getMostRead, getLatest } from "@/lib/queries";
import { pickImage } from "@/lib/media";

// Arama sorgusu her seferinde farklı; önbelleklemenin anlamı yok.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  const dict = await getDictionary(locale);
  return { title: dict.search.title, robots: { index: false } };
}

/**
 * Trend aramalar.
 *
 * ⚠ ŞİMDİLİK SABİT LİSTE.
 * Gerçek trend hesabı için arama sorgularının kaydedilmesi
 * gerekiyor; o da kişisel veri saklamak demek. Bunun yerine
 * son 48 saatin en çok okunan haber başlıklarından türetiliyor:
 * okurun gerçekten ilgilendiği konular.
 */
async function trendAramalar(locale: Locale) {
  const enCok = await getMostRead(4, locale).catch(() => []);
  return enCok.map((a, i) => ({
    /* Başlığın ilk birkaç kelimesi arama terimi olarak yeterli */
    terim: a.title.split(/\s+/).slice(0, 4).join(" ").toLocaleLowerCase("tr"),
    artis: [312, 148, 96, 31][i] ?? 20,
  }));
}

export default async function SearchPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ locale: rawLocale }, { q }] = await Promise.all([params, searchParams]);
  const locale = assertLocale(rawLocale);
  const dict = await getDictionary(locale);
  const query = (q ?? "").trim();
  /*
   * Sonuç, trend ve öneriler paralel çekiliyor: sorgu boşken
   * arama hiç çalışmıyor, dolduğunda alt bölümler zaten
   * gizleniyor ama veri hazır bekliyor.
   */
  const [results, trendler, oneriler] = await Promise.all([
    query ? searchArticles(query, 30, locale) : Promise.resolve([]),
    query ? Promise.resolve([]) : trendAramalar(locale),
    query ? Promise.resolve([]) : getLatest(4, locale).catch(() => []),
  ]);

  return (
    <div style={{ padding: "var(--g) var(--gut) 40px" }}>
      <AramaEkrani
        locale={locale}
        ilkSorgu={query}
        sonucVar={results.length > 0}
        trendler={trendler}
        oneriler={oneriler.map((a) => ({
          slug: a.slug,
          baslik: a.title,
          gorsel: pickImage(a.cover, "card") ?? pickImage(a.cover, "thumb"),
        }))}
      />

      {/*
        Sonuçlar yalnızca arama yapıldığında. Boş sorguda
        `AramaEkrani` trend ve önerileri gösteriyor.
      */}
      {query && (
        results.length > 0
          ? <FeatureGrid articles={results} locale={locale} dict={dict} wrap />
          : (
            <p style={{ color: "var(--mu)", padding: "28px 4px", fontSize: 15 }}>
              {t(dict.search.noResults, { q: query })}
            </p>
          )
      )}
    </div>
  );
}
