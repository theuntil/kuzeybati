import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { NavItem } from "@/lib/types";
import Icon, { type IconName } from "@/components/ui/Icon";

/**
 * Mobil sekme çubuğu — prototipteki beş sekme ve ölçüler
 * (58px genişlik, 46px yükseklik, 10.5px etiket).
 */
const tab: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  fontSize: 10.5, fontWeight: 700, color: "var(--mu)",
  minWidth: 58, minHeight: 46, justifyContent: "center", flex: 1,
};

export default function MobileTabBar({
  locale, dict, nav,
}: {
  locale: Locale;
  dict: Dictionary;
  nav: NavItem[];
}) {
  void nav;

  const items: { key: IconName; label: string; url: string }[] = [
    { key: "home", label: dict.nav.home, url: href(locale, "home") },
    { key: "grid", label: dict.nav.services, url: href(locale, "services") },
    /*
     * ⚠ "VİDEOLU HABER" YERİNE REELS.
     * Eski video sayfası ızgara listesiydi; akış deneyimi
     * mobilde çok daha iyi çalışıyor. Eski sayfa duruyor,
     * yalnızca menüdeki yeri değişti.
     */
    { key: "reels", label: dict.nav.reels, url: href(locale, "reels") },
    { key: "search", label: dict.nav.search, url: href(locale, "search") },
    { key: "user", label: dict.nav.account, url: href(locale, "account") },
  ];

  return (
    <nav
      data-tabbar
      data-only="mobile"
      aria-label={dict.nav.menu}
      style={{
        position: "fixed", insetInline: 0, bottom: 0, zIndex: 80,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        background: "color-mix(in srgb, var(--bg) 92%, transparent)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid var(--bd)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map((i) => (
        /*
         * ⚠ `<Link>` — TAM SAYFA YENİLEME DEĞİL.
         *
         * Reels sayfasında videonun SESLİ başlayabilmesi buna
         * bağlı. Tarayıcı, kullanıcı sayfayla etkileşime
         * girmeden sesli oynatmaya izin vermiyor; tıklama bu
         * izni veriyor ama TAM SAYFA YENİLEMEDE izin kayboluyor
         * çünkü yeni bir belge açılıyor.
         *
         * `<Link>` sayfa içi gezinme yapıyor: belge aynı
         * kalıyor, tıklamayla kazanılan izin korunuyor ve video
         * ilk kareden itibaren sesli açılıyor.
         */
        <Link key={i.key} href={i.url} style={tab}>
          <Icon name={i.key} size={21} strokeWidth={1.5} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
