import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicConfig } from "@/lib/config";
import { hizSiniri, istekKimligi, asiriIstekYaniti } from "@/lib/rate-limit";

/**
 * ZİYARET KAYDI
 *
 * ┌─ NEDEN SUNUCUDAN ⚠️ ──────────────────────────────────────┐
 * │ Önce tarayıcı doğrudan Supabase'i çağırıyordu:             │
 * │     void sb.rpc("track_page_view", { … })                  │
 * │ `void` hatayı yutuyordu — çağrı başarısız olsa hiçbir yerde│
 * │ iz kalmıyor, "neden 0" sorusu cevapsız kalıyordu.          │
 * │                                                              │
 * │ Ayrıca tarayıcıdan üçüncü parti bir alan adına istek atmak, │
 * │ izleme engelleyicilerin ilk kestiği şey.                    │
 * │                                                              │
 * │ Şimdi: tarayıcı → kendi sunucumuz → veritabanı.             │
 * │   • Kendi alan adımız, engelleyici kesmiyor                 │
 * │   • Sunucu gerçek IP başlığını görüyor → ülke                │
 * │   • Sunucu User-Agent görüyor → tarayıcı, işletim sistemi   │
 * │   • Hata sunucu günlüğüne düşüyor                            │
 * └──────────────────────────────────────────────────────────────┘
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Veritabanı istemcisi.
 *
 * ⚠ MODÜL SEVİYESİNDE OLUŞTURULMUYOR.
 * `createClient` ortam değişkeni boşsa fırlatıyor ve bu, modül
 * yüklenirken oluyor — DERLEME sırasında:
 *   Error: supabaseUrl is required
 * Sayfa üretimi tamamen kırılıyordu. İstek geldiğinde
 * oluşturuluyor ve bir kez saklanıyor.
 *
 * ⚠ `anon` ANAHTARI, service_role DEĞİL.
 * Bu uç herkese açık; ele geçirilirse en fazla sahte ziyaret
 * kaydı yazılır. service_role burada dursaydı tüm veritabanı
 * açık olurdu.
 */
let _sb: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_sb) return _sb;
  /*
   * ⚠ ORTAM DEĞİŞKENİ DOĞRUDAN OKUNMUYOR.
   *
   * `process.env.SUPABASE_URL` yazıyordum. Dağıtımda değişkenler
   * `NEXT_PUBLIC_SUPABASE_URL` adıyla tanımlıydı ve bu uç onları
   * göremiyordu — sunucu günlüğü şunu basıyordu:
   *   [izle] hata: SUPABASE_URL ve SUPABASE_ANON_KEY tanımlı değil
   *
   * `publicConfig()` her iki adı da deniyor; sitenin geri kalanı
   * zaten onu kullandığı için çalışıyordu.
   */
  const { supabaseUrl: url, supabaseAnonKey: key } = publicConfig();
  if (!url || !key) {
    throw new Error("Supabase ayarları bulunamadı (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL)");
  }
  /*
   * Tip parametresiz `SupabaseClient`: üretilmiş şema tipleri
   * olmadan `rpc()` argümanları `undefined` sanılıyordu.
   */
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

/**
 * User-Agent'tan tarayıcı adı.
 *
 * Kütüphane kullanılmıyor: `ua-parser-js` 40 KB ve bize üç
 * bilgi lazım. Sıra ÖNEMLİ — Edge kendini Chrome, Chrome
 * kendini Safari sanıyor.
 */
function tarayici(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/YaBrowser/.test(ua)) return "Yandex";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Diğer";
}

function isletim(ua: string): string {
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Diğer";
}

/**
 * Bot mu?
 *
 * ⚠ SAYILMAMALILAR. Google, Bing ve sosyal medya önizleme
 * botları günde binlerce istek atıyor; sayılırsa istatistik
 * tamamen anlamsızlaşıyor.
 */
function botMu(ua: string): boolean {
  return /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime/i
    .test(ua);
}

/**
 * Ülke kodu.
 *
 * Vekil sunucular ülkeyi başlıkta gönderiyor (Cloudflare,
 * Vercel, Fly). IP'nin KENDİSİ hiçbir yere yazılmıyor —
 * yalnızca ülke kodu.
 */
function ulke(req: NextRequest): string | null {
  const h = req.headers;
  const k =
    h.get("cf-ipcountry") ??
    h.get("x-vercel-ip-country") ??
    h.get("x-country-code") ??
    h.get("fly-client-ip-country");
  if (!k || k === "XX" || k.length !== 2) return null;
  return k.toUpperCase();
}

export async function POST(req: NextRequest) {
  /*
   * ⚠ HIZ SINIRI.
   * İzlenme kaydı: dakikada 60. Normal okuma için fazlasıyla yeterli,
   * betikle sayaç şişirmeyi engelliyor.
   */
  const bekle = hizSiniri("izle", istekKimligi(req), 60, 60000);
  if (bekle !== null) return asiriIstekYaniti(bekle);

  try {
    return await isle(req);
  } catch (e) {
    /*
     * Ziyaret kaydı SİTEYİ ETKİLEMEMELİ. Ayar eksikse ya da
     * veritabanı ulaşılamazsa hata loglanıyor ama okur hiçbir
     * şey fark etmiyor.
     */
    console.error("[izle] hata:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

async function isle(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  // Botlar sessizce yok sayılıyor — hata değil, sayım değil
  if (botMu(ua)) return NextResponse.json({ ok: true, bot: true });

  let g: Record<string, unknown>;
  try {
    /*
     * `sendBeacon` gövdeyi metin olarak gönderiyor; JSON
     * ayrıştırma burada yapılıyor.
     */
    g = JSON.parse(await req.text()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  /* ---- Süre güncellemesi ---- */
  if (g.kind === "sure") {
    const id = Number(g.id);
    const sn = Number(g.seconds);
    if (!Number.isFinite(id) || !Number.isFinite(sn)) {
      return NextResponse.json({ ok: false });
    }
    const { error } = await db().rpc("izle_sure", { p_id: id, p_saniye: Math.round(sn) });
    if (error) console.error("[izle] süre yazılamadı:", error.message);
    return NextResponse.json({ ok: !error });
  }

  /* ---- Yeni sayfa ---- */
  const { data, error } = await db().rpc("izle_sayfa", {
    p: {
      path: String(g.path ?? "/").slice(0, 300),
      type: String(g.type ?? "diger").slice(0, 32),
      session: String(g.session ?? "anon").slice(0, 80),
      locale: String(g.locale ?? "tr").slice(0, 5),
      referrer: g.referrer ? String(g.referrer).slice(0, 300) : null,
      platform: String(g.platform ?? "web"),
      screen_w: g.screen_w ?? null,
      country: ulke(req),
      browser: tarayici(ua),
      os: isletim(ua),
    },
  });

  if (error) {
    /*
     * ⚠ HATA GİZLENMİYOR.
     * Eskiden sessizce yutuluyordu ve "neden 0 görünüyor"
     * sorusunun cevabı hiçbir yerde yoktu.
     */
    /*
     * ⚠ 200 DÖNÜLÜYOR, 500 DEĞİL.
     *
     * Ziyaret kaydı yan bir iş; başarısız olması okuru
     * ilgilendirmiyor. 500 dönersek tarayıcı konsolu kırmızı
     * hatalarla doluyor ve `sendBeacon` yeniden deneyebiliyor.
     *
     * Sebep sunucu günlüğüne yazılıyor — orada görünüyor,
     * kaybolmuyor.
     */
    console.error("[izle] kayıt yazılamadı:", error.message);
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, id: data });
}
