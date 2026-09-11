import { getWeather, weatherLabel, type Weather } from "@/lib/services";
import { demoWeather } from "@/lib/demo";
import Icon from "@/components/ui/Icon";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Haberin ŞEHRİNİN havası.
 *
 * Ankara'daki bir okur Trabzon haberini açtığında Trabzon'un
 * havasını görür — sayfa neredeyse o yerin bağlamını taşımalı.
 * Okurun kendi konumu istenmiyor, izin de sorulmuyor.
 */
export default async function WeatherCard({
  city, lat, lon, dict, preloaded, demo = false,
}: {
  city: string;
  lat?: number | null;
  lon?: number | null;
  dict: Dictionary;
  /** Sayfa zaten çektiyse tekrar istek atma */
  preloaded?: Weather | null;
  /** Servis yanıt vermezse örnek veri gösterilsin mi */
  demo?: boolean;
}) {
  // Servis yanıt vermezse: demo modunda örnek, yayında kutu yok.
  const w = preloaded ?? (await getWeather(city, lat, lon)) ?? (demo ? (demoWeather as Weather) : null);
  if (!w) return null;

  const label = weatherLabel(w.code);

  return (
    <aside
      style={{
        border: "1px solid var(--bd)", borderRadius: 18,
        background: "var(--s1)", padding: 18,
      }}
      data-hava-kart
    >
      <div data-hava-baslik className="eyebrow muted" style={{ marginBottom: 10 }}>
        {dict.services.weather} · {w.city}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "var(--tx)", display: "flex" }} aria-hidden>
          <span data-hava-ikon style={{ display: "flex" }}>
            <Icon name={label.icon} size={38} strokeWidth={1.4} />
          </span>
        </span>
        <div>
          <div data-hava-derece style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{w.temp}°</div>
          <div data-hava-detay className="muted" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>
            {dict.services.feelsLike} {w.feels}° · {dict.services.humidity} %{w.humidity}
          </div>
        </div>
        <div className="muted" style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 600, textAlign: "end" }}>
          <div>{dict.services.high} {w.high}°</div>
          <div>{dict.services.low} {w.low}°</div>
        </div>
      </div>

      {/*
        Günlük tahmin şeridi.

        ⚠ `data-hava-gunler` CSS için TUTAMAK.
        Şehir sayfasında bu kart mobilde en üste alınıyor ve
        orada tam boy yer kaplıyordu; bu şerit CSS ile
        gizleniyor. İşaret olmadan gizlemenin güvenli bir yolu
        yoktu — sınıf adları üretilmiş olabilir.
      */}
      <div data-hava-gunler style={{ display: "flex", gap: 6, marginTop: 14 }}>
        {w.daily.map((d) => (
          <div
            key={d.date}
            style={{
              flex: 1, textAlign: "center", background: "var(--s2)",
              borderRadius: 10, padding: "8px 2px",
            }}
          >
            <div className="muted" style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>
              {new Date(d.date).toLocaleDateString("tr-TR", { weekday: "short" })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "3px 0" }} aria-hidden>
              <Icon name={weatherLabel(d.code).icon} size={18} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{d.high}°</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
