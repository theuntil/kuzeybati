-- ############################################################
--  YAMA 23 — ANA SAYFA SAYILARI
--
--  Video rayı 4'ten 10'a, kategori blokları 3'ten 8'e çıkıyor.
--  İkisi de yatay kaydırılabilir olduğu için fazla kart sayfayı
--  uzatmıyor; okur kaydırdıkça görüyor.
--
--  Kategori başına kart sayısı için ayar yoktu, ekleniyor.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set statement_timeout = '60s';

alter table public.site_settings
  add column if not exists home_category_count int not null default 8;

do $$ begin
  alter table public.site_settings
    add constraint chk_ss_catcount check (home_category_count between 1 and 24);
exception when duplicate_object then null; end $$;

comment on column public.site_settings.home_category_count is
'Ana sayfadaki her kategori bloğunda gösterilecek haber sayısı. Blok yatay kaydırılır.';

-- Varsayılanları güncelle (elle değiştirilmemişse)
update public.site_settings
   set home_video_count = 10
 where id and home_video_count = 4;

update public.site_settings
   set home_category_count = 8
 where id and home_category_count < 8;

-- Görünümü tazele: yeni kolon dışarı açılsın
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
       home_category_slugs, home_category_count, home_feed_count,
       social_links, seo_title_suffix, seo_description, analytics_id,
       contact_email, contact_phone, contact_address
  from public.site_settings where id;

grant select on public.public_site_settings to anon, authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select home_video_count as "video", home_category_count as "kategori_basina",
       home_featured_count as "one_cikan", home_feed_count as "akis"
  from public.site_settings;

select 'Ana sayfa sayilari guncellendi.' as durum;

notify pgrst, 'reload schema';
