import { assetUrl } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   REKLAM SAYFASI

   Tamamı panelden yönetiliyor: başlık, tanıtım metni, üç ekran
   görüntüsü ve iletişim e-postası.

   ⚠ KODDA SABİT İLETİŞİM BİLGİSİ YOK.
   E-posta `reklam_email` alanından geliyor; boşsa genel
   iletişim adresine düşülüyor. İkisi de yoksa iletişim bölümü
   hiç basılmıyor — çalışmayan bir bağlantı göstermek kötü.
   ══════════════════════════════════════════════════════════════ */

const AVANTAJLAR = [
  {
    ikon: "user" as const,
    baslik: "Yerel ve sadık okur",
    metin: "Bölgesini takip eden, haberi düzenli okuyan bir kitleye "
      + "doğrudan ulaşırsınız.",
  },
  {
    ikon: "reels" as const,
    baslik: "Web ve mobil birlikte",
    metin: "Reklamınız hem sitede hem mobil uygulamada gösterilebilir. "
      + "İsterseniz yalnızca birini seçersiniz.",
  },
  {
    ikon: "chart" as const,
    baslik: "Ölçülebilir sonuç",
    metin: "Gösterim ve tıklama sayıları düzenli olarak paylaşılır; "
      + "kampanyanızın karşılığını görürsünüz.",
  },
  {
    ikon: "check" as const,
    baslik: "Okuru yormayan yerleşim",
    metin: "Reklam alanları içeriğin akışını bozmayacak şekilde "
      + "tasarlandı. Açılır pencere, otomatik ses yok.",
  },
];

export default function ReklamSayfasi({ settings }: { settings: SiteSettings }) {
  const s = settings;

  const baslik = (s.ads_page_title ?? "").trim()
    || "Markanızı doğru okurla buluşturun";
  const giris = (s.ads_page_intro ?? "").trim()
    || "Bölgenin haber kaynağında yer alın. Web sitemizde ve mobil "
      + "uygulamamızda markanıza uygun reklam alanları sunuyoruz.";

  const eposta = (s.reklam_email ?? "").trim() || (s.contact_email ?? "").trim();

  /*
   * ⚠ İLK GÖRSEL HERO'YA GİDİYOR.
   * Üç görselin hepsini alta koymak yerine birincisi üst
   * bölümde büyük gösteriliyor; kalanlar aşağıdaki şeritte.
   * Boş olanlar hiç basılmıyor.
   */
  const tumGorseller = [s.ads_shot_1_key, s.ads_shot_2_key, s.ads_shot_3_key]
    .map((k) => assetUrl(k))
    .filter((x): x is string => Boolean(x));

  const heroGorsel = tumGorseller[0] ?? null;
  const gorseller = tumGorseller.slice(1);

  return (
    <div className="kb-reklam">
      {/*
        ÜST BÖLÜM

        ⚠ GÖRSEL VARSA İKİ SÜTUN.
        Solda metin, sağda görsel. Görsel yüklenmemişse metin
        ortalanıyor — yarım kalan bir düzen göstermek yerine
        tek sütuna dönüyor.
      */}
      <section className={`kb-reklam-hero${heroGorsel ? " kb-iki" : ""}`}>
        {/*
          Hareketli desen — tanıtım bloğundakiyle aynı dil.
          `prefers-reduced-motion` açıksa duruyor.
        */}
        <span className="kb-reklam-desen" aria-hidden />

        <div className="kb-reklam-hero-ic">
          <span className="kb-reklam-etiket">Reklam</span>
          <h1>{baslik}</h1>
          <p>{giris}</p>

          {eposta && (
            <a href={`mailto:${eposta}`} className="kb-reklam-cta">
              <Icon name="share" size={17} />
              Teklif alın
            </a>
          )}
        </div>

        {heroGorsel && (
          <div className="kb-reklam-hero-gorsel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroGorsel} alt="" />
          </div>
        )}
      </section>

      {/* ---- avantajlar ---- */}
      <section className="kb-reklam-bolum">
        <h2>Neden burada reklam vermelisiniz</h2>
        <div className="kb-reklam-izgara">
          {AVANTAJLAR.map((a) => (
            <div key={a.baslik} className="kb-reklam-kart">
              <span className="kb-reklam-ikon" aria-hidden>
                <Icon name={a.ikon} size={19} strokeWidth={1.8} />
              </span>
              <h3>{a.baslik}</h3>
              <p>{a.metin}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- ekran görüntüleri ---- */}
      {gorseller.length > 0 && (
        <section className="kb-reklam-bolum">
          <h2>Reklam alanlarımız</h2>
          <p className="kb-reklam-alt">
            Sitede ve mobil uygulamada reklamınızın görüneceği yerler.
          </p>
          <div className="kb-reklam-gorseller">
            {gorseller.map((g, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={g}
                src={g}
                alt={`Reklam alanı örneği ${i + 1}`}
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- iletişim ---- */}
      {eposta && (
        <section className="kb-reklam-iletisim">
          <h2>Konuşalım</h2>
          <p>
            Bütçenize ve hedefinize uygun bir plan hazırlayalım.
            Aşağıdaki adrese yazmanız yeterli.
          </p>
          <a href={`mailto:${eposta}`}>{eposta}</a>
          {s.contact_phone && (
            <a href={`tel:${s.contact_phone.replace(/\s+/g, "")}`}>
              {s.contact_phone}
            </a>
          )}
        </section>
      )}
    </div>
  );
}
