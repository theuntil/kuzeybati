import { href, type Locale, haberYolu} from "@/i18n/config";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import CocukKapak from "@/components/site/CocukKapak";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Article } from "@/lib/types";
import { pickImage, srcSet } from "@/lib/media";
import { articleMinutes, t, relativeTime } from "@/lib/format";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * KATEGORİ RAYI
 *
 * Kategori bloklarında 8 haber var; üçlü ızgaraya sığmaz ve
 * sayfayı gereksiz uzatır. Bunun yerine yatay kaydırılıyor —
 * mobilde parmakla, masaüstünde fareyle.
 */
export default function CategoryRail({
  articles, locale, dict,
}: {
  articles: Article[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (!articles.length) return null;

  return (
    <div
      data-hide-sb
      style={{
        display: "flex", gap: "var(--g)", overflowX: "auto",
        scrollSnapType: "x mandatory", paddingBottom: 2,
      }}
    >
      {articles.map((a) => {
        const img = pickImage(a.cover, "thumb");
        return (
          <Link
            key={a.id}
            href={haberYolu(locale, a.slug, a.category_slug)}
            style={{
              flex: "0 0 auto", width: "var(--cat-w)", scrollSnapAlign: "start",
              display: "flex", flexDirection: "column", color: "var(--tx)",
            }}
          >
            <span
              style={{
                position: "relative", aspectRatio: "16 / 10", borderRadius: 14, overflow: "hidden",
                background: a.cover?.dominant_color ?? "var(--s2)",
              }}
            >
              {img && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img}
                  srcSet={srcSet(a.cover)}
                  sizes="264px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              {!img && <VarsayilanGorsel />}
              <CocukKapak guvenli={a.cocuk_guvenli} />
            </span>

            <span
              style={{
                fontSize: 10.5, fontWeight: 800, color: "var(--ac)",
                textTransform: "uppercase", letterSpacing: ".07em", marginTop: 11,
              }}
            >
              {a.son_dakika ? dict.home.breaking : a.city_name ?? a.category_name ?? ""}
            </span>

            <span
              style={{
                position: "relative", fontSize: 15.5, fontWeight: 700, lineHeight: 1.32, marginTop: 5,
                textWrap: "pretty", overflowWrap: "anywhere",
                display: "-webkit-box", WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}
            >
              {a.title}
            </span>

            {/* Alt satır: solda okuma süresi, sağda etkileşim.
                Sayı yoksa simge de basılmaz — boş "0" gürültüdür. */}
            <span
              style={{
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 12, color: "var(--mu)", fontWeight: 600,
                marginTop: "auto", paddingTop: 8,
              }}
            >
              <span>{relativeTime(a.published_at, locale)}</span>

              <span style={{ display: "flex", alignItems: "center", gap: 9, marginInlineStart: "auto" }}>
                {(a.stats?.like_count ?? 0) > 0 && (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                    title={dict.article.like}
                  >
                    <Icon name="heart" size={13} />
                    {a.stats!.like_count}
                  </span>
                )}
                {(a.stats?.comment_count ?? 0) > 0 && (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                    title={dict.comments.title}
                  >
                    <Icon name="comment" size={13} />
                    {a.stats!.comment_count}
                  </span>
                )}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
