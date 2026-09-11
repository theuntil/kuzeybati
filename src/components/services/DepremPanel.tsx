"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { Deprem } from "@/app/api/deprem/route";
import dynamic from "next/dynamic";
import { renk } from "./DepremHarita";
import DepremDetay from "./DepremDetay";

/*
 * ⚠ HARİTA SUNUCUDA ÇİZİLMİYOR.
 * Leaflet `window`a doğrudan erişiyor; `ssr: false` olmadan
 * sunucu tarafı derleme çöküyor.
 */
const DepremHarita = dynamic(() => import("./DepremHarita"), {
  ssr: false,
  loading: () => <div className="kb-deprem-leaflet kb-deprem-yukleniyor" />,
});

/* ══════════════════════════════════════════════════════════════
   DEPREM TAKİP

   Solda Türkiye haritası, sağda süzgeçli liste.

   ┌─ HARİTA NEDEN SVG ⚠️ ─────────────────────────────────────┐
   │ Leaflet ya da Mapbox gibi bir kütüphane çekmek sayfaya    │
   │ yüzlerce kilobayt ekliyor, dış bir CDN'e bağımlı hâle     │
   │ getiriyor ve karo (tile) isteği başına ücret doğurabiliyor.│
   │                                                              │
   │ Burada gösterilen şey noktaların ülke içindeki KONUMU;     │
   │ sokak detayı gerekmiyor. Basit bir SVG ülke sınırı ve      │
   │ enlem/boylam → piksel dönüşümü yeterli, bağımlılık sıfır. │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */


const BUYUKLUK_SECENEK = [
  { k: 0, ad: "Tümü" },
  { k: 3, ad: "3+" },
  { k: 4, ad: "4+" },
  { k: 5, ad: "5+" },
];

const ZAMAN_SECENEK = [
  { k: 6, ad: "6 saat" },
  { k: 24, ad: "24 saat" },
  { k: 72, ad: "3 gün" },
  { k: 168, ad: "7 gün" },
];

