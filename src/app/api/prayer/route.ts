import { NextResponse, type NextRequest } from "next/server";
import { getPrayerTimes } from "@/lib/services";

export const revalidate = 3600;

/** Namaz vakitleri — Aladhan, method 13 (Diyanet İşleri Başkanlığı) */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "Ankara";
  const data = await getPrayerTimes(city);
  if (!data) {
    return NextResponse.json({ error: "Vakitler alınamadı" }, { status: 502 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
  });
}
