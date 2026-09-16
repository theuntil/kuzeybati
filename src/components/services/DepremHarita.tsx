"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import type { Deprem } from "@/app/api/deprem/route";

/*
 * ⚠ CSS STATİK İÇE AKTARILIYOR.
 * Dinamik `import()` ile CSS almak TypeScript'te tip hatası
 * veriyor; Next.js zaten bu dosyayı yalnızca bu bileşen
 * yüklendiğinde paketliyor.
 */
import "leaflet/dist/leaflet.css";

/* ══════════════════════════════════════════════════════════════
   DEPREM HARİTASI — LEAFLET

   ┌─ NEDEN GERÇEK HARİTA ⚠️ ──────────────────────────────────┐
   │ Önce elle çizilmiş bir SVG ülke hattı vardı. Noktaların   │
   │ yeri kabaca doğruydu ama yakınlaştırma, kaydırma ve şehir │
   │ ayrıntısı yoktu — deprem takibinde "tam olarak nerede"    │
   │ sorusu asıl soru.                                           │
   │                                                              │
   │ Leaflet açık kaynak ve karo sağlayıcısı ücretsiz           │
   │ (CARTO). Dinamik `import()` ile yalnızca bu sayfada        │
   │ yükleniyor; ana paketi büyütmüyor.                          │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/** Büyüklüğe göre renk — kırmızıya doğru */
export function renk(m: number): string {
  if (m >= 5) return "#FF453A";
  if (m >= 4) return "#FF9F0A";
  if (m >= 3) return "#FFD60A";
  return "#30D158";
}

/** Büyüklüğe göre daire yarıçapı (piksel) */
function yaricap(m: number): number {
  return Math.max(4, Math.min(20, (m - 0.5) * 3.2));
}

export default function DepremHarita({
  veri, secili, onSec, merkez, koyu,
}: {
  veri: Deprem[];
  secili: string | null;
  onSec: (id: string) => void;
  /** Varsayılan şehrin koordinatı — harita buraya odaklanıyor */
  merkez: { lat: number; lon: number } | null;
  koyu: boolean;
}) {
  const kap = useRef<HTMLDivElement>(null);
  const harita = useRef<LeafletMap | null>(null);
  const katman = useRef<CircleMarker[]>([]);
  const ilkOdak = useRef(false);

  /* ---- Haritayı bir kez kur ---- */
  useEffect(() => {
    let iptal = false;

    (async () => {
      if (!kap.current || harita.current) return;

      /*
       * ⚠ DİNAMİK YÜKLEME ŞART.
       * Leaflet `window` ve `document`'e doğrudan erişiyor;
       * sunucuda içe aktarılırsa sayfa çöküyor.
       */
      const L = (await import("leaflet")).default;
      if (iptal || !kap.current) return;

      const m = L.map(kap.current, {
        zoomControl: false,
        attributionControl: true,
        /* Dünya sınırları dışına kaydırılamasın */
        maxBounds: [[33.0, 22.0], [45.0, 48.0]],
        maxBoundsViscosity: 0.7,
        minZoom: 5,
      });

      /*
       * Türkiye'nin tamamı — varsayılan şehir yoksa bu görünüm.
       */
      m.setView([39.0, 35.0], 6);

      /*
       * ⚠ KARO SAĞLAYICI: CARTO.
       * Ücretsiz, anahtar istemiyor ve iki tema sunuyor —
       * sitenin koyu/açık temasıyla uyumlu kalıyor. OSM'nin
       * standart karosu yalnızca açık temada var ve koyu
       * temada göz alıyordu.
       */
      /*
       * ⚠ KARO SAĞLAYICI: OPENSTREETMAP.
       *
       * Önce CARTO kullanılıyordu ama o servis artık API
       * anahtarı istiyor — harita üzerinde "API key required"
       * yazısı çıkıyordu.
       *
       * OSM'nin kendi karo sunucusu anahtarsız ve ücretsiz.
       * Tek eksiği koyu tema sunmaması; onu CSS süzgeciyle
       * çözüyoruz (bkz. `.kb-deprem-koyu`).
       */
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap katkıda bulunanlar",
        maxZoom: 19,
      }).addTo(m);

      L.control.zoom({ position: "bottomright" }).addTo(m);

      harita.current = m;
    })();

    return () => { iptal = true; };
  }, [koyu]);

  /*
   * ⚠ TEMA DEĞİŞİNCE KARO YENİDEN YÜKLENMİYOR.
   *
   * Önce koyu/açık için iki ayrı karo kaynağı vardı ve tema
   * değişiminde katman silinip yeniden ekleniyordu. Tek kaynağa
   * geçince buna gerek kalmadı; koyulaştırma CSS süzgeciyle
   * yapılıyor ve ağ isteği doğurmuyor.
   */

  /* ---- Varsayılan şehre odaklan ---- */
  useEffect(() => {
    const m = harita.current;
    if (!m || !merkez || ilkOdak.current) return;

    /*
     * ⚠ YALNIZCA BİR KEZ.
     * Her veri yenilemesinde odaklarsa, kullanıcı haritayı
     * kaydırdıktan 60 saniye sonra görüntü zıplardı.
     */
    ilkOdak.current = true;
    m.setView([merkez.lat, merkez.lon], 8);
  }, [merkez]);

  /* ---- Noktaları çiz ---- */
  useEffect(() => {
    const m = harita.current;
    if (!m) return;

    (async () => {
      const L = (await import("leaflet")).default;

      /* Önceki noktaları temizle */
      for (const c of katman.current) c.remove();
      katman.current = [];

      for (const d of veri) {
        const aktif = d.id === secili;
        const c = L.circleMarker([d.enlem, d.boylam], {
          radius: aktif ? yaricap(d.buyukluk) + 3 : yaricap(d.buyukluk),
          color: aktif ? (koyu ? "#fff" : "#111") : renk(d.buyukluk),
          weight: aktif ? 2.5 : 1,
          fillColor: renk(d.buyukluk),
          fillOpacity: aktif ? 0.95 : 0.6,
        });

        c.bindTooltip(
          `<b>${d.buyukluk.toFixed(1)}</b> · ${d.yer}`,
          { direction: "top", offset: [0, -6] },
        );
        c.on("click", () => onSec(d.id));
        c.addTo(m);
        katman.current.push(c);
      }
    })();
  }, [veri, secili, onSec, koyu]);

  /* ---- Seçilen depreme kaydır ---- */
  useEffect(() => {
    const m = harita.current;
    if (!m || !secili) return;
    const d = veri.find((x) => x.id === secili);
    if (!d) return;

    /*
     * ⚠ SADECE KAYDIRMA DEĞİL, YAKINLAŞTIRMA DA.
     * `panTo` görüntüyü kaydırıyordu ama uzaklaştırılmış bir
     * haritada seçilen deprem hâlâ küçük bir nokta olarak
     * kalıyordu. En az 9. seviyeye yaklaşıyor; kullanıcı
     * zaten daha yakındaysa o seviye korunuyor.
     */
    const hedefZoom = Math.max(m.getZoom(), 9);
    m.flyTo([d.enlem, d.boylam], hedefZoom, { duration: 0.7 });
  }, [secili, veri]);

  useEffect(() => {
    return () => {
      harita.current?.remove();
      harita.current = null;
    };
  }, []);

  return (
    <div
      ref={kap}
      className={`kb-deprem-leaflet${koyu ? " kb-deprem-koyu" : ""}`}
    />
  );
}
