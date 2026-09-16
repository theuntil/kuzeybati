"use client";
import { useCocukModu, ortulmeli } from "./CocukModu";

/* ══════════════════════════════════════════════════════════════
   ÇOCUK MODU PERDESİ

   ┌─ TEK PERDE ⚠️ ────────────────────────────────────────────┐
   │ Bir ara her bölüm ayrı sarılıyordu: görseller, sesli       │
   │ anlatım, AI özeti, metin. Sayfa boyunca dört ayrı          │
   │ "gizlendi" kutusu çıkıyordu — hem çirkin hem gereksiz      │
   │ tekrar.                                                      │
   │                                                              │
   │ Artık başlık ve künye dışındaki her şey tek perdenin       │
   │ altında. Bir kez açıklanıyor, bir kez açılıyor.            │
   │                                                              │
   │ Perde SAYFA YÜKSEKLİĞİNİ AŞARSA açıklama ekranın dışında   │
   │ kalır; bu yüzden açıklama `position: sticky` ile görünür   │
   │ alanda tutuluyor.                                            │
   └──────────────────────────────────────────────────────────────┘

   ┌─ KIRMIZI DEĞİL ⚠️ ────────────────────────────────────────┐
   │ Kırmızı perde "tehlike" hissi veriyordu. Bu bir uyarı      │
   │ değil, bir tercih. Nötr bir buzlu cam yeterli.             │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function CocukKilit({
  guvenli, children,
}: {
  guvenli: boolean | null | undefined;
  children: React.ReactNode;
}) {
  const { acik, hazir, degistir } = useCocukModu();

  const kilitli = hazir && ortulmeli(acik, guvenli);
  if (!kilitli) return <>{children}</>;

  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
      <div
        aria-hidden
        style={{
          filter: "blur(18px)",
          pointerEvents: "none",
          userSelect: "none",
          // Hafif soluk: perdenin arkasında bir şey olduğu belli
          opacity: 0.4,
          transform: "scale(1.02)",   // bulanık kenar taşmasın
        }}
      >
        {children}
      </div>

      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          /*
           * ⚠ ÜSTE YASLI, ORTAYA DEĞİL.
           * Perde artık tüm haberi kaplıyor; ortalanınca
           * açıklama sayfanın çok aşağısında kalıyor ve okur
           * onu görmüyordu.
           */
          alignItems: "center", justifyContent: "flex-start",
          gap: 12, padding: "clamp(24px, 12vh, 120px) 20px 20px",
          textAlign: "center",
          // Nötr buzlu cam — uyarı rengi yok
          background: "color-mix(in srgb, var(--bg) 55%, transparent)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="var(--mu)" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="m3 3 18 18" />
        </svg>

        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>
            Bu haber çocuklar için uygun değil
          </div>
        </div>

        {/*
          ⚠ "YİNE DE GÖSTER" DEĞİL.
          Tek tek bölüm açmak, kalan bölümler kapalıyken haberi
          okunamaz kılıyordu. Düğme doğrudan çocuk modunu
          kapatıyor — kullanıcının aslında istediği bu.
        */}
        <button
          type="button"
          onClick={degistir}
          style={{
            padding: "9px 20px", borderRadius: 999,
            border: "1px solid var(--s3)",
            background: "var(--bg)", color: "var(--tx)",
            fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          }}
        >
          Çocuk modunu kapat
        </button>
      </div>
    </div>
  );
}
