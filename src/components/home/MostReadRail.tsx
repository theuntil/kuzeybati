import { href, type Locale, haberYolu} from "@/i18n/config";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Article } from "@/lib/types";
import { pickImage } from "@/lib/media";
import { relativeTime, plainText } from "@/lib/format";
import CocukKapak from "@/components/site/CocukKapak";
import Link from "next/link";

/**
 * En çok okunanlar. Numaralandırma süs değil: sıra gerçek
 * okunma sayısını taşıyor. Mobilde gizli (data-mob-hide) —
 * prototipteki davranışın aynısı.
 */
export default function MostReadRail({
  articles, locale, dict, hideOnMobile = true,
}: {
  articles: Article[];
  locale: Locale;
  dict: Dictionary;
  /** Ana sayfada mobilde gizli (prototipteki davranış); yan sütunda görünür */
  hideOnMobile?: boolean;
}) {
  if (!articles.length) return null;

  return (
    <aside
      {...(hideOnMobile ? { "data-mob-hide": "" } : {})}
      style={{
        flex: "1 1 var(--side)", minWidth: 0, background: "var(--s1)",
        border: "1px solid var(--bd)", borderRadius: 18, padding: 24,
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.015em" }}>
          {dict.home.mostRead}
        </h3>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--mu)" }}>
          {dict.home.last24h}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {articles.map((a, i) => {
          const img = pickImage(a.cover, "thumb");
          const last = i === articles.length - 1;
          return (
            <Link
              key={a.id}
              href={haberYolu(locale, a.slug, a.category_slug)}
              style={{
                display: "flex", gap: 12, alignItems: "flex-start", width: "100%",
                padding: "11px 0", color: "var(--tx)",
                borderBottom: last ? undefined : "1px solid var(--bd)",
              }}
            >
              <span
                style={{
                  fontSize: 14, fontWeight: 800, color: "var(--mu)",
                  width: 14, flexShrink: 0, paddingTop: 2,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "block" }}>
                <span
                  style={{
                    display: "block", fontSize: 13.5, fontWeight: 700,
                    lineHeight: 1.32, textWrap: "pretty",
                  }}
                >
                  {a.title}
                </span>
                <span
                  style={{
                    display: "flex", alignItems: "center", gap: 7, marginTop: 6,
                    fontSize: 11, color: "var(--mu)", fontWeight: 600,
                  }}
                >
                  {a.category_name && (
                    <span
                      style={{
                        color: "var(--tx)", fontWeight: 800,
                        textTransform: "uppercase", letterSpacing: ".05em",
                      }}
                    >
                      {a.category_name}
                    </span>
                  )}
                  {/*
                    ⚠ OKUMA SÜRESİ YERİNE YAYIN ZAMANI.
                    Tarih zaten yanında duruyordu; ikisi birden
                    satırı şişiriyordu. Göreli zaman hem kısa
                    hem karar verdirici.
                  */}
                  · {relativeTime(a.published_at, locale)}
                </span>
              </span>
              <span style={{
                position: "relative", width: 56, height: 56, borderRadius: 10,
                overflow: "hidden", flexShrink: 0, background: "var(--s2)",
              }}>
                {img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={img} alt="" loading="lazy" />
                ) : (
                  <VarsayilanGorsel />
                )}
                {/* Çocuk modunda uygunsuz haberin kapağı buzlanıyor */}
                <CocukKapak guvenli={a.cocuk_guvenli} />
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
