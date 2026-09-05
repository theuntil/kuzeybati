import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import { assertLocale, serviceHref, serviceSlugs, type ServiceKey } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SERVICE_META } from "@/components/services/ServiceShell";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const dict = await getDictionary(assertLocale(raw));
  return { title: dict.nav.services };
}

/**
 * HİZMETLER — giriş sayfası
 *
 * Her hizmet kendi adresine gider (/hizmetler/hava-durumu gibi).
 * Tek sayfada sekme yerine ayrı adres: paylaşılabilir ve arama
 * motorlarınca ayrı ayrı indekslenebilir.
 */
export default async function ServicesIndex({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);
  const [dict, s] = await Promise.all([getDictionary(locale), getSiteSettings()]);

  const keys = (Object.keys(serviceSlugs) as ServiceKey[]).filter((k) => {
    /*
     * ⚠ HER HİZMET İÇİN AYRI ANAHTAR.
     * Önce yalnızca hava, namaz ve piyasa kontrol ediliyordu;
     * eczane, skorlar ve trafik `return true` ile her zaman
     * görünüyordu — kapatmanın bir yolu yoktu.
     */
    if (k === "weather") return s.weather_enabled;
    if (k === "prayer") return s.prayer_enabled;
    if (k === "markets") return s.markets_enabled;
    if (k === "pharmacy") return s.pharmacy_enabled;
    if (k === "scores") return s.scores_enabled;
    if (k === "traffic") return s.traffic_enabled;
    if (k === "earthquake") return s.earthquake_enabled;
    if (k === "onthisday") return s.onthisday_enabled;
    return true;
  });

  return (
    <div style={{ padding: "var(--g) var(--gut) 48px" }}>
      <h1 style={{ fontSize: "var(--h1)", fontWeight: 800, letterSpacing: "-.03em", margin: "10px 0 24px" }}>
        {dict.nav.services}
      </h1>

      <div
        style={{
          display: "grid", gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
        }}
      >
        {keys.map((k) => {
          const m = SERVICE_META[k];
          return (
            <Link
              key={k}
              href={serviceHref(locale, k)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "var(--s1)", border: "1px solid var(--bd)",
                borderRadius: 16, padding: 18, color: "var(--tx)",
              }}
            >
              <span
                style={{
                  width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                  background: m.tint, color: m.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icon name={m.icon} size={22} />
              </span>
              <span style={{ fontSize: 15.5, fontWeight: 700, minWidth: 0 }}>
                {dict.srv[k]}
              </span>
              <span style={{ marginInlineStart: "auto", color: "var(--mu)", flexShrink: 0 }}>
                <Icon name="chevronRight" size={17} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
