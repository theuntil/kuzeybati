import "server-only";
import type { Quote, TickerSymbol } from "./types";

/**
 * PİYASA VERİSİ
 *
 * BIST endeksleri  → borsa-api paketi (Yahoo Finance üzerinden)
 * Döviz / emtia / kripto → Yahoo chart uç noktası
 * Gram altın       → XAU/oz × USD/TRY ÷ 31.1035 (türetilir)
 *
 * ⚠️ LİSANS UYARISI
 * borsa-api ve Yahoo Finance GECİKMELİ ve halka açık veri sunar.
 * Paketin kendi belgesi ticari kullanım için uygun olmadığını
 * söylüyor; gerçek zamanlı BIST verisini bir haber sitesinde
 * yayınlamak BIST lisansı gerektirir. Şerit "gecikmeli" ibaresiyle
 * gösteriliyor. Ticari yayına geçmeden önce lisanslı bir sağlayıcıya
 * (Foreks, Matriks, Twelve Data vb.) geçilmeli — bu dosyanın
 * fetchQuotes fonksiyonunu değiştirmek yeterli olacak.
 */

const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";
const OZ_IN_GRAM = 31.1034768;

/** İki kaynağın da döndürdüğü ortak biçim */
interface Tick {
  value: number;
  prev: number;
  currency?: string;
  /** Mini grafik için son kapanışlar (eskiden yeniye) */
  spark?: number[];
}

interface YahooResult {
  meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; currency?: string };
  indicators?: { quote?: { close?: (number | null)[] }[] };
}

async function yahooQuote(symbol: string): Promise<Tick | null> {
  try {
    // 1 saatlik aralık: mini grafik için yeterli nokta verir,
    // günlük aralıkta beş nokta çıkıyor ve grafik köşeli duruyordu.
    const res = await fetch(
      `${YAHOO}/${encodeURIComponent(symbol)}?interval=1h&range=5d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KuzeybatiHaber/1.0)" },
        /*
         * ⚠ ZAMAN AŞIMI ŞART.
         * Sağlayıcı yanıt vermediğinde istek süresiz asılı
         * kalıyor ve sayfa hiç açılmıyordu.
         */
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { chart?: { result?: YahooResult[] } };
    const r = json.chart?.result?.[0];
    const meta = r?.meta;
    const value = meta?.regularMarketPrice;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof value !== "number" || typeof prev !== "number" || prev === 0) return null;

    const closes = (r?.indicators?.quote?.[0]?.close ?? [])
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

    return { value, prev, currency: meta?.currency, spark: sample(closes, 32) };
  } catch {
    return null;
  }
}

/** Diziyi en fazla `n` noktaya eşit aralıklarla indirger. */
function sample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)]);
}

/**
 * borsa-api istemcisi — SÜREÇ BAŞINA TEK ÖRNEK.
 *
 * Her çağrıda `new BorsaAPI()` kurmak üç soruna yol açıyordu:
 *  - Paket içindeki yahoo-finance2 örneği her seferinde yeniden
 *    kuruluyor ve "anket" bildirimini logda tekrar tekrar basıyordu
 *    (bildirim örnek başına bir kez gösteriliyor).
 *  - Yedi sembollük şeritte tek istekte yedi istemci kuruluyordu.
 *  - Paketin iç önbelleği her seferinde sıfırlanıyordu.
 */
type BorsaClient = { getIndex(s: string): Promise<{ value: number; changePercent: number }> };
let borsaPromise: Promise<BorsaClient | null> | null = null;

function getBorsa(): Promise<BorsaClient | null> {
  if (!borsaPromise) {
    borsaPromise = import("borsa-api")
      .then((mod) => {
        const Ctor = ((mod as unknown as { default?: unknown }).default ?? mod) as new () => BorsaClient;
        return new Ctor();
      })
      .catch(() => null);
  }
  return borsaPromise;
}

async function bistIndex(symbol: string): Promise<Tick | null> {
  try {
    const api = await getBorsa();
    if (!api) return yahooQuote(`${symbol}.IS`);
    const r = await api.getIndex(symbol);
    if (typeof r?.value !== "number") return null;
    const pct = typeof r.changePercent === "number" ? r.changePercent : 0;
    return { value: r.value, prev: r.value / (1 + pct / 100) };
  } catch {
    // Paket yoksa veya kaynak yanıt vermezse Yahoo'ya düş.
    return yahooQuote(`${symbol}.IS`);
  }
}

function pct(value: number, prev: number) {
  return prev === 0 ? 0 : ((value - prev) / prev) * 100;
}

export async function fetchQuotes(symbols: TickerSymbol[]): Promise<Quote[]> {
  // Gram altın iki başka değere bağlı; onları önce topluyoruz.
  const needsGold = symbols.some((s) => s.source === "derived" && s.key === "GRAMALTIN");
  const [gold, usdtry] = needsGold
    ? await Promise.all([yahooQuote("GC=F"), yahooQuote("USDTRY=X")])
    : [null, null];

  const out = await Promise.all(
    symbols.map(async (s): Promise<Quote | null> => {
      if (s.source === "derived" && s.key === "GRAMALTIN") {
        if (!gold || !usdtry) return null;
        const value = (gold.value * usdtry.value) / OZ_IN_GRAM;
        const prev = (gold.prev * usdtry.prev) / OZ_IN_GRAM;
        // Gram altın türetilmiş: iki serinin noktaları çarpılır
        const n = Math.min(gold.spark?.length ?? 0, usdtry.spark?.length ?? 0);
        const spark = n
          ? Array.from({ length: n }, (_, i) =>
              ((gold.spark as number[])[i] * (usdtry.spark as number[])[i]) / OZ_IN_GRAM)
          : undefined;
        return {
          key: s.key, label: s.label, value,
          changePercent: pct(value, prev), currency: "TRY", spark,
        };
      }

      const r = s.source === "bist" ? await bistIndex(s.key) : await yahooQuote(s.key);
      if (!r) return null;
      return {
        key: s.key,
        label: s.label,
        value: r.value,
        changePercent: pct(r.value, r.prev),
        currency: r.currency,
        spark: r.spark,
      };
    }),
  );

  // Bir sembol düşerse şerit tamamen boşalmasın; sadece o atlanır.
  return out.filter((q): q is Quote => q !== null);
}
