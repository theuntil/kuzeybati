"use client";
import { useEffect, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   ONAY PENCERESİ

   Tarayıcının `confirm()` kutusu yerine.

   ⚠ NEDEN KENDİ PENCEREMİZ?
   `confirm()` işletim sisteminin kutusunu açıyor: siteyle
   hiç uyuşmayan bir görünüm, koyu temayı bilmiyor, metni
   biçimlendirilemiyor ve mobilde adres çubuğunun altında
   garip duruyor. Ayrıca ana iş parçacığını kilitliyor.
   ══════════════════════════════════════════════════════════════ */

export default function OnayPenceresi({
  acik, baslik, aciklama, onayYazi = "Sil", tehlike = true,
  onOnay, onIptal,
}: {
  acik: boolean;
  baslik: string;
  aciklama?: string;
  onayYazi?: string;
  tehlike?: boolean;
  onOnay: () => void;
  onIptal: () => void;
}) {
  const [mobil, setMobil] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const olc = () => setMobil(!mq.matches);
    olc();
    mq.addEventListener("change", olc);
    return () => mq.removeEventListener("change", olc);
  }, []);

  useEffect(() => {
    if (!acik) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onIptal(); };
    window.addEventListener("keydown", esc);
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = eski;
    };
  }, [acik, onIptal]);

  if (mobil === null) return null;

  const dugmeOrtak: React.CSSProperties = {
    flex: 1, padding: "14px 18px", borderRadius: 12,
    fontSize: 14.5, fontWeight: 700, cursor: "pointer",
    border: "1px solid var(--bd)",
  };

  return (
    <>
      <div
        onClick={onIptal}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
          opacity: acik ? 1 : 0,
          pointerEvents: acik ? "auto" : "none",
          transition: "opacity .2s ease", zIndex: 260,
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-hidden={!acik}
        style={
          mobil
            ? {
                position: "fixed", left: 12, right: 12,
                bottom: acik ? 12 : -40,
                background: "var(--s1)", borderRadius: 20,
                padding: "26px 24px calc(22px + env(safe-area-inset-bottom))",
                boxSizing: "border-box", zIndex: 261,
                opacity: acik ? 1 : 0,
                pointerEvents: acik ? "auto" : "none",
                transition: "opacity .22s ease, bottom .28s cubic-bezier(.2,.9,.25,1.1)",
                boxShadow: "0 -6px 30px rgba(0,0,0,.32)",
              }
            : {
                position: "fixed", top: "50%", left: "50%",
                width: 400, maxWidth: "92vw",
                background: "var(--s1)", borderRadius: 18,
                padding: "30px 32px", boxSizing: "border-box", zIndex: 261,
                opacity: acik ? 1 : 0,
                pointerEvents: acik ? "auto" : "none",
                transform: acik
                  ? "translate(-50%,-50%) scale(1)"
                  : "translate(-50%,-50%) scale(.94)",
                transition: "opacity .2s ease, transform .22s cubic-bezier(.2,.9,.25,1.1)",
                boxShadow: "0 20px 60px rgba(0,0,0,.35)",
              }
        }
      >
        <h3 style={{
          fontSize: 17, fontWeight: 800,
          margin: 0, marginBottom: aciklama ? 8 : 22,
        }}>
          {baslik}
        </h3>
        {aciklama && (
          <p style={{
            fontSize: 14, lineHeight: 1.6,
            color: "var(--mu)", margin: "0 0 22px",
          }}>
            {aciklama}
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onIptal}
            style={{
              ...dugmeOrtak,
              background: "transparent", color: "var(--tx)",
            }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onOnay}
            style={{
              ...dugmeOrtak,
              border: "none",
              background: tehlike ? "#b91c1c" : "var(--tx)",
              color: tehlike ? "#fff" : "var(--bg)",
            }}
          >
            {onayYazi}
          </button>
        </div>
      </div>
    </>
  );
}
