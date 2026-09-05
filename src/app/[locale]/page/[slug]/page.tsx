import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { defaultLocale, type Locale, assertLocale } from "@/i18n/config";
import { getPage } from "@/lib/queries";
import { getSiteSettings } from "@/lib/settings";
import KurumsalBilgi from "@/components/site/KurumsalBilgi";
import UygulamaTanitim from "@/components/site/UygulamaTanitim";

export const revalidate = 3600;

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale);
  const p = await getPage(slug);
  if (!p) return { title: "404" };
  return {
    title: p.title[locale] ?? p.title[defaultLocale] ?? slug,
    description: p.seo_description?.[locale] ?? undefined,
  };
}

/** Kurumsal sayfalar — içerik panelden, dile göre girilir. */
export default async function StaticPage({ params }: { params: Params }) {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale);
  const p = await getPage(slug);
  if (!p) notFound();

  const title = p.title[locale] ?? p.title[defaultLocale] ?? slug;
  const body = p.body?.[locale] ?? p.body?.[defaultLocale] ?? "";

  /*
   * ⚠ RESMİ BİLGİLER YALNIZCA İKİ SAYFADA.
   * Hakkımızda ve Künye yasal olarak bu bilgileri taşımak
   * zorunda (5187 sayılı Basın Kanunu). Diğer sayfalarda
   * gereksiz kalabalık olurdu.
   */
  const kurumsalMi = slug === "hakkimizda" || slug === "kunye" || slug === "iletisim";
  const settings = kurumsalMi ? await getSiteSettings() : null;

  return (
    <div style={{ padding: "var(--g) var(--gut) 40px", maxWidth: 760 }}>
      <h1 style={{ fontSize: "var(--h1)", fontWeight: 800, margin: "12px 0 20px" }}>
        {title}
      </h1>
      <div className="prose">
        {body
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para, i) => (
            <p key={i}>{para}</p>
          ))}
      </div>

      {settings && (
        <KurumsalBilgi settings={settings} tur={slug === "kunye" ? "kunye" : slug === "iletisim" ? "iletisim" : "hakkimizda"}
          locale={locale} />
      )}

      {/*
        Uygulama tanıtımı — statik sayfaların en altında.
        Okur içeriği bitirdikten sonra karşılaşıyor; araya
        girmiyor.
      */}
      {/*
        ⚠ `settings` yalnızca kurumsal sayfalarda yükleniyor.
        Diğerlerinde `null` — blok o zaman basılmıyor.
      */}
      {settings && <UygulamaTanitim settings={settings} />}

    </div>
  );
}
