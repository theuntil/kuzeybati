-- ############################################################
--  YAMA 29 — YÖNETİM PANELİ DESTEĞİ
--
--  Onaylama, moderasyon ve ayar fonksiyonlarının ÇOĞU zaten var
--  (approve_article, reject_article, moderate_comment,
--   pending_comments, bot_health, ai_health…). Bu yama eksik
--  kalan parçaları ekler:
--
--    • Panel listeleri (haber kuyruğu, kullanıcılar, istatistik)
--    • Rol değiştirme RPC'si
--    • Ayarları tek yerden güncelleme
--    • Genel bakış özeti
--
--  TASARIM
--    Panel tabloları DOĞRUDAN yazmaz; her işlem bir RPC'den
--    geçer. Böylece yetki, doğrulama ve denetim izi tek yerde
--    kalır ve mobil uygulama da aynı uçları kullanabilir.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. DENETİM İZİ
--
--  Kim neyi ne zaman değiştirdi. Rol değişikliği, haber onayı,
--  ayar güncellemesi gibi işlemler buraya düşer.
-- ============================================================
create table if not exists public.admin_log (
  id         bigserial primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  target     text,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_log_time_idx on public.admin_log (created_at desc);

alter table public.admin_log enable row level security;
alter table public.admin_log force  row level security;

drop policy if exists admin_log_read on public.admin_log;
create policy admin_log_read on public.admin_log
  for select using (public.is_admin());

revoke insert, update, delete on public.admin_log from anon, authenticated;
grant select on public.admin_log to authenticated;

create or replace function public.log_admin(
  p_action text, p_target text default null, p_detail jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = ''
as $$
  insert into public.admin_log (actor_id, action, target, detail)
  values (auth.uid(), p_action, p_target, coalesce(p_detail,'{}'::jsonb));
$$;

-- ============================================================
-- 2. HABER KUYRUĞU
-- ============================================================
create or replace view public.admin_articles
with (security_invoker = true) as
select a.id, a.slug, a.title, a.summary, a.status, a.source,
       a.published_at, a.created_at, a.edited_at, a.deleted_at,
       a.haber_kodu, a.son_dakika, a.media_state,
       c.name  as category_name, c.slug as category_slug,
       ci.name as city_name,
       p.display_name as author_name, p.username as author_username,
       ai.onem_puani, ai.cocuk_guvenli,
       coalesce(st.view_count, 0)    as view_count,
       coalesce(st.like_count, 0)    as like_count,
       coalesce(st.comment_count, 0) as comment_count
  from public.articles a
  left join public.categories c   on c.id  = a.category_id
  left join public.cities     ci  on ci.id = a.city_id
  left join public.profiles   p   on p.id  = a.author_id
  left join public.article_ai  ai on ai.article_id = a.id
  left join public.article_stats st on st.article_id = a.id
 where public.is_staff();

grant select on public.admin_articles to authenticated;

-- ============================================================
-- 3. KULLANICILAR
-- ============================================================
create or replace view public.admin_users
with (security_invoker = true) as
select p.id, p.role, p.display_name, p.username,
       p.first_name, p.last_name, p.is_active,
       p.created_at, p.last_seen_at, p.onboarded_at,
       ci.name as city_name,
       u.email,
       (select count(*) from public.comments c
         where c.user_id = p.id and c.status <> 'deleted') as comment_count,
       (select count(*) from public.articles a
         where a.author_id = p.id and a.deleted_at is null) as article_count
  from public.profiles p
  left join public.cities ci on ci.id = p.city_id
  left join auth.users u on u.id = p.id
 where public.is_admin();

grant select on public.admin_users to authenticated;

-- ============================================================
-- 4. ROL DEĞİŞTİRME
--
--  `tg_guard_role_change` trigger'ı doğrudan UPDATE'i zaten
--  engelliyor. Bu RPC yetkiyi kontrol eder, değişikliği yapar ve
--  denetim izine yazar.
--
--  Kendi rolünü düşüremezsin: son admin kendini okur yaparsa
--  panele giriş kalmaz.
-- ============================================================
create or replace function public.admin_set_role(
  p_user_id uuid,
  p_role    public.user_role
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_old public.user_role; v_admins int;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  select role into v_old from public.profiles where id = p_user_id;
  if v_old is null then
    raise exception 'Kullanici bulunamadi' using errcode = 'P0002';
  end if;
  if v_old = p_role then return; end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Kendi yonetici yetkini kaldiramazsin' using errcode = '42501';
  end if;

  if v_old = 'admin' and p_role <> 'admin' then
    select count(*) into v_admins from public.profiles
     where role = 'admin' and is_active;
    if v_admins <= 1 then
      raise exception 'Son yonetici rolden cikarilamaz' using errcode = '42501';
    end if;
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;
  perform public.log_admin('role_change', p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_role));
end; $$;

create or replace function public.admin_set_active(
  p_user_id uuid, p_active boolean
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and not p_active then
    raise exception 'Kendi hesabini kapatamazsin' using errcode = '42501';
  end if;

  update public.profiles set is_active = p_active, updated_at = now()
   where id = p_user_id;
  perform public.log_admin('user_active', p_user_id::text,
    jsonb_build_object('active', p_active));
end; $$;

revoke all on function public.admin_set_role(uuid, public.user_role) from public, anon;
revoke all on function public.admin_set_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;

-- ============================================================
-- 5. AYAR GÜNCELLEME
--
--  Panel `site_settings`e doğrudan yazmaz. Bu RPC yalnızca
--  BİLİNEN anahtarları kabul eder; bilinmeyen anahtar sessizce
--  yok sayılmaz, hata verir — yazım hatası fark edilmeden
--  geçmesin.
-- ============================================================
create or replace function public.admin_update_settings(p_patch jsonb)
returns public.site_settings
language plpgsql security definer set search_path = ''
as $$
declare
  k text;
  v_row public.site_settings;
  allowed text[] := array[
    'site_name','site_tagline','logo_light_key','logo_dark_key','favicon_key','og_image_key',
    'maintenance_mode','maintenance_title','maintenance_message','maintenance_until',
    'default_locale','enabled_locales',
    'header_sticky','header_progress_bar',
    'ticker_enabled','ticker_speed_sec','ticker_symbols',
    'city_strip_enabled','city_strip_slugs',
    'comments_enabled','comments_require_approval','comments_min_len','comments_max_len',
    'likes_enabled','views_enabled','ai_summary_enabled','tts_enabled',
    'weather_enabled','prayer_enabled','markets_enabled','ads_enabled',
    'demo_mode','registration_enabled','registration_message',
    'home_hero_count','home_mostread_count','home_featured_count','home_video_count',
    'home_category_slugs','home_category_count','home_feed_count',
    'social_links','seo_title_suffix','seo_description','analytics_id',
    'contact_email','contact_phone','contact_address'
  ];
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any(allowed)) then
      raise exception 'Bilinmeyen ayar: %', k using errcode = '22023';
    end if;
  end loop;

  update public.site_settings s
     set site_name = coalesce(p_patch->>'site_name', s.site_name),
         site_tagline = coalesce(p_patch->>'site_tagline', s.site_tagline),
         logo_light_key = coalesce(p_patch->>'logo_light_key', s.logo_light_key),
         logo_dark_key  = coalesce(p_patch->>'logo_dark_key',  s.logo_dark_key),
         favicon_key    = coalesce(p_patch->>'favicon_key',    s.favicon_key),
         og_image_key   = coalesce(p_patch->>'og_image_key',   s.og_image_key),
         maintenance_mode = coalesce((p_patch->>'maintenance_mode')::boolean, s.maintenance_mode),
         maintenance_title = coalesce(p_patch->>'maintenance_title', s.maintenance_title),
         maintenance_message = coalesce(p_patch->>'maintenance_message', s.maintenance_message),
         header_sticky = coalesce((p_patch->>'header_sticky')::boolean, s.header_sticky),
         header_progress_bar = coalesce((p_patch->>'header_progress_bar')::boolean, s.header_progress_bar),
         ticker_enabled = coalesce((p_patch->>'ticker_enabled')::boolean, s.ticker_enabled),
         ticker_speed_sec = coalesce((p_patch->>'ticker_speed_sec')::int, s.ticker_speed_sec),
         ticker_symbols = coalesce(p_patch->'ticker_symbols', s.ticker_symbols),
         city_strip_enabled = coalesce((p_patch->>'city_strip_enabled')::boolean, s.city_strip_enabled),
         city_strip_slugs = coalesce(p_patch->'city_strip_slugs', s.city_strip_slugs),
         comments_enabled = coalesce((p_patch->>'comments_enabled')::boolean, s.comments_enabled),
         comments_require_approval = coalesce((p_patch->>'comments_require_approval')::boolean, s.comments_require_approval),
         comments_min_len = coalesce((p_patch->>'comments_min_len')::int, s.comments_min_len),
         comments_max_len = coalesce((p_patch->>'comments_max_len')::int, s.comments_max_len),
         likes_enabled = coalesce((p_patch->>'likes_enabled')::boolean, s.likes_enabled),
         views_enabled = coalesce((p_patch->>'views_enabled')::boolean, s.views_enabled),
         ai_summary_enabled = coalesce((p_patch->>'ai_summary_enabled')::boolean, s.ai_summary_enabled),
         tts_enabled = coalesce((p_patch->>'tts_enabled')::boolean, s.tts_enabled),
         weather_enabled = coalesce((p_patch->>'weather_enabled')::boolean, s.weather_enabled),
         prayer_enabled = coalesce((p_patch->>'prayer_enabled')::boolean, s.prayer_enabled),
         markets_enabled = coalesce((p_patch->>'markets_enabled')::boolean, s.markets_enabled),
         ads_enabled = coalesce((p_patch->>'ads_enabled')::boolean, s.ads_enabled),
         demo_mode = coalesce((p_patch->>'demo_mode')::boolean, s.demo_mode),
         registration_enabled = coalesce((p_patch->>'registration_enabled')::boolean, s.registration_enabled),
         registration_message = coalesce(p_patch->>'registration_message', s.registration_message),
         home_hero_count = coalesce((p_patch->>'home_hero_count')::int, s.home_hero_count),
         home_mostread_count = coalesce((p_patch->>'home_mostread_count')::int, s.home_mostread_count),
         home_featured_count = coalesce((p_patch->>'home_featured_count')::int, s.home_featured_count),
         home_video_count = coalesce((p_patch->>'home_video_count')::int, s.home_video_count),
         home_category_slugs = coalesce(p_patch->'home_category_slugs', s.home_category_slugs),
         home_category_count = coalesce((p_patch->>'home_category_count')::int, s.home_category_count),
         home_feed_count = coalesce((p_patch->>'home_feed_count')::int, s.home_feed_count),
         seo_title_suffix = coalesce(p_patch->>'seo_title_suffix', s.seo_title_suffix),
         seo_description = coalesce(p_patch->>'seo_description', s.seo_description),
         analytics_id = coalesce(p_patch->>'analytics_id', s.analytics_id),
         contact_email = coalesce(p_patch->>'contact_email', s.contact_email),
         contact_phone = coalesce(p_patch->>'contact_phone', s.contact_phone),
         contact_address = coalesce(p_patch->>'contact_address', s.contact_address),
         updated_at = now()
   where s.id
  returning * into v_row;

  perform public.log_admin('settings_update', null, p_patch);
  return v_row;
end; $$;

revoke all on function public.admin_update_settings(jsonb) from public, anon;
grant execute on function public.admin_update_settings(jsonb) to authenticated;

-- ============================================================
-- 6. BOT / AI AYARLARI
-- ============================================================
create or replace function public.admin_set_bot(p_enabled boolean, p_email text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  update public.bot_settings
     set is_enabled = p_enabled,
         alert_email = coalesce(nullif(trim(coalesce(p_email,'')), ''), alert_email),
         updated_at = now()
   where id;
  perform public.log_admin('bot_toggle', null, jsonb_build_object('enabled', p_enabled));
end; $$;

create or replace function public.admin_set_ai(p_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  update public.ai_settings set is_enabled = p_enabled, updated_at = now() where id;
  perform public.log_admin('ai_toggle', null, jsonb_build_object('enabled', p_enabled));
end; $$;

revoke all on function public.admin_set_bot(boolean, text) from public, anon;
revoke all on function public.admin_set_ai(boolean) from public, anon;
grant execute on function public.admin_set_bot(boolean, text) to authenticated;
grant execute on function public.admin_set_ai(boolean) to authenticated;

-- ============================================================
-- 7. GENEL BAKIŞ
-- ============================================================
create or replace view public.admin_overview
with (security_invoker = true) as
select
  (select count(*) from public.articles
    where status = 'pending_review' and deleted_at is null) as bekleyen_haber,
  (select count(*) from public.comments
    where status = 'pending')                               as bekleyen_yorum,
  (select count(*) from public.articles
    where status = 'published' and deleted_at is null)      as yayindaki_haber,
  (select count(*) from public.articles
    where status = 'published' and deleted_at is null
      and published_at > now() - interval '24 hours')       as bugun_yayin,
  (select count(*) from public.profiles)                    as kullanici,
  (select count(*) from public.profiles
    where created_at > now() - interval '7 days')           as yeni_kullanici,
  -- Bültende `is_active` yok; çift onay modeli:
  -- onaylanmış VE aboneliği bırakmamış olanlar sayılır.
  (select count(*) from public.newsletter_subscribers
    where confirmed and unsubscribed_at is null)            as bulten_abone,
  (select coalesce(sum(view_count), 0) from public.article_stats)  as toplam_okuma,
  (select coalesce(sum(views_24h), 0)  from public.article_stats)  as okuma_24s,
  (select count(*) from public.category_mappings
    where category_id is null)                              as bekleyen_kategori,
  (select count(*) from public.city_mappings
    where city_id is null)                                  as bekleyen_sehir,
  (select count(*) from public.media where status = 'failed') as hatali_medya
 where public.is_staff();

grant select on public.admin_overview to authenticated;

-- ============================================================
-- 8. EN ÇOK OKUNANLAR (panel istatistiği)
-- ============================================================
create or replace view public.admin_top_articles
with (security_invoker = true) as
select a.id, a.slug, a.title, a.published_at,
       st.view_count, st.views_24h, st.like_count, st.comment_count,
       c.name as category_name
  from public.article_stats st
  join public.articles a on a.id = st.article_id
  left join public.categories c on c.id = a.category_id
 where public.is_staff() and a.deleted_at is null;

grant select on public.admin_top_articles to authenticated;

create or replace view public.admin_top_pages
with (security_invoker = true) as
select path, page_type, view_count, views_24h, last_view_at
  from public.page_stats
 where public.is_staff();

grant select on public.admin_top_pages to authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'ADMIN GORUNUMLERI' as rapor, table_name
  from information_schema.views
 where table_schema='public' and table_name like 'admin_%'
 order by table_name;

select 'ADMIN RPC' as rapor, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname like 'admin_%'
 order by 2;

select 'Yonetim paneli destegi kuruldu.' as durum;

notify pgrst, 'reload schema';
