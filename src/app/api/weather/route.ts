import { NextResponse, type NextRequest } from "next/server";
import { getWeather } from "@/lib/services";

export const revalidate = 1800;

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  if (!city) {
    return NextResponse.json({ error: "city parametresi gerekli" }, { status: 400 });
  }
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));

  const data = await getWeather(
    city,
    Number.isFinite(lat) ? lat : null,
    Number.isFinite(lon) ? lon : null,
  );
  if (!data) {
    return NextResponse.json({ error: "Hava durumu alınamadı" }, { status: 502 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
