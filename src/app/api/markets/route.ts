import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";
import { fetchQuotes } from "@/lib/markets";

export const revalidate = 60;

/**
 * Piyasa verisi. Semboller panelden (site_settings.ticker_symbols)
 * geliyor, kodda sabit liste yok.
 *
 * NOT: Veri gecikmelidir ve ticari yayın için BIST lisansı gerekir;
 * ayrıntı src/lib/markets.ts başındaki uyarıda.
 */
export async function GET() {
  const s = await getSiteSettings();
  if (!s.markets_enabled) {
    return NextResponse.json({ quotes: [], disabled: true });
  }
  const quotes = await fetchQuotes(s.ticker_symbols);
  return NextResponse.json(
    { quotes, delayed: true, at: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
