import type { Quote } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/i18n/config";

/**
 * Kayan piyasa şeridi. Sonsuz akış için liste iki kez basılıp
 * -%50 ötelenir; ikinci kopya ekran okuyucudan gizlenir.
 */
export default function TickerBar({
  quotes, speedSec, locale,
}: {
  quotes: Quote[];
  speedSec: number;
  locale: Locale;
}) {
  const Row = ({ hidden = false }: { hidden?: boolean }) => (
    <div
      aria-hidden={hidden || undefined}
      style={{
        display: "flex", gap: 22, paddingInlineEnd: 22,
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: "var(--mu)",
      }}
    >
      {quotes.map((q) => {
        const up = q.changePercent >= 0;
        return (
          <span key={`${q.key}-${hidden ? "b" : "a"}`}>
            {q.label}{" "}
            <b style={{ color: up ? "var(--ac2)" : "var(--dn)" }}>
              {formatNumber(q.value, locale, q.value >= 1000 ? 0 : 2)}{" "}
              {up ? "+" : "−"}
              {formatNumber(Math.abs(q.changePercent), locale, 2)}%
            </b>
          </span>
        );
      })}
    </div>
  );

  return (
    <div data-ticker-bar data-hide-sb style={{ overflow: "hidden", padding: "6px 0", maxHeight: 40 }}>
      <div
        data-ticker
        style={{ display: "flex", width: "max-content", animation: `tick ${speedSec}s linear infinite` }}
      >
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
