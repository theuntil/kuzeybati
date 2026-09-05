"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ══════════════════════════════════════════════════════════════
   9:16 VİDEO ÇERÇEVESİ

   ┌─ NEDEN CSS DEĞİL, ÖLÇÜM ⚠️ ───────────────────────────────┐
   │ Önce şu yazılmıştı:                                        │
   │     height: 100%; aspect-ratio: 9/16; max-width: 100%      │
   │                                                              │
   │ `height: 100%` yüksekliği kilitliyor, `aspect-ratio` da     │
   │ genişliği ondan türetiyor. Sütun bu genişlikten darsa       │
   │ `max-width` devreye giriyor ama yükseklik sabit kaldığı     │
   │ için oran bozuluyor ve video sütundan TAŞIYORDU. Ekranı     │
   │ daraltınca videonun yarısı kayboluyordu.                    │
   │                                                              │
   │ Tarayıcılar bu çakışmayı sürüm sürüm farklı çözüyor;        │
   │ hangi kuralın kazandığı garanti değil. Ölçüp piksel         │
   │ vermek tek kesin yol.                                        │
   └──────────────────────────────────────────────────────────────┘

   Hesap: kutuya SIĞAN en büyük 9:16 dikdörtgen.
     genişlik  = min(alanGenislik, alanYukseklik * 9/16)
     yükseklik = genişlik * 16/9
   ══════════════════════════════════════════════════════════════ */

const ORAN = 9 / 16;

export default function VideoCerceve({
  children, radius = 18, dolgu = 0,
}: {
  children: ReactNode;
  radius?: number;
  /** Kenar boşluğu — hesaba dahil ediliyor */
  dolgu?: number;
}) {
  const alan = useRef<HTMLDivElement>(null);
  const [olcu, setOlcu] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = alan.current;
    if (!el) return;

    function hesapla() {
      const el2 = alan.current;
      if (!el2) return;

      const kutuG = el2.clientWidth - dolgu * 2;
      const kutuY = el2.clientHeight - dolgu * 2;
      if (kutuG <= 0 || kutuY <= 0) return;

      /* Sığan en büyük 9:16 */
      const g = Math.min(kutuG, kutuY * ORAN);
      const y = g / ORAN;

      setOlcu({ w: Math.floor(g), h: Math.floor(y) });
    }

    hesapla();

    /*
     * ⚠ ResizeObserver, `window.resize` DEĞİL.
     * Sütun genişliği yorum panelinin açılıp kapanmasıyla da
     * değişiyor; pencere boyutu sabit kalsa bile yeniden
     * ölçmek gerekiyor.
     */
    const go = new ResizeObserver(hesapla);
    go.observe(el);
    return () => go.disconnect();
  }, [dolgu]);

  return (
    <div
      ref={alan}
      style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        /* Izgara hücresinin taşmasını engelliyor */
        minWidth: 0, minHeight: 0, overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          width: olcu?.w ?? 0,
          height: olcu?.h ?? 0,
          borderRadius: radius,
          overflow: "hidden",
          background: "#000",
          boxShadow: "0 18px 50px rgba(0,0,0,.35)",
          /* Ölçüm bitene kadar görünmüyor — zıplama olmasın */
          opacity: olcu ? 1 : 0,
          transition: "opacity .18s ease",
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
