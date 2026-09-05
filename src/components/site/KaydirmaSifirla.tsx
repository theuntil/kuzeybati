"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/* ══════════════════════════════════════════════════════════════
   SAYFA GEÇİŞİNDE BAŞA DÖN

   ┌─ YENİ SAYFA ORTASINDAN AÇILIYORDU ⚠️ ──────────────────────┐
   │ Bağlantılar `<Link>`e çevrildikten sonra tarayıcı sayfayı  │
   │ yeniden yüklemiyor; aynı belge üzerinde içerik değişiyor.  │
   │ Kaydırma konumu olduğu yerde kalıyor ve okur yeni haberi   │
   │ ortasından görüyordu.                                        │
   │                                                              │
   │ Next normalde başa kaydırıyor ama bu sayfalar akış          │
   │ (streaming) ile geliyor: sıfırlama, içerik yerleşmeden      │
   │ önce çalışıyor, sonra gelen içerik sayfayı uzatınca         │
   │ tarayıcı eski konumu geri getiriyor.                         │
   │                                                              │
   │ Burada sıfırlama, yol DEĞİŞTİKTEN sonra açıkça yapılıyor.  │
   └──────────────────────────────────────────────────────────────┘

   ⚠ ÇAPA BAĞLANTILARI KORUNUYOR.
   Adreste `#bolum` varsa okur belirli bir yere gitmek istiyor;
   ona dokunulmuyor.

   ⚠ GERİ/İLERİ TUŞU KORUNUYOR.
   Tarayıcının kendi geri gitme davranışında okur bıraktığı yere
   dönmeli. `popstate` sırasında sıfırlama atlanıyor.
   ══════════════════════════════════════════════════════════════ */

export default function KaydirmaSifirla() {
  const yol = usePathname();
  const sorgu = useSearchParams();

  /*
   * ┌─ SAYFA YENİLEYİNCE ZORLA BAŞA ATIYORDU ⚠️ ────────────────┐
   * │ İlk hâli her çalıştığında başa kaydırıyordu — İLK        │
   * │ YÜKLEMEDE de. F5'e basınca tarayıcı doğru şekilde okurun │
   * │ kaldığı yeri geri getiriyor, hemen ardından bu kod       │
   * │ sayfayı yukarı çekiyordu. Okur "biri elle yukarı aldı"   │
   * │ gibi görüyordu.                                            │
   * │                                                              │
   * │ Sıfırlama yalnızca YOL DEĞİŞTİĞİNDE yapılmalı. İlk       │
   * │ değer kaydediliyor ve o turda hiçbir şey yapılmıyor.     │
   * └──────────────────────────────────────────────────────────────┘
   */
  const oncekiYol = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const anahtar = `${yol}?${sorgu?.toString() ?? ""}`;

    /* İlk yükleme: tarayıcının geri getirdiği konuma dokunma */
    if (oncekiYol.current === null) {
      oncekiYol.current = anahtar;
      return;
    }
    if (oncekiYol.current === anahtar) return;
    oncekiYol.current = anahtar;

    if (window.location.hash) return;

    let geri = false;
    const isaretle = () => { geri = true; };
    window.addEventListener("popstate", isaretle);

    /*
     * İki kare bekleniyor: ilk boyama ve akışla gelen ilk
     * içerik yerleştikten sonra sıfırlanıyor. Tek karede
     * yapılırsa gelen içerik konumu tekrar kaydırıyor.
     */
    const z1 = requestAnimationFrame(() => {
      const z2 = requestAnimationFrame(() => {
        if (!geri) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
      return () => cancelAnimationFrame(z2);
    });

    return () => {
      window.removeEventListener("popstate", isaretle);
      cancelAnimationFrame(z1);
    };
  }, [yol, sorgu]);

  return null;
}
