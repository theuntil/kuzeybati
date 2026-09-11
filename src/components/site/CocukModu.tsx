"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   ÇOCUK MODU

   ┌─ ÜÇ DURUM VAR, İKİSİ DEĞİL ⚠️ ────────────────────────────┐
   │   true  → AI baktı, çocuklar için UYGUN                    │
   │   false → AI baktı, UYGUN DEĞİL → örtülür                  │
   │   null  → AI HİÇ BAKMADI → hiçbir şey yapılmaz             │
   │                                                              │
   │ `null`ı `false` saymak, AI'nın işlemediği binlerce haberi   │
   │ yanlışlıkla "sakıncalı" gösterirdi.                         │
   └──────────────────────────────────────────────────────────────┘

   ┌─ SUNUCU VE İSTEMCİ UYUŞMAZLIĞI ⚠️ ────────────────────────┐
   │ Tercih `localStorage`'da. Sunucu onu bilemiyor; ilk çizimde │
   │ mod KAPALI varsayılıyor, sonra istemcide açılıyor. Doğrudan │
   │ okusaydık React "hydration mismatch" hatası verirdi.        │
   │                                                              │
   │ `hazir` bayrağı bu yüzden var: yerleşim oturana kadar örtü  │
   │ çizilmiyor, ekran zıplamıyor.                                │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const ANAHTAR = "kb_cocuk";

interface Baglam {
  acik: boolean;
  hazir: boolean;
  degistir: () => void;
}

const Ctx = createContext<Baglam>({ acik: false, hazir: false, degistir: () => {} });

export function useCocukModu() {
  return useContext(Ctx);
}

export function CocukModuSaglayici({ children }: { children: React.ReactNode }) {
  const [acik, setAcik] = useState(false);
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    try {
      setAcik(localStorage.getItem(ANAHTAR) === "1");
    } catch { /* gizli sekmede depolama kapalı */ }
    setHazir(true);
  }, []);

  const degistir = useCallback(() => {
    setAcik((o) => {
      const y = !o;
      try { localStorage.setItem(ANAHTAR, y ? "1" : "0"); } catch { /* yok say */ }
      /*
       * Gövdeye işaret konuyor: CSS bazı yerlerde React'e
       * gerek kalmadan tepki verebiliyor (yazdırma, geçişler).
       */
      document.documentElement.dataset.cocuk = y ? "1" : "0";
      return y;
    });
  }, []);

  useEffect(() => {
    if (hazir) document.documentElement.dataset.cocuk = acik ? "1" : "0";
  }, [acik, hazir]);

  return (
    <Ctx.Provider value={{ acik, hazir, degistir }}>{children}</Ctx.Provider>
  );
}

/**
 * Bu haber çocuk modunda örtülmeli mi?
 *
 * @param guvenli  `article_ai.cocuk_guvenli` — true/false/null
 */
export function ortulmeli(acik: boolean, guvenli: boolean | null | undefined): boolean {
  // ⚠ Yalnızca AÇIKÇA `false` olanlar. `null` işlenmemiş demek.
  return acik && guvenli === false;
}
