import "server-only";
import type { Quote, TickerSymbol } from "@/lib/types";
import {
  piyasaHepsi, piyasaHazir, birimTl, dovizSerisi,
  type Kur, type Maden, type Kripto,
} from "./client";

/*
 * ══════════════════════════════════════════════════════════════
 *  ŞERİT VE WIDGET İÇİN FİYAT LİSTESİ
 *
 *  ┌─ ARAYÜZ AYNI KALIYOR ⚠️ ───────────────────────────────────┐
 *  │ Eski `fetchQuotes` Yahoo Finance'ten çekiyordu ve lisans   │
 *  │ açısından sorunluydu. Yeni kaynak Piyasa API.              │
 *  │                                                              │
 *  │ Dönüş tipi (`Quote`) DEĞİŞMEDİ: şerit, widget ve piyasa   │
 *  │ sayfası olduğu gibi çalışmaya devam ediyor. Değişen        │
 *  │ yalnızca verinin nereden geldiği.                           │
 *  └──────────────────────────────────────────────────────────────┘
 *
 *  ⚠ TEK İSTEK.
 *  `/v1/markets` döviz, maden ve kriptoyu birlikte veriyor.
 *  Sembol başına ayrı istek atmak hız sınırını gereksiz yere
 *  zorlardı.
 * ══════════════════════════════════════════════════════════════
 */

/**
 * Panelden gelen anahtarı API kodlarına eşliyor.
 *
 * ┌─ PANELDEKİ ANAHTARLAR YAHOO BİÇİMİNDE ⚠️ ──────────────────┐
 * │ Sembol listesi eski kaynağa göre kaydedilmiş:              │
 * │   USDTRY=X · EURTRY=X · BTC-USD · GC=F · XU100 · BZ=F      │
 * │                                                              │
 * │ İlk eşleştirici yalnızca sade kodları (USD, BTC) tanıyordu.│
 * │ Sonuç: şeritte ve widget'ta yalnızca birkaç değer          │
 * │ görünüyordu, gram altın da bozuktu.                         │
 * │                                                              │
 * │ Artık Yahoo biçimleri de çözülüyor. Panelde hiçbir şey     │
 * │ değiştirmen gerekmiyor.                                      │
 * │                                                              │
 * │ ⚠ BIST ENDEKSLERİ (XU100) BU API'DE YOK.                   │
 * │ Kaynak TCMB, Borsa İstanbul kıymetli madenler ve kripto.   │
 * │ Endeks isteyen sembol sessizce atlanıyor — uydurma değer   │
 * │ göstermektense göstermemek doğru.                           │
 * └──────────────────────────────────────────────────────────────┘
 */
type Cozum =
  | { tur: "doviz" | "maden" | "kripto"; kod: string }
  | { tur: "yok"; kod: string };

const MADEN_ESLESME: Record<string, string> = {
  GRAMALTIN: "altin", ALTIN: "altin", XAU: "altin", "GC=F": "altin",
  "XAUUSD=X": "altin", GUMUS: "gumus", XAG: "gumus", "SI=F": "gumus",
  "XAGUSD=X": "gumus", PLATIN: "platin", "PL=F": "platin",
  PALADYUM: "paladyum", "PA=F": "paladyum",
};

/** Bu API'nin hiç sunmadığı türler — sessizce atlanıyor */
const DESTEKSIZ = /^(XU\d+|BIST|XU100\.IS|BZ=F|CL=F|NG=F|\^)/i;

function cozumle(key: string): Cozum {
  const ham = (key ?? "").trim();
  if (!ham) return { tur: "yok", kod: "" };

  const k = ham.toUpperCase();

  /* Endeks ve emtia vadelileri bu API'de yok */
  if (DESTEKSIZ.test(k)) return { tur: "yok", kod: k };

  if (MADEN_ESLESME[k]) return { tur: "maden", kod: MADEN_ESLESME[k] };

  /*
   * Kripto: "BTC-USD", "BTCUSD", "BTC-TRY" ve sade "BTC"
   * biçimlerinin hepsi aynı sembole çözülüyor.
   */
  const kripto = k.match(/^([A-Z]{2,6})[-/]?(USD|USDT|TRY)$/);
  const sade = kripto ? kripto[1] : k;
  if (/^(BTC|ETH|XRP|SOL|ADA|DOGE|AVAX|TRX|DOT|MATIC|LTC|SHIB|PEPE|BNB|LINK|ATOM|UNI|XLM|ETC|FIL|NEAR)$/.test(sade)) {
    return { tur: "kripto", kod: sade };
  }

  /*
   * Döviz: "USDTRY=X", "USD/TRY", "USDTRY", "USD" hepsi USD.
   * Sondaki TRY ve Yahoo eki temizleniyor.
   */
  const doviz = k
    .replace(/=X$/, "")
    .replace(/[-/]/g, "")
    .replace(/TRY$/, "");
  if (/^[A-Z]{3}$/.test(doviz)) return { tur: "doviz", kod: doviz };

  return { tur: "yok", kod: k };
}

