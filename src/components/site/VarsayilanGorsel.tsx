"use client";
import { useEffect, useState } from "react";

/**
 * GÖRSELİ OLMAYAN YERDE VARSAYILAN GÖRSEL
 *
 * ⚠ Tema istemcide belirleniyor.
 * Sunucuda yapılsaydı önbelleğe alınan sayfa yanlış görseli
 * taşırdı: ilk isteği açık temadaki biri yapmışsa herkes onu
 * görürdü.
 *
 * Ayar boşsa hiçbir şey çizilmiyor — kap kendi zeminiyle
 * kalıyor, eskisi gibi.
 */
export default function VarsayilanGorsel() {
  const [karanlik, setKaranlik] = useState(false);
  const [adres, setAdres] = useState<{ acik: string | null; koyu: string | null }>(
    { acik: null, koyu: null },
  );

  useEffect(() => {
    const kok = document.documentElement;
    const olc = () => setKaranlik(kok.dataset.theme === "dark");
    olc();

    /* Tema değişince güncellensin */
    /*
     * ⚠ ADRESLER GÖVDEDEN OKUNUYOR, PROP OLARAK GEÇMİYOR.
     *
     * Bu bileşen onlarca kart bileşeninin içinde kullanılıyor;
     * ayarı her birine prop olarak taşımak hepsinin imzasını
     * değiştirmek demekti. Yerleşim `<body>` üzerine yazıyor,
     * bileşen oradan okuyor.
     */
    setAdres({
      acik: document.body.dataset.ph || null,
      koyu: document.body.dataset.phDark || null,
    });

    const g = new MutationObserver(olc);
    g.observe(kok, { attributes: true, attributeFilter: ["data-theme"] });
    return () => g.disconnect();
  }, []);

  const src = (karanlik ? adres.koyu || adres.acik : adres.acik) ?? null;
  if (!src) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        objectFit: "cover",
      }}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
