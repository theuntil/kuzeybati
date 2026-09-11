import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { assertLocale, accountFromSlug, href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createAuthedClient } from "@/lib/supabase/server";
import { getCityOptions, getCategoryOptions } from "@/lib/queries";
import ArticleEditor from "@/components/account/ArticleEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false } };
}

/** /hesabim/yeni — editörün yeni haber formu */
export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale: raw, section } = await params;
  const locale = assertLocale(raw) as Locale;
  if (accountFromSlug(locale, section) !== "new") notFound();

  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(href(locale, "login"));

  const { data: profile } = await sb.from("my_profile").select("role").maybeSingle();
  // Haber ekleme yalnızca editör ve admin
  if (profile?.role !== "author" && profile?.role !== "admin") notFound();

  const [dict, categories, cities] = await Promise.all([
    getDictionary(locale),
    getCategoryOptions(),
    getCityOptions(),
  ]);

  /*
   * ⚠ SABİT PİKSEL SINIRI YOK — bkz. /hesabim/duzenle/[id] sayfasındaki
   * aynı düzeltme. Panel bir okuma sayfası değil.
   */
  return (
    <div style={{ padding: "var(--g) var(--gut) 48px", width: "100%", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", margin: "10px 0 22px" }}>
        {dict.editor.newTitle}
      </h1>
      <ArticleEditor locale={locale} dict={dict} categories={categories} cities={cities} />
    </div>
  );
}
