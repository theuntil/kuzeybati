import type { Metadata } from "next";
import { notFound } from "next/navigation";
import YoneticiGovde from "@/components/site/YoneticiGovde";
import DepremPanel from "@/components/services/DepremPanel";
import {
  assertLocale, serviceFromSlug, serviceHref, type ServiceKey,
} from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getSiteSettings } from "@/lib/settings";
import { getTopCities } from "@/lib/queries";
import { fetchQuotes } from "@/lib/markets";
import { getWeather, getPrayerTimes, weatherLabel, type Weather } from "@/lib/services";
import { getScoreBoard, sportsConfigured } from "@/lib/sports";
import TarihteBugunPanel from "@/components/services/TarihteBugun";
import { getDutyPharmacies, pharmacyConfigured } from "@/lib/pharmacy";
import { getSelectedCitySlug } from "@/lib/city";
import { getCity, getCityOptions } from "@/lib/queries";
import PharmacyList from "@/components/services/Pharmacy";
import { demoQuotes, demoWeather, demoPrayer } from "@/lib/demo";
import ServiceShell, { NoProvider } from "@/components/services/ServiceShell";
import { Fixtures, Standings, TopScorers, ScoreFooter } from "@/components/services/Scores";
import Sparkline from "@/components/home/Sparkline";
import Icon from "@/components/ui/Icon";
import { formatNumber } from "@/lib/format";

export const revalidate = 300;

type Params = Promise<{ locale: string; service: string }>;
type Query = Promise<{ city?: string; week?: string; il?: string; ilce?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, service } = await params;
  const locale = assertLocale(raw);
  const key = serviceFromSlug(locale, service);

  /*
   * ⚠ BAŞLIK YALNIZCA HİZMETLERİ TANIYORDU.
   *
   * Bu rota yönetici tanıtım sayfasını da karşılıyor. Hizmet
   * eşleşmeyince `title: "404"` dönüyordu; sayfa açılıyor ve
   * doğru içeriği gösteriyor ama sekme başlığı ve arama
   * motoru sonucu "404" yazıyordu.
   *
   * Sayfanın kendisiyle aynı dağıtım burada da yapılıyor.
   */
  if (!key) {
    const ayar = await getSiteSettings();
    const r = ayar as typeof ayar & Record<string, string | boolean | null>;
    const ySlug = String(r.yonetici_slug ?? "").trim();
    const yAd = String(r.yonetici_ad ?? "").trim();

    if (r.yonetici_sayfa_acik && ySlug && ySlug === service && yAd) {
      return {
        title: yAd,
        description: String(r.yonetici_ozet ?? r.yonetici_unvan ?? "") || undefined,
        alternates: { canonical: `/${locale}/${ySlug}` },
      };
    }
    return { title: "404" };
  }

  const dict = await getDictionary(locale);
  return { title: dict.srv[key], alternates: { canonical: serviceHref(locale, key) } };
}

