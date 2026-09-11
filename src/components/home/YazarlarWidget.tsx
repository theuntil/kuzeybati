import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/server";
import { assetUrl } from "@/lib/media";
import { href, profilYolu, type Locale } from "@/i18n/config";

/* ══════════════════════════════════════════════════════════════
   YAZARLARIMIZ

   Panelden "ana sayfada göster" işaretlenen yazarlar.

   ⚠ İŞARETLİ YAZAR YOKSA BÖLÜM HİÇ BASILMIYOR.
   Boş bir "Yazarlarımız" başlığı sayfayı bozar; yönetici
   kimseyi işaretlemediyse bölüm yokmuş gibi davranıyor.
   ══════════════════════════════════════════════════════════════ */

interface Yazar {
  id: string;
  ad: string;
  kullanici_adi: string | null;
  unvan: string | null;
  avatar_key: string | null;
  haber_sayisi: number;
}

export default async function YazarlarWidget({ locale }: { locale: Locale }) {
  const sb = createPublicClient();
  const { data, error } = await sb.rpc("home_yazarlar", { p_limit: 6 });

  if (error) {
    /*
     * Hata sayfayı düşürmüyor: bölüm gizleniyor ve sebep
     * günlüğe yazılıyor. Yazar listesi sayfanın olmazsa olmazı
     * değil.
     */
    console.error("[YAZARLAR] liste alınamadı:", error.message);
    return null;
  }

  const yazarlar = (data ?? []) as Yazar[];
  if (yazarlar.length === 0) return null;

  return (
    <section className="kb-yazarlar" aria-label="Yazarlarımız">
      <div className="kb-yazarlar-bas">
        <h2>Yazarlarımız</h2>
        <Link href={href(locale, "yazarlar")}>Tümü</Link>
      </div>

      <div className="kb-yazarlar-izgara">
        {yazarlar.map((y) => (
          <Link
            key={y.id}
            /*
             * Kullanıcı adı yoksa profil adresi kurulamıyor;
             * o yazar yazarlar sayfasına yönlendiriliyor.
             */
            /*
             * ⚠ İKİ AYRI ROTA.
             * Liste sayfası `/yazarlar`, profil ise
             * `/yazar/<kullanici>`. İlk yazımımda profil
             * adresini `/yazarlar/<kullanici>` diye kurmuştum
             * ve her tıklama 404 veriyordu.
             */
            href={y.kullanici_adi
              ? profilYolu(locale, "yazar", y.kullanici_adi)
              : href(locale, "yazarlar")}
            className="kb-yazar-kart"
          >
            <span className="kb-yazar-avatar">
              {y.avatar_key ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={assetUrl(y.avatar_key) ?? ""} alt="" loading="lazy" />
              ) : (
                /* Görsel yoksa baş harf — boş daire kötü görünüyordu */
                <span aria-hidden>{y.ad.charAt(0).toLocaleUpperCase("tr")}</span>
              )}
            </span>

            <span className="kb-yazar-ad">{y.ad}</span>

            {y.unvan && <span className="kb-yazar-unvan">{y.unvan}</span>}

            <span className="kb-yazar-sayi">
              {/*
                Sayım 50'de duruyor (bkz. `home_yazarlar`);
                tam değer kartta gerekmiyor.
              */}
              {y.haber_sayisi >= 50 ? "50+" : y.haber_sayisi} haber
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
