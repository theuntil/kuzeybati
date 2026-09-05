"use client";
import { useEffect, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   TEMA DEĞİŞTİRİCİ

   ┌─ İKONU HEP AY GÖSTERİYORDU ⚠️ ────────────────────────────┐
   │ Eski düğme sabit bir ay çiziyordu; koyu temaya geçince de  │
   │ ay kalıyordu. Kullanıcı hangi modda olduğunu düğmeden      │
   │ anlayamıyordu.                                               │
   │                                                              │
   │ Artık İKİ ikon üst üste duruyor ve geçişte biri dönerek     │
   │ çıkıp diğeri giriyor.                                        │
   └──────────────────────────────────────────────────────────────┘

   ┌─ ANİMASYON CSS İLE ⚠️ ────────────────────────────────────┐
   │ JS animasyon kütüphanesi eklemedim. `transform` ve         │
   │ `opacity` GPU'da çalışıyor; 60 kare akıcı ve paket 0 KB.   │
   │ `cubic-bezier` yumuşak bir yay hissi veriyor.               │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const ANAHTAR = "kb_tema";

export default function TemaSwitch({ etiket }: { etiket?: string }) {
  const [koyu, setKoyu] = useState(false);
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    /*
     * Sıra: kayıtlı tercih → işletim sisteminin tercihi.
     * Sunucu bunu bilemediği için ilk çizimde açık tema
     * varsayılıyor; `hazir` olana kadar ikon çizilmiyor ki
     * yanlış ikon bir an görünüp değişmesin.
     */
    let k = false;
    try {
      const kayit = localStorage.getItem(ANAHTAR);
      k = kayit ? kayit === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch { /* depolama kapalı */ }
    setKoyu(k);
    document.documentElement.dataset.theme = k ? "dark" : "light";
    setHazir(true);
  }, []);

  function degistir() {
    setKoyu((o) => {
      const y = !o;
      try { localStorage.setItem(ANAHTAR, y ? "dark" : "light"); } catch { /* yok say */ }
      document.documentElement.dataset.theme = y ? "dark" : "light";
      return y;
    });
  }

  return (
    <button
      type="button"
      onClick={degistir}
      aria-label={koyu ? "Açık temaya geç" : "Koyu temaya geç"}
      title={koyu ? "Açık tema" : "Koyu tema"}
      className="tema-switch"
      style={{
        position: "relative",
        display: "inline-flex", alignItems: "center", gap: etiket ? 9 : 0,
        justifyContent: "center",
        width: etiket ? "auto" : 38, height: 38,
        padding: etiket ? "0 14px" : 0,
        borderRadius: 999, border: "none",
        background: "transparent", color: "inherit", cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "relative", width: 20, height: 20,
          display: "inline-block", flexShrink: 0,
          // İkon değişirken hafif zıplama — iOS anahtarındaki his
          transition: "transform .45s cubic-bezier(.34,1.56,.64,1)",
          transform: hazir ? "scale(1)" : "scale(.85)",
        }}
      >
        {/* GÜNEŞ — açık temada görünür */}
        <svg
          viewBox="0 0 24 24" width="20" height="20" fill="none"
          stroke="currentColor" strokeWidth="1.9"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: "absolute", inset: 0,
            opacity: hazir && !koyu ? 1 : 0,
            transform: `rotate(${koyu ? -90 : 0}deg) scale(${koyu ? 0.4 : 1})`,
            transition: "opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>

        {/* AY — koyu temada görünür */}
        <svg
          viewBox="0 0 24 24" width="20" height="20" fill="none"
          stroke="currentColor" strokeWidth="1.9"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: "absolute", inset: 0,
            opacity: hazir && koyu ? 1 : 0,
            transform: `rotate(${koyu ? 0 : 90}deg) scale(${koyu ? 1 : 0.4})`,
            transition: "opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />
        </svg>
      </span>

      {etiket && (
        <span style={{ fontSize: 14.5, fontWeight: 500 }}>
          {koyu ? "Açık tema" : "Koyu tema"}
        </span>
      )}
    </button>
  );
}
