import type { Locale } from "@/i18n/config";

/** articles.body içindeki blok — bot'un parser/types.ts'iyle AYNI şekil */
export type BodyBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "media"; mediaKey: string };

/** public_articles görünümünün bire bir karşılığı */
export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: BodyBlock[] | null;
  byline: string | null;
  son_dakika: boolean;
  published_at: string;
  edited_at: string | null;
  tags: string[] | null;
  /** Gövdeden hesaplanmış okuma süresi (dakika) — DB'den gelir */
  reading_minutes: number | null;
  /** Haberin bağlı olduğu tüm kategori slug'ları (konu + kapsam) */
  category_slugs: string[] | null;
  has_video: boolean | null;
  seo_title: string | null;
  seo_description: string | null;
  category_id: string | null;
  city_id: string | null;
  source_id: string | null;
  cover_media_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  category_kind: "topic" | "scope" | null;
  city_slug: string | null;
  city_name: string | null;
  plate_code: number | null;
  region: string | null;
  is_domestic: boolean | null;
  source_name: string | null;
  source_logo: string | null;
  /** Künye bağlantısı için — yazarın kullanıcı adı */
  author_username?: string | null;
  /** Künye satırında kaynak logosu yerine kullanılıyor */
  author_avatar?: string | null;
  author_name?: string | null;
  /** Künye bağlantısı için — kaynağın adresi */
  source_slug?: string | null;
  /** AI değerlendirmesi: true/false/null (null = işlenmemiş) */
  cocuk_guvenli?: boolean | null;
}

/** public_media görünümü */
export interface MediaRow {
  id: string;
  article_id: string;
  type: "image" | "video";
  sort_order: number;
  storage_key: string | null;
  poster_key: string | null;
  variants: Record<string, unknown>;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  dominant_color: string | null;
  duration_sec: number | null;
  caption: string | null;
  credit: string | null;
}

export interface ArticleAi {
  article_id: string;
  ozet: string | null;
  instagram: string | null;
  onem_puani: number | null;
  onem_gerekce: string | null;
  /** null = henüz değerlendirilmedi (üç durumlu, bilinçli) */
  cocuk_guvenli: boolean | null;
  guvenlik_sebepleri: string[] | null;
}

export interface Translation {
  article_id: string;
  locale: string;
  baslik: string | null;
  ozet: string | null;
  icerik: string | null;
  slug: string | null;
  status: "ok" | "failed" | "skipped";
}

export interface ArticleStats {
  article_id: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  views_24h: number;
}

/** Sayfada kullanılan birleşik biçim */
export interface Article extends ArticleRow {
  media: MediaRow[];
  cover: MediaRow | null;
  ai: ArticleAi | null;
  stats: ArticleStats | null;
  /** Gösterilen dil; çeviri yoksa "tr"ye düşer */
  shownLocale: Locale;
  /** İstenen dilde çeviri var mıydı? */
  translated: boolean;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  kind: "topic" | "scope";
  color: string;
  text_color: string;
  icon: string | null;
  sort_order: number;
  show_in_menu: boolean;
  show_in_home: boolean;
}

export interface CityRow {
  id: string;
  slug: string;
  name: string;
  plate_code: number | null;
  region: string | null;
  is_domestic: boolean;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
}

export interface NavItem {
  id: string;
  location: "header" | "footer" | "mobile" | "drawer" | "services";
  parent_id: string | null;
  kind: "home" | "category" | "city" | "page" | "url" | "video" | "search";
  label: Partial<Record<Locale, string>>;
  target_slug: string | null;
  url: string | null;
  icon: string | null;
  category_color: string | null;
  sort_order: number;
  open_new_tab: boolean;
}

export interface SiteSettings {
  site_name: string;
  site_tagline: string | null;
  logo_light_key: string | null;
  logo_dark_key: string | null;
  favicon_key: string | null;
  /** Koyu tema faviconu — boşsa `favicon_key` kullanılır */
  favicon_dark_key: string | null;
  /** Uygulama mağazası adresleri — boşsa düğme gösterilmiyor */
  app_store_url: string | null;
  /* ---- Uygulama tanıtımı (Reels akışındaki kart) ---- */
  app_gallery_url: string | null;
  app_gallery_badge_key: string | null;
  app_icon_key: string | null;
  /* ---- Tanıtım şeridi (ana sayfa / haber / hakkımızda) ---- */
  app_promo_key: string | null;
  /* Site genelindeki tanıtım bloğu — reels kartından bağımsız */
  app_promo_site_enabled: boolean;
  app_promo_title: string | null;
  app_name: string | null;
  app_tagline: string | null;
  /** Sıralı ekran görüntüsü anahtarları */
  app_screenshots: string[];
  app_promo_enabled: boolean;

