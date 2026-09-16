import type { ReactNode } from "react";
import { HIZMET_GORUNUM } from "@/components/site/hizmetler";
import { href, type Locale, type ServiceKey } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon, { type IconName } from "@/components/ui/Icon";
import { CityButton } from "@/components/site/CityProvider";
import Link from "next/link";

/*
 * ⚠ DÖRDÜNCÜ KOPYAYDI — ARTIK TEK KAYNAKTAN.
 * Hizmet görünümü dört ayrı yerde tanımlıydı; deprem
 * eklenince hiçbirine yazılmadı ve menüde görünmedi.
 * `hizmetler.ts` tek doğruluk kaynağı.
 */
export const SERVICE_META = HIZMET_GORUNUM;

/**
 * Hizmet sayfalarının ortak kabuğu: başlık, simge ve diğer
 * hizmetlere geçiş şeridi. Her hizmetin kendi adresi olduğu için
 * bu şerit sekme değil, gerçek bağlantı.
 */
export default function ServiceShell({
  active, locale, dict, children, aside, showCity = false,
}: {
  active: ServiceKey;
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
  aside?: ReactNode;
  /** Şehre bağlı hizmetlerde başlıkta şehir düğmesi çıkar */
  showCity?: boolean;
}) {
  const meta = SERVICE_META[active];
  const label = (k: ServiceKey) => dict.srv[k];

  return (
    <div style={{ padding: "var(--g) var(--gut) 48px" }}>
      {/*
        ⚠ YATAY HİZMET BARI KALDIRILDI.

        Her hizmet sayfasının üstünde altı hizmetin tamamını
        listeleyen kaydırmalı bir şerit vardı. Üç sorun:

          • Sayfanın en değerli yerini (üst kısım) kaplıyordu
          • Mobilde yatay kaydırma gerektiriyordu ve içerik
            aşağı itiliyordu
          • Header'daki hizmetler düğmesi zaten aynı listeyi
            açıyor — aynı gezinme iki yerde

        Geri dönüş için başlığın yanında tek bir bağlantı
        yeterli.
      */}
      <Link
        href={href(locale, "services")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: "var(--mu)",
          marginBottom: 14, textDecoration: "none",
        }}
      >
        <span style={{ display: "flex", transform: "rotate(180deg)" }}>
          <Icon name="chevronRight" size={14} />
        </span>
        {dict.nav.services}
      </Link>

      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <span
          style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: meta.tint, color: meta.color,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name={meta.icon} size={24} />
        </span>
        <h1 style={{ fontSize: "var(--h1)", fontWeight: 800, letterSpacing: "-.03em" }}>
          {label(active)}
        </h1>
        {showCity && (
          <span style={{ marginInlineStart: "auto" }}>
            <CityButton label={dict.srv.province} />
          </span>
        )}
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "calc(var(--g) * 1.4)", alignItems: "flex-start" }}>
        <div style={{ flex: "3 1 var(--main)", minWidth: 0 }}>{children}</div>
        {aside && (
          <aside
            style={{
              flex: "1 1 var(--side)", minWidth: 0,
              display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}

/** Veri kaynağı bağlanmamış hizmetler için dürüst boş durum */
export function NoProvider({ dict }: { dict: Dictionary }) {
  return (
    <div
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: "44px 24px", textAlign: "center",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--mu)", margin: 0 }}>
        {dict.srv.noProvider}
      </p>
    </div>
  );
}
