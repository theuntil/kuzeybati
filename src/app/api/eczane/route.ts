import { NextResponse, type NextRequest } from "next/server";
import { getNearbyPharmacies, pharmacyConfigured } from "@/lib/pharmacy";

export const dynamic = "force-dynamic";

/**
 * KONUMA GÖRE NÖBETÇİ ECZANE
 *
 * Tarayıcı yalnızca koordinat gönderir; API anahtarı burada,
 * sunucuda kalır. Anahtarı istemciye vermek kotanın başkaları
 * tarafından tüketilmesi demekti.
 *
 * KENDİ HIZ SINIRIMIZ
 *   Sağlayıcının kotası dakikada 100 istek. Bu uç nokta herkese
 *   açık olduğu için biri arka arkaya çağırıp kotayı bitirebilir.
 *   IP başına dakikada 12 istek: normal kullanım için fazlasıyla
 *   yeterli, kötüye kullanım için değil.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);

  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    // Bellek sınırsız büyümesin: süresi geçmiş kayıtları ara ara temizle
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    }
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

export async function GET(req: NextRequest) {
  if (!pharmacyConfigured()) {
    return NextResponse.json({ error: "disabled" }, { status: 503 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radius = Number(sp.get("radius") ?? 5000);

  const { result, error } = await getNearbyPharmacies(lat, lng, radius);
  if (!result) {
    const status = error === "bad" ? 400 : error === "rate" ? 429 : 502;
    return NextResponse.json({ error: error ?? "down" }, { status });
  }

  return NextResponse.json(result, {
    // Kişiye özel sonuç: paylaşılan önbelleğe girmesin
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
