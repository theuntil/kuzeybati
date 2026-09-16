import { assetUrl } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   UYGULAMA TANITIM ŞERİDİ

   Ana sayfada öne çıkanların üstünde, haber sayfasında
   yorumların üstünde, hakkımızda sayfasının en altında.

   ┌─ GÖRSEL ALTA SIFIR YAPIŞIYOR ⚠️ ───────────────────────────┐
   │ İstenen görünüm: telefon görseli kutunun alt kenarına     │
   │ boşluksuz oturuyor, oradan taşmıyor. `overflow: hidden` + │
   │ görselin `display:block` olması şart — satır içi görsel   │
   │ altında birkaç piksel boşluk bırakır.                      │
   └──────────────────────────────────────────────────────────────┘

   ┌─ RENKLER TERS ⚠️ ──────────────────────────────────────────┐
   │ Site koyu temadayken bu kutu AÇIK, açık temadayken KOYU.  │
   │ Sayfadan ayrışsın ve bir reklam değil, davet gibi         │
   │ dursun diye. `[data-theme]` seçicileriyle CSS'te.          │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function UygulamaTanitim({
  settings, baslik,
}: {
  settings: SiteSettings;
  /** Varsayılan başlık panelden geliyor; istenirse geçersiz kılınır */
  baslik?: string;
}) {
  const s = settings as SiteSettings & Record<string, string | null>;

  const gorsel = assetUrl(s.app_promo_key);

  /*
   * ⚠ MAĞAZA KARTLARI — SADECE LOGO DEĞİL.
   *
   * Önce panelden yüklenen hazır rozet görseli basılıyordu.
   * O görseller farklı en-boy oranlarında geliyor ve yan yana
   * hizasız duruyordu. Footer'da zaten doğru çözüm var:
   * küçük logo + "Hemen indirin" üst satırı + mağaza adı.
   *
   * Aynı yapı burada da kullanılıyor — tek fark, bu blokta
   * kartların ÇERÇEVESİ YOK; zemin zaten koyu, çerçeve
   * gürültü yaratıyordu.
   */
  const magazalar = [
    { ad: "App Store",   alt: "Hemen indirin",
      url: s.app_store_url,   logo: assetUrl(s.app_store_badge_key) },
    { ad: "Google Play", alt: "Hemen indirin",
      url: s.play_store_url,  logo: assetUrl(s.play_store_badge_key) },
    { ad: "AppGallery",  alt: "Hemen indirin",
      url: s.app_gallery_url, logo: assetUrl(s.app_gallery_badge_key) },
  ].filter((m) => m.url);

  /*
   * ⚠ HİÇBİR MAĞAZA TANIMLI DEĞİLSE BASILMIYOR.
   * İndirme düğmesi olmayan bir tanıtım kutusu okura hiçbir
   * şey vermez, yalnızca yer kaplar.
   */
  if (magazalar.length === 0) return null;

  /*
   * ⚠ PANELDEN KAPATILABİLİR.
   * Reels kartının anahtarından ayrı: yönetici birini açıp
   * ötekini kapalı tutabiliyor.
   */
  if (settings.app_promo_site_enabled === false) return null;

  /*
   * ┌─ BAŞLIK İSTEĞE BAĞLI ⚠️ ───────────────────────────────────┐
   * │ Önce panel alanı boşsa sabit bir yazıya düşülüyordu;      │
   * │ yönetici başlığı KALDIRAMIYORDU.                           │
   * │                                                              │
   * │ Artık boş bırakılırsa başlık hiç basılmıyor ve düzen      │
   * │ buna göre toparlanıyor: mağaza kartları dikey olarak      │
   * │ ortalanıyor, üstteki boşluk kapanıyor.                     │
   * │                                                              │
   * │ ⚠ `??` DEĞİL, BOŞLUK KIRPILARAK KONTROL.                  │
   * │ Panelden gelen değer `""` olabiliyor; `??` boş dizeyi     │
   * │ "dolu" sayar ve boş bir başlık kutusu basardı.            │
   * └──────────────────────────────────────────────────────────────┘
   */
  const hamBaslik = (baslik ?? s.app_promo_title ?? "").trim();
  const satirlar = hamBaslik
    ? hamBaslik.split(/\\n|\n/).map((x) => x.trim()).filter(Boolean)
    : [];

  return (
    <section className="kb-app-tanitim" aria-label="Mobil uygulama">
      {/* Hareketli çizgi deseni — zeminde, içeriğin altında */}
      <span className="kb-app-desen" aria-hidden />

      <div className="kb-app-icerik">
        <div className={`kb-app-sol${satirlar.length ? "" : " kb-app-basliksiz"}`}>
          {satirlar.length > 0 && (
            <h2 className="kb-app-baslik">
              {satirlar.map((satir, i) => (
                <span key={i} style={{ display: "block" }}>{satir}</span>
              ))}
            </h2>
          )}

          <div className="kb-app-rozetler">
            {magazalar.map((m) => (
              <a
                key={m.ad}
                href={m.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="kb-app-rozet"
                aria-label={`${m.ad} — hemen indir`}
              >
                <span className="kb-app-rozet-logo">
                  {m.logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.logo} alt="" loading="lazy" />
                  ) : (
                    <Icon name="grid" size={17} />
                  )}
                </span>

                <span className="kb-app-rozet-yazi">
                  <span>{m.alt}</span>
                  <strong>{m.ad}</strong>
                </span>
              </a>
            ))}
          </div>
        </div>

        {gorsel && (
          <div className="kb-app-sag">
            {/* eslint-disable-next-line @next/next/no-img-element */
            }
            <img src={gorsel} alt="" loading="lazy" decoding="async" />
          </div>
        )}
      </div>
    </section>
  );
}
