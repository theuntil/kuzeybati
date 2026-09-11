-- ############################################################
--  YAMA 21 — DEMO MODU ANAHTARI
--
--  SORUN:
--    Veritabanı boşken site prototipteki örnek haberlerle
--    doluyordu. Kurulum sırasında faydalıydı; ama YAYINDA
--    gerçek olmayan haber göstermek kabul edilemez.
--
--  ÇÖZÜM:
--    site_settings.demo_mode — VARSAYILAN KAPALI.
--    Kapalıyken site yalnızca veritabanındaki gerçek içeriği
--    gösterir; içerik yoksa bölüm hiç render edilmez.
--
--    Açmak istersen (tasarım denemesi, sunum, boş kurulum):
--      update public.site_settings set demo_mode = true where id;
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set statement_timeout = '60s';

alter table public.site_settings
  add column if not exists demo_mode boolean not null default false;

comment on column public.site_settings.demo_mode is
'true ise veritabanı boşken örnek içerik gösterilir. YAYINDA FALSE OLMALI.';

-- Görünümü yeniden oluştur (yeni kolon dışarı açılsın)
drop view if exists public.public_site_settings;
create view public.public_site_settings
with (security_invoker = true) as
select site_name, site_tagline, logo_light_key, logo_dark_key, favicon_key, og_image_key,
       maintenance_mode, maintenance_title, maintenance_message, maintenance_until,
       default_locale, enabled_locales,
       header_sticky, header_progress_bar,
       ticker_enabled, ticker_speed_sec, ticker_symbols,
       city_strip_enabled, city_strip_slugs,
       comments_enabled, comments_require_approval, comments_min_len, comments_max_len,
       likes_enabled, views_enabled, ai_summary_enabled, tts_enabled,
       weather_enabled, prayer_enabled, markets_enabled, ads_enabled,
       demo_mode,
       home_hero_count, home_mostread_count, home_featured_count, home_video_count,
       home_category_slugs, home_feed_count,
       social_links, seo_title_suffix, seo_description, analytics_id,
       contact_email, contact_phone, contact_address
  from public.site_settings where id;

grant select on public.public_site_settings to anon, authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select demo_mode as "demo_modu", maintenance_mode as "bakim_modu"
  from public.site_settings;

select 'Demo modu eklendi. Varsayilan: KAPALI.' as durum;

notify pgrst, 'reload schema';
