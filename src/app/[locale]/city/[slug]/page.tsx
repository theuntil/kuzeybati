import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, type Locale, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getSiteSettings } from "@/lib/settings";
import { getByCity, getCity } from "@/lib/queries";
import SonsuzGrid from "@/components/home/SonsuzGrid";
import WeatherCard from "@/components/article/WeatherCard";

export const revalidate = 120;

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale);
  const c = await getCity(slug);
  if (!c) return { title: "404" };
  return { title: c.name, alternates: { canonical: href(locale, "city", slug) } };
}

export default async function CityPage({ params }: { params: Params }) {
  const { locale: rawLocale, slug } = await params;
  const locale = assertLocale(rawLocale);
  const [dict, settings, city, items] = await Promise.all([
    getDictionary(locale),
    getSiteSettings(),
    getCity(slug),
    getByCity(slug, 30, locale),
  ]);
  if (!city) notFound();

  return (
    <div style={{ padding: "var(--g) var(--gut) 40px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 22px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "var(--h1)", fontWeight: 800 }}>{city.name}</h1>
        {city.plate_code && (
          <span className="badge" style={{ background: "var(--s2)", color: "var(--mu)" }}>
            {String(city.plate_code).padStart(2, "0")}
          </span>
        )}
        {city.region && <span className="muted" style={{ fontSize: 13.5 }}>{city.region}</span>}
      </header>

      {/*
        ⚠ MOBİLDE HAVA DURUMU EN ÜSTTE.

        `flex-wrap` ile yan sütun dar ekranda haberlerin ALTINA
        düşüyordu; şehir sayfasına giren okur hava durumunu
        görmek için tüm haber listesini kaydırmak zorundaydı.

        `order` ile mobilde başa alınıyor ve `kb-hava-mini`
        sınıfıyla yüksekliği kısaltılıyor — en üstte yer
        kaplamasın diye.
      */}
      <div className="kb-sehir-duzen" style={{ display: "flex", flexWrap: "wrap", gap: "var(--g)", alignItems: "flex-start" }}>
        <div className="kb-sehir-ana" style={{ flex: "3 1 var(--main)", minWidth: 0 }}>
          {items.length === 0 ? (
            <p className="muted">{dict.search.noResults}</p>
          ) : (
            /* Tasarım aynı; yalnızca devamı yükleniyor */
            <SonsuzGrid
              ilk={items}
              locale={locale}
              dict={dict}
              sehir={slug}
            />
          )}
        </div>

        {settings.weather_enabled && city.is_domestic && (
          <div className="kb-sehir-hava" style={{ flex: "1 1 var(--side)", minWidth: 0 }}>
            <WeatherCard
              city={city.name}
              lat={city.latitude}
              lon={city.longitude}
              dict={dict}
              demo={settings.demo_mode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
