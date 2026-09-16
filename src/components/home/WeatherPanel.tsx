import { getWeather, weatherLabel, type Weather } from "@/lib/services";
import { demoWeather } from "@/lib/demo";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * HERO YANINDAKİ HAVA PANELİ
 *
 * Ekran görüntüsündeki düzen: başlık solda, şehir sağda konum
 * simgesiyle; altında "hissedilen X°, durum" satırı; sağda büyük
 * simge ve derece; en altta ince çizgi ve "Tahmini gör ›".
 */
export default async function WeatherPanel({
  city, lat, lon, locale, dict, demo,
}: {
  city: string;
  lat?: number | null;
  lon?: number | null;
  locale: Locale;
  dict: Dictionary;
  demo: boolean;
}) {
  const w = (await getWeather(city, lat, lon)) ?? (demo ? (demoWeather as Weather) : null);
  if (!w) return null;

  const label = weatherLabel(w.code);

  return (
    <aside
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>
          {dict.services.weather}
        </h2>
        <span
          style={{
            marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 5,
            fontSize: 13.5, color: "var(--mu)", fontWeight: 500,
          }}
        >
          {w.city}
          <Icon name="pin" size={14} />
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
            {dict.services.feelsLike} {w.feels}°, {label.tr}
          </div>
          <div style={{ fontSize: 12, color: "var(--mu)", marginTop: 4 }}>
            {dict.services.high} {w.high}° · {dict.services.low} {w.low}° ·{" "}
            {dict.services.humidity} %{w.humidity}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Icon name={label.icon} size={34} strokeWidth={1.4} />
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.03em" }}>
            {w.temp}°
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--bd)", margin: "18px 0 14px" }} />

      <Link
        href={href(locale, "services")}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 15, fontWeight: 600, color: "var(--tx)",
        }}
      >
        {dict.services.seeForecast}
        <Icon name="chevronRight" size={16} />
      </Link>
    </aside>
  );
}
