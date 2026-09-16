import type { ReactNode } from "react";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { assetUrl } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import type { SiteSettings } from "@/lib/types";
import Link from "next/link";

/**
 * GİRİŞ / KAYIT KABUĞU
 *
 * iOS tarzı: ortada tek kolon, 52px dokunma hedefleri, yumuşak
 * köşeler, sade tipografi. Mobilde tam ekran, masaüstünde
 * ortalanmış dar kolon.
 */
export default function AuthShell({
  settings, locale, dict, title, subtitle, children, footer,
}: {
  settings: SiteSettings;
  locale: Locale;
  dict: Dictionary;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const logo = assetUrl(settings.logo_light_key ?? settings.logo_dark_key);

  return (
    /**
     * Masaüstünde ortada KART, mobilde tam ekran.
     *
     * Mobil düzeni masaüstüne olduğu gibi taşımak "büyütülmüş
     * telefon" hissi veriyordu. Kart sınırı, gölge ve zeminle
     * masaüstünde oturaklı duruyor.
     */
    <div className="kb-auth-wrap">
      {/* Geri düğmesi SOL ÜSTTE — sayfa akışının dışında,
          uygulamalardaki alışılmış yerinde. */}
      <Link
        href={href(locale, "home")}
        aria-label={dict.auth.backHome}
        title={dict.auth.backHome}
        className="kb-auth-back"
      >
        <span style={{ display: "flex", transform: "rotate(180deg)" }}>
          <Icon name="chevronRight" size={18} />
        </span>
      </Link>

      <div className="kb-auth-card">
        <Link href={href(locale, "home")} style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          {logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt={settings.site_name} style={{ height: 26, width: "auto" }} />
          ) : (
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }}>
              {settings.site_name}
            </span>
          )}
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", textAlign: "center", lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 15, color: "var(--mu)", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}

        <div style={{ marginTop: 26 }}>{children}</div>

        {footer && (
          <div style={{ marginTop: 22, textAlign: "center", fontSize: 14.5, color: "var(--mu)" }}>
            {footer}
          </div>
        )}

        <p style={{ marginTop: 18, textAlign: "center", fontSize: 12, color: "var(--mu)", lineHeight: 1.6 }}>
          {dict.auth.legal}
        </p>
      </div>

      <style>{`
        .kb-auth-back {
          position: fixed; inset-inline-start: 16px;
          top: calc(16px + env(safe-area-inset-top));
          width: 40px; height: 40px; border-radius: 999px;
          display: flex; align-items: center; justify-content: center;
          background: var(--s2); color: var(--tx);
          z-index: 10;
        }
        @media (min-width: 861px) {
          .kb-auth-back { inset-inline-start: 24px; top: 24px; }
        }

        .kb-auth-wrap {
          min-height: 100dvh;
          display: flex; align-items: center; justify-content: center;
          padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
        }
        .kb-auth-card { width: 100%; max-width: 400px; }

        /* KART YOK.
           Kutu içine almak formu sayfadan kopuk gösteriyordu;
           zemin ile aynı renkte, sınırsız ve gölgesiz duruyor. */
        @media (min-width: 861px) {
          .kb-auth-card { max-width: 400px; }
        }
      `}</style>
    </div>
  );
}
