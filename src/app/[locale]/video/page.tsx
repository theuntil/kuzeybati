import { assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getVideoArticles } from "@/lib/queries";
import FeatureGrid from "@/components/home/FeatureGrid";

export const revalidate = 180;

export default async function VideoPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  const dict = await getDictionary(locale);
  const items = await getVideoArticles(24, locale);

  return (
    <div style={{ padding: "var(--g) var(--gut) 40px" }}>
      <h1 style={{ fontSize: "var(--h1)", fontWeight: 800, margin: "10px 0 22px" }}>
        {dict.home.videoNews}
      </h1>
      {items.length === 0 ? (
        <p className="muted">{dict.search.noResults}</p>
      ) : (
        <FeatureGrid articles={items} locale={locale} dict={dict} wrap />
      )}
    </div>
  );
}
