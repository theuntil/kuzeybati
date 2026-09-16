import type { Article } from "@/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import { haberYolu, type Locale } from "@/i18n/config";
import { pickImage } from "@/lib/media";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   METİN ARASINDA HABER ÖNERİSİ

   Verilen eskize göre yeniden yazıldı.

   ┌─ ÖNCEKİ HÂLİ NEDEN BOZUKTU ⚠️ ────────────────────────────┐
   │ Masaüstünde başlıklar 37px, liste başlıkları 28px'ti —    │
   │ haberin kendi metninden büyük. Blok, okuma akışını kesip  │
   │ sayfanın merkezine oturuyordu.                             │
   │                                                              │
   │ Eskizdeki düzen:                                            │
   │   Masaüstü → solda büyük haber, kategori/başlık/özet       │
   │              GÖRSELİN ÜZERİNDE; sağda 3 küçük haber alt    │
   │              alta. Büyük görselin yüksekliği sağdaki üçün  │
   │              toplamına eşit.                                 │
   │   Mobil    → tek sütun; büyük haber üstte tam genişlik,    │
   │              altında YALNIZCA 2 küçük haber yan yana       │
   │              (üçüncüsü gizli), görsel üstte metin altta.   │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function IcerikOneri({
  items, locale, dict, kategori,
}: {
  items: Article[];
  locale: Locale;
  dict: Dictionary;
  kategori: string | null;
}) {
  /* İki haberden az öneri gösterilmiyor — blok boş görünür */
  if (items.length < 2) return null;

  const [ilk, ...digerleri] = items;
  if (!ilk) return null;

  const buyuk = pickImage(ilk.cover, "card");

  /*
   * ⚠ ÜÇ KÜÇÜK HABER HER ZAMAN BASILIYOR.
   * Üçüncüsü mobilde CSS ile gizleniyor; JavaScript ile
   * ayırmak ekran genişliğini sunucuda bilmeyi gerektirirdi
   * ve ilk boyamada yanlış sayıda kart çıkardı.
   */
  const kucukler = digerleri.slice(0, 3);

  const kategoriAdi = (a: Article) =>
    a.category_name ?? kategori ?? null;

  return (
    <aside className="oneri">
      <h2 className="oneri-baslik">
        {kategori
          ? `${kategori} ${dict.article.related.toLocaleLowerCase(locale)}`
          : dict.article.related}
      </h2>

      <div className="oneri-grid">
        {/* ---- ÖNE ÇIKAN: metin görselin üzerinde ---- */}
        <Link
          href={haberYolu(locale, ilk.slug, ilk.category_slug)}
          className="oneri-one"
        >
          <span className="oneri-one-gorsel">
            {buyuk ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={buyuk} alt="" loading="lazy" />
            ) : (
              <VarsayilanGorsel />
            )}
          </span>

          {/*
            Görselin alt kısmına oturan katman. Okunabilirlik
            için altta koyu bir geçiş var — açık görsellerde
            beyaz yazı kayboluyordu.
          */}
          <span className="oneri-one-katman">
            {kategoriAdi(ilk) && (
              <span className="oneri-etiket oneri-etiket-one">
                {kategoriAdi(ilk)}
              </span>
            )}
            <span className="oneri-one-baslik">{ilk.title}</span>
          </span>
        </Link>

        {/* ---- KÜÇÜK HABERLER ---- */}
        <ul className="oneri-liste">
          {kucukler.map((a, i) => {
            const kucuk = pickImage(a.cover, "thumb");
            return (
              <li key={a.id} className={i === 2 ? "oneri-ucuncu" : undefined}>
                <Link
                  href={haberYolu(locale, a.slug, a.category_slug)}
                  className="oneri-satir"
                >
                  <span className="oneri-satir-gorsel">
                    {kucuk ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={kucuk} alt="" loading="lazy" />
                    ) : (
                      <VarsayilanGorsel />
                    )}
                  </span>

                  <span className="oneri-satir-metin">
                    {kategoriAdi(a) && (
                      <span className="oneri-etiket">{kategoriAdi(a)}</span>
                    )}
                    <span className="oneri-satir-baslik">{a.title}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
