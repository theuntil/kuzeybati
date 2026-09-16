import Chevron from "./Chevron";

/** Prototipteki bölüm başlığı: h2 + ok, gap 10, alt boşluk 14 */
export default function SectionHead({
  title, more, moreLabel,
}: {
  title: string;
  more?: string;
  moreLabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
      <h2
        style={{
          overflowWrap: "anywhere", fontSize: "var(--h2)",
          fontWeight: 800, letterSpacing: "-.03em",
        }}
      >
        {title}
      </h2>
      <Chevron href={more} title={moreLabel} />
    </div>
  );
}
