/**
 * KENDİ İKONLARIMIZ
 *
 * `public/icon/` altındaki dosyalar kullanılıyor. İkon
 * kütüphanesindeki karşılıkları marka hissini taşımıyordu.
 *
 * ⚠ Dosya eksikse tarayıcı kırık görsel gösterir; `onError`
 * ile gizleniyor ve yerine boşluk kalıyor — düğme yine
 * çalışıyor, sayfa bozulmuyor.
 *
 * Beklenen dosyalar:
 *   /icon/heart-regular.svg     /icon/heart-solid.svg
 *   /icon/bookmark-regular.svg  /icon/bookmark-solid.svg
 *   /icon/close.png
 */
export type OzelIkonAdi =
  | "heart" | "heart-solid"
  | "bookmark" | "bookmark-solid"
  | "close";

const DOSYA: Record<OzelIkonAdi, string> = {
  "heart": "/icon/heart-regular.svg",
  "heart-solid": "/icon/heart-solid.svg",
  "bookmark": "/icon/bookmark-regular.svg",
  "bookmark-solid": "/icon/bookmark-solid.svg",
  "close": "/icon/close.png",
};

export default function OzelIkon({
  ad, size = 18, renk,
}: {
  ad: OzelIkonAdi;
  size?: number;
  /**
   * İkon rengi.
   *
   * SVG'ler siyah çizim; `filter` ile beyaza çevriliyor.
   * Renk vermek için ayrı ayrı dosya tutmaktan iyi.
   */
  renk?: "beyaz" | "miras";
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={DOSYA[ad]}
      alt=""
      width={size}
      height={size}
      aria-hidden
      style={{
        width: size, height: size,
        display: "block", flexShrink: 0,
        objectFit: "contain",
        filter: renk === "beyaz" ? "brightness(0) invert(1)" : undefined,
      }}
      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
    />
  );
}
