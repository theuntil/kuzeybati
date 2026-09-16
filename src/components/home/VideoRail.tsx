import { href, type Locale, haberYolu} from "@/i18n/config";
import type { Article } from "@/lib/types";
import { pickImage } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import CocukKapak from "@/components/site/CocukKapak";
import Link from "next/link";

/**
 * VİDEO RAYI
 *
 * Başlık kartın ALTINDA değil, videonun İÇİNDE altta duruyor;
 * üstüne koyu bir geçiş bindirilerek okunur kalıyor. En fazla
 * üç satır, taşarsa "…" ile kesiliyor.
 *
 * Yatay kaydırılır: mobilde parmakla, masaüstünde fare ya da
 * kaydırma çubuğuyla. `scroll-snap` her kartı hizalı bırakır.
 *
 * Buraya yalnızca GERÇEKTEN videosu olan haberler gelir —
 * kaynak sorgu `articles.has_video` bayrağını kullanır.
 */
export default function VideoRail({
  articles, locale,
}: {
  articles: Article[];
  locale: Locale;
}) {
  if (!articles.length) return null;

  return (
    <div
      data-hide-sb
      style={{
        display: "flex", gap: 12, overflowX: "auto",
        scrollSnapType: "x mandatory", paddingBottom: 2,
      }}
    >
      {articles.map((a) => {
        const img = pickImage(a.cover, "thumb");
        const dur = a.cover?.duration_sec;
        return (
          <Link
            key={a.id}
            href={haberYolu(locale, a.slug, a.category_slug)}
            style={{
              flex: "0 0 auto", width: "var(--vid-w)", scrollSnapAlign: "start",
              color: "#fff",
            }}
          >
            <span
              style={{
                position: "relative", display: "block", width: "100%",
                aspectRatio: "9 / 16", borderRadius: 14, overflow: "hidden",
                background: a.cover?.dominant_color ?? "var(--s2)",
              }}
            >
              {img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={img} alt="" loading="lazy" decoding="async" />
              ) : (
                /* Poster üretilmemişse boş gri kutu yerine baskın
                   renk: kart bozuk değil, sade görünür. */
                <span
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0,
                    background: `linear-gradient(160deg, ${a.cover?.dominant_color ?? "var(--s2)"}, var(--s3))`,
                  }}
                />
              )}

              {/* Çocuk modunda uygunsuz haberin kapağı buzlanıyor */}
              <CocukKapak guvenli={a.cocuk_guvenli} />

              {/* oynat simgesi */}
              <span
                aria-hidden
                style={{
                  position: "absolute", insetInlineStart: 10, top: 10,
                  width: 32, height: 32, borderRadius: 999,
                  background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icon name="play" size={14} color="#fff" strokeWidth={2.4} />
              </span>

              {/* süre */}
              {dur ? (
                <span
                  style={{
                    position: "absolute", insetInlineEnd: 10, top: 10,
                    background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)",
                    color: "#fff", fontSize: 11, fontWeight: 700,
                    padding: "4px 8px", borderRadius: 999,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, "0")}
                </span>
              ) : null}

              {/* okunurluk için koyu geçiş */}
              <span
                aria-hidden
                style={{
                  position: "absolute", insetInline: 0, bottom: 0, height: "74%",
                  background:
                    "linear-gradient(to top, rgba(6,8,10,.95) 12%, rgba(6,8,10,.55) 52%, transparent 100%)",
                }}
              />

              {/*
                BAŞLIK — videonun içinde, dört satır sınırlı.

                ⚠ KIRPMA VE DOLGU AYRI KATMANDA.

                Önce ikisi aynı öğedeydi: `-webkit-line-clamp`
                ile `padding-bottom` birlikte kullanılınca kırpma
                dolguyu hesaba katmıyor ve son satır kartın
                altından TAŞIYORDU.

                Şimdi dış kutu konumlandırma ve dolguyu, iç kutu
                yalnızca kırpmayı üstleniyor. Satır sayısı ne
                olursa olsun metin kenara değmiyor.
              */}
              <span
                style={{
                  position: "absolute", insetInline: 0, bottom: 0,
                  padding: "18px 14px 20px",
                  display: "block",
                }}
              >
                <span
                  style={{
                    fontSize: 13, fontWeight: 700, lineHeight: 1.34,
                    color: "#fff", textWrap: "pretty",
                    overflowWrap: "anywhere",
                    display: "-webkit-box", WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}
                >
                  {a.title}
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
