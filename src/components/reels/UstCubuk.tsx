"use client";
import { useEffect, useState } from "react";
import { temaDegistir } from "@/lib/tema";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   REELS ÜST ÇUBUĞU

   Soldan sağa:  geri · gece modu · logo
   ══════════════════════════════════════════════════════════════ */

export default function UstCubuk({
  locale, mobil, logoLight, logoDark, sehirDugmesi,
}: {
  locale: string;
  mobil: boolean;
  logoLight: string | null;
  logoDark: string | null;
  /** Masaüstünde logonun soluna yerleşen şehir seçici */
  sehirDugmesi?: React.ReactNode;
}) {
  const [koyu, setKoyu] = useState(false);
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    setMonte(true);
    function oku() {
      setKoyu(document.documentElement.getAttribute("data-theme") === "dark");
    }
    oku();
    const g = new MutationObserver(oku);
    g.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
    return () => g.disconnect();
  }, []);

  /* Tema değişimi tek yerden: hem localStorage hem çerez yazılıyor */
  function temaDegistirTikla() { temaDegistir(); }

  /*
   * ⚠ MOBİLDE HER ZAMAN KOYU TEMA LOGOSU.
   *
   * Mobilde reels arka planı her koşulda siyah video. Açık tema
   * logosu (koyu renkli çizim) orada görünmüyordu. Masaüstünde
   * sayfa arka planı temaya uyduğu için normal davranış geçerli.
   *
   * Ayrıca eskiden iki logo da basılıp CSS ile gizleniyordu;
   * `data-theme` mobilde beklendiği gibi çalışmayınca ikisi
   * birden görünüyordu. Artık tek görsel basılıyor.
   */
  const logo = mobil
    ? (logoDark ?? logoLight)
    : (koyu ? (logoDark ?? logoLight) : (logoLight ?? logoDark));

  /*
   * ⚠ İKON RENGİ ZEMİNE GÖRE.
   *
   * Mobilde düğme videonun üstünde: beyaz doğru.
   * Masaüstünde sayfa arka planının üstünde: açık temada beyaz
   * ikon görünmüyordu. `var(--tx)` temayla birlikte dönüyor.
   */
  const ikonRengi = mobil ? "#fff" : "var(--tx)";

  const dugme: React.CSSProperties = {
    width: 38, height: 38, borderRadius: "50%",
    display: "grid", placeItems: "center",
    color: ikonRengi, textDecoration: "none",
    pointerEvents: "auto", flexShrink: 0,
    border: "none", cursor: "pointer", padding: 0,
  };

  return (
    <div style={{
      position: "fixed",
      top: mobil ? "calc(11px + env(safe-area-inset-top))" : 14,
      insetInlineStart: mobil ? 11 : 16,
      zIndex: 45,
      display: "flex", alignItems: "center", gap: 9,
      pointerEvents: "none",
    }}>
      <Link
        href={`/${locale}`}
        className={mobil ? "kb-cam" : "kb-cam kb-cam-acik"}
        aria-label="Geri"
        style={dugme}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      {/*
        Gece modu — YALNIZCA MASAÜSTÜ.

        ⚠ Mobilde reels arka planı her koşulda siyah video;
        tema değiştirmenin bu ekranda görünür bir karşılığı yok.
        Dar ekranda üç düğme logoyu da sıkıştırıyordu.
      */}
      {!mobil && (
        <button
          type="button"
          onClick={temaDegistirTikla}
          className="kb-cam kb-cam-acik"
          aria-label="Gece modu"
          title="Gece modu"
          style={dugme}
        >
          <span style={{
            display: "grid", placeItems: "center",
            width: 17, height: 17,
            transform: monte && koyu ? "rotate(-180deg)" : "rotate(0deg)",
            transition: "transform .42s cubic-bezier(.2,.9,.25,1.1)",
          }}>
            {monte && koyu ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden>
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
              </svg>
            )}
          </span>
        </button>
      )}

      {/*
        ŞEHİR DÜĞMESİ — YALNIZCA MASAÜSTÜ.

        ⚠ Önce videonun sağ üstündeydi; okur onu bir video
        denetimi sanıyordu. Yeri burası: geri ve gece modunun
        yanında, logonun hemen solunda — hepsi site gezinme
        düğmeleri.

        Mobilde sağ üstte kalıyor: dar ekranda soldaki şeride
        dördüncü düğme sığmıyor ve logoyu eziyor.
      */}
      {!mobil && sehirDugmesi}

      {logo && (
        <span style={{ display: "flex", alignItems: "center", height: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" style={{ height: 24, width: "auto", display: "block" }} />
        </span>
      )}
    </div>
  );
}
