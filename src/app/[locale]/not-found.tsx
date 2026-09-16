import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * 404 — DİL ÖNEKLİ SAYFALAR
 *
 * ⚠ KÖKTE AYRI BİR 404 DAHA VAR (`app/not-found.tsx`).
 * Next.js `not-found.tsx`'i yalnızca kendi segmentinde ve
 * altında kullanıyor. Bu dosya `/tr/olmayan-sayfa` gibi
 * adresleri karşılıyor; dil öneki hiç olmayan adresler
 * (middleware'in yönlendiremediği durumlar) kökteki dosyaya
 * düşüyor. Biri olmazsa orada Next'in çıplak varsayılan
 * sayfası çıkıyor — header, footer, tema hiçbiri yok.
 */
export default function NotFound() {
  /*
   * ⚠ YALNIZCA HER ZAMAN VAR OLAN ADRESLER.
   * Bir ara buraya "/gundem" de konmuştu; o bir KATEGORİ ve
   * panelden silinebiliyor. 404 sayfasından 404'e giden bir
   * bağlantı en kötü seçenek. Ana sayfa ve arama sabit
   * rotalar, hiçbir koşulda kaybolmuyorlar.
   */
  const yollar = [
    { ad: "Ana sayfa", href: "/", ikon: "home" as const },
    { ad: "Arama", href: "/arama", ikon: "search" as const },
  ];

  return (
    <div style={{
      padding: "72px var(--gut) 90px",
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center",
    }}>
      <span style={{
        display: "grid", placeItems: "center",
        width: 76, height: 76, borderRadius: "50%",
        background: "var(--s2)", color: "var(--mu)", marginBottom: 22,
      }}>
        <Icon name="search" size={30} />
      </span>

      <p style={{
        fontSize: 12.5, fontWeight: 800, letterSpacing: ".1em",
        color: "var(--mu)", margin: "0 0 10px",
      }}>
        404
      </p>

      <h1 style={{
        fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800,
        letterSpacing: "-.01em", margin: "0 0 12px",
      }}>
        Sayfa bulunamadı
      </h1>

      <p style={{
        fontSize: 15.5, lineHeight: 1.65, color: "var(--mu)",
        margin: "0 0 28px", maxWidth: 440,
      }}>
        Aradığın sayfa taşınmış, adı değişmiş ya da hiç var
        olmamış olabilir.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {yollar.map((y, i) => (
          <Link
            key={y.href}
            href={y.href}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 20px", borderRadius: 14,
              fontSize: 14.5, fontWeight: 700, textDecoration: "none",
              background: i === 0 ? "var(--tx)" : "var(--s2)",
              color: i === 0 ? "var(--bg)" : "var(--tx)",
              border: i === 0 ? "none" : "1px solid var(--bd)",
            }}
          >
            <Icon name={y.ikon} size={16} />
            {y.ad}
          </Link>
        ))}
      </div>
    </div>
  );
}
