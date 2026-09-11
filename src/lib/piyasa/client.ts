import "server-only";

/*
 * ══════════════════════════════════════════════════════════════
 *  PİYASA API İSTEMCİSİ
 *
 *  Kaynak: https://piyasa.rovandcloud.com
 *  TCMB döviz · Borsa İstanbul kıymetli maden · kripto
 *
 *  ┌─ ANAHTAR ASLA TARAYICIYA GİTMEZ ⚠️ ───────────────────────┐
 *  │ Belge açıkça söylüyor: tarayıcıya gömülen anahtar herkese │
 *  │ açıktır. Bu dosya `server-only`; anahtar yalnızca sunucu  │
 *  │ tarafında okunuyor ve istekler oradan geçiyor.            │
 *  │                                                              │
 *  │ Bu yüzden ortam değişkeninin adında `NEXT_PUBLIC_` YOK.   │
 *  └──────────────────────────────────────────────────────────────┘
 * ══════════════════════════════════════════════════════════════
 */

const TABAN = (process.env.PIYASA_API_URL ?? "https://piyasa.rovandcloud.com")
  .trim()
  .replace(/\/+$/, "");

const ANAHTAR = process.env.PIYASA_API_KEY?.trim() ?? "";

/** Ayarların yanında bu da gerekli; ikisi de yoksa bölüm gizleniyor */
export function piyasaHazir(): boolean {
  return Boolean(ANAHTAR);
}

/*
 * Tazelenme sürelerini belge veriyor:
 *   döviz  → iş günleri ~15:30, günde bir
 *   maden  → günlük kapanış
 *   kripto → dakikada bir
 *
 * Belge ayrıca "aynı veriyi saniyede birçok kez istemenin faydası
 * yok" diyor. Süreler ona göre seçildi.
 */
export const TAZELE = {
  doviz: 60 * 30,
  maden: 60 * 30,
  kripto: 60,
  hepsi: 60,
  /*
   * ⚠ SERİ UZUN ÖNBELLEKLENİYOR.
   * TCMB günlük veri yayınlıyor; altı saat bile fazlaydı.
   * Bir gün tutmak hem doğru hem sayfayı hızlandırıyor.
   */
  seri: 60 * 60 * 24,
} as const;

function piyasaHata(sebep: string, ayrinti?: unknown) {
  console.error(`[PIYASA] ${sebep}`, ayrinti === undefined ? "" : ayrinti);
}

/**
 * API'ye tek istek.
 *
 * ⚠ HER HATA DURUMU AYRI ELE ALINIYOR.
 * Belgedeki kodlar: 401 anahtar, 403 yetki/engel, 404 bilinmeyen
 * kayıt, 429 hız sınırı, 503 yoğunluk. Sessizce `null` dönmek
 * sorunu teşhis edilemez yapardı.
 */
async function iste<T>(
  yol: string,
  revalidate: number,
  denemeler = 1,
): Promise<T | null> {
  if (!ANAHTAR) {
    piyasaHata("PIYASA_API_KEY tanımlı değil — piyasa bölümleri gizlendi");
    return null;
  }

  const adres = `${TABAN}${yol}`;

  for (let i = 0; i <= denemeler; i++) {
    try {
      const res = await fetch(adres, {
        headers: { "x-api-key": ANAHTAR, accept: "application/json" },
        next: { revalidate },
        /* Sağlayıcı yavaşlarsa sayfa beklemesin */
        /*
       * Dört saniye uzundu: sağlayıcı yanıt vermiyorsa
       * beklemek yerine o bölümü atlamak daha iyi.
       */
      signal: AbortSignal.timeout(2500),
      });

      if (res.ok) return (await res.json()) as T;

      if (res.status === 401) {
        piyasaHata(`401 — PIYASA_API_KEY geçersiz. Adres: ${adres}`);
        return null;
      }
      if (res.status === 403) {
        piyasaHata(`403 — anahtarın bu uca yetkisi yok ya da geçici engel. ${yol}`);
        return null;
      }
      if (res.status === 404) {
        /* Bilinmeyen kod/sembol — hata değil, veri yok */
        return null;
      }
      if (res.status === 429) {
        /*
         * Belge `retry-after` başlığını veriyor; ona uyuluyor.
         * Sunucu söylemiyorsa kısa bir bekleme.
         */
        const ra = Number(res.headers.get("retry-after"));
        if (i < denemeler) {
          await new Promise((r) =>
            setTimeout(r, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1200));
          continue;
        }
        piyasaHata("429 — hız sınırı aşıldı");
        return null;
      }
      if (res.status >= 500) {
        if (i < denemeler) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        piyasaHata(`${res.status} — servis yanıt vermiyor. ${yol}`);
        return null;
      }

      piyasaHata(`beklenmeyen ${res.status}. ${yol}`);
      return null;
    } catch (e) {
      if (i >= denemeler) {
        piyasaHata(`bağlantı kurulamadı: ${adres}`,
          e instanceof Error ? e.message : e);
        return null;
      }
    }
  }
  return null;
}

