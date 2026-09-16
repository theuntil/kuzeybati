import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { assertLocale, accountFromSlug, href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createAuthedClient } from "@/lib/supabase/server";
import { getCityOptions, getCategoryOptions } from "@/lib/queries";
import ArticleEditor, { type Block } from "@/components/account/ArticleEditor";
import ArticleStats, { type Detail as StatsDetail } from "@/components/account/ArticleStats";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false } };
}

/** /hesabim/duzenle/{id} — editörün kendi haberini düzenlemesi */
export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ locale: string; section: string; id: string }>;
}) {
  const { locale: raw, section, id } = await params;
  const locale = assertLocale(raw) as Locale;
  const kind = accountFromSlug(locale, section);
  if (kind !== "edit" && kind !== "stats") notFound();

  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(href(locale, "login"));

  /**
   * Haberi `articles` tablosundan okuyoruz; RLS yalnızca yazarın
   * ve yöneticinin kendi taslaklarını görmesine izin veriyor.
   * Başkasının haberini açmaya çalışan boş sonuç alır → 404.
   */
  /* ---- istatistik sayfası ---- */
  if (kind === "stats") {
    const [{ data: detail, error }, dict2] = await Promise.all([
      sb.rpc("my_article_detail", { p_id: id }),
      getDictionary(locale),
    ]);
    if (error || !detail) notFound();

    /*
     * ⚠ SABİT PİKSEL SINIRI YOK.
     *
     * Önce `maxWidth: 820` vardı — panelde ana sayfadaki okuma
     * genişliği sınırı (%70) uygulanıyordu. Panel bir okuma
     * sayfası değil, bir çalışma ekranı; ekranın tamamını
     * kullanıyor. Gutter (`var(--gut)`) yalnızca kenardan nefes
     * payı, içerik genişliğini sınırlamıyor.
     */
    return (
      <div style={{ padding: "var(--g) var(--gut) 48px", width: "100%", boxSizing: "border-box" }}>
        <ArticleStats detail={detail as StatsDetail} locale={locale} dict={dict2} />
      </div>
    );
  }

  const { data: row } = await sb
    .from("articles")
    .select("id, title, summary, body, tags, status, author_id, category_id, city_id, cover_url, editor_media")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!row) notFound();

  const [dict, categories, cities] = await Promise.all([
    getDictionary(locale),
    getCategoryOptions(),
    getCityOptions(),
  ]);

  // Kategori/şehir kimliklerini slug'a çevir
  const [{ data: cat }, { data: city }] = await Promise.all([
    row.category_id
      ? sb.from("categories").select("slug").eq("id", row.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.city_id
      ? sb.from("cities").select("slug").eq("id", row.city_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div style={{ padding: "var(--g) var(--gut) 48px", width: "100%", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", margin: "10px 0 22px" }}>
        {dict.editor.editTitle}
      </h1>
      <ArticleEditor
        locale={locale}
        dict={dict}
        categories={categories}
        cities={cities}
        article={{
          id: row.id,
          title: row.title,
          summary: row.summary,
          body: (Array.isArray(row.body) ? row.body : []) as Block[],
          category_slug: cat?.slug ?? null,
          city_slug: city?.slug ?? null,
          tags: row.tags,
          status: row.status,
          cover_url: row.cover_url,
          editor_media: row.editor_media,
        }}
      />
    </div>
  );
}