export default async function ServicePage({
  params, searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const [{ locale: raw, service }, q] = await Promise.all([params, searchParams]);
  const locale = assertLocale(raw);
  const key = serviceFromSlug(locale, service);

  /*
   * ⚠ TEK PARÇALI ADRESLERİN DAĞITIMI BURADA.
   *
   * Bu rota `/{dil}/{bir-şey}` biçimindeki tüm adresleri
   * yakalıyor. Yönetici tanıtım sayfası için ayrı bir dinamik
   * rota açmak (`[kisi]`) aynı seviyede iki farklı slug adı
   * demekti; Next.js'te hangisinin eşleşeceği belirsiz kalıyor
   * ve `/tr/hava-durumu` yanlış rotaya düşebiliyordu.
   *
   * Hizmet değilse, yönetici slug'ıyla eşleşip eşleşmediğine
   * bakılıyor. O da tutmuyorsa 404.
   */
  if (!key) {
    const ayar = await getSiteSettings();
    const r = ayar as typeof ayar & Record<string, string | boolean | null>;
    const ySlug = String(r.yonetici_slug ?? "").trim();

    if (r.yonetici_sayfa_acik && ySlug && ySlug === service
        && String(r.yonetici_ad ?? "").trim()) {
      return (
        <div style={{ padding: "var(--g) var(--gut) 48px", maxWidth: 860 }}>
          <YoneticiGovde settings={ayar} locale={locale} />
        </div>
      );
    }
    notFound();
  }

  /**
   * ŞEHİR SİTE GENELİNDEN GELİR.
   *
   * Hava, namaz ve eczane aynı seçime bağlı: okur şehri bir kez
   * seçer, üç hizmet birden ona göre çalışır. Adresteki `?city=`
   * yalnızca paylaşılan bağlantılar için geçersiz kılar.
   */
  const [dict, s, citySlug] = await Promise.all([
    getDictionary(locale),
    getSiteSettings(),
    getSelectedCitySlug(),
  ]);

  const slug = q.city ?? citySlug;
  const cityRow = await getCity(slug);
  const city = cityRow?.name ?? "İstanbul";
  const demo = s.demo_mode;

  /*
   * ⚠ KAPALI HİZMET 404 VERİYOR.
   *
   * Yalnızca menüden gizlemek yetmiyor: adresi bilen ya da
   * arama motorundan gelen biri sayfayı yine açabilirdi.
   * Kapalı hizmet gerçekten yok sayılıyor.
   */
  const acik: Record<string, boolean> = {
    weather: s.weather_enabled,
    prayer: s.prayer_enabled,
    markets: s.markets_enabled,
    pharmacy: s.pharmacy_enabled,
    scores: s.scores_enabled,
    traffic: s.traffic_enabled,
    earthquake: s.earthquake_enabled,
    onthisday: s.onthisday_enabled,
  };
  if (acik[key] === false) notFound();

  const shell = (body: React.ReactNode, aside?: React.ReactNode) => (
    <ServiceShell
      active={key as ServiceKey}
      locale={locale}
      dict={dict}
      aside={aside}
      showCity={key === "weather" || key === "prayer" || key === "pharmacy"}
    >
      {body}
    </ServiceShell>
  );

  /* ---------------- DEPREM ---------------- */
  if (key === "earthquake") {
    /*
     * Varsayılan şehir haritanın açılış odağı.
     * `cityRow` zaten yukarıda çekiliyor; koordinatı yoksa
     * harita Türkiye geneline açılıyor.
     */
    return shell(
      <DepremPanel
        merkez={
          cityRow?.latitude != null && cityRow?.longitude != null
            ? { lat: cityRow.latitude, lon: cityRow.longitude }
            : null
        }
      />,
    );
  }

  /* ---------------- HAVA DURUMU ---------------- */
  if (key === "weather") {
    const w: Weather | null =
      (await getWeather(city, cityRow?.latitude, cityRow?.longitude)) ??
      (demo ? (demoWeather as Weather) : null);
    if (!w) return shell(<NoProvider dict={dict} />);
    const label = weatherLabel(w.code);

    return shell(
      <>

        <div
          style={{
            background: "var(--s1)", border: "1px solid var(--bd)",
            borderRadius: 18, padding: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Icon name={label.icon} size={56} strokeWidth={1.3} />
            <div>
              <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1 }}>
                {w.temp}°
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>{label.tr}</div>
            </div>
            <dl
              style={{
                marginInlineStart: "auto", display: "grid", gap: 6,
                fontSize: 13.5, color: "var(--mu)", margin: 0,
              }}
            >
              <div><dt style={{ display: "inline" }}>{dict.services.feelsLike}</dt>{" "}
                <dd style={{ display: "inline", margin: 0, color: "var(--tx)", fontWeight: 600 }}>{w.feels}°</dd></div>
              <div><dt style={{ display: "inline" }}>{dict.services.humidity}</dt>{" "}
                <dd style={{ display: "inline", margin: 0, color: "var(--tx)", fontWeight: 600 }}>%{w.humidity}</dd></div>
              {w.wind !== undefined && (
                <div><dt style={{ display: "inline" }}>{dict.srv.wind}</dt>{" "}
                  <dd style={{ display: "inline", margin: 0, color: "var(--tx)", fontWeight: 600 }}>{w.wind} km/s</dd></div>
              )}
            </dl>
          </div>
        </div>

        {w.hourly && w.hourly.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "26px 0 12px" }}>{dict.srv.hourly}</h2>
            <div
              data-hide-sb
              style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}
            >
              {w.hourly.map((h) => (
                <div
                  key={h.time}
                  style={{
                    flex: "0 0 auto", width: 74, textAlign: "center",
                    background: "var(--s1)", border: "1px solid var(--bd)",
                    borderRadius: 12, padding: "12px 6px",
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "var(--mu)", fontWeight: 700 }}>
                    {new Date(h.time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", padding: "7px 0" }}>
                    <Icon name={weatherLabel(h.code).icon} size={20} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{h.temp}°</div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "26px 0 12px" }}>{dict.srv.daily}</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {w.daily.map((d) => (
            <div
              key={d.date}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "var(--s1)", border: "1px solid var(--bd)",
                borderRadius: 12, padding: "12px 16px",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 92 }}>
                {new Date(d.date).toLocaleDateString("tr-TR", { weekday: "long" })}
              </span>
              <Icon name={weatherLabel(d.code).icon} size={22} strokeWidth={1.5} />
              <span style={{ fontSize: 13.5, color: "var(--mu)", flex: 1 }}>
                {weatherLabel(d.code).tr}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {d.high}° <span style={{ color: "var(--mu)", fontWeight: 500 }}>{d.low}°</span>
              </span>
            </div>
          ))}
        </div>
      </>,
    );
  }

  /* ---------------- PİYASALAR ---------------- */
  if (key === "markets") {
    let quotes = s.markets_enabled ? await fetchQuotes(s.ticker_symbols) : [];
    if (!quotes.length) {
      if (!demo) return shell(<NoProvider dict={dict} />);
      quotes = demoQuotes;
    }
    return shell(
      <>
        <div style={{ display: "grid", gap: 10 }}>
          {quotes.map((qq) => {
            const up = qq.changePercent >= 0;
            return (
              <div
                key={qq.key}
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  background: "var(--s1)", border: "1px solid var(--bd)",
                  borderRadius: 14, padding: "16px 18px",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0 }}>
                  {qq.label}
                </span>
                {qq.spark && qq.spark.length > 1 && (
                  <Sparkline points={qq.spark} up={up} width={110} height={34} />
                )}
                <span style={{ textAlign: "end", flexShrink: 0 }}>
                  <span style={{ display: "block", fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {formatNumber(qq.value, locale, qq.value >= 1000 ? 0 : 2)}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: up ? "var(--ac2)" : "var(--dn)" }}>
                    {up ? "+" : "−"}{formatNumber(Math.abs(qq.changePercent), locale, 2)}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--mu)", marginTop: 16 }}>
          {dict.services.delayed}
        </p>
      </>,
    );
  }

  /* ---------------- NAMAZ VAKİTLERİ ---------------- */
  if (key === "prayer") {
    const p = (await getPrayerTimes(city)) ?? (demo ? demoPrayer : null);
    if (!p) return shell(<NoProvider dict={dict} />);
    const label = (k: string) => (dict.services as unknown as Record<string, string>)[k] ?? k;

    return shell(
      <>
        <div style={{ display: "grid", gap: 8 }}>
          {p.times.map((t) => {
            const on = p.next?.key === t.key;
            return (
              <div
                key={t.key}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: on ? "var(--s3)" : "var(--s1)",
                  border: `1px solid ${on ? "var(--mu)" : "var(--bd)"}`,
                  borderRadius: 14, padding: "16px 18px",
                }}
              >
                <span style={{ fontSize: 15.5, fontWeight: on ? 800 : 600, flex: 1 }}>
                  {label(t.key)}
                </span>
                {on && (
                  <span
                    style={{
                      fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em",
                      textTransform: "uppercase", color: "var(--bg)",
                      background: "var(--tx)", padding: "3px 8px", borderRadius: 6,
                    }}
                  >
                    {dict.services.next}
                  </span>
                )}
                <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {t.time}
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--mu)", marginTop: 16 }}>
          {p.date} · Diyanet İşleri Başkanlığı
        </p>
      </>,
    );
  }

  /* ---------------- TARİHTE BUGÜN ---------------- */
  if (key === "onthisday") {
    return shell(<TarihteBugunPanel locale={locale} />);
  }

  /* ---------------- FUTBOL SKORLARI ---------------- */
  if (key === "scores") {
    if (!sportsConfigured()) return shell(<NoProvider dict={dict} />);
    const board = await getScoreBoard();
    if (!board) return shell(<NoProvider dict={dict} />);

    const week = Number(q.week) || board.currentWeek;
    return shell(
      <>
        <Fixtures board={board} week={week} dict={dict} />
        <ScoreFooter board={board} dict={dict} />
      </>,
      <>
        <Standings rows={board.standings} dict={dict} />
        <TopScorers board={board} dict={dict} />
      </>,
    );
  }

  /* ---------------- NÖBETÇİ ECZANE ---------------- */
  if (key === "pharmacy") {
    if (!pharmacyConfigured()) return shell(<NoProvider dict={dict} />);
    const duty = await getDutyPharmacies(slug);
    return shell(<PharmacyList initial={duty.result} dict={dict} canLocate />);
  }

  /* ---------------- KAYNAK SEÇİLMEMİŞ HİZMETLER ---------------- */
  // Trafik için henüz veri sağlayıcısı yok.
  // Uydurma veri göstermek yerine dürüst boş durum.
  return shell(<NoProvider dict={dict} />);
}
