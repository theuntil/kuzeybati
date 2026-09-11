"use client";
import { useEffect } from "react";

/* ══════════════════════════════════════════════════════════════
   KAYDIRINCA ŞERİTLERİ GİZLE

   Sayfa aşağı kaydırılınca borsa şeridi (header üstü) ve
   kategori/şehir şeridi (header altı) kapanıyor; yalnızca ana
   satır kalıyor. Yukarı dönünce geri geliyorlar.

   ┌─ TİTREME SORUNU ⚠️ ───────────────────────────────────────┐
   │ Tek bir eşik kullanılırsa, tam o noktada şeritler açılıp   │
   │ kapanıyor: şerit kapanınca sayfa yukarı kayıyor, eşiğin    │
   │ altına düşüyor, şerit açılıyor, tekrar aşağı kayıyor…      │
   │                                                              │
   │ İKİ AYRI EŞİK var (histerezis): 120 pikselde kapanıyor,    │
   │ 60 pikselde açılıyor. Aradaki 60 piksellik boşluk döngüyü  │
   │ kırıyor.                                                     │
   └──────────────────────────────────────────────────────────────┘

   ┌─ HER KAYDIRMADA HESAP YAPILMIYOR ⚠️ ──────────────────────┐
   │ `scroll` olayı saniyede yüzlerce kez tetikleniyor.         │
   │ `requestAnimationFrame` ile kare başına bir kez            │
   │ çalışıyor — akıcı kalıyor, işlemci ısınmıyor.              │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const KAPAT = 120;   // bu pikselden sonra şeritler kapanır
const AC    = 60;    // bu pikselin üstüne dönünce açılır

export default function HeaderDaralt() {
  useEffect(() => {
    const kok = document.documentElement;
    let bekliyor = false;
    let kapali = false;

    function olc() {
      bekliyor = false;
      const y = window.scrollY;

      /*
       * ⚠ İKİ EŞİK.
       * Tek eşik olsaydı sınırda sürekli açılıp kapanırdı.
       */
      if (!kapali && y > KAPAT) {
        kapali = true;
        kok.dataset.headerDar = "1";
      } else if (kapali && y < AC) {
        kapali = false;
        kok.dataset.headerDar = "0";
      }
    }

    function kaydir() {
      if (bekliyor) return;
      bekliyor = true;
      requestAnimationFrame(olc);
    }

    olc();   // sayfa ortadan açılmış olabilir
    window.addEventListener("scroll", kaydir, { passive: true });
    return () => {
      window.removeEventListener("scroll", kaydir);
      delete kok.dataset.headerDar;
    };
  }, []);

  return null;
}
