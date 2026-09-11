import type { SiteSettings } from "@/lib/types";
import { assetUrl } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * YÖNETİCİ TANITIM SAYFASININ GÖVDESİ
 *
 * ⚠ KENDİ ROTASI YOK — BİLEŞEN.
 *
 * Önce `app/[locale]/(yonetici)/[kisi]` diye ayrı bir rota
 * vardı. Ama `app/[locale]/(hizmet)/[service]` de aynı seviyede
 * tek parçalı adresleri yakalıyor. Next.js iki farklı dinamik
 * ada sahip bu rotaları aynı seviyede tutunca hangisinin
 * eşleşeceği belirsiz kalıyor — `/tr/hava-durumu` yanlış
 * rotaya düşebilirdi.
 *
 * Çözüm: tek rota, içinde dağıtım. Bu dosya yalnızca görünümü
 * taşıyor.
 */
export default function YoneticiGovde({
  settings, locale,
}: {
  settings: SiteSettings;
  locale: string;
}) {
  const r = settings as SiteSettings & Record<string, string | boolean | null>;
  const ad = String(r.yonetici_ad ?? "").trim();

  const unvan = String(r.yonetici_unvan ?? "").trim();
  const ozet = String(r.yonetici_ozet ?? "").trim();
  const biyo = String(r.yonetici_biyografi ?? "").trim();
  const foto = assetUrl(String(r.yonetici_foto_key ?? "") || null);
  const kapak = assetUrl(String(r.yonetici_kapak_key ?? "") || null);

  /*
   * Sosyal bağlantılar — `SosyalBaglantilar` bileşeni site
   * hesapları için; bunlar kişiye ait, o yüzden ayrı.
   */
  /*
   * ⚠ İKON SETİNDE MARKA SİMGESİ YOK.
   * `Icon` bileşeni arayüz ikonları taşıyor; LinkedIn ve X gibi
   * marka simgeleri satır içi SVG olarak veriliyor —
   * `SosyalBaglantilar` bileşeninde de aynı yaklaşım var.
   */
  const baglantilar: { ad: string; url: string; simge: React.ReactNode }[] = [
    {
      ad: "LinkedIn", url: String(r.yonetici_linkedin ?? "").trim(),
      simge: (
        <>
          <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" />
          <path d="M7 10v7M7 7v.01M11.5 17v-3.8a2.2 2.2 0 0 1 4.4 0V17" />
        </>
      ),
    },
    {
      ad: "X", url: String(r.yonetici_x ?? "").trim(),
      simge: (
        <path d="M3 3l7.5 9.8L3.4 21h2.2l5.8-6.6L16.5 21H21l-7.9-10.3L20.6 3h-2.2l-5.3 6.1L8.5 3H3z"
          fill="currentColor" stroke="none" />
      ),
    },
    {
      ad: "Instagram", url: String(r.yonetici_instagram ?? "").trim(),
      simge: (
        <>
          <rect x="2" y="2" width="20" height="20" rx="5.5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
        </>
      ),
    },
  ].filter((x) => x.url);

  const eposta = String(r.yonetici_email ?? "").trim();

  return (
    <div>
      {/* ---- kapak ---- */}
      {kapak && (
        <div style={{
          width: "100%", aspectRatio: "3 / 1", borderRadius: 18,
          overflow: "hidden", background: "var(--s2)", marginBottom: -46,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={kapak} alt="" style={{
            width: "100%", height: "100%", objectFit: "cover",
          }} />
        </div>
      )}

      {/* ---- kimlik ---- */}
      <div style={{
        display: "flex", alignItems: "center", gap: 18,
        position: "relative", zIndex: 1, flexWrap: "wrap",
        paddingInline: kapak ? 6 : 0,
      }}>
        <span style={{
          width: 108, height: 108, borderRadius: "50%", flexShrink: 0,
          overflow: "hidden", background: "var(--s2)",
          border: kapak ? "5px solid var(--bg)" : "none",
          display: "grid", placeItems: "center",
          fontSize: 38, fontWeight: 800, color: "var(--mu)",
        }}>
          {foto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={foto} alt="" style={{
              width: "100%", height: "100%", objectFit: "cover",
            }} />
          ) : (
            ad.slice(0, 1).toUpperCase()
          )}
        </span>

        <div style={{ minWidth: 0, flex: "1 1 240px", paddingTop: kapak ? 40 : 0 }}>
          <h1 style={{
            fontSize: "clamp(23px, 3.4vw, 31px)", fontWeight: 800,
            letterSpacing: "-.015em", margin: 0, overflowWrap: "anywhere",
          }}>
            {ad}
          </h1>
          {unvan && (
            <p style={{
              fontSize: 15, lineHeight: 1.5, color: "var(--mu)",
              margin: "6px 0 0", overflowWrap: "anywhere",
            }}>
              {unvan}
            </p>
          )}
        </div>
      </div>

      {ozet && (
        <p style={{
          fontSize: 16.5, lineHeight: 1.65, color: "var(--tx)",
          opacity: .9, margin: "24px 0 0",
        }}>
          {ozet}
        </p>
      )}

      {/* ---- biyografi ---- */}
      {biyo && (
        <div style={{ marginTop: 22 }}>
          {biyo.split(/\n{2,}/).filter(Boolean).map((para, i) => (
            <p key={i} style={{
              fontSize: 15.5, lineHeight: 1.75, color: "var(--tx)",
              opacity: .86, margin: "0 0 14px", overflowWrap: "anywhere",
            }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {/* ---- iletişim ---- */}
      {(baglantilar.length > 0 || eposta) && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 9, marginTop: 26,
        }}>
          {eposta && (
            <a
              href={`mailto:${eposta}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 17px", borderRadius: 13,
                background: "var(--s2)", border: "1px solid var(--bd)",
                color: "var(--tx)", fontSize: 13.5, fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden>
                <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
                <path d="m3.5 7 8.5 6 8.5-6" />
              </svg>
              {eposta}
            </a>
          )}

          {baglantilar.map((b) => (
            <a
              key={b.ad}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 17px", borderRadius: 13,
                background: "var(--s2)", border: "1px solid var(--bd)",
                color: "var(--tx)", fontSize: 13.5, fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden>
                {b.simge}
              </svg>
              {b.ad}
            </a>
          ))}
        </div>
      )}

      <Link
        href={`/${locale}/sayfa/hakkimizda`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13.5, fontWeight: 600, color: "var(--mu)",
          marginTop: 30, textDecoration: "none",
        }}
      >
        <span style={{ display: "flex", transform: "rotate(180deg)" }}>
          <Icon name="chevronRight" size={15} />
        </span>
        Hakkımızda
      </Link>
    </div>
  );
}
