import type { Locale } from "@/i18n/config";
import { href, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAllCities } from "@/lib/queries";
import type { CityRow } from "@/lib/types";
import Link from "next/link";

export const revalidate = 3600;

export default async function CityIndex({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  const dict = await getDictionary(locale);

  const cities = await getAllCities();
  const byRegion = new Map<string, CityRow[]>();
  for (const c of cities) {
    const key = c.region ?? "—";
    byRegion.set(key, [...(byRegion.get(key) ?? []), c]);
  }

  return (
    <div style={{ padding: "var(--g) var(--gut) 40px" }}>
      <h1 style={{ fontSize: "var(--h1)", fontWeight: 800, margin: "10px 0 24px" }}>
        {dict.nav.allCities}
      </h1>

      {[...byRegion.entries()].map(([region, list]) => (
        <section key={region} style={{ marginBottom: 26 }}>
          <h2 className="eyebrow muted" style={{ marginBottom: 10 }}>{region}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {list.map((c) => (
              <Link
                key={c.id}
                href={href(locale, "city", c.slug)}
                className="btn"
                style={{ padding: "7px 13px", fontSize: 13.5 }}
              >
                {c.plate_code && (
                  <span className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                    {String(c.plate_code).padStart(2, "0")}
                  </span>
                )}
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
