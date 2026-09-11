import type { SiteSettings } from "@/lib/types";
import { assetUrl } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   YÖNETİCİ KİŞİ KARTI

   Hakkımızda sayfasında gösteriliyor; tıklayınca ayrıntı
   sayfasına gidiyor.

   ┌─ BOŞ KART BASILMIYOR ⚠️ ──────────────────────────────────┐
   │ Ad girilmemişse ya da kart panelden kapatılmışsa hiçbir   │
   │ şey çizilmiyor. Yarım doldurulmuş bir kişi kartı kurumsal │
   │ bir sayfada güven kaybettirir.                             │
   │                                                              │
   │ ⚠ SAYFA KAPALIYSA KART BAĞLANTISIZ.                        │
   │ Kart açık ama ayrıntı sayfası kapalıysa `<a>` yerine düz  │
   │ bir kutu basılıyor — tıklanıp 404 alınmasın diye.         │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function YoneticiKarti({
  settings, locale,
}: {
  settings: SiteSettings;
  locale: string;
}) {
  const s = settings as SiteSettings & Record<string, string | boolean | null>;

  const ad = String(s.yonetici_ad ?? "").trim();
  if (!ad || !s.yonetici_kart_acik) return null;

  const unvan = String(s.yonetici_unvan ?? "").trim();
  const slug = String(s.yonetici_slug ?? "").trim();
  const foto = assetUrl(String(s.yonetici_foto_key ?? "") || null);

  /* Sayfa kapalı ya da adres yoksa bağlantı verilmiyor */
  const gidilebilir = Boolean(slug) && Boolean(s.yonetici_sayfa_acik);
  const adres = gidilebilir ? `/${locale}/${slug}` : null;

  const govde = (
    <>
      <span style={{
        width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
        overflow: "hidden", background: "var(--s2)",
        display: "grid", placeItems: "center",
        fontSize: 23, fontWeight: 800, color: "var(--mu)",
      }}>
        {foto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={foto} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          ad.slice(0, 1).toUpperCase()
        )}
      </span>

      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{
          display: "block", fontSize: 16.5, fontWeight: 800,
          letterSpacing: "-.01em", overflowWrap: "anywhere",
        }}>
          {ad}
        </span>
        {unvan && (
          <span style={{
            display: "block", fontSize: 13.5, lineHeight: 1.5,
            color: "var(--mu)", marginTop: 4, overflowWrap: "anywhere",
          }}>
            {unvan}
          </span>
        )}
      </span>

      {adres && (
        <span style={{ display: "flex", color: "var(--mu)", flexShrink: 0 }}>
          <Icon name="chevronRight" size={17} />
        </span>
      )}
    </>
  );

  const kutu: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 16,
    padding: 18, borderRadius: 16,
    background: "var(--s1)", border: "1px solid var(--bd)",
    color: "var(--tx)", textDecoration: "none",
  };

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{
        fontSize: 12, fontWeight: 800, letterSpacing: ".05em",
        textTransform: "uppercase", color: "var(--mu)",
        margin: "0 0 12px",
      }}>
        Yönetim
      </h2>

      {adres ? (
        <Link href={adres} style={kutu}>{govde}</Link>
      ) : (
        <div style={kutu}>{govde}</div>
      )}
    </section>
  );
}
