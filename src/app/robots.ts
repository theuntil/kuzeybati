import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/settings";

import { publicConfig } from "@/lib/config";
export const revalidate = 300;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = publicConfig().siteUrl;
  const s = await getSiteSettings();

  // Bakım modunda arama motorları boş sayfayı indekslemesin.
  if (s.maintenance_mode) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/arama", "/search", "/hesabim", "/account"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
