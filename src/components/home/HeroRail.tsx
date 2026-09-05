"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import CocukKapak from "@/components/site/CocukKapak";
import { href, type Locale, haberYolu} from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Article } from "@/lib/types";
import { pickImage, srcSet, assetUrl } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * HERO
 *
 * Ekran görüntüsündeki düzen:
 *   sağ üstte  "5 / 15" sayacı + duraklat düğmesi
 *   sağ altta  önceki / sonraki okları (masaüstü)
 *   sol altta  kaynak künyesi, altında BÜYÜK BAŞLIK
 *
 * ÖZET GÖSTERİLMEZ — hero'da yalnızca başlık var. Özet hem
 * görseli boğuyordu hem de mobilde başlığı aşağı itiyordu.
 *
 * Kaydırma yerel `scroll-snap` ile: betik yüklenmeden de
 * parmakla çevrilebilir. Otomatik geçiş 6 saniyede bir,
 * duraklat düğmesiyle ya da fareyle üstüne gelince durur.
 */
export default function HeroRail({
  articles, locale, dict,
}: {
  articles: Article[];
  locale: Locale;
  dict: Dictionary;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const n = ((i % articles.length) + articles.length) % articles.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [articles.length]);

  useEffect(() => {
    if (paused || hover || articles.length < 2) return;
    const id = setInterval(() => {
      const el = track.current;
      if (!el) return;
      goTo(Math.round(el.scrollLeft / el.clientWidth) + 1);
    }, 6000);
    return () => clearInterval(id);
  }, [paused, hover, articles.length, goTo]);

  if (!articles.length) return null;

  const round: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 999,
    background: "rgba(20,20,20,.55)", backdropFilter: "blur(10px)",
    color: "#fff", display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0,
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", borderRadius: 18, overflow: "hidden",
        border: "1px solid var(--bd)", background: "var(--s2)",
      }}
    >
      <div
        ref={track}
        data-hide-sb
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        style={{
          display: "flex", overflowX: "auto",
          scrollSnapType: "x mandatory", height: "var(--hero)",
        }}
      >
        {articles.map((a, i) => {
          const img = pickImage(a.cover, "full");
          const logo = assetUrl(a.source_logo);
          return (
            <Link
              key={a.id}
              href={haberYolu(locale, a.slug, a.category_slug)}
              style={{ flex: "0 0 100%", scrollSnapAlign: "start", position: "relative" }}
            >
              {img && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img}
                  srcSet={srcSet(a.cover)}
                  sizes="(max-width: 860px) 100vw, 70vw"
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                />
              )}
              {!img && <VarsayilanGorsel />}
              <CocukKapak guvenli={a.cocuk_guvenli} />

              <span
                aria-hidden
                style={{
                  position: "absolute", inset: 0,
                  background:
                    "linear-gradient(to top, rgba(6,8,10,.95) 0%, rgba(6,8,10,.55) 34%, rgba(6,8,10,.06) 66%)",
                }}
              />

              <span
                style={{
                  position: "absolute", insetInline: 0, bottom: 0,
                  padding: "24px var(--heroPad) 24px 24px", display: "block",
                }}
              >
                {/* kaynak künyesi */}
                <span style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                  {logo && (
                    <span style={{
                    position: "relative", width: 24, height: 24,
                    borderRadius: 999, overflow: "hidden", flexShrink: 0,
                    /* Saydam PNG logo — arkasına beyaz kare konmuyor */
                    background: "transparent",
                  }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo} alt="" style={{ objectFit: "contain" }} />
                    </span>
                  )}
                  <span
                    style={{
                      position: "relative", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.9)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {a.source_name ?? a.byline}
                  </span>
                  {a.son_dakika && (
                    <span
                      style={{
                        fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em",
                        textTransform: "uppercase", color: "#fff", background: "var(--dn)",
                        padding: "3px 8px", borderRadius: 6, flexShrink: 0,
                      }}
                    >
                      {dict.home.breaking}
                    </span>
                  )}
                </span>

                {/* SADECE BAŞLIK — özet yok */}
                <span
                  style={{
                    display: "block", fontSize: "var(--heroTitle)", lineHeight: 1.14,
                    fontWeight: 800, letterSpacing: "-.035em", color: "#fff",
                    textWrap: "balance", maxWidth: "24ch", overflowWrap: "anywhere",
                  }}
                >
                  {a.title}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* sayaç + duraklat */}
      {articles.length > 1 && (
        <div
          style={{
            position: "absolute", insetInlineEnd: 14, top: 14,
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(20,20,20,.55)", backdropFilter: "blur(10px)",
            borderRadius: 999, padding: "5px 6px 5px 12px",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
            {index + 1} <span style={{ opacity: 0.6 }}>/ {articles.length}</span>
          </span>
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? dict.home.play : dict.home.pause}
            title={paused ? dict.home.play : dict.home.pause}
            style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
          >
            <Icon name={paused ? "play" : "pause"} size={13} strokeWidth={2.2} color="#fff" />
          </button>
        </div>
      )}

      {/* önceki / sonraki */}
      {articles.length > 1 && (
        <div
          className="only-desktop"
          style={{ position: "absolute", insetInlineEnd: 16, bottom: 18, display: "flex", gap: 8 }}
        >
          <button onClick={() => goTo(index - 1)} aria-label={dict.common.back} style={round}>
            <Icon name="chevronLeft" size={17} strokeWidth={1.9} color="#fff" />
          </button>
          <button onClick={() => goTo(index + 1)} aria-label={dict.home.more} style={round}>
            <Icon name="chevronRight" size={17} strokeWidth={1.9} color="#fff" />
          </button>
        </div>
      )}

    </div>
  );
}
