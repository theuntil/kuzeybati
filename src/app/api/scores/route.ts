import { NextResponse } from "next/server";
import { getScoreBoard } from "@/lib/sports";

export const revalidate = 120;

/**
 * Futbol skorları ve puan durumu.
 *
 * ┌─ MOBİL İÇİN AÇILDI ⚠️ ─────────────────────────────────────┐
 * │ Site bu veriyi sunucu bileşenlerinde doğrudan             │
 * │ `getScoreBoard()` ile okuyor; HTTP ucu yoktu.              │
 * │                                                              │
 * │ Mobil uygulamanın `skor.rovand.cloud` adresine doğrudan   │
 * │ gitmesi, takım adı temizleme ve önbellek mantığını         │
 * │ uygulamada tekrarlamak demekti. Tek kaynak burası.         │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ⚠ KAYNAK ULAŞILAMAZSA BOŞ DÖNÜYOR.
 * `null` yerine boş yapı: mobil taraf alan okurken çökmesin.
 */
export async function GET() {
  const veri = await getScoreBoard();

  if (!veri) {
    return NextResponse.json(
      {
        league: "", currentWeek: 0, lastWeek: 0,
        matches: [], standings: [], scorers: [],
        unavailable: true,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(veri, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
