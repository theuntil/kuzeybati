"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/* ══════════════════════════════════════════════════════════════
   SAYFADA KALMA SÜRESİ

   ┌─ ZİYARET KAYDI ARTIK BURADA DEĞİL ⚠️ ─────────────────────┐
   │ Kayıt MIDDLEWARE'de yazılıyor — her istekte, sunucuda,     │
   │ önbellekten önce. Engellenemez, atlanamaz.                  │
   │                                                              │
   │ Bu bileşen yalnızca SÜREYİ ölçüyor: sunucu okurun sayfada  │
   │ ne kadar kaldığını bilemez. Süre gelmezse ziyaret yine      │
   │ sayılmış oluyor — yalnızca "kaç saniye kaldı" eksik kalıyor.│
   └──────────────────────────────────────────────────────────────┘

   ESKİ AÇIKLAMA

   ┌─ HABER OKUMASINDAN AYRI ⚠️ ───────────────────────────────┐
   │ article_views → haberin OKUNMA sayısı (4 sn kuralı)        │
   │ page_views    → her SAYFA ziyareti                          │
   │ Toplanmıyorlar; farklı sorulara cevap veriyorlar.           │
   └──────────────────────────────────────────────────────────────┘

   ┌─ SÜRE ÖLÇÜMÜ ⚠️ ──────────────────────────────────────────┐
   │ Sayfa açılınca kayıt yazılıyor ve id dönüyor. Sayfa        │
   │ kapanırken `sendBeacon` ile aynı id'ye süre yazılıyor.     │
   │                                                              │
   │ `sendBeacon` şart: normal `fetch` sayfa kapanırken iptal   │
   │ ediliyor ve süre hiç ulaşmıyor. Beacon tarayıcı tarafından │
   │ kuyruğa alınıp arka planda gönderiliyor.                    │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

function sayfaTuru(yol: string): string {
  const p = yol.replace(/^\/(tr|en|ar|ru)(?=\/|$)/, "") || "/";
  if (p === "/") return "anasayfa";
  if (p.startsWith("/haber/")) return "haber";
  if (p.startsWith("/kategori/")) return "kategori";
  if (p.startsWith("/etiket/")) return "etiket";
  if (p.startsWith("/sehir/")) return "sehir";
  if (p.startsWith("/arama")) return "arama";
  if (p.startsWith("/yazar/")) return "yazar";
  if (p.startsWith("/sayfa/")) return "sayfa";
  if (p.startsWith("/giris") || p.startsWith("/kayit")) return "hesap";
  return "diger";
}

/**
 * Oturum kimliği.
 *
 * `sessionStorage` — sekme kapanınca siliniyor, kalıcı iz
 * bırakmıyor. Sunucuda ayrıca karma alınıyor; ham değer
 * veritabanına hiç girmiyor.
 */
function oturum(): string {
  try {
    const k = "kb_s";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "anon";   // gizli sekmede depolama kapalı olabilir
  }
}

/** Cihaz — ekran genişliğinden. User-agent güvenilmez ve kaldırılıyor. */
function cihaz(): string {
  const g = window.innerWidth;
  return g < 768 ? "mobile" : g < 1024 ? "tablet" : "desktop";
}

export default function SayfaTakip({ locale }: { locale: string }) {
  const yol = usePathname();
  const sorgu = useSearchParams();

  const sonYol = useRef<string | null>(null);
  const kayitId = useRef<number | null>(null);
  const baslangic = useRef<number>(Date.now());

  useEffect(() => {
    if (!yol) return;

    // Arama sayfasında sorgu da anlamlı; diğerlerinde değil
    const tam = yol.startsWith("/arama") && sorgu?.get("q")
      ? `${yol}?q=${sorgu.get("q")}`
      : yol;

    if (sonYol.current === tam) return;

    /** Önceki sayfanın süresini gönder */
    const sureyiGonder = () => {
      if (kayitId.current === null) return;
      const sn = Math.round((Date.now() - baslangic.current) / 1000);
      if (sn < 1) return;
      const govde = JSON.stringify({
        kind: "sure", id: kayitId.current, seconds: sn,
      });
      try {
        // Beacon sayfa kapanırken bile gidiyor
        navigator.sendBeacon("/api/izle", new Blob([govde], { type: "application/json" }));
      } catch {
        void fetch("/api/izle", { method: "POST", body: govde, keepalive: true });
      }
      kayitId.current = null;
    };

    sureyiGonder();
    sonYol.current = tam;

    /*
     * 800 ms bekleniyor: hızlı geçilen sayfalar (yanlış tıklama,
     * yönlendirme zinciri) sayılmasın. Okuma sayacındaki 4
     * saniyeden kısa — burada "girdi mi" ölçülüyor.
     */
    const zaman = setTimeout(() => {
      let kaynak: string | null = null;
      try {
        kaynak = document.referrer || null;
        // Kendi sayfalarımız arası geçiş kaynak sayılmaz
        if (kaynak && new URL(kaynak).hostname === window.location.hostname) {
          kaynak = null;
        }
      } catch { /* bozuk referrer */ }

      baslangic.current = Date.now();

      void fetch("/api/izle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: tam, type: sayfaTuru(tam), session: oturum(),
          locale, referrer: kaynak, platform: cihaz(),
          screen_w: window.innerWidth,
        }),
      })
        .then((r) => r.json())
        .then((j: { id?: number }) => { kayitId.current = j?.id ?? null; })
        .catch(() => { /* ağ hatası: ziyaret sayılmaz, sayfa etkilenmez */ });
    }, 800);

    /* Sekme kapanırken / arka plana alınırken süreyi gönder */
    const gizlendi = () => { if (document.visibilityState === "hidden") sureyiGonder(); };
    document.addEventListener("visibilitychange", gizlendi);
    window.addEventListener("pagehide", sureyiGonder);

    return () => {
      clearTimeout(zaman);
      document.removeEventListener("visibilitychange", gizlendi);
      window.removeEventListener("pagehide", sureyiGonder);
    };
  }, [yol, sorgu, locale]);

  return null;
}
