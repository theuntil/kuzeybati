import { createPublicClient } from "@/lib/supabase/server";
import { assetUrl } from "@/lib/media";
import { publicConfig } from "@/lib/config";
import type { Locale } from "@/i18n/config";

interface Ad {
  id: string;
  placement: string;
  advertiser: string | null;
  image_key: string | null;
  image_dark_key: string | null;
  target_url: string | null;
  headline: string | null;
  body: string | null;
  cta_label: string | null;
  embed_html: string | null;
  locale: string | null;
}

/**
 * Reklam yuvası.
 *
 * Kayıt yoksa HİÇBİR ŞEY render edilmez — boş gri kutu göstermek
 * sayfayı bozuk gösterir. "Reklam" etiketi her zaman görünür;
 * içeriği reklamdan ayırmak yasal ve etik bir gereklilik.
 */
export default async function AdSlot({
  placement, locale, enabled,
}: {
  placement: string;
  locale: Locale;
  enabled: boolean;
}) {
  if (!enabled) return null;
  if (!publicConfig().supabaseUrl) return null;

  let ad: Ad | null = null;
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("public_ads")
      .select("*")
      .eq("placement", placement)
      .or(`locale.is.null,locale.eq.${locale}`)
      .order("sort_order")
      .limit(1);
    ad = ((data as Ad[]) ?? [])[0] ?? null;
  } catch {
    return null;
  }
  if (!ad) return null;

  const img = assetUrl(ad.image_key);

  const inner = (
    <div
      style={{
        display: "flex", gap: 14, alignItems: "center",
        border: "1px solid var(--bd)", borderRadius: "var(--radius)",
        background: "var(--s1)", padding: 14, overflow: "hidden",
      }}
    >
      {img && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={img}
          alt=""
          loading="lazy"
          style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow muted" style={{ marginBottom: 5 }}>
          Reklam{ad.advertiser ? ` · ${ad.advertiser}` : ""}
        </div>
        {ad.headline && (
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{ad.headline}</div>
        )}
        {ad.body && (
          <p className="muted" style={{ fontSize: 13, margin: "5px 0 0", lineHeight: 1.45 }}>
            {ad.body}
          </p>
        )}
        {ad.cta_label && (
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ac)", display: "inline-block", marginTop: 7 }}>
            {ad.cta_label} →
          </span>
        )}
      </div>
    </div>
  );

  // Ağ reklamı (AdSense vb.) kendi kodunu getirir.
  if (ad.embed_html) {
    return (
      <div style={{ margin: "var(--g) 0" }}>
        <div className="eyebrow muted" style={{ marginBottom: 6 }}>Reklam</div>
        <div dangerouslySetInnerHTML={{ __html: ad.embed_html }} />
      </div>
    );
  }

  return (
    <div style={{ margin: "var(--g) 0" }}>
      {ad.target_url ? (
        <a href={ad.target_url} target="_blank" rel="noopener noreferrer sponsored">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
