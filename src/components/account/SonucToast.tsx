"use client";
import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

/* ══════════════════════════════════════════════════════════════
   KAYDETME SONUCU BİLDİRİMİ

   Adres çentiğinden okunuyor: `#kb=yayinlandi`.

   ⚠ NEDEN ÇENTİK?
   Kaydetme sonrası sayfa değişiyor; durumu React durumunda
   taşıyamıyoruz. Sorgu dizesi kullanılsaydı adres çubuğunda
   kalırdı ve okur sayfayı yenilediğinde bildirim tekrar
   çıkardı. Çentik okunduktan sonra siliniyor.

   ⚠ MEVCUT TOAST SİSTEMİ KULLANILIYOR.
   Projede zaten `useToast()` var; ayrı bir bildirim altyapısı
   kurmak ikisinin üst üste çıkmasına yol açardı.
   ══════════════════════════════════════════════════════════════ */

const METIN: Record<string, { yazi: string; tur: "success" | "info" | "error" }> = {
  yayinlandi:  { yazi: "Haberin yayınlandı", tur: "success" },
  beklemede:   { yazi: "Haberin onaya gönderildi", tur: "info" },
  guncellendi: { yazi: "Değişiklikler kaydedildi", tur: "success" },
  degisiklik_bekliyor: {
    yazi: "Değişikliğin onaya gönderildi — yayındaki sürüm aynı kaldı",
    tur: "info",
  },
  sifre_degisti: { yazi: "Şifren değiştirildi", tur: "success" },
  hata: { yazi: "Bir şeyler ters gitti", tur: "error" },
};

export default function SonucToast() {
  const toast = useToast();

  useEffect(() => {
    function oku() {
      const h = window.location.hash;
      if (!h.startsWith("#kb=")) return;

      const m = METIN[h.slice(4)];
      if (!m) return;

      toast.toast(m.yazi, m.tur);

      /* Yenilemede tekrar çıkmasın */
      history.replaceState(
        null, "",
        window.location.pathname + window.location.search,
      );
    }

    oku();
    window.addEventListener("hashchange", oku);
    return () => window.removeEventListener("hashchange", oku);
  }, [toast]);

  return null;
}
