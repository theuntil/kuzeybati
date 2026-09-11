import type { DutyResult } from "@/lib/pharmacy";
import type { Dictionary } from "@/i18n/get-dictionary";
import { serviceHref, type Locale } from "@/i18n/config";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * SAĞLIK KATEGORİSİ — NÖBETÇİ ECZANE ŞERİDİ
 *
 * Sağlık sayfasına giren okurun aradığı ilk şey çoğu zaman
 * nöbetçi eczanedir. Seçili şehre göre ilk dört eczane; tamamı
 * için hizmet sayfasına bağlantı.
 */
export default function PharmacyStrip({
  duty, locale, dict,
}: {
  duty: DutyResult;
  locale: Locale;
  dict: Dictionary;
}) {
  const list = duty.pharmacies.slice(0, 6);
  if (!list.length) return null;

  return (
    <section
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18, marginBottom: "calc(var(--g) + 8px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: "rgba(229,72,77,.14)", color: "#E5484D",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="cross" size={17} strokeWidth={1.8} />
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>{dict.srv.pharmacy}</h2>
        {duty.il && (
          <span style={{ fontSize: 12, color: "var(--mu)", fontWeight: 600 }}>{duty.il}</span>
        )}
        <Link
          href={serviceHref(locale, "pharmacy")}
          style={{
            marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 4,
            fontSize: 13, fontWeight: 700, color: "#E5484D", flexShrink: 0,
          }}
        >
          {dict.common.all}
          <Icon name="chevronRight" size={15} />
        </Link>
      </div>

      <div
        data-hide-sb
        style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x proximity", paddingBottom: 2 }}
      >
        {list.map((p) => (
          <article
            key={p.id}
            style={{
              flex: "0 0 auto", width: 218, scrollSnapAlign: "start",
              background: "var(--s2)", borderRadius: 14, padding: "13px 14px",
              display: "flex", flexDirection: "column",
            }}
          >
            <h3
              style={{
                fontSize: 14, fontWeight: 800, lineHeight: 1.28,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}
            >
              {p.ad}
            </h3>
            <p
              style={{
                fontSize: 12, color: "var(--mu)", margin: "6px 0 10px", lineHeight: 1.4,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}
            >
              {p.adres}
            </p>
            {p.telefon && (
              <a
                href={`tel:${p.telefon.replace(/\s/g, "")}`}
                style={{
                  marginTop: "auto", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6, height: 34, borderRadius: 10,
                  background: "#E5484D", color: "#fff", fontSize: 12.5, fontWeight: 700,
                }}
              >
                <Icon name="phone" size={13} color="#fff" />
                {dict.srv.call}
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
