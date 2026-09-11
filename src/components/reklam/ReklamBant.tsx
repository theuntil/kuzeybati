"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/* ══════════════════════════════════════════════════════════════
   REKLAM BANDI

   Belirli noktalarda tek bir yatay reklam. Şerit sisteminden
   TAMAMEN AYRI: orası döngü hâlinde akan bir sütun, burası
   sabit tek bir görsel.

   ⚠ MOBİL VE MASAÜSTÜ İÇİN AYRI GÖRSEL.
   İkisi de yüklenmişse ekran genişliğine göre biri seçiliyor.
   Yalnızca biri varsa o kullanılıyor — eksik görsel yüzünden
   alan boş kalmıyor.
   ══════════════════════════════════════════════════════════════ */

interface Reklam {
  id: string;
  gorsel_key: string;
  mobil_key: string | null;
  hedef_url: string;
}

export type BantYeri = "article_top" | "article_bottom" | "home_top";

export default function ReklamBant({
  yer, cdnBase, aktif = true,
}: { yer: BantYeri; cdnBase: string; aktif?: boolean }) {
  const [r, setR] = useState<Reklam | null>(null);
  const [mobil, setMobil] = useState(false);
  const cdn = cdnBase.replace(/\/+$/, "");

  useEffect(() => {
    const olc = () => setMobil(window.innerWidth < 768);
    olc();
    window.addEventListener("resize", olc);
    return () => window.removeEventListener("resize", olc);
  }, []);

  useEffect(() => {
    if (!aktif) return;   // kapalıysa istek yok
    let iptal = false;
    void (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("public_reklamlar")
        .select("id, gorsel_key, mobil_key, hedef_url")
        .eq("yer", yer)
        .order("sira")
        .limit(1)
        .maybeSingle();

      if (iptal) return;
      if (error) {
        console.error(`[REKLAM] ${yer} okunamadı:`, error.message);
        return;
      }
      setR((data ?? null) as Reklam | null);
    })();

    return () => { iptal = true; };
  }, [yer, aktif]);

  if (!aktif || !r) return null;

  /* Mobilde mobil görsel varsa o, yoksa masaüstü görseli */
  const anahtar = mobil ? (r.mobil_key ?? r.gorsel_key) : r.gorsel_key;

  return (
    <a
      href={r.hedef_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="kb-reklam-bant"
      aria-label="Reklam"
      onClick={() => {
        void supabaseBrowser()
          .rpc("reklam_tiklandi", { p_id: r.id })
          .then(() => undefined, () => undefined);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${cdn}/${anahtar}`}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
