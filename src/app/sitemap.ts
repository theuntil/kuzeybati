import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { locales, href, type Locale } from "@/i18n/config";

import { publicConfig } from "@/lib/config";
export const revalidate = 3600;

/** Son 5.000 haber + kategori ve şehir sayfaları */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicConfig().siteUrl;

  // Veritabanına ulaşılamıyorsa derleme çökmesin; en azından
  // dil ana sayfaları haritada kalsın.
  try {
    return await build(base);
  } catch {
    return (locales as readonly Locale[]).map((locale) => ({
      url: base + href(locale, "home"),
      changeFrequency: "hourly" as const,
      priority: 1,
    }));
  }
}

async function build(base: string): Promise<MetadataRoute.Sitemap> {
  const sb = createPublicClient();

  const [{ data: articles }, { data: cats }, { data: cities }] = await Promise.all([
    sb.from("public_articles").select("slug, published_at").order("published_at", { ascending: false }).limit(5000),
    sb.from("categories").select("slug").eq("is_active", true),
    sb.from("cities").select("slug").eq("is_active", true),
  ]);

  const out: MetadataRoute.Sitemap = [];

  for (const locale of locales as readonly Locale[]) {
    out.push({ url: base + href(locale, "home"), changeFrequency: "hourly", priority: 1 });
  }

  for (const a of (articles as { slug: string; published_at: string }[]) ?? []) {
    for (const locale of locales as readonly Locale[]) {
      out.push({
        url: base + href(locale, "news", a.slug),
        lastModified: new Date(a.published_at),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  for (const c of (cats as { slug: string }[]) ?? []) {
    out.push({ url: base + href("tr", "category", c.slug), changeFrequency: "hourly", priority: 0.6 });
  }
  for (const c of (cities as { slug: string }[]) ?? []) {
    out.push({ url: base + href("tr", "city", c.slug), changeFrequency: "daily", priority: 0.5 });
  }

  return out;
}
