/**
 * BEĞENİ / KAYDETME İKONU
 *
 * ┌─ İKİ GÖRSEL ÜST ÜSTE ⚠️ ──────────────────────────────────┐
 * │ Tek `<img>` kullanıp `src` değiştiriyordum: basınca yeni   │
 * │ dosya (heart-solid.svg) indirilene kadar ikon eski hâlinde │
 * │ kalıyordu. Gecikme buradan geliyordu.                       │
 * │                                                              │
 * │ Şimdi ikisi de baştan yükleniyor, üst üste duruyor ve      │
 * │ yalnızca `opacity` değişiyor. Ağ isteği yok — geçiş anlık. │
 * └──────────────────────────────────────────────────────────────┘
 */
export default function AksiyonIkon({
  tur, aktif, size = 18,
}: {
  tur: "heart" | "bookmark";
  aktif: boolean;
  size?: number;
}) {
  const bos = `/icon/${tur}-regular.svg`;
  const dolu = `/icon/${tur}-solid.svg`;

  const ortak: React.CSSProperties = {
    position: "absolute", inset: 0,
    width: "100%", height: "100%",
    objectFit: "contain",
    transition: "opacity .12s ease, transform .22s cubic-bezier(.34,1.56,.64,1)",
  };

  return (
    <span
      aria-hidden
      style={{
        position: "relative", display: "inline-block",
        width: size, height: size, flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bos}
        alt=""
        style={{ ...ortak, opacity: aktif ? 0 : 1 }}
        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dolu}
        alt=""
        data-dolu
        style={{
          ...ortak,
          opacity: aktif ? 1 : 0,
          transform: aktif ? "scale(1)" : "scale(.82)",
        }}
        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
      />
    </span>
  );
}
