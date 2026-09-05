import { href, serviceHref, type Locale, haberYolu} from "@/i18n/config";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Quote, Article } from "@/lib/types";
import type { PrayerTimes } from "@/lib/services";
import type { Match } from "@/lib/sports";
import type { DutyResult } from "@/lib/pharmacy";
import { formatNumber } from "@/lib/format";
import { pickImage } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import CocukKapak from "@/components/site/CocukKapak";
import Link from "next/link";

/**
 * HERO ÜSTÜ HİZMET ŞERİDİ
 *
 * Sıra bilinçli: MAÇ → NÖBETÇİ ECZANE → PİYASA → NAMAZ → VİDEO.
 * Maç ve eczane en çok bakılan iki bilgi; eczane ayrıca acil bir
 * ihtiyaç, o yüzden öne alındı.
 *
 * Eczane, namaz ve hava seçili şehre bağlıdır (site geneli).
 * Veri gelmeyen kart hiç basılmaz — boş kutu göstermek yerine
 * şeridi daraltmak doğru.
 */
const CARD: React.CSSProperties = {
  flex: "1 1 0", minWidth: 232, display: "flex", alignItems: "center", gap: 12,
  background: "var(--s1)", border: "1px solid var(--bd)",
  borderRadius: 14, padding: "12px 14px", color: "var(--tx)",
  scrollSnapAlign: "start",
};
const EYEBROW: React.CSSProperties = {
  fontSize: 11.5, color: "var(--mu)", fontWeight: 500,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const LINE: React.CSSProperties = {
  fontSize: 14.5, fontWeight: 700, marginTop: 3, lineHeight: 1.25,
};

export default function TopStrip({
  locale, dict, quote, prayer, video, match, duty,
}: {
  locale: Locale;
  dict: Dictionary;
  quote: Quote | null;
  prayer: PrayerTimes | null;
  video: Article | null;
  /** En son oynanan ya da sıradaki maç — Skor API'sinden */
  match: { match: Match; league: string; label: "result" | "upcoming" } | null;
  /** Seçili şehrin nöbetçi eczaneleri */
  duty: DutyResult | null;
}) {
  const items: React.ReactNode[] = [];
  const prayerLabel = (k: string) =>
    (dict.services as unknown as Record<string, string>)[k] ?? k;

  /* ---- 1) MAÇ ---- */
  if (match) {
    const { match: m, league, label } = match;
    const row = (t: Match["home"], score: number | null) => (
      <span style={{ ...LINE, display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {t.logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={t.logo}
            alt=""
            loading="lazy"
            style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }}
          />
        )}
        <span style={{ position: "relative", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {t.name}
        </span>
        <b style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{score ?? "—"}</b>
      </span>
    );

    items.push(
      <Link key="mt" href={serviceHref(locale, "scores")} style={CARD}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ ...EYEBROW, display: "block" }}>
            {league} · {m.week}. {dict.srv.week} ·{" "}
            {label === "result" ? dict.srv.result : dict.srv.upcoming}
          </span>
          {row(m.home, m.homeScore)}
          {row(m.away, m.awayScore)}
        </span>
      </Link>,
    );
  }

  /* ---- 2) NÖBETÇİ ECZANE ---- */
  if (duty && duty.pharmacies.length > 0) {
    const first = duty.pharmacies[0];
    items.push(
      <Link key="ph" href={serviceHref(locale, "pharmacy")} style={CARD}>
        <span
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "rgba(229,72,77,.14)", color: "#E5484D",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="cross" size={18} strokeWidth={1.8} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ ...EYEBROW, display: "block" }}>
            {dict.srv.pharmacy}
            {duty.il ? ` · ${duty.il}` : ""}
          </span>
          <span
            style={{
              position: "relative", ...LINE, display: "block",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {first.ad}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--mu)", marginTop: 2 }}>
            {duty.pharmacies.length > 1
              ? `${first.ilce} · +${duty.pharmacies.length - 1}`
              : first.ilce}
          </span>
        </span>
      </Link>,
    );
  }

  /* ---- 3) PİYASA ---- */
  if (quote) {
    const up = quote.changePercent >= 0;
    items.push(
      <Link key="mk" href={serviceHref(locale, "markets")} style={CARD}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ ...EYEBROW, display: "block" }}>{dict.services.markets}</span>
          <span style={{ ...LINE, display: "flex", alignItems: "baseline", gap: 8 }}>
            {quote.label}
            <b style={{ marginInlineStart: "auto", fontVariantNumeric: "tabular-nums" }}>
              {formatNumber(quote.value, locale, 2)}
            </b>
          </span>
          <span
            style={{
              display: "block", fontSize: 12.5, fontWeight: 700, marginTop: 2,
              color: up ? "var(--ac2)" : "var(--dn)", textAlign: "end",
            }}
          >
            {up ? "+" : "−"}{formatNumber(Math.abs(quote.changePercent), locale, 2)}%
          </span>
        </span>
      </Link>,
    );
  }

  /* ---- 4) NAMAZ ---- */
  if (prayer?.next) {
    items.push(
      <Link key="pr" href={serviceHref(locale, "prayer")} style={CARD}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ ...EYEBROW, display: "block" }}>
            {dict.services.prayer} · {prayer.city}
          </span>
          <span style={{ ...LINE, display: "flex", alignItems: "baseline", gap: 8 }}>
            {prayerLabel(prayer.next.key)}
            <b style={{ marginInlineStart: "auto", fontVariantNumeric: "tabular-nums" }}>
              {prayer.next.time}
            </b>
          </span>
        </span>
      </Link>,
    );
  }

  /* ---- 5) VİDEO ---- */
  if (video) {
    const img = pickImage(video.cover, "thumb");
    items.push(
      <Link key="vd" href={haberYolu(locale, video.slug, video.category_slug)} style={CARD}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ ...EYEBROW, display: "block" }}>{dict.home.videoNews}</span>
          <span
            style={{
              position: "relative", ...LINE, display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 13.5,
            }}
          >
            {video.title}
          </span>
        </span>
        <span style={{
          position: "relative", width: 46, height: 46, borderRadius: 10,
          overflow: "hidden", flexShrink: 0, background: "var(--s2)",
        }}>
          {img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={img} alt="" loading="lazy" />
          ) : (
            <VarsayilanGorsel />
          )}
          {/* Çocuk modunda uygunsuz haberin kapağı buzlanıyor */}
          <CocukKapak guvenli={video.cocuk_guvenli} />
        </span>
      </Link>,
    );
  }

  if (items.length === 0) return null;

  return (
    <div
      data-hide-sb
      style={{
        display: "flex", gap: 12, overflowX: "auto",
        scrollSnapType: "x proximity", paddingBottom: 2,
      }}
    >
      {items}
    </div>
  );
}