  /* ---- Kurumsal bilgiler (Hakkımızda · Künye) ---- */
  company_name: string | null;
  company_legal_name: string | null;
  company_owner: string | null;
  company_tax_office: string | null;
  company_tax_no: string | null;
  company_trade_no: string | null;
  company_story: string | null;
  imtiyaz_sahibi: string | null;
  genel_yayin_yonetmeni: string | null;
  sorumlu_yazi_isleri: string | null;
  yayin_turu: string | null;
  hosting_saglayici: string | null;
  yazilim_altyapisi: string | null;
  /* ---- İletişim ve sosyal hesaplar (panelden) ---- */
  reklam_email: string | null;
  tekzip_email: string | null;
  sosyal_instagram: string | null;
  sosyal_facebook: string | null;
  sosyal_x: string | null;
  sosyal_youtube: string | null;
  sosyal_linkedin: string | null;
  sosyal_tiktok: string | null;
  sosyal_whatsapp: string | null;
  sosyal_telegram: string | null;
  /** App Store tarzı istatistik şeridi */
  app_stats: { ust: string; orta: string; alt: string }[];
  play_store_url: string | null;
  /** Mağaza rozet görselleri — boşsa gömülü çizim kullanılır */
  app_store_badge_key: string | null;
  play_store_badge_key: string | null;
  /** Görseli olmayan yerlerde kullanılan varsayılan görsel */
  placeholder_key: string | null;
  placeholder_dark_key: string | null;
  og_image_key: string | null;
  maintenance_mode: boolean;
  maintenance_title: string;
  maintenance_message: string;
  maintenance_until: string | null;
  /**
   * Personel bakım ekranını görmez, gerçek siteyi görür.
   * Düzeltmeyi yayına almadan önce doğrulayabilsin diye.
   */
  maintenance_bypass_staff: boolean;
  default_locale: Locale;
  enabled_locales: Locale[];
  header_sticky: boolean;
  header_progress_bar: boolean;
  ticker_enabled: boolean;
  ticker_speed_sec: number;
  ticker_symbols: TickerSymbol[];
  city_strip_enabled: boolean;
  city_strip_slugs: string[];
  comments_enabled: boolean;
  comments_require_approval: boolean;
  comments_min_len: number;
  comments_max_len: number;
  likes_enabled: boolean;
  views_enabled: boolean;
  ai_summary_enabled: boolean;
  tts_enabled: boolean;
  weather_enabled: boolean;
  /* ---- Hizmet görünürlüğü (panelden) ---- */
  pharmacy_enabled: boolean;
  scores_enabled: boolean;
  traffic_enabled: boolean;
  earthquake_enabled: boolean;
  /* Wikimedia 'tarihte bugün' hizmeti */
  onthisday_enabled: boolean;
  /* ---- Yönetici tanıtımı (panelden) ---- */
  yonetici_ad: string | null;
  yonetici_unvan: string | null;
  yonetici_slug: string | null;
  yonetici_foto_key: string | null;
  yonetici_kapak_key: string | null;
  yonetici_ozet: string | null;
  yonetici_biyografi: string | null;
  yonetici_linkedin: string | null;
  yonetici_x: string | null;
  yonetici_instagram: string | null;
  yonetici_email: string | null;
  yonetici_kart_acik: boolean;
  yonetici_sayfa_acik: boolean;
  prayer_enabled: boolean;
  markets_enabled: boolean;
  ads_enabled: boolean;
  /** Veritabanı boşken örnek içerik gösterilsin mi. Yayında false. */
  demo_mode: boolean;
  /** Yeni kayıtlar açık mı — panelden kapatılabilir */
  registration_enabled: boolean;
  registration_message: string | null;
  home_hero_count: number;
  home_mostread_count: number;
  home_featured_count: number;
  home_video_count: number;
  /** Kategori bloklarında gösterilecek haber sayısı */
  home_block_count: number;
  home_category_slugs: string[];
  home_category_count: number;
  home_feed_count: number;
  social_links: Record<string, string>;
  seo_title_suffix: string;
  seo_description: string | null;
  analytics_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
}

export interface TickerSymbol {
  key: string;
  label: string;
  source: "bist" | "yahoo" | "derived";
}

export interface Quote {
  key: string;
  label: string;
  value: number;
  changePercent: number;
  currency?: string;
  /** Mini grafik noktaları (eskiden yeniye) */
  spark?: number[];
}

export interface Comment {
  id: string;
  article_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_username: string | null;
  author_avatar: string | null;
  author_role: string;
  /**
   * Onay bekleyen kendi yorumumuz.
   *
   * Sunucudan gelmiyor — gönderildiği anda listeye eklenen
   * yorumda işaretleniyor ki okur yorumunun gittiğini görsün.
   */
  bekliyor?: boolean;
}
