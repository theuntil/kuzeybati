"use client";

/**
 * AKIŞ GÖRÜNÜM ANAHTARI
 *
 * Ölçüler verilen işaretlemenin birebir karşılığı (rem → px):
 *   kap        2.125rem × 6rem   = 34 × 96,  köşe 1.5rem = 24
 *   iç boşluk  0.1875rem         = 3
 *   düğme      1.75rem × 2.75rem = 28 × 44,  tam yuvarlak
 *   kayan taş  sol 3 ↔ 49,  300ms ease-in-out
 *
 * İki düğme de mutlak konumlu; kayan taş altlarında ve
 * `transition-all` ile kayıyor — seçim değişince taş yumuşakça
 * geçiyor, düğmeler yerinde kalıyor.
 */
export type FeedView = "small" | "large";

export default function ViewToggle({
  value, onChange, labels,
}: {
  value: FeedView;
  onChange: (v: FeedView) => void;
  labels: { small: string; large: string };
}) {
  const btn = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    insetInlineStart: side === "left" ? 3 : 49,
    top: 3,
    zIndex: 10,
    height: 28,
    width: 44,
    borderRadius: 999,
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color .2s ease",
  });

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        role="radiogroup"
        aria-label={labels.large}
        style={{
          position: "relative", height: 34, width: 96, flexShrink: 0,
          borderRadius: 24, background: "var(--s3)", padding: 3,
        }}
      >
        {/* kayan taş */}
        <div
          aria-hidden
          style={{
            position: "absolute", height: 28, width: 44, top: 3,
            insetInlineStart: value === "small" ? 3 : 49,
            borderRadius: 999, background: "var(--bg)",
            transition: "inset-inline-start .3s ease-in-out",
          }}
        />

        <button
          role="radio"
          aria-checked={value === "small"}
          aria-label={labels.small}
          title={labels.small}
          onClick={() => onChange("small")}
          style={{ ...btn("left"), color: value === "small" ? "var(--tx)" : "var(--mu)" }}
        >
          {/* küçük kartlar: solda üç kare, sağda üç çubuk */}
          <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" aria-hidden focusable="false">
            <rect width="8.25" height="2.25" x="4.75" y="1" rx="0.375" />
            <path d="M4.75 5.125c0-.207.168-.375.375-.375h5.5c.207 0 .375.168.375.375v1.5a.375.375 0 0 1-.375.375h-5.5a.375.375 0 0 1-.375-.375z" />
            <rect width="8.25" height="2.25" x="4.75" y="8.5" rx="0.375" />
            <rect width="2.25" height="2.25" x="1" y="1" rx="0.375" />
            <rect width="2.25" height="2.25" x="1" y="4.75" rx="0.375" />
            <rect width="2.25" height="2.25" x="1" y="8.5" rx="0.375" />
          </svg>
        </button>

        <button
          role="radio"
          aria-checked={value === "large"}
          aria-label={labels.large}
          title={labels.large}
          onClick={() => onChange("large")}
          style={{ ...btn("right"), color: value === "large" ? "var(--tx)" : "var(--mu)" }}
        >
          {/* büyük kartlar: üstte geniş kutu, altta çubuk */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden focusable="false">
            <rect width="12" height="7.5" rx="0.75" />
            <rect width="12" height="2.286" y="9.715" rx="0.375" />
          </svg>
        </button>
      </div>
    </div>
  );
}
