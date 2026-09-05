import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Locale, assertLocale, profilYolu} from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getYayinci, getYayinciHaberleri } from "@/lib/queries";
import { publicConfig } from "@/lib/config";
import ProfilBasi, { type Sosyal } from "@/components/site/ProfilBasi";
/*
 * ⚠ ANA SAYFADAKİ AKIŞIN AYNISI KULLANILIYOR.
 *
 * Önce `ProfilHaberler` vardı — bu sayfalara özel, ayrı bir
 * kart tasarımı. İki farklı liste görünümü bakımı ikiye
 * katlıyor ve siteyi tutarsız gösteriyordu. `ForYou` ana
 * sayfadaki "size özel" bölümünün ta kendisi: aynı kart,
 * aynı görünüm anahtarı (büyük/liste), aynı davranış.
 */
import ForYou from "@/components/home/ForYou";

/**
 * YAYINCI SAYFASI
 *
 * Haber kaynağının kurumsal profili: logo, açıklama, web sitesi,
 * sosyal bağlantılar ve o kaynaktan gelen haberler.
 *
 * Yazar sayfasından farkı, kurumsal duruşu: unvan yerine
 * "Haber ajansı" rozeti, avatar yerine logo.
 */
export const revalidate = 300;

type Params = Promise<{ locale: string; slug: string }>;

function cdnUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  const base = publicConfig().cdnBase.replace(/\/+$/, "");
  return base ? `${base}/${key}` : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = assertLocale(raw);
  const y = await getYayinci(slug);
  if (!y) return { title: "404" };
  return {
    title: y.name,
    description: y.description ?? undefined,
    alternates: { canonical: profilYolu(locale, "yayinci", slug) },
  };
}

export default async function YayinciSayfasi({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const locale = assertLocale(raw) as Locale;
  const dict = await getDictionary(locale);

  const yayinci = await getYayinci(slug);
  if (!yayinci) notFound();

  const haberler = await getYayinciHaberleri(yayinci.id, 24, locale);

  /*
   * Sosyal bağlantılara web sitesini de ekle: `sources.website`
   * ayrı bir kolonda duruyor ama okur için ikisi aynı şey.
   */
  const sosyal: Sosyal = {
    ...(yayinci.social_links as Sosyal | null),
    ...(yayinci.website ? { website: yayinci.website } : {}),
  };

  return (
    <div style={{ padding: "18px var(--gut) 40px" }}>
      <ProfilBasi
        ad={yayinci.name}
        altAd={yayinci.short_name !== yayinci.name ? yayinci.short_name : null}
        aciklama={yayinci.description}
        avatar={cdnUrl(yayinci.logo_key ?? yayinci.logo_dark_key)}
        kapak={cdnUrl(yayinci.cover_key)}
        basHarf={(yayinci.short_name || yayinci.name).charAt(0).toUpperCase()}
        sosyal={sosyal}
        haberSayisi={yayinci.haber_sayisi}
        rozet={yayinci.is_agency ? "Haber ajansı" : "Yayıncı"}
        locale={locale}
      />

      {haberler.length === 0 ? (
        <p style={{ color: "var(--mu)", padding: "28px 4px", fontSize: 15 }}>
          Bu kaynaktan yayımlanmış haber yok.
        </p>
      ) : (
        <ForYou articles={haberler} locale={locale} dict={dict}
          sonsuzAkis={false} ikiKolon
          title={`${yayinci.short_name} haberleri`} />
      )}
    </div>
  );
}