export async function piyasaQuotes(symbols: TickerSymbol[]): Promise<Quote[]> {
  if (!piyasaHazir() || symbols.length === 0) return [];

  const hepsi = await piyasaHepsi();
  if (!hepsi) return [];

  const kurlar = new Map<string, Kur>();
  for (const k of hepsi.currencies?.data ?? []) {
    if (k?.code) kurlar.set(k.code.toUpperCase(), k);
  }

  const madenler = new Map<string, Maden>();
  for (const m of hepsi.metals?.data ?? []) {
    if (m?.id) madenler.set(m.id.toLowerCase(), m);
  }

  const kriptolar = new Map<string, Kripto>();
  for (const c of hepsi.crypto?.data ?? []) {
    if (c?.symbol) kriptolar.set(c.symbol.toUpperCase(), c);
  }

  const cikti: Quote[] = [];

  /*
   * ⚠ GRAFİK VERİSİ PARALEL ÇEKİLİYOR.
   * Döviz kartlarında mini grafik vardı ve kaldırılınca
   * eksik görünüyordu. Geçmiş yalnızca EVDS'te var; istekler
   * sırayla atılsa şerit yavaşlardı.
   */
  const grafikGereken = symbols
    .map((s) => cozumle(s.key))
    .filter((c): c is { tur: "doviz"; kod: string } => c.tur === "doviz")
    .map((c) => c.kod);

  const grafikler = new Map<string, number[]>();
  await Promise.all(
    [...new Set(grafikGereken)].map(async (kod) => {
      const seri = await dovizSerisi(kod).catch(() => []);
      if (seri.length > 1) grafikler.set(kod, seri);
    }),
  );

  const atlanan: string[] = [];

  for (const s of symbols) {
    const { tur, kod } = cozumle(s.key);

    if (tur === "yok") {
      atlanan.push(s.key);
      continue;
    }

    if (tur === "doviz") {
      const k = kurlar.get(kod);
      /*
       * ⚠ `birimTl` ŞART.
       * TCMB yeni 100 birim üzerinden yayınlıyor; ham satış
       * kuru kullanılsaydı yen 100 kat pahalı görünürdü.
       */
      const deger = k ? birimTl(k) : null;
      if (k && deger !== null) {
        cikti.push({
          key: s.key, label: s.label, value: deger,
          changePercent: k.change?.pct ?? 0,
          currency: "TRY",
          spark: grafikler.get(kod),
        });
      }
      continue;
    }

    if (tur === "maden") {
      const m = madenler.get(kod);
      /*
       * ⚠ FİYAT `spot`TAN OKUNUYOR, `closing`DEN DEĞİL.
       * Belge: TL/gram serisi seyrek işlem görüyor ve günlerce
       * eski kalabiliyor; `spot` hepsini aynı tarihe hizalıyor.
       */
      const gram = m?.spot?.tryPerGram;
      if (m && !m.noData && typeof gram === "number") {
        cikti.push({
          key: s.key, label: s.label, value: gram,
          changePercent: m.spot?.changePct ?? 0,
          currency: "TRY",
        });
      }
      continue;
    }

    const c = kriptolar.get(kod);
    const tl = c?.try;
    if (c && typeof tl === "number") {
      cikti.push({
        key: s.key, label: s.label, value: tl,
        changePercent: c.changePct24h ?? 0,
        currency: "TRY",
      });
    }
  }

  if (atlanan.length) {
    /*
     * Hangi sembollerin karşılığı olmadığı günlüğe yazılıyor:
     * yönetici panelden listeyi güncellemek isteyebilir.
     */
    console.warn(`[PIYASA] bu kaynakta karşılığı yok: ${atlanan.join(", ")}`);
  }

  return cikti;
}
