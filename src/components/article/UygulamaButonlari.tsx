"use client";
import { useEffect, useState } from "react";
import { publicConfig } from "@/lib/config";

/* ══════════════════════════════════════════════════════════════
   UYGULAMA MAĞAZASI DÜĞMELERİ

   ┌─ CİHAZA GÖRE ⚠️ ──────────────────────────────────────────┐
   │ Android'de yalnızca Google Play, iPhone'da yalnızca App    │
   │ Store, masaüstünde ikisi birden.                            │
   │                                                              │
   │ iPhone kullanıcısına Play Store düğmesi göstermek boşa yer │
   │ kaplamaktan öte — basınca indiremeyeceği bir sayfaya       │
   │ gidiyor.                                                     │
   └──────────────────────────────────────────────────────────────┘

   ┌─ CİHAZ İSTEMCİDE BELİRLENİYOR ⚠️ ─────────────────────────┐
   │ Sunucu tarafında yapılsaydı önbelleğe alınan sayfa yanlış  │
   │ düğmeyi taşırdı: ilk isteği Android yapmışsa herkes Play   │
   │ Store görürdü.                                               │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function UygulamaButonlari({
  appStore, playStore, appBadge, playBadge,
}: {
  appStore: string | null;
  playStore: string | null;
  /**
   * Yüklenmiş rozet görselleri.
   *
   * ⚠ Apple ve Google'ın rozetleri marka kurallarına tabi;
   * kendi çizimimiz kural dışı kalabiliyor. Panelden resmî
   * rozet yüklenince o kullanılıyor, yoksa gömülü çizim.
   */
  appBadge?: string | null;
  playBadge?: string | null;
}) {
  const [cihaz, setCihaz] = useState<"ios" | "android" | "masaustu" | null>(null);
  const cdn = publicConfig().cdnBase.replace(/\/+$/, "");
  const rozet = (k: string | null | undefined) => (k ? `${cdn}/${k}` : null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setCihaz(
      /iPhone|iPad|iPod/.test(ua) ? "ios"
      : /Android/.test(ua) ? "android"
      : "masaustu",
    );
  }, []);

  /* Cihaz bilinene kadar çizme: yanlış düğme bir an görünmesin */
  if (!cihaz) return null;

  const ios = cihaz !== "android" && appStore;
  const android = cihaz !== "ios" && playStore;
  if (!ios && !android) return null;

  /*
   * ⚠ HER ZAMAN DÜĞME.
   *
   * Rozet yüklenince yalnızca resim gösteriliyordu ve minicik
   * kalıyordu. Artık yüklenen görsel düğmenin İKONU olarak
   * kullanılıyor; yazı ve indirme oku her hâlükârda yerinde.
   */
  const kutu: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 12,
    /* İç dolgu geniş: düğme sıkışık duruyordu */
    height: 52, padding: "0 26px", borderRadius: 15,
    background: "var(--s2)", color: "var(--tx)",
    textDecoration: "none", whiteSpace: "nowrap",
    border: "1px solid var(--bd)",
  };

  const yaziKutu: React.CSSProperties = {
    display: "flex", flexDirection: "column",
    alignItems: "flex-start", lineHeight: 1.15,
  };
  const ustYazi: React.CSSProperties = { fontSize: 9.5, color: "var(--mu)", fontWeight: 600 };
  const altYazi: React.CSSProperties = { fontSize: 13.5, fontWeight: 800, letterSpacing: "-.01em" };

  /** Sağdaki minik indirme oku */
  const indirOk = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.1"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.5, marginInlineStart: 2 }} aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );

  return (
    <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
      {ios && (
        <a href={appStore!} target="_blank" rel="noopener noreferrer"
          style={kutu} aria-label="App Store">
          {rozet(appBadge) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={rozet(appBadge)!} alt=""
              style={{ height: 20, width: "auto", flexShrink: 0 }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
              style={{ flexShrink: 0 }} aria-hidden>
              <path d="M16.7 1.4c.1 1.1-.3 2.2-1 3-.7.8-1.9 1.5-3 1.4-.1-1.1.4-2.2 1-3 .8-.8 2-1.4 3-1.4zM20 17.2c-.5 1.1-.8 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9-1.9 0-2.4.9-3.7.9-1.6 0-2.8-1.6-3.7-3-2.5-3.9-2.8-8.5-1.2-10.9 1.1-1.7 2.8-2.7 4.4-2.7 1.6 0 2.6 1 3.9 1 1.3 0 2-1 3.8-1 1.4 0 2.9.7 4 2-3.5 1.9-2.9 6.9.4 8.9z" />
            </svg>
          )}
          <span style={yaziKutu}>
            <span style={ustYazi}>İndir</span>
            <span style={altYazi}>App Store</span>
          </span>
          {indirOk}
        </a>
      )}

      {android && (
        <a href={playStore!} target="_blank" rel="noopener noreferrer"
          style={kutu} aria-label="Google Play">
          {rozet(playBadge) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={rozet(playBadge)!} alt=""
              style={{ height: 20, width: "auto", flexShrink: 0 }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24"
              style={{ flexShrink: 0 }} aria-hidden>
              <path fill="#00D7FE" d="M3.6 1.8c-.3.3-.5.8-.5 1.4v17.6c0 .6.2 1.1.5 1.4l.1.1 9.9-9.9v-.2L3.6 1.8z" />
              <path fill="#FFBC00" d="m16.8 15.7-3.2-3.3v-.2l3.2-3.3.1.1 3.9 2.2c1.1.6 1.1 1.6 0 2.3l-4 2.2z" />
              <path fill="#FF3A44" d="m16.9 15.6-3.3-3.3-10 10c.4.4 1 .4 1.7.1l11.6-6.8z" />
              <path fill="#00F076" d="M16.9 8.9 5.3 2.2c-.7-.4-1.3-.4-1.7.1l10 10 3.3-3.4z" />
            </svg>
          )}
          <span style={yaziKutu}>
            <span style={ustYazi}>İndir</span>
            <span style={altYazi}>Google Play</span>
          </span>
          {indirOk}
        </a>
      )}
    </div>
  );
}
