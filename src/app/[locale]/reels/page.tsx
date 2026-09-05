import { assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createAuthedClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { DEFAULT_CITY } from "@/lib/city";
import ReelsAkis from "@/components/reels/ReelsAkis";
import { getSiteSettings } from "@/lib/settings";
import { assetUrl } from "@/lib/media";
import type { Reel } from "@/components/reels/tipler";

/**
 * REELS
 *
 * Videosu olan haberler, dikey kaydırmalı akış.
 *
 * ⚠ ÖNBELLEK YOK.
 *
 * Akış kişiye özel: şehir payı okuyucunun seçimine göre
 * değişiyor ve rastgele grup her istekte farklı. `revalidate`
 * verilseydi herkes aynı listeyi görürdü.
 */
export const dynamic = "force-dynamic";

export default async function ReelsPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = assertLocale(rawLocale);
  const dict = await getDictionary(locale);

  const sb = await createAuthedClient();
  const kutu = await cookies();

  /*
   * Şehir sırası:
   *   1. Giriş yapmışsa profilindeki şehir
   *   2. Çerezdeki seçim (giriş yapmamış okur)
   *   3. Varsayılan şehir — hava durumu ve eczane ile aynı
   */
  const { data: auth } = await sb.auth.getUser();

  let sehir = kutu.get("kb-city")?.value ?? "";

  if (auth.user) {
    const { data: p } = await sb
      .from("my_profile")
      .select("city_slug")
      .maybeSingle();
    const profilSehri = (p as { city_slug?: string | null } | null)?.city_slug;
    if (profilSehri) sehir = profilSehri;
  }

  /* Seçim yapılmış mı — çubuğu göstermek için */
  const sehirSecilmis = Boolean(sehir);
  if (!sehir) sehir = DEFAULT_CITY;

  const settings = await getSiteSettings();

  const { data } = await sb.rpc("reels_akis", {
    p_sehir: sehir,
    p_limit: 10,
    p_offset: 0,
    p_haric: [],
  });

  const ilk = ((data as { haberler?: Reel[] } | null)?.haberler ?? []) as Reel[];

  /*
   * ⚠ SAYFA KENDİ KAYDIRMASINI YÖNETİYOR.
   * Gövde kaydırması açık kalırsa mobilde iki katmanlı kaydırma
   * oluyor ve snap tutmuyor.
   */
  return (
    <ReelsAkis
      ilk={ilk}
      locale={locale}
      dict={dict}
      girisliBaslangic={Boolean(auth.user)}
      sehirSecilmis={sehirSecilmis}
      logoLight={assetUrl(settings.logo_light_key)}
      logoDark={assetUrl(settings.logo_dark_key)}
      /*
        Tanıtım kartı ayarları.

        ⚠ KAPALIYSA `null` GÖNDERİLİYOR.
        Boş bir nesne gönderilseydi akışa boş kartlar
        eklenirdi; null olunca örgü hiç reklam koymuyor.
      */
      uygulama={
        settings.app_promo_enabled === false
          ? null
          : {
              ad: settings.app_name ?? null,
              slogan: settings.app_tagline ?? null,
              simge: settings.app_icon_key ?? null,
              ekranlar: Array.isArray(settings.app_screenshots)
                ? (settings.app_screenshots as string[])
                : [],
              appStore: settings.app_store_url ?? null,
              playStore: settings.play_store_url ?? null,
              appGallery: settings.app_gallery_url ?? null,
              appStoreRozet: settings.app_store_badge_key ?? null,
              playStoreRozet: settings.play_store_badge_key ?? null,
              appGalleryRozet: settings.app_gallery_badge_key ?? null,
              istatistik: Array.isArray(settings.app_stats)
                ? (settings.app_stats as { ust: string; orta: string; alt: string }[])
                : [],
            }
      }
    />
  );
}
