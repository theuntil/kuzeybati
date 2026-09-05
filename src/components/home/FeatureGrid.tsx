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
 * 3 sütunlu kart ızgarası (öne çıkanlar ve kategori blokları).
 * `data-feat` mobilde CSS ile yatay kaydırmaya döner —
 * prototipteki applyDevice davranışının karşılığı.
 */
export default function FeatureGrid({
  articles, locale, dict, wrap = false,
}: {
  articles: Article[];
  locale: Locale;
  dict: Dictionary;
  /**
   * true: uzun listeler (kategori, arama) — satır sonunda alta sarar.
   * false: ana sayfa blokları — mobilde yatay kaydırmaya döner.
   */
  wrap?: boolean;
}) {
  return (
    <div
      {...(wrap ? {} : { "data-feat": "", "data-hide-sb": "" })}
      style={
        wrap
          ? {
              display: "grid",
              gap: "var(--g)",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(var(--card), 100%), 1fr))",
            }
          : { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--g)" }
      }
    >
      {articles.map((a) => {
// Kartlar en fazla ~264px genişlikte. 800px "card" varyantını
        // basmak boşuna bant genişliği; 400px "thumb" retinada bile yeterli.
        const img = pickImage(a.cover, "thumb");
        return (
          <Link
            key={a.id}
            href={haberYolu(locale, a.slug, a.category_slug)}
            style={{ display: "flex", flexDirection: "column", minWidth: 0, color: "var(--tx)" }}
          >
            <span
              style={{
                position: "relative", aspectRatio: "16/10", borderRadius: 14,
                overflow: "hidden", background: "var(--s2)",
              }}
            >
              {img && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img}
                  srcSet={srcSet(a.cover)}
                  sizes="(max-width: 860px) 220px, 300px"
                  alt=""
                  loading="lazy"
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
              {a.son_dakika ? dict.home.breaking : a.category_name ?? a.city_name ?? ""}
            </span>
            <span
              style={{
                fontSize: 15.5, fontWeight: 700, lineHeight: 1.32,
                marginTop: 5, textWrap: "pretty",
              }}
            >
              {a.title}
            </span>
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
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="heart" size={13} />{a.stats!.like_count}
                  </span>
                )}
                {(a.stats?.comment_count ?? 0) > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="comment" size={13} />{a.stats!.comment_count}
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
