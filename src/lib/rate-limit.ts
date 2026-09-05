/*
 * ══════════════════════════════════════════════════════════════
 *  HIZ SINIRLAYICI
 *
 *  ┌─ NEDEN GEREKLİ ⚠️ ─────────────────────────────────────────┐
 *  │ Kimlik doğrulaması OLMAYAN uçlar tasarım gereği herkese    │
 *  │ açık — ama sınırsız olmamalı:                                │
 *  │                                                              │
 *  │   • `/api/kayit-onay` ve `/api/sifre-sifirla` her istekte  │
 *  │     e-posta gönderiyor. Sınır yoksa saldırgan bir kurbanın │
 *  │     adresine binlerce mail yağdırabilir (mail bombası) ve  │
 *  │     bizim gönderim kotamızı tüketip servisi kullanılamaz    │
 *  │     hâle getirebilir.                                        │
 *  │   • `/api/izle` izlenme sayıyor. Sınırsızken bir betikle    │
 *  │     herhangi bir haber "en çok okunan" yapılabilir —       │
 *  │     istatistikler ve ana sayfa manipüle edilebilir.        │
 *  │                                                              │
 *  │ ⚠ BELLEKTE TUTULUYOR. Tek örnek (instance) için yeterli;   │
 *  │ birden fazla sunucuya dağıtılırsa her biri kendi sayacını  │
 *  │ tutar. Kaba kuvvet ve otomatik istismarı durdurmaya yeter, │
 *  │ dağıtık bir saldırı için Cloudflare katmanı gerekir.       │
 *  └──────────────────────────────────────────────────────────────┘
 * ══════════════════════════════════════════════════════════════
 */

type Kayit = { sayac: number; sifirlama: number };

const kovalar = new Map<string, Map<string, Kayit>>();

/*
 * Bellek sızıntısını önlemek için süresi dolmuş kayıtlar
 * temizleniyor. Her çağrıda tüm tabloyu taramak pahalı
 * olurdu; belirli aralıklarla yapılıyor.
 */
let sonTemizlik = Date.now();
const TEMIZLIK_ARALIGI = 5 * 60_000;

function temizle(simdi: number) {
  if (simdi - sonTemizlik < TEMIZLIK_ARALIGI) return;
  sonTemizlik = simdi;
  for (const [, kova] of kovalar) {
    for (const [k, v] of kova) {
      if (v.sifirlama <= simdi) kova.delete(k);
    }
  }
}

/**
 * İstek sahibinin kimliği.
 *
 * ⚠ `x-forwarded-for` GÜVENİLİR DEĞİL — istemci uydurabilir.
 * Ama ters vekil (Dokploy/Cloudflare) bu başlığı kendisi
 * yazdığı için pratikte ilk değer doğru. Yine de tek başına
 * bir yetki kararında ASLA kullanılmamalı; burada yalnızca
 * kaba kuvveti yavaşlatıyor.
 */
export function istekKimligi(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ilk = xff.split(",")[0]?.trim();
  return ilk || req.headers.get("x-real-ip") || "bilinmeyen";
}

/**
 * @param ad     Kova adı (uç başına ayrı sayaç)
 * @param anahtar Genelde IP; e-posta gibi daha dar bir anahtar da olabilir
 * @param limit  Pencere başına izin verilen istek
 * @param pencereMs Pencere uzunluğu
 * @returns izin verildiyse `null`, verilmediyse saniye cinsinden bekleme
 */
export function hizSiniri(
  ad: string,
  anahtar: string,
  limit: number,
  pencereMs: number,
): number | null {
  const simdi = Date.now();
  temizle(simdi);

  let kova = kovalar.get(ad);
  if (!kova) {
    kova = new Map();
    kovalar.set(ad, kova);
  }

  const mevcut = kova.get(anahtar);

  if (!mevcut || mevcut.sifirlama <= simdi) {
    kova.set(anahtar, { sayac: 1, sifirlama: simdi + pencereMs });
    return null;
  }

  if (mevcut.sayac >= limit) {
    return Math.max(1, Math.ceil((mevcut.sifirlama - simdi) / 1000));
  }

  mevcut.sayac += 1;
  return null;
}

/**
 * Sınır aşıldığında dönülecek standart yanıt.
 *
 * ⚠ 429 ve `Retry-After` şart: istemcinin ne zaman tekrar
 * deneyeceğini bilmesi gerekiyor, yoksa döngüye giriyor.
 */
export function asiriIstekYaniti(bekleSaniye: number): Response {
  return new Response(
    JSON.stringify({
      error: "Çok fazla istek",
      detail: `Lütfen ${bekleSaniye} saniye sonra tekrar deneyin.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(bekleSaniye),
      },
    },
  );
}
