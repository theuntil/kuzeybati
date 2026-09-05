import type { Metadata } from "next";
import { assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { searchArticles } from "@/lib/queries";
import { t } from "@/lib/format";
import FeatureGrid from "@/components/home/FeatureGrid";

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
  const results = query ? await searchArticles(query, 30, locale) : [];

  return (
    <div style={{ padding: "var(--g) var(--gut) 40px" }}>
      <h1 style={{ fontSize: "var(--h2)", fontWeight: 800, margin: "10px 0 16px" }}>
        {dict.search.title}
      </h1>

      <form action="" method="get" style={{ display: "flex", gap: 9, marginBottom: 26 }}>
        <input
          className="field"
          type="search"
          name="q"
          defaultValue={query}
          placeholder={dict.search.placeholder}
          autoFocus
          aria-label={dict.search.placeholder}
        />
        <button className="btn btn-primary">{dict.nav.search}</button>
      </form>

      {query && (
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
          {t(dict.search.results, { n: results.length })}
        </p>
      )}

      {query && results.length === 0 ? (
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{dict.search.noResults}</p>
          <p className="muted">{dict.search.tryAgain}</p>
        </div>
      ) : (
        <FeatureGrid articles={results} locale={locale} dict={dict} wrap />
      )}
    </div>
  );
}
