import "server-only";

/**
 * HAVA DURUMU — Open-Meteo (anahtar gerekmez, ticari kullanım serbest)
 * NAMAZ VAKTİ  — Aladhan (anahtar gerekmez), method 13 = Diyanet
 *
 * İkisi de şehir adıyla çalışır; haber sayfası haberin şehrini
 * geçirir, böylece okunan haberin şehrinin havası gösterilir.
 */

export interface Weather {
  city: string;
  temp: number;
  feels: number;
  humidity: number;
  code: number;
  high: number;
  low: number;
  wind?: number;
  daily: { date: string; high: number; low: number; code: number }[];
  /** Önümüzdeki saatler — hava durumu sayfası kullanır */
  hourly?: { time: string; temp: number; code: number }[];
}

interface GeoHit { latitude: number; longitude: number; name: string }

async function geocode(city: string): Promise<GeoHit | null> {
  try {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({ name: city, count: "1", country: "TR", language: "tr", format: "json" });
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: GeoHit[] };
    return json.results?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getWeather(
  city: string,
  lat?: number | null,
  lon?: number | null,
): Promise<Weather | null> {
  let latitude = lat ?? null;
  let longitude = lon ?? null;
  let name = city;

  // cities tablosunda koordinat varsa geocoding'e hiç gitmiyoruz.
  if (latitude == null || longitude == null) {
    const hit = await geocode(city);
    if (!hit) return null;
    latitude = hit.latitude;
    longitude = hit.longitude;
    name = hit.name;
  }

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
        hourly: "temperature_2m,weather_code",
        daily: "temperature_2m_max,temperature_2m_min,weather_code",
        timezone: "Europe/Istanbul",
        forecast_days: "7",
      });
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      current: {
        temperature_2m: number; apparent_temperature: number;
        relative_humidity_2m: number; weather_code: number; wind_speed_10m?: number;
      };
      hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] };
      daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
    };

    // Saatlik: şu andan itibaren 24 saat
    const now = Date.now();
    const hourly = (j.hourly?.time ?? [])
      .map((t, i) => ({
        time: t,
        temp: Math.round(j.hourly!.temperature_2m[i]),
        code: j.hourly!.weather_code[i],
      }))
      .filter((x) => +new Date(x.time) >= now - 3600_000)
      .slice(0, 24);

    return {
      city: name,
      temp: Math.round(j.current.temperature_2m),
      feels: Math.round(j.current.apparent_temperature),
      humidity: Math.round(j.current.relative_humidity_2m),
      code: j.current.weather_code,
      wind: j.current.wind_speed_10m ? Math.round(j.current.wind_speed_10m) : undefined,
      hourly,
      high: Math.round(j.daily.temperature_2m_max[0]),
      low: Math.round(j.daily.temperature_2m_min[0]),
      daily: j.daily.time.slice(1, 7).map((d, i) => ({
        date: d,
        high: Math.round(j.daily.temperature_2m_max[i + 1]),
        low: Math.round(j.daily.temperature_2m_min[i + 1]),
        code: j.daily.weather_code[i + 1],
      })),
    };
  } catch {
    return null;
  }
}

/**
 * WMO hava kodu → HugeIcons ikon adı + etiket.
 *
 * Emoji KULLANILMIYOR: emoji her işletim sisteminde farklı çizilir,
 * tema rengini almaz ve boyutu kontrol edilemez. İkon adı
 * `components/ui/Icon.tsx` içindeki HugeIcons kaydına işaret eder.
 */
export type WeatherIcon =
  | "wClear" | "wPartly" | "wCloudy" | "wFog" | "wDrizzle"
  | "wRain" | "wSnow" | "wShower" | "wSnowShower" | "wStorm";

export function weatherLabel(code: number): { icon: WeatherIcon; tr: string } {
  if (code === 0) return { icon: "wClear", tr: "Açık" };
  if (code <= 2) return { icon: "wPartly", tr: "Az bulutlu" };
  if (code === 3) return { icon: "wCloudy", tr: "Bulutlu" };
  if (code <= 48) return { icon: "wFog", tr: "Sisli" };
  if (code <= 57) return { icon: "wDrizzle", tr: "Çiseleme" };
  if (code <= 67) return { icon: "wRain", tr: "Yağmurlu" };
  if (code <= 77) return { icon: "wSnow", tr: "Karlı" };
  if (code <= 82) return { icon: "wShower", tr: "Sağanak" };
  if (code <= 86) return { icon: "wSnowShower", tr: "Kar sağanağı" };
  return { icon: "wStorm", tr: "Gök gürültülü" };
}

export interface PrayerTimes {
  city: string;
  date: string;
  times: { key: string; time: string }[];
  next: { key: string; time: string } | null;
}

const ORDER = ["Imsak", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
const KEYS: Record<string, string> = {
  Imsak: "imsak", Sunrise: "gunes", Dhuhr: "ogle",
  Asr: "ikindi", Maghrib: "aksam", Isha: "yatsi",
};

export async function getPrayerTimes(city: string): Promise<PrayerTimes | null> {
  try {
    const method = process.env.PRAYER_METHOD ?? "13";
    const url =
      "https://api.aladhan.com/v1/timingsByCity?" +
      new URLSearchParams({ city, country: "Turkey", method });
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      data?: { timings: Record<string, string>; date: { readable: string } };
    };
    if (!j.data) return null;

    const times = ORDER.map((k) => ({
      key: KEYS[k],
      time: (j.data!.timings[k] ?? "").slice(0, 5),
    })).filter((x) => x.time);

    const now = new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
    });
    const next = times.find((x) => x.time > now) ?? null;

    return { city, date: j.data.date.readable, times, next };
  } catch {
    return null;
  }
}
