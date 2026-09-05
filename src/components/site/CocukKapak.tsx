"use client";
import { useCocukModu, ortulmeli } from "./CocukModu";

/**
 * Haber kartı kapak örtüsü.
 *
 * Çocuk modunda sakıncalı haberin kapağı yarı saydam kırmızıyla
 * kaplanıyor. Kart TIKLANABİLİR kalıyor — üstüne basınca habere
 * gidiyor; okur "neden kırmızı" diye merak edip açabilmeli.
 *
 * ⚠ Kart bileşenlerine dokunulmuyor. Bu örtü kapak görselinin
 * üstüne konumlanıyor; her kart türüyle çalışıyor.
 */
export default function CocukKapak({
  guvenli,
}: {
  guvenli: boolean | null | undefined;
}) {
  const { acik, hazir } = useCocukModu();
  if (!hazir || !ortulmeli(acik, guvenli)) return null;

  return (
    <span
      aria-label="Çocuklar için uygun değil"
      title="Çocuklar için uygun değil"
      style={{
        position: "absolute", inset: 0, zIndex: 2,
        /*
         * ⚠ ORTADA, SOL ALTTA DEĞİL.
         * Önce sol altta küçük bir "Gizlendi" rozeti vardı:
         * neyin neden gizlendiğini anlatmıyordu ve gözden
         * kaçıyordu. Artık ortada, açık bir cümleyle.
         */
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 8, padding: 12, textAlign: "center",
        /*
         * ⚠ KIRMIZI DEĞİL, NÖTR BUZLU CAM.
         * Kırmızı perde "tehlike" hissi veriyordu; bu bir uyarı
         * değil, kullanıcının kendi tercihi.
         */
        background: "color-mix(in srgb, var(--bg) 45%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        pointerEvents: "none",   // tıklama alttaki bağlantıya geçsin
        borderRadius: "inherit",
      }}
    >
      {/* Kapalı göz — "gizli" anlamını taşıyan tek simge */}
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden
        style={{ color: "var(--tx)", opacity: .85, flexShrink: 0 }}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="m3 3 18 18" />
      </svg>

      <span
        style={{
          color: "var(--tx)",
          fontSize: 12.5, fontWeight: 700, lineHeight: 1.35,
          maxWidth: "92%",
          /*
           * ⚠ KAPATMA DÜĞMESİ YOK.
           * Haber sayfasında zaten bir açma düğmesi var; kartta
           * ikincisi hem yeri daraltıyor hem de tıklamayı
           * karıştırıyordu. Kart normal şekilde basılabiliyor,
           * habere gidiyor.
           */
        }}
      >
        Bu haber çocuklar için uygun değil
      </span>
    </span>
  );
}
