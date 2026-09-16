import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { href, type Locale, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getByCategory, getCategory, getMostRead } from "@/lib/queries";
import { getSiteSettings } from "@/lib/settings";
import HeroRail from "@/components/home/HeroRail";
import FeatureGrid from "@/components/home/FeatureGrid";
import SonsuzGrid from "@/components/home/SonsuzGrid";
import MostReadRail from "@/components/home/MostReadRail";
import SectionHead from "@/components/home/SectionHead";
import Newsletter from "@/components/site/Newsletter";
import AdSlot from "@/components/site/AdSlot";
import CategoryExtras from "@/components/category/CategoryExtras";

export const revalidate = 120;

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale);
  const c = await getCategory(slug);
  if (!c) return { title: "404" };
  return {
    title: c.name,
    alternates: { canonical: href(locale, "category", slug) },
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale) as Locale;

  const [dict, s, category, items] = await Promise.all([
    getDictionary(locale),
    getSiteSettings(),
    getCategory(slug),
    getByCategory(slug, 40, locale),
  ]);
  if (!category) notFound();

  const mostRead = await getMostRead(5, locale);

  /**
   * Ana sayfayla aynı düzen mantığı: önce manşet, sonra kategoriye
   * özel bölüm, sonra haber ızgarası. Düz liste okuru karşılamıyor.
   */
  const hero = items.slice(0, Math.min(4, items.length));
  const rest = items.slice(hero.length);

  return (
    <div style={{ padding: "var(--g) var(--gut) 40px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 20px" }}>
        <span
          aria-hidden
          style={{ width: 5, height: 30, borderRadius: 3, background: category.color }}
        />
        <h1 style={{ fontSize: "var(--h1)", fontWeight: 800, letterSpacing: "-.03em" }}>
          {category.name}
        </h1>
      </header>

      {items.length === 0 ? (
        <p className="muted">{dict.search.noResults}</p>
      ) : (
        <>
          {/* ---- manşet ---- */}
          {hero.length > 0 && (
            <div style={{ marginBottom: "calc(var(--g) + 8px)" }}>
              <HeroRail articles={hero} locale={locale} dict={dict} />
            </div>
          )}

          {/* ---- kategoriye özel bölüm (spor / ekonomi / sağlık) ----
                 Dış servise bağlı; sayfanın geri kalanını bekletmesin
                 diye Suspense içinde. */}
          <Suspense fallback={null}>
            <CategoryExtras slug={slug} locale={locale} dict={dict} />
          </Suspense>

          {/* ---- haberler + yan sütun ---- */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--g)", alignItems: "flex-start" }}>
            <div style={{ flex: "3 1 var(--main)", minWidth: 0 }}>
              <SectionHead title={dict.home.last24h} />
              {/*
                ⚠ TASARIM DEĞİŞMİYOR.
                Bir denemede `ForYou` kullanılmıştı; sonsuz akış
                geldi ama kart tasarımı da değişti. `SonsuzGrid`
                `FeatureGrid`'i olduğu gibi kullanıyor, yalnızca
                aşağı kaydırınca devamını yüklüyor.
              */}
              <SonsuzGrid
                ilk={rest}
                locale={locale}
                dict={dict}
                kategori={slug}
              />
            </div>

            <aside
              style={{
                flex: "1 1 var(--side)", minWidth: 0,
                display: "flex", flexDirection: "column", gap: 12,
              }}
            >
              <MostReadRail articles={mostRead} locale={locale} dict={dict} hideOnMobile={false} />
              <Newsletter locale={locale} dict={dict} source="category" />
              <AdSlot placement="sidebar" locale={locale} enabled={s.ads_enabled} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
