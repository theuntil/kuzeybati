import { getPrayerTimes } from "@/lib/services";
import { fetchQuotes } from "@/lib/markets";
import { getFeaturedMatch, getScoreBoard } from "@/lib/sports";
import { getDutyPharmacies, pharmacyConfigured } from "@/lib/pharmacy";
import { demoQuotes, demoPrayer } from "@/lib/demo";
import TopStrip from "./TopStrip";
import LeagueTable from "./LeagueTable";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Article, SiteSettings } from "@/lib/types";

/* ══════════════════════════════════════════════════════════════
   DIŞ SERVİSLER — AYRI AKIŞTA

   ┌─ HABERLER NEDEN BEKLİYORDU ⚠️ ────────────────────────────┐
   │ Ana sayfa render edilmeden önce BEŞ dış servis            │
   │ bekleniyordu: borsa, namaz vakti, maç, puan durumu,       │
   │ nöbetçi eczane. Hepsi Supabase dışında, üçüncü taraf.     │
   │                                                             │
   │ Biri yavaşsa (ya da zaman aşımına düşerse) TÜM SAYFA      │
   │ bekliyordu — haberler hazır olmasına rağmen 4-5 saniye    │
   │ boş ekran.                                                  │
   │                                                             │
   │ Bu bileşenler kendi verilerini kendileri çekiyor ve        │
   │ `<Suspense>` ile sarmalanıyor. Haberler ANINDA geliyor;    │
   │ şerit ve puan tablosu hazır olduğunda yerine oturuyor.     │
   └─────────────────────────────────────────────────────────────┘

   Her biri kendi hatasını yutuyor: eczane servisi çökerse
   şeridin geri kalanı yine görünür.
   ══════════════════════════════════════════════════════════════ */

export async function TopStripAsync({
  locale, dict, settings, cityName, citySlug, video, demo,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  cityName: string;
  citySlug: string;
  video: Article | null;
  demo: boolean;
}) {
  const [quotes, prayerR, featuredMatch, duty] = await Promise.all([
    settings.markets_enabled
      ? fetchQuotes(settings.ticker_symbols.slice(0, 1)).catch(() => [])
      : Promise.resolve([]),
    settings.prayer_enabled
      ? getPrayerTimes(cityName).catch(() => null)
      : Promise.resolve(null),
    getFeaturedMatch().catch(() => null),
    pharmacyConfigured()
      ? getDutyPharmacies(citySlug).then((r) => r.result).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <TopStrip
      locale={locale}
      dict={dict}
      quote={quotes[0] ?? (demo ? demoQuotes[0] : null)}
      prayer={prayerR ?? (demo ? demoPrayer : null)}
      video={video}
      match={featuredMatch}
      duty={duty}
    />
  );
}

export async function LeagueTableAsync({
  dict, locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const board = await getScoreBoard().catch(() => null);
  if (!board) return null;
  return <LeagueTable board={board} dict={dict} locale={locale} />;
}

/**
 * Şerit iskeleti.
 *
 * Yüksekliği gerçek şeritle AYNI: veri gelince sayfa zıplamasın
 * (CLS). Ölçü `TopStrip`teki kart yüksekliğinden alındı.
 */
export function TopStripSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        display: "flex", gap: "var(--g)", overflow: "hidden",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="kb-skeleton"
          style={{
            flex: "1 1 0", minWidth: 0, height: 92, borderRadius: 18,
          }}
        />
      ))}
    </div>
  );
}
