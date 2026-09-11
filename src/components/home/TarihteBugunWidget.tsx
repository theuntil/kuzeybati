import { tarihteBugun, stripHtml, enIyiSayfa } from "@/lib/wiki/onthisday";
import { dayMonthNow, gunAyEtiketi, WIKI_LANG } from "@/lib/wiki/config";
import { type Locale, serviceHref } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   TARİHTE BUGÜN — MİNİ WIDGET

   Ana sayfada piyasaların altında, haber sayfasında sabah
   bülteninin altında. Üç olay gösteriyor, gerisi hizmet
   sayfasında.

   ⚠ VERİ YOKSA HİÇ BASILMIYOR.
   Boş bir kutu sayfada delik bırakır ve site bozuk görünür.
   ══════════════════════════════════════════════════════════════ */

export default async function TarihteBugunWidget({
  locale, dict, adet = 3,
}: {
  locale: Locale;
  dict: Dictionary;
  adet?: number;
}) {
  const { month, day, isoDate } = dayMonthNow();

  const { olaylar } = await tarihteBugun({
    month, day,
    lang: locale === "tr" ? "tr" : WIKI_LANG,
    limit: adet,
  }).catch(() => ({ olaylar: [], lang: WIKI_LANG, bozuk: true }));

  if (!olaylar.length) return null;

  const etiket = gunAyEtiketi(isoDate, locale === "tr" ? "tr-TR" : "en-GB");
  const baslik = (dict.srv as Record<string, string>).onthisday ?? "Tarihte Bugün";
  const tumu = serviceHref(locale, "onthisday");

  return (
    <section
      style={{
        border: "1px solid var(--bd)", borderRadius: 18,
        background: "var(--s1)", padding: 18, overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", alignItems: "baseline",
        justifyContent: "space-between", gap: 10, marginBottom: 14,
      }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow muted">{baslik}</div>
          <div style={{
            fontSize: 19, fontWeight: 800, letterSpacing: "-.02em",
            marginTop: 2,
          }}>
            {etiket}
          </div>
        </div>

        <Link href={tumu} style={{
          fontSize: 12.5, fontWeight: 700, color: "var(--ac)",
          textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap",
        }}>
          {dict.common.all}
        </Link>
      </div>

      <ol style={{
        listStyle: "none", margin: 0, padding: 0,
        display: "grid", gap: 12,
      }}>
        {olaylar.map((o, i) => {
          const sayfa = enIyiSayfa(o.pages);
          const gorsel = sayfa?.thumbnail?.source;

          return (
            <li
              key={`${o.year ?? "x"}-${i}`}
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              {/*
                Yıl rozeti: görsel olsa da olmasa da aynı yerde
                duruyor — liste hizalı kalıyor.
              */}
              <span style={{
                flexShrink: 0, width: 46, height: 46, borderRadius: 12,
                display: "grid", placeItems: "center", overflow: "hidden",
                background: "var(--s2)", position: "relative",
              }}>
                {gorsel ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={gorsel} alt="" loading="lazy" decoding="async"
                    style={{
                      width: "100%", height: "100%",
                      objectFit: "cover", display: "block",
                    }}
                  />
                ) : (
                  <span style={{
                    fontSize: 11.5, fontWeight: 800, color: "var(--mu)",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {o.year ?? "—"}
                  </span>
                )}
              </span>

              <span style={{ minWidth: 0, flex: 1 }}>
                {o.year !== undefined && (
                  <span style={{
                    display: "block", fontSize: 11.5, fontWeight: 800,
                    color: "var(--ac)", marginBottom: 2,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {o.year}
                  </span>
                )}
                <span style={{
                  display: "-webkit-box", WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                  fontSize: 13.5, lineHeight: 1.4, color: "var(--tx)",
                  overflowWrap: "anywhere",
                }}>
                  {stripHtml(o.text)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* CC BY-SA yükümlülüğü — kısa biçim, tam atıf hizmet sayfasında */}
      <p style={{
        margin: "14px 0 0", fontSize: 11, color: "var(--mu)",
      }}>
        Kaynak: Wikipedia · CC BY-SA
      </p>
    </section>
  );
}
