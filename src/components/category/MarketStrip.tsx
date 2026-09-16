import type { Quote } from "@/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import { serviceHref, type Locale } from "@/i18n/config";
import { formatNumber } from "@/lib/format";
import Sparkline from "@/components/home/Sparkline";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * EKONOMİ KATEGORİSİ — PİYASA ŞERİDİ
 *
 * Ekonomi haberlerini okuyan kişi kuru ve endeksi de görmek
 * ister. Yatay kaydırılan kartlar, her birinde mini grafik.
 */
export default function MarketStrip({
  quotes, locale, dict,
}: {
  quotes: Quote[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (!quotes.length) return null;

  return (
    <section
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18, marginBottom: "calc(var(--g) + 8px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: "rgba(10,132,255,.15)", color: "#0A84FF",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="markets" size={17} />
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>{dict.services.markets}</h2>
        <Link
          href={serviceHref(locale, "markets")}
          style={{
            marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 4,
            fontSize: 13, fontWeight: 700, color: "var(--ac)", flexShrink: 0,
          }}
        >
          {dict.common.all}
          <Icon name="chevronRight" size={15} />
        </Link>
      </div>

      <div
        data-hide-sb
        style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x proximity", paddingBottom: 2 }}
      >
        {quotes.map((q) => {
          const up = q.changePercent >= 0;
          return (
            <div
              key={q.key}
              style={{
                flex: "0 0 auto", width: 178, scrollSnapAlign: "start",
                background: "var(--s2)", borderRadius: 14, padding: "13px 14px",
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--mu)" }}>{q.label}</div>
              <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {formatNumber(q.value, locale, q.value >= 1000 ? 0 : 2)}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 12.5, fontWeight: 700,
                    color: up ? "var(--ac2)" : "var(--dn)",
                  }}
                >
                  {up ? "+" : "−"}{formatNumber(Math.abs(q.changePercent), locale, 2)}%
                </span>
                {q.spark && q.spark.length > 1 && (
                  <span style={{ marginInlineStart: "auto" }}>
                    <Sparkline points={q.spark} up={up} width={64} height={26} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
