import type { SiteSettings } from "@/lib/types";
import { assetUrl } from "@/lib/media";

/**
 * Bakım modu. Panelden tek UPDATE ile açılır:
 *   update site_settings set maintenance_mode = true where id;
 *
 * Deploy gerekmez; ISR önbelleği 60 saniyede yenilendiği için
 * en geç bir dakika içinde tüm sayfalarda görünür.
 */
export default function Maintenance({ settings }: { settings: SiteSettings }) {
  const logo = assetUrl(settings.logo_dark_key ?? settings.logo_light_key);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 460 }}>
        {logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logo}
            alt={settings.site_name}
            style={{ height: 30, width: "auto", margin: "0 auto 28px" }}
          />
        )}
        <div
          className="badge"
          style={{ background: "var(--s2)", color: "var(--mu)", marginBottom: 18 }}
        >
          {settings.site_name}
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 12 }}>
          {settings.maintenance_title}
        </h1>
        <p style={{ color: "var(--mu)", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
          {settings.maintenance_message}
        </p>
        {settings.maintenance_until && (
          <p style={{ color: "var(--mu)", fontSize: 13, marginTop: 20 }}>
            {new Date(settings.maintenance_until).toLocaleString("tr-TR", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Europe/Istanbul",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
