import { getRelated } from "@/lib/queries";
import { relativeTime } from "@/lib/format";
import { haberYolu, type Locale } from "@/i18n/config";
import { pickImage } from "@/lib/media";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import Link from "next/link";
import type { Article } from "@/lib/types";

/* ══════════════════════════════════════════════════════════════
   AYNI KATEGORİ VE ŞEHİRDEN HABERLER

   Yorumların altında. Sade tutuluyor: yalnızca başlık ve yayın
   zamanı. Özet, kategori rozeti ve yazar burada gürültü olurdu —
   okur zaten bir haber okumuş, sıradakini seçiyor.

   ⚠ SAYFA AÇILIŞINI GECİKTİRMİYOR.
   Çağıran taraf `Suspense` ile sarmalıyor; bu sorgu sayfanın
   geri kalanı çizildikten sonra tamamlanıyor.
   ══════════════════════════════════════════════════════════════ */

export default async function BenzerHaberler({
  article, locale,
}: {
  article: Article;
  locale: Locale;
}) {
  /*
   * `getRelated` önce aynı kategoriye, yetmezse aynı şehre
   * bakıyor — bu bileşenin istediği tam olarak bu.
   */
  const haberler = await getRelated(article, 6, locale)
    .catch(() => [] as Article[]);

  if (!haberler.length) return null;

  return (
    <section className="kb-benzer" aria-label="Benzer haberler">
      <h2 className="kb-benzer-baslik">Bunlar da ilginizi çekebilir</h2>

      <div className="kb-benzer-izgara">
        {haberler.map((a) => {
          const img = pickImage(a.cover, "card") ?? pickImage(a.cover, "thumb");
          return (
            <Link
              key={a.id}
              href={haberYolu(locale, a.slug, a.category_slug)}
              className="kb-benzer-kart"
            >
              <span className="kb-benzer-gorsel">
                {img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={img} alt="" loading="lazy" decoding="async" />
                ) : (
                  <VarsayilanGorsel />
                )}
              </span>

              <span className="kb-benzer-metin">{a.title}</span>

              <span className="kb-benzer-zaman">
                {relativeTime(a.published_at, locale)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Yükleme iskeleti.
 *
 * ⚠ GERÇEK KARTLA AYNI ÖLÇÜLERDE.
 * Farklı yükseklikte olsaydı veri gelince sayfa zıplar, okur
 * yerini kaybederdi.
 */
export function BenzerHaberlerIskelet() {
  return (
    <section className="kb-benzer kb-benzer-yukleniyor" aria-hidden>
      <span className="kb-benzer-baslik kb-benzer-satir" style={{ width: 210 }} />
      <div className="kb-benzer-izgara">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="kb-benzer-kart">
            <span className="kb-benzer-gorsel kb-benzer-satir" />
            <span className="kb-benzer-satir" style={{ height: 14, marginTop: 10 }} />
            <span className="kb-benzer-satir" style={{ height: 14, width: "70%", marginTop: 6 }} />
            <span className="kb-benzer-satir" style={{ height: 11, width: "40%", marginTop: 8 }} />
          </span>
        ))}
      </div>
    </section>
  );
}