/* ---------- yanıt biçimleri (belgeye göre) ---------- */

export interface Degisim { diff?: number | null; pct?: number | null }

export interface Kur {
  code: string;
  name?: string | null;
  forexBuying?: number | null;
  forexSelling?: number | null;
  banknoteBuying?: number | null;
  banknoteSelling?: number | null;
  /** Kaç birim üzerinden yayınlandığı — JPY'de 100 */
  unit?: number | null;
  /** 1 birimin TL karşılığı; hesaplarda BU kullanılmalı */
  oneUnitTry?: number | null;
  crossRateUsd?: number | null;
  change?: Degisim | null;
}

export interface Maden {
  id: string;
  name?: string | null;
  date?: string | null;
  spot?: {
    tryPerGram?: number | null;
    tryPerKg?: number | null;
    usdPerOunce?: number | null;
    changePct?: number | null;
  } | null;
  noData?: boolean;
}

export interface Kripto {
  symbol: string;
  name?: string | null;
  usd?: number | null;
  try?: number | null;
  changePct24h?: number | null;
  lastUpdated?: string | null;
}

export interface PiyasaHepsi {
  currencies?: { date?: string | null; data?: Kur[] } | null;
  metals?: { data?: Maden[] } | null;
  crypto?: { usdTry?: number | null; usdTryDate?: string | null; data?: Kripto[] } | null;
  unavailable?: string[];
  stale?: boolean;
  date?: string | null;
}

/* ---------- uç noktalar ---------- */

/**
 * Tek istekte döviz + maden + kripto.
 *
 * ⚠ BÖLÜMLER BAĞIMSIZ.
 * Belge: biri alınamazsa diğerleri yine döner ve sebep
 * `unavailable` dizisinde yazar. Bu yüzden tek bir bölümün
 * boş gelmesi tüm bloğu iptal etmiyor.
 */
export async function piyasaHepsi(): Promise<PiyasaHepsi | null> {
  const d = await iste<PiyasaHepsi>("/v1/markets", TAZELE.hepsi);
  if (d?.unavailable?.length) {
    console.warn(`[PIYASA] alınamayan bölümler: ${d.unavailable.join(", ")}`);
  }
  return d;
}

export async function kurlar(kodlar?: string[]): Promise<Kur[]> {
  const q = kodlar?.length ? `?codes=${encodeURIComponent(kodlar.join(","))}` : "";
  const d = await iste<{ data?: Kur[] }>(`/v1/rates${q}`, TAZELE.doviz);
  return d?.data ?? [];
}

export async function madenler(): Promise<Maden[]> {
  const d = await iste<{ data?: Maden[] }>("/v1/metals", TAZELE.maden);
  /*
   * ⚠ İŞLEM GÖRMEYEN MADEN GİZLENİYOR.
   * Belge: platin ve paladyum sık sık `noData: true` geliyor;
   * "arayüzünüzde bu kartları gizleyin" diyor.
   */
  return (d?.data ?? []).filter((m) => !m.noData && m.spot?.tryPerGram);
}

export async function kriptolar(semboller?: string[]): Promise<Kripto[]> {
  const q = semboller?.length
    ? `?symbols=${encodeURIComponent(semboller.join(","))}` : "";
  const d = await iste<{ data?: Kripto[] }>(`/v1/crypto${q}`, TAZELE.kripto);
  return d?.data ?? [];
}

/* ---------- yardımcılar ---------- */

/**
 * Bir kurun 1 birim TL karşılığı.
 *
 * ┌─ JAPON YENİ TUZAĞI ⚠️ ─────────────────────────────────────┐
 * │ TCMB yeni 100 birim üzerinden yayınlıyor (`unit: 100`).    │
 * │ `forexSelling` doğrudan kullanılırsa yen 100 KAT PAHALI    │
 * │ görünür. Belge açıkça `oneUnitTry` kullanılmasını söylüyor.│
 * │                                                              │
 * │ `oneUnitTry` gelmezse satış kuru birime bölünerek aynı     │
 * │ sonuç elde ediliyor.                                         │
 * └──────────────────────────────────────────────────────────────┘
 */
