import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, type Locale, assertLocale, profilYolu} from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getYazar, getYazarHaberleri } from "@/lib/queries";
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
 * YAZAR SAYFASI
 *
 * Yazarın profili, sosyal bağlantıları ve yazdığı haberler.
 * Haber sayfasındaki künyeden buraya geliniyor.
 */
export const revalidate = 300;

type Params = Promise<{ locale: string; username: string }>;

function cdnUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  const base = publicConfig().cdnBase.replace(/\/+$/, "");
  return base ? `${base}/${key}` : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, username } = await params;
  const locale = assertLocale(raw);
  const y = await getYazar(username);
  if (!y) return { title: "404" };
  return {
    title: y.display_name,
    description: y.bio ?? y.title ?? undefined,
    alternates: { canonical: profilYolu(locale, "yazar", username) },
    openGraph: {
      title: y.display_name,
      description: y.bio ?? undefined,
      images: cdnUrl(y.cover_key) ? [cdnUrl(y.cover_key)!] : undefined,
    },
  };
}

export default async function YazarSayfasi({ params }: { params: Params }) {
  const { locale: raw, username } = await params;
  const locale = assertLocale(raw) as Locale;
  const dict = await getDictionary(locale);

  const yazar = await getYazar(username);
  if (!yazar) notFound();

  const haberler = await getYazarHaberleri(yazar.id, 24, locale);

  /* Ad soyad varsa onu göster; yoksa görünen ada düş */
  const tamAd = [yazar.first_name, yazar.last_name].filter(Boolean).join(" ")
    || yazar.display_name;

  return (
    <div style={{ padding: "18px var(--gut) 40px" }}>
      <ProfilBasi
        ad={tamAd}
        altAd={yazar.title}
        aciklama={yazar.bio}
        avatar={cdnUrl(yazar.avatar_key)}
        kapak={cdnUrl(yazar.cover_key)}
        basHarf={yazar.bas_harf}
        sosyal={yazar.social_links as Sosyal | null}
        haberSayisi={yazar.haber_sayisi}
        rozet="Yazar"
        locale={locale}
      />

      {haberler.length === 0 ? (
        <p style={{ color: "var(--mu)", padding: "28px 4px", fontSize: 15 }}>
          Bu yazarın yayımlanmış haberi yok.
        </p>
      ) : (
        <ForYou articles={haberler} locale={locale} dict={dict}
          sonsuzAkis={false} ikiKolon
          title={`${tamAd} imzalı haberler`} />
      )}
    </div>
  );
}
