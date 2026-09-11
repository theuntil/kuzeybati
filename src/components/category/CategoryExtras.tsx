import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { getScoreBoard, sportsConfigured } from "@/lib/sports";
import { fetchQuotes } from "@/lib/markets";
import { getDutyPharmacies, pharmacyConfigured } from "@/lib/pharmacy";
import { getSelectedCitySlug } from "@/lib/city";
import { getSiteSettings } from "@/lib/settings";
import { demoQuotes } from "@/lib/demo";
import ScoreStrip from "./ScoreStrip";
import MarketStrip from "./MarketStrip";
import PharmacyStrip from "./PharmacyStrip";

/**
 * KATEGORİYE ÖZEL BÖLÜM
 *
 * Kategori sayfası düz bir haber listesi olmak zorunda değil.
 * Okur spora girdiğinde skoru, ekonomiye girdiğinde kuru,
 * sağlığa girdiğinde nöbetçi eczaneyi arar.
 *
 * Eşleşme kategori SLUG'una göre. Eşleşme yoksa hiçbir şey
 * basılmaz — zorlama widget koymak sayfayı gürültüye boğar.
 *
 * Veri gelmezse bölüm de görünmez; boş kutu göstermeyiz.
 */
const SPORT = new Set(["spor", "sports", "futbol"]);
const FINANCE = new Set(["ekonomi", "finans", "is-dunyasi", "borsa"]);
const HEALTH = new Set(["saglik", "health"]);

export default async function CategoryExtras({
  slug, locale, dict,
}: {
  slug: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const s = await getSiteSettings();

  if (SPORT.has(slug)) {
    if (!sportsConfigured()) return null;
    const board = await getScoreBoard();
    return board ? <ScoreStrip board={board} locale={locale} dict={dict} /> : null;
  }

  if (FINANCE.has(slug)) {
    if (!s.markets_enabled) return null;
    let quotes = await fetchQuotes(s.ticker_symbols);
    if (!quotes.length) {
      if (!s.demo_mode) return null;
      quotes = demoQuotes;
    }
    return <MarketStrip quotes={quotes} locale={locale} dict={dict} />;
  }

  if (HEALTH.has(slug)) {
    if (!pharmacyConfigured()) return null;
    const city = await getSelectedCitySlug();
    const { result } = await getDutyPharmacies(city);
    return result ? <PharmacyStrip duty={result} locale={locale} dict={dict} /> : null;
  }

  return null;
}