export function birimTl(k: Kur): number | null {
  if (typeof k.oneUnitTry === "number" && Number.isFinite(k.oneUnitTry)) {
    return k.oneUnitTry;
  }
  const satis = k.forexSelling;
  const birim = k.unit && k.unit > 0 ? k.unit : 1;
  return typeof satis === "number" && Number.isFinite(satis)
    ? satis / birim
    : null;
}

/**
 * Kripto fiyatı için ondalık basamak sayısı.
 *
 * ⚠ MİKRO FİYATLI COİNLER.
 * Belge: PEPE ve SHIB gibi paralar 0.00000364 gibi değerler
 * alıyor; sabit iki ondalıkla gösterilirse fiyat SIFIR görünür.
 * Basamak sayısı büyüklüğe göre seçiliyor.
 */
export function kriptoBasamak(deger: number): number {
  const m = Math.abs(deger);
  if (m === 0) return 2;
  if (m >= 1000) return 0;
  if (m >= 1) return 2;
  if (m >= 0.01) return 4;
  if (m >= 0.0001) return 6;
  return 8;
}

/* ---------- geçmiş seri (mini grafik) ---------- */

export interface SeriNokta { tarih: string; deger: number }

/*
 * ┌─ MİNİ GRAFİK İÇİN GEÇMİŞ VERİ ⚠️ ─────────────────────────┐
 * │ API anlık fiyat veriyor; geçmiş yalnızca `/v1/series`     │
 * │ (TCMB EVDS) üzerinden alınabiliyor.                        │
 * │                                                              │
 * │ EVDS'te döviz ve altın serileri var, KRİPTO YOK. Bu yüzden │
 * │ kripto kartlarında grafik çizilmiyor — uydurma bir çizgi   │
 * │ göstermektense hiç göstermemek doğru.                       │
 * │                                                              │
 * │ Seri kodu bulunamazsa sessizce boş dönüyor; kart grafiksiz │
 * │ ama çalışır durumda kalıyor.                                 │
 * └──────────────────────────────────────────────────────────────┘
 */
const SERI_KOD: Record<string, string> = {
  USD: "TP.DK.USD.S.YTL",
  EUR: "TP.DK.EUR.S.YTL",
  GBP: "TP.DK.GBP.S.YTL",
  CHF: "TP.DK.CHF.S.YTL",
  JPY: "TP.DK.JPY.S.YTL",
};

/** ISO tarih, n gün önce */
function gunOnce(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function dovizSerisi(kod: string, gun = 30): Promise<number[]> {
  const seri = SERI_KOD[kod.toUpperCase()];
  if (!seri) return [];

  /*
   * `frequency=1` günlük. Belge başlangıç tarihi kuralını
   * anlatıyor: istenen frekansın ilk günü verilmeli — günlük
   * seride herhangi bir gün geçerli.
   */
  const q = new URLSearchParams({
    codes: seri,
    start: gunOnce(gun),
    frequency: "1",
  });

  const d = await iste<{ data?: Record<string, unknown>[] }>(
    `/v1/series?${q}`, TAZELE.seri);
  if (!d?.data?.length) return [];

  const noktalar: number[] = [];
  for (const satir of d.data) {
    /*
     * ⚠ ALAN ADI SERİ KODUNDAN TÜRETİLİYOR.
     * EVDS yanıtında değer, kod içindeki noktalar alt çizgiye
     * çevrilmiş bir alanda geliyor. Bulunamazsa satırdaki ilk
     * sayısal değer kullanılıyor.
     */
    const anahtar = seri.replace(/\./g, "_");
    let v = satir[anahtar] ?? satir[seri];

    if (v === undefined) {
      for (const [ad, deger] of Object.entries(satir)) {
        if (ad.toLowerCase().includes("tarih") || ad.toLowerCase() === "date") continue;
        if (typeof deger === "number" || (typeof deger === "string" && deger.trim() !== "")) {
          v = deger; break;
        }
      }
    }

    const sayi = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
    if (Number.isFinite(sayi) && sayi > 0) noktalar.push(sayi);
  }

  return noktalar;
}
