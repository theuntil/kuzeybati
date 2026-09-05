/**
 * YÜKLEME İSKELETİ
 *
 * Boş ekran yerine içeriğin şeklini gösterir; sayfa yerleşimi
 * veri gelince zıplamaz. Dönen çark yerine bu tercih edildi:
 * kullanıcı ne geleceğini görüyor.
 */
export function Skeleton({
  w = "100%", h = 16, r = 8, style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="kb-skel"
      style={{
        display: "block", width: w, height: h, borderRadius: r,
        background: "var(--s2)", ...style,
      }}
    />
  );
}

/** Kart listesi iskeleti */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gap: 10 }} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "var(--s1)", border: "1px solid var(--bd)",
            borderRadius: 16, padding: 16,
          }}
        >
          <Skeleton w="45%" h={13} />
          <Skeleton h={17} style={{ marginTop: 10 }} />
          <Skeleton w="70%" h={17} style={{ marginTop: 7 }} />
        </div>
      ))}
      <style>{`
        .kb-skel {
          position: relative; overflow: hidden;
        }
        .kb-skel::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(90deg,
            transparent, rgba(255,255,255,.06), transparent);
          animation: kbShimmer 1.5s infinite;
        }
        @keyframes kbShimmer {
          from { transform: translateX(-100%) }
          to   { transform: translateX(100%) }
        }
        @media (prefers-reduced-motion: reduce) {
          .kb-skel::after { animation: none }
        }
      `}</style>
    </div>
  );
}
