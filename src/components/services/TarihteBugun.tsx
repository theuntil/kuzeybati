import { tarihteBugun, stripHtml, enIyiSayfa } from "@/lib/wiki/onthisday";
import { dayMonthNow, gunAyEtiketi, WIKI_LANG } from "@/lib/wiki/config";
import type { Locale } from "@/i18n/config";

/* ══════════════════════════════════════════════════════════════
   TARİHTE BUGÜN — HİZMET SAYFASI GÖVDESİ

   Wikimedia "On this day" beslemesi. Editoryal seçilmiş olaylar
   önce, ardından diğerleri; yeniden eskiye sıralı.
   ══════════════════════════════════════════════════════════════ */

export default async function TarihteBugunPanel({
  locale,
}: {
  locale: Locale;
}) {
  const { month, day, isoDate } = dayMonthNow();
  const { olaylar, bozuk } = await tarihteBugun({
    month, day, lang: locale === "tr" ? "tr" : WIKI_LANG, limit: 30,
  });

  const etiket = gunAyEtiketi(isoDate, locale === "tr" ? "tr-TR" : "en-GB");

  if (!olaylar.length) {
    return (
      <p style={{ color: "var(--mu)", padding: "28px 4px", fontSize: 15 }}>
        {bozuk
          ? "Veri şu an alınamıyor, birazdan tekrar deneyin."
          : "Bugün için kayıt bulunamadı."}
      </p>
    );
  }

  return (
    <div>
      <p style={{
        color: "var(--mu)", fontSize: 14, margin: "0 0 18px",
      }}>
        {etiket} — {olaylar.length} olay
      </p>

      <ol style={{
        listStyle: "none", margin: 0, padding: 0,
        display: "grid", gap: 12,
      }}>
        {olaylar.map((o, i) => {
          const sayfa = enIyiSayfa(o.pages);
          const metin = stripHtml(o.text);
          const gorsel = sayfa?.thumbnail?.source;

          /*
           * ⚠ BAŞLIK YOKSA BAĞLANTI DA YOK.
           * Bazı olaylar hiçbir maddeye bağlı değil; tıklanabilir
           * göstermek okuru boş sayfaya götürürdü.
           */
          const govde = (
            <>
              {gorsel ? (
                <img
                  src={gorsel}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 76, height: 76, borderRadius: 13,
                    objectFit: "cover", flexShrink: 0,
                    background: "var(--s2)",
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 76, height: 76, borderRadius: 13, flexShrink: 0,
                    display: "grid", placeItems: "center",
                    background: "var(--s2)", color: "var(--mu)",
                    fontSize: 15, fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {o.year ?? "—"}
                </span>
              )}

              <span style={{ minWidth: 0, flex: 1 }}>
                {o.year !== undefined && (
                  <span style={{
                    display: "block", fontSize: 12.5, fontWeight: 800,
                    color: "var(--ac)", letterSpacing: ".02em",
                    marginBottom: 3,
                  }}>
                    {o.year}
                  </span>
                )}
                <span style={{
                  display: "block", fontSize: 14.5, lineHeight: 1.45,
                  color: "var(--tx)", overflowWrap: "anywhere",
                }}>
                  {metin}
                </span>
              </span>
            </>
          );

          const kutu: React.CSSProperties = {
            display: "flex", gap: 14, alignItems: "flex-start",
            padding: 14, borderRadius: 16,
            background: "var(--s1)", border: "1px solid var(--bd)",
            textDecoration: "none",
          };

          /*
           * ┌─ BAĞLANTI WIKIPEDIA'YA ⚠️ ──────────────────────────┐
           * │ İlk hâli kendi sitemizde bir detay sayfasına link   │
           * │ veriyordu: `/tr/tarihte-bugun/<baslik>`. O rota HİÇ │
           * │ YOKTU — her kart 404'e gidiyordu.                    │
           * │                                                        │
           * │ Detay sayfası yazmak yerine doğrudan kaynağa         │
           * │ gidiliyor: okur zaten ansiklopedi maddesini görmek  │
           * │ istiyor, biz araya bir kopya sayfa koymamalıyız —   │
           * │ hem bakım yükü hem SEO'da yinelenen içerik.         │
           * │                                                        │
           * │ Yeni sekmede açılıyor: okur haber sitesinden        │
           * │ kopmasın.                                             │
           * └──────────────────────────────────────────────────────┘
           */
          const wikiAdres = sayfa?.content_urls?.desktop?.page;

          return (
            <li key={`${o.year ?? "x"}-${i}`}>
              {wikiAdres ? (
                <a
                  href={wikiAdres}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={kutu}
                >
                  {govde}
                </a>
              ) : (
                <div style={kutu}>{govde}</div>
              )}
            </li>
          );
        })}
      </ol>

      {/*
        ⚠ LİSANS ATFI ZORUNLU.
        Wikipedia içeriği CC BY-SA lisanslı; kaynağı ve lisansı
        belirtmek yasal yükümlülük.
      */}
      <p style={{
        marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--bd)",
        fontSize: 12.5, color: "var(--mu)", lineHeight: 1.6,
      }}>
        İçerik{" "}
        <a href="https://www.wikipedia.org" target="_blank"
          rel="noopener noreferrer" style={{ color: "var(--ac)" }}>
          Wikipedia
        </a>{" "}
        kaynaklıdır ve{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank" rel="noopener noreferrer" style={{ color: "var(--ac)" }}>
          CC BY-SA 4.0
        </a>{" "}
        lisansıyla sunulmaktadır.
      </p>
    </div>
  );
}