export default function DepremPanel({
  merkez,
}: {
  /* Varsayılan şehrin koordinatı — harita buraya odaklanıyor */
  merkez: { lat: number; lon: number } | null;
}) {
  const [veri, setVeri] = useState<Deprem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [bayat, setBayat] = useState(false);

  const [minBuyukluk, setMinBuyukluk] = useState(0);
  const [saat, setSaat] = useState(24);
  const [il, setIl] = useState("");
  const [secili, setSecili] = useState<string | null>(null);

  const listeRef = useRef<HTMLDivElement>(null);

  /*
   * ⚠ TEMA DOM'DAN OKUNUYOR.
   * Harita karosu temaya göre değişiyor; sunucudan gelen bir
   * değer önbelleğe alınıp yanlış temayı taşırdı.
   */
  const [koyu, setKoyu] = useState(true);
  useEffect(() => {
    const kok = document.documentElement;
    const olc = () => setKoyu(kok.dataset.theme !== "light");
    olc();
    const g = new MutationObserver(olc);
    g.observe(kok, { attributes: true, attributeFilter: ["data-theme"] });
    return () => g.disconnect();
  }, []);

  const cek = useCallback(async () => {
    try {
      const y = await fetch("/api/deprem");
      const j = (await y.json()) as {
        depremler?: Deprem[]; error?: string; bayat?: boolean;
      };
      if (!y.ok || !j.depremler) {
        setHata(
          j.error === "rate_limited" ? "Çok sık yenilendi, biraz bekle"
          : "Deprem verisi şu an alınamıyor",
        );
        return;
      }
      setVeri(j.depremler);
      setBayat(Boolean(j.bayat));
      setHata(null);
    } catch {
      setHata("Bağlantı kurulamadı");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void cek();
    /*
     * ⚠ 60 SANİYEDE BİR — DAHA SIK DEĞİL.
     * Sunucu tarafı zaten 60 saniye önbellekliyor; daha sık
     * sormak aynı yanıtı tekrar almak demek.
     */
    const z = setInterval(() => void cek(), 60_000);
    return () => clearInterval(z);
  }, [cek]);

  /* İl listesi veriden üretiliyor — sabit liste eskiyebilir */
  const iller = useMemo(() => {
    const s = new Set<string>();
    for (const d of veri) if (d.il) s.add(d.il);
    return [...s].sort((a, b) => a.localeCompare(b, "tr"));
  }, [veri]);

  const suzulmus = useMemo(() => {
    const simdi = Date.now();
    return veri.filter((d) => {
      if (d.buyukluk < minBuyukluk) return false;
      if (il && d.il !== il) return false;

      /*
       * ⚠ AFAD TARİHİ YEREL SAAT, `Z` YOK.
       * `new Date("2026-09-04 05:22:18")` Safari'de geçersiz;
       * boşluk `T` ile değiştiriliyor.
       */
      const t = new Date(d.tarih.replace(" ", "T")).getTime();
      if (!Number.isFinite(t)) return true;
      return simdi - t <= saat * 3600_000;
    });
  }, [veri, minBuyukluk, saat, il]);

  const enBuyuk = useMemo(
    () => suzulmus.reduce((a, b) => (b.buyukluk > a ? b.buyukluk : a), 0),
    [suzulmus],
  );

  function zamanMetni(tarih: string): string {
    const t = new Date(tarih.replace(" ", "T")).getTime();
    if (!Number.isFinite(t)) return tarih;
    const fark = Math.floor((Date.now() - t) / 60000);
    if (fark < 1) return "az önce";
    if (fark < 60) return `${fark} dk önce`;
    const s = Math.floor(fark / 60);
    if (s < 24) return `${s} saat önce`;
    return `${Math.floor(s / 24)} gün önce`;
  }

  const secim = suzulmus.find((d) => d.id === secili) ?? null;

  return (
    <div className="kb-deprem">
      {/* ---- HARİTA ---- */}
      <div className="kb-deprem-harita">
        <DepremHarita
          veri={suzulmus}
          secili={secili}
          onSec={(id) => {
            setSecili(id);
            listeRef.current
              ?.querySelector(`[data-id="${id}"]`)
              ?.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
          merkez={merkez}
          koyu={koyu}
        />

        {/* Özet rozeti — harita üzerinde */}
        <div className="kb-deprem-ozet">
          <span><b>{suzulmus.length}</b> deprem</span>
          {enBuyuk > 0 && (
            <span style={{ color: renk(enBuyuk) }}>
              en büyük <b>{enBuyuk.toFixed(1)}</b>
            </span>
          )}
          {bayat && <span style={{ color: "#FF9F0A" }}>gecikmeli</span>}
        </div>
      </div>

      {/* ---- LİSTE ---- */}
      <div className="kb-deprem-liste">
        <div className="kb-deprem-suzgec">
          <select
            value={il}
            onChange={(e) => setIl(e.target.value)}
            aria-label="İl seç"
          >
            <option value="">Tüm iller</option>
            {iller.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>

          <div>
            <span className="kb-deprem-etiket">Büyüklük</span>
            <div className="kb-deprem-segment">
              {BUYUKLUK_SECENEK.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setMinBuyukluk(o.k)}
                  aria-pressed={minBuyukluk === o.k}
                  className={minBuyukluk === o.k ? "aktif" : undefined}
                >
                  {o.ad}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="kb-deprem-etiket">Zaman</span>
            <div className="kb-deprem-segment">
              {ZAMAN_SECENEK.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setSaat(o.k)}
                  aria-pressed={saat === o.k}
                  className={saat === o.k ? "aktif" : undefined}
                >
                  {o.ad}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="kb-deprem-kayitlar" ref={listeRef}>
          {yukleniyor ? (
            [0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="kb-deprem-iskelet" />
            ))
          ) : hata ? (
            <p className="kb-deprem-bos">{hata}</p>
          ) : suzulmus.length === 0 ? (
            <p className="kb-deprem-bos">
              Seçtiğin aralıkta deprem kaydı yok.
            </p>
          ) : (
            suzulmus.map((d) => (
              <button
                key={d.id}
                type="button"
                data-id={d.id}
                onClick={() => setSecili(d.id)}
                className={`kb-deprem-kart${d.id === secili ? " aktif" : ""}`}
              >
                <span
                  className="kb-deprem-mag"
                  style={{ background: `${renk(d.buyukluk)}22`, color: renk(d.buyukluk) }}
                >
                  {d.buyukluk.toFixed(1)}
                </span>

                <span className="kb-deprem-metin">
                  <span className="kb-deprem-yer">{d.yer}</span>
                  <span className="kb-deprem-alt">
                    {zamanMetni(d.tarih)} · {d.derinlik.toFixed(1)} km derinlik
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

      </div>

      {/*
        AYRINTI PANELİ

        ⚠ MASAÜSTÜNDE SAĞDAN, MOBİLDE ALTTAN.
        Önce mobilde tek satırlık bir şerit vardı; deprem
        ayrıntıları (derinlik, koordinat, tarih) hiçbir yerde
        gösterilmiyordu.
      */}
      <DepremDetay deprem={secim} onKapat={() => setSecili(null)} />
    </div>
  );
}
