import "server-only";
import { cache } from "react";
import { createPublicClient } from "./supabase/server";
import type { SiteSettings, NavItem } from "./types";
import { defaultLocale } from "@/i18n/config";

/** Ayar okunamazsa site çökmesin diye güvenli varsayılanlar */
const FALLBACK: SiteSettings = {
  site_name: "Kuzeybatı Haber",
  site_tagline: null,
  logo_light_key: null,
  logo_dark_key: null,
  favicon_key: null,
  favicon_dark_key: null,
  app_store_url: null,
  /* Uygulama tanıtım kartı — Reels akışında her üç haberde bir */
  app_gallery_url: null,
  app_gallery_badge_key: null,
  app_icon_key: null,
  app_promo_key: null,
  /* Görsel yüklenmeden açılırsa blok yarım görünür */
  app_promo_site_enabled: false,
  app_promo_title: null,
  app_name: null,
  app_tagline: null,
  app_screenshots: [] as string[],
  app_promo_enabled: true,
  company_name: null,
  company_legal_name: null,
  company_owner: null,
  company_tax_office: null,
  company_tax_no: null,
  company_trade_no: null,
  company_story: null,
  imtiyaz_sahibi: null,
  genel_yayin_yonetmeni: null,
  sorumlu_yazi_isleri: null,
  yayin_turu: null,
  hosting_saglayici: null,
  yazilim_altyapisi: null,
  reklam_email: null,
  tekzip_email: null,
  sosyal_instagram: null,
  sosyal_facebook: null,
  sosyal_x: null,
  sosyal_youtube: null,
  sosyal_linkedin: null,
  sosyal_tiktok: null,
  sosyal_whatsapp: null,
  sosyal_telegram: null,
  app_stats: [] as { ust: string; orta: string; alt: string }[],
  play_store_url: null,
  app_store_badge_key: null,
  play_store_badge_key: null,
  placeholder_key: null,
  placeholder_dark_key: null,
  og_image_key: null,
  maintenance_mode: false,
  maintenance_title: "Kısa bir ara",
  maintenance_message: "Siteyi güncelliyoruz. Birazdan buradayız.",
  maintenance_until: null,
  maintenance_bypass_staff: true,
  default_locale: defaultLocale,
  enabled_locales: ["tr", "en", "ar", "ru"],
  header_sticky: true,
  header_progress_bar: true,
  ticker_enabled: true,
  ticker_speed_sec: 50,
  ticker_symbols: [],
  city_strip_enabled: true,
  city_strip_slugs: [],
  comments_enabled: true,
  comments_require_approval: true,
  comments_min_len: 2,
  comments_max_len: 2000,
  likes_enabled: true,
  views_enabled: true,
  ai_summary_enabled: true,
  tts_enabled: true,
  weather_enabled: true,
  pharmacy_enabled: true,
  scores_enabled: true,
  traffic_enabled: true,
  earthquake_enabled: false,
  /* Yeni hizmet — mevcut siteleri değiştirmemek için kapalı başlıyor */
  onthisday_enabled: false,
  yonetici_ad: null,
  yonetici_unvan: null,
  yonetici_slug: null,
  yonetici_foto_key: null,
  yonetici_kapak_key: null,
  yonetici_ozet: null,
  yonetici_biyografi: null,
  yonetici_linkedin: null,
  yonetici_x: null,
  yonetici_instagram: null,
  yonetici_email: null,
  yonetici_kart_acik: false,
  yonetici_sayfa_acik: false,
  prayer_enabled: true,
  markets_enabled: true,
  ads_enabled: false,
  // Yayında demo içerik gösterilmez. Sadece panelden açılır.
  demo_mode: false,
  registration_enabled: true,
  registration_message: null,
  home_hero_count: 5,
  home_mostread_count: 5,
  home_featured_count: 6,
  home_video_count: 10,
  home_block_count: 8,
  home_category_slugs: ["asayis", "ekonomi", "spor", "saglik"],
  home_category_count: 8,
  home_feed_count: 12,
  social_links: {},
  seo_title_suffix: " — Kuzeybatı Haber",
  seo_description: null,
  analytics_id: null,
  contact_email: null,
  contact_phone: null,
  contact_address: null,
};

/**
 * `cache()` aynı istek içinde tekrar sorgu atılmasını engeller;
 * layout, sayfa ve metadata üçü de çağırsa DB'ye tek gidiş olur.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const sb = createPublicClient();
    const { data, error } = await sb
      .from("public_site_settings")
      .select("*")
      .single();
    if (error || !data) return FALLBACK;
    return { ...FALLBACK, ...(data as Partial<SiteSettings>) };
  } catch {
    // Ayar okunamıyorsa site yine de açılmalı — bakım moduna
    // düşmek burada yanlış olur, asıl arıza DB bağlantısıdır.
    return FALLBACK;
  }
});

export const getNav = cache(async (): Promise<NavItem[]> => {
  try {
    const sb = createPublicClient();
    const { data } = await sb.from("public_nav").select("*");
    return (data as NavItem[]) ?? [];
  } catch {
    return [];
  }
});

export function navByLocation(items: NavItem[], loc: NavItem["location"]) {
  return items
    .filter((i) => i.location === loc && !i.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
}
