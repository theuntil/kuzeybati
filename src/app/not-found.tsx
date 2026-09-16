import Link from "next/link";
/**
 * 404 — KÖK
 *
 * ⚠ BU DOSYA OLMADAN NEXT'İN ÇIPLAK SAYFASI ÇIKIYOR.
 * Dil öneki olmayan ve middleware'in yönlendiremediği adresler
 * (`/olmayan-birsey` gibi) buraya düşüyor. Kendi `<html>`
 * gövdesini kuruyor çünkü `[locale]/layout.tsx` bu seviyede
 * çalışmıyor — header, footer ve tema değişkenleri burada yok.
 *
 * Tema betiği tekrarlanıyor: koyu tema seçmiş okur bu sayfada
 * bir kare beyaz ekran görmesin diye.
 */
const temaBetigi = `
(function(){try{
  /*
   * ⚠ ÖNCE localStorage.
   * Bu sayfa statik üretiliyor, yani HTML'de tema yok. Çerez
   * silinmiş ama localStorage duruyorsa okurun seçimi yine de
   * biliniyor; sisteme düşmeden önce oraya bakılıyor.
   */
  var s = null; try { s = localStorage.getItem('kb-theme'); } catch (e) {}
  var c = document.cookie.match(/(?:^|; )kb-theme=(light|dark)/);
  var t = (s === 'light' || s === 'dark') ? s
        : c ? c[1]
        : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', t);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();
`;

export default function KokNotFound() {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaBetigi }} />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "40px 20px",
          background: "var(--bg, #0F0F0F)",
          color: "var(--tx, #EFF3F4)",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p style={{
            fontSize: 12.5, fontWeight: 800, letterSpacing: ".1em",
            opacity: .55, margin: "0 0 10px",
          }}>
            404
          </p>
          <h1 style={{
            fontSize: 30, fontWeight: 800, letterSpacing: "-.01em",
            margin: "0 0 12px",
          }}>
            Sayfa bulunamadı
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, opacity: .7, margin: "0 0 26px" }}>
            Aradığın sayfa taşınmış, adı değişmiş ya da hiç var
            olmamış olabilir.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "13px 26px", borderRadius: 14,
              background: "var(--tx, #EFF3F4)", color: "var(--bg, #0F0F0F)",
              fontSize: 15, fontWeight: 700, textDecoration: "none",
            }}
          >
            Ana sayfaya dön
          </Link>
        </div>
      </body>
    </html>
  );
}
