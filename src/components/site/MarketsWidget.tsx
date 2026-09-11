import { fetchQuotes } from "@/lib/markets";
import { formatNumber } from "@/lib/format";
import type { SiteSettings } from "@/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import { href, type Locale } from "@/i18n/config";
import { demoQuotes } from "@/lib/demo";
import Sparkline from "@/components/home/Sparkline";
import Link from "next/link";

/** Yan sütun piyasa kutusu — şeritteki sembollerin tablo hali. */
export default async function MarketsWidget({
  settings, dict, locale, limit = 4,
}: {
  settings: SiteSettings;
  dict: Dictionary;
  locale: Locale;
  limit?: number;
}) {
  if (!settings.markets_enabled) return null;

  let quotes = await fetchQuotes(settings.ticker_symbols.slice(0, limit));
  // Sağlayıcı yanıt vermezse: demo modunda örnek, yayında kutu yok.
  if (!quotes.length) {
    if (!settings.demo_mode) return null;
    quotes = demoQuotes.slice(0, limit);
  }

  return (
    <aside
      style={{
        border: "1px solid var(--bd)", borderRadius: 18,
        background: "var(--s1)", padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800 }}>{dict.services.markets}</h3>
        <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
          {dict.services.delayed}
        </span>
      </div>

      <dl style={{ display: "grid", gap: 14, margin: 0 }}>
        {quotes.map((q) => {
          const up = q.changePercent >= 0;
          return (
            <div key={q.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <dt
                style={{
                  fontSize: 13, fontWeight: 700, minWidth: 0, flex: "1 1 auto",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {q.label}
              </dt>

              {/* mini grafik: yönü ve oynaklığı bir bakışta gösterir */}
              {q.spark && q.spark.length > 1 && (
                <Sparkline points={q.spark} up={up} />
              )}

              <dd
                style={{
                  margin: 0, textAlign: "end", flexShrink: 0,
                  fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatNumber(q.value, locale, q.value > 1000 ? 0 : 2)}
                <span
                  style={{
                    display: "block", fontSize: 11.5,
                    color: up ? "var(--ac2)" : "var(--dn)",
                  }}
                >
                  {up ? "+" : "−"}
                  {formatNumber(Math.abs(q.changePercent), locale, 2)}%
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <Link
        href={href(locale, "services")}
        style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--ac)" }}
      >
        {dict.services.goToMarkets} →
      </Link>
    </aside>
  );
}
