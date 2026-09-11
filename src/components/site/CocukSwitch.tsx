"use client";
import { useCocukModu } from "./CocukModu";

/**
 * Çocuk modu anahtarı.
 *
 * Açıkken, AI'nın "çocuklar için uygun değil" dediği haberlerin
 * kapağı kırmızı örtüyle kaplanıyor ve haber sayfasında içerik
 * bulanıklaştırılıyor.
 *
 * ⚠ AI işlememiş haberler etkilenmiyor — `cocuk_guvenli` null
 * ise hiçbir şey yapılmıyor.
 */
export default function CocukSwitch({ etiket }: { etiket?: boolean }) {
  const { acik, hazir, degistir } = useCocukModu();

  return (
    <button
      type="button"
      onClick={degistir}
      aria-pressed={acik}
      aria-label={acik ? "Çocuk modunu kapat" : "Çocuk modunu aç"}
      title={acik ? "Çocuk modu açık" : "Çocuk modu"}
      style={{
        display: "inline-flex", alignItems: "center",
        gap: etiket ? 10 : 7,
        height: 38, padding: etiket ? "0 14px" : "0 11px",
        borderRadius: 999, border: "none", cursor: "pointer",
        background: acik ? "rgba(190,30,45,.14)" : "transparent",
        color: acik ? "#be1e2d" : "inherit",
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 30, height: 17, borderRadius: 999, flexShrink: 0,
          background: acik ? "#be1e2d" : "var(--s3, rgba(128,128,128,.35))",
          transition: "background .28s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <span
          style={{
            position: "absolute", top: 2.5, left: 2.5,
            width: 12, height: 12, borderRadius: "50%",
            background: "#fff",
            // Yay hissi: anahtar biraz taşıp yerine oturuyor
            transform: `translateX(${hazir && acik ? 13 : 0}px)`,
            transition: "transform .3s cubic-bezier(.34,1.56,.64,1)",
          }}
        />
      </span>
      <span style={{ fontSize: etiket ? 14.5 : 13, fontWeight: 600, whiteSpace: "nowrap" }}>
        Çocuk modu
      </span>
    </button>
  );
}
