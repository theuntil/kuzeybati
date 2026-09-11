import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * SON DEPREMLER — AFAD
 *
 * ┌─ NEDEN SUNUCUDAN GEÇİYOR ⚠️ ──────────────────────────────┐
 * │ Tarayıcı AFAD'ı doğrudan çağıramıyor: servis CORS başlığı │
 * │ göndermiyor. Ayrıca her ziyaretçinin ayrı ayrı istek       │
 * │ atması AFAD'ı gereksiz yorardı.                            │
 * │                                                              │
 * │ Bu uç, veriyi bir kez çekip 60 saniye önbellekte tutuyor.  │
 * │ Deprem verisi zaten dakikada bir güncelleniyor; daha sık   │
 * │ sormanın karşılığı yok.                                     │
 * └──────────────────────────────────────────────────────────────┘
 */

const AFAD = "https://deprem.afad.gov.tr/apiv2/event/filter";

/** Sunucu belleğinde tutulan son yanıt */
let onbellek: { veri: Deprem[]; zaman: number } | null = null;
const ONBELLEK_MS = 60_000;

export interface Deprem {
  id: string;
  tarih: string;
  buyukluk: number;
  derinlik: number;
  enlem: number;
  boylam: number;
  yer: string;
  il: string | null;
  ilce: string | null;
}

/* Kendi hız sınırımız — uç herkese açık */
const PENCERE_MS = 60_000;
const PENCERE_MAX = 20;
const vurus = new Map<string, { n: number; sifir: number }>();

function sinirAsildi(ip: string): boolean {
  const simdi = Date.now();
  const k = vurus.get(ip);
  if (!k || simdi > k.sifir) {
    vurus.set(ip, { n: 1, sifir: simdi + PENCERE_MS });
    if (vurus.size > 5000) {
      for (const [a, b] of vurus) if (simdi > b.sifir) vurus.delete(a);
    }
    return false;
  }
  k.n += 1;
  return k.n > PENCERE_MAX;
}

/** AFAD `YYYY-MM-DD HH:mm:ss` bekliyor */
function afadTarih(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

interface AfadKayit {
  eventID?: string; date?: string; magnitude?: string | number;
  depth?: string | number; latitude?: string | number;
  longitude?: string | number; location?: string;
  province?: string; district?: string;
}

function donustur(ham: AfadKayit[]): Deprem[] {
  return ham
    .map((x): Deprem | null => {
      const buyukluk = Number(x.magnitude);
      const enlem = Number(x.latitude);
      const boylam = Number(x.longitude);

      /*
       * ⚠ BOZUK KAYIT ATLANIYOR.
       * AFAD ara sıra boş koordinat ya da metin büyüklük
       * gönderiyor; haritaya `NaN` koymak tüm çizimi bozuyordu.
       */
      if (!Number.isFinite(buyukluk) || !Number.isFinite(enlem)
          || !Number.isFinite(boylam) || !x.date) return null;

      return {
        id: String(x.eventID ?? `${x.date}-${enlem}-${boylam}`),
        tarih: String(x.date),
        buyukluk,
        derinlik: Number(x.depth) || 0,
        enlem, boylam,
        yer: String(x.location ?? "").trim() || "Bilinmiyor",
        il: x.province ? String(x.province).trim() : null,
        ilce: x.district ? String(x.district).trim() : null,
      };
    })
    .filter((x): x is Deprem => x !== null)
    /* En yeni üstte */
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "yok";
  if (sinirAsildi(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  /* Önbellek taze mi */
  if (onbellek && Date.now() - onbellek.zaman < ONBELLEK_MS) {
    return NextResponse.json(
      { depremler: onbellek.veri, onbellek: true },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  }

  /*
   * Son 7 gün, 1.0 üstü.
   * Daha geniş aralık yanıtı büyütüyor ve listede işe
   * yaramayan yüzlerce mikro sarsıntı oluşturuyor.
   */
  const bitis = new Date();
  const baslangic = new Date(bitis.getTime() - 7 * 24 * 60 * 60 * 1000);

  const adres = `${AFAD}?start=${encodeURIComponent(afadTarih(baslangic))}`
    + `&end=${encodeURIComponent(afadTarih(bitis))}`
    + `&minmag=1.0&orderby=timedesc&limit=500`;

  try {
    const kontrol = new AbortController();
    const zaman = setTimeout(() => kontrol.abort(), 12_000);

    const yanit = await fetch(adres, {
      signal: kontrol.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(zaman);

    if (!yanit.ok) {
      /*
       * ⚠ ESKİ VERİ, HİÇ VERİDEN İYİ.
       * AFAD zaman zaman 5xx dönüyor. Elimizde önceki yanıt
       * varsa onu göndermek, sayfayı boş bırakmaktan iyi —
       * kullanıcıya bayatlığı belirtiliyor.
       */
      if (onbellek) {
        return NextResponse.json({ depremler: onbellek.veri, bayat: true });
      }
      return NextResponse.json({ error: "afad_error" }, { status: 502 });
    }

    const ham = (await yanit.json()) as AfadKayit[];
    const veri = donustur(Array.isArray(ham) ? ham : []);

    onbellek = { veri, zaman: Date.now() };

    return NextResponse.json(
      { depremler: veri },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    if (onbellek) {
      return NextResponse.json({ depremler: onbellek.veri, bayat: true });
    }
    return NextResponse.json({ error: "unreachable" }, { status: 503 });
  }
}
