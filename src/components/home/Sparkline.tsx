/**
 * MİNİ GRAFİK
 *
 * Küçük bir çizgi grafiği: yalnızca yönü ve dalgalanmayı gösterir,
 * eksen ve etiket yok. Bu ölçekte (60×22) rakam okunmaz; grafiğin
 * işi "yükseliyor mu, ne kadar oynak" sorusunu bir bakışta
 * cevaplamak.
 *
 * `preserveAspectRatio="none"` ile kutuya yayılır; noktalar 0-100
 * arasına normalize edildiği için gerçek değerler önemsiz.
 */
export default function Sparkline({
  points, up, width = 62, height = 22,
}: {
  points: number[];
  up: boolean;
  width?: number;
  height?: number;
}) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const color = up ? "var(--ac2)" : "var(--dn)";
  const id = `sp-${points.length}-${up ? "u" : "d"}-${Math.round(min)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L100,100 L0,100 Z`} fill={`url(#${id})`} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ strokeWidth: 1.6 }}
      />
    </svg>
  );
}
