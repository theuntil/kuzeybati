"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { Deprem } from "@/app/api/deprem/route";
import { renk } from "./DepremHarita";

/* ══════════════════════════════════════════════════════════════
   DEPREM AYRINTI PANELİ

   Masaüstünde sağdan kayarak, mobilde alttan açılıyor.

   ┌─ KAPANIŞ ANİMASYONU İÇİN GECİKME ⚠️ ──────────────────────┐
   │ Panel doğrudan kaldırılırsa DOM'dan anında silinir ve     │
   │ kapanma animasyonu hiç görünmez. `kapaniyor` durumu       │
   │ animasyon süresi kadar bekletiyor, sonra sökülüyor.       │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function DepremDetay({
  deprem, onKapat,
}: {
  deprem: Deprem | null;
  onKapat: () => void;
}) {
  const [gosterilen, setGosterilen] = useState<Deprem | null>(deprem);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    if (deprem) {
      setGosterilen(deprem);
      /*
       * İki kare beklemek gerekiyor: öğe önce kapalı konumda
       * basılmalı, sonra açık sınıfı eklenmeli. Aksi hâlde
       * tarayıcı geçişi hiç çalıştırmıyor.
       */
      const z = requestAnimationFrame(() => setAcik(true));
      return () => cancelAnimationFrame(z);
    }

    setAcik(false);
    const z = setTimeout(() => setGosterilen(null), 280);
    return () => clearTimeout(z);
  }, [deprem]);

  useEffect(() => {
    if (!deprem) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [deprem, onKapat]);

  if (!gosterilen) return null;

  const d = gosterilen;
  const c = renk(d.buyukluk);

  const tarih = (() => {
    const t = new Date(d.tarih.replace(" ", "T"));
    if (Number.isNaN(t.getTime())) return d.tarih;
    return t.toLocaleString("tr-TR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  })();

  const satirlar = [
    { ad: "Büyüklük", deger: d.buyukluk.toFixed(1) },
    { ad: "Derinlik", deger: `${d.derinlik.toFixed(1)} km` },
    { ad: "Tarih", deger: tarih },
    { ad: "İl", deger: d.il ?? "—" },
    { ad: "İlçe", deger: d.ilce ?? "—" },
    { ad: "Enlem", deger: d.enlem.toFixed(4) },
    { ad: "Boylam", deger: d.boylam.toFixed(4) },
  ];

  return (
    <>
      <div
        onClick={onKapat}
        className={`kb-detay-perde${acik ? " acik" : ""}`}
        aria-hidden
      />

      <aside
        className={`kb-deprem-detay${acik ? " acik" : ""}`}
        role="dialog"
        aria-label="Deprem ayrıntısı"
      >
        {/* Mobilde aşağı çekilebileceğini gösteren tutamak */}
        <div className="kb-deprem-detay-tutamak" aria-hidden>
          <span />
        </div>

        <div className="kb-deprem-detay-ust">
          <span
            className="kb-deprem-detay-mag"
            style={{ background: `${c}22`, color: c }}
          >
            {d.buyukluk.toFixed(1)}
          </span>

          <span className="kb-deprem-detay-yer">{d.yer}</span>

          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="kb-deprem-detay-kapat"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <dl className="kb-deprem-detay-liste">
          {satirlar.map((x) => (
            <div key={x.ad}>
              <dt>{x.ad}</dt>
              <dd>{x.deger}</dd>
            </div>
          ))}
        </dl>

        {/*
          Harici harita bağlantısı — okur konumu tam olarak
          görmek isterse.
        */}
        <a
          className="kb-deprem-detay-dis"
          href={`https://www.openstreetmap.org/?mlat=${d.enlem}&mlon=${d.boylam}#map=11/${d.enlem}/${d.boylam}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Haritada aç
        </a>
      </aside>
    </>
  );
}
