-- ############################################################
--  YAMA 19 — SİTE KATMANI
--
--  Next.js sitesinin ihtiyaç duyduğu her şey:
--    1. site_settings   — bakım modu, header, özellik anahtarları
--    2. nav_items       — menü (header / footer / mobil) panelden
--    3. comments        — yorum (ÜYELİK ZORUNLU + moderasyon)
--    4. article_likes   — beğeni (ÜYELİK ZORUNLU)
--    5. article_views   — görüntülenme (append-only + toplu sayaç)
--    6. article_stats   — okunma/beğeni/yorum sayaçları
--    7. pages           — Hakkımızda / Künye / Gizlilik ... panelden
--
--  TASARIM KARARI: sayaçlar articles tablosunda TUTULMUYOR.
--  articles.view_count her görüntülemede UPDATE demekti; popüler
--  haberde saniyede onlarca yazma → row lock + ISR cache kirlenmesi.
--  Ayrı tabloda tutuluyor, articles'a hiç dokunulmuyor.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set statement_timeout = '180s';

-- ============================================================
-- 1. ENUM'LAR
-- ============================================================
do $$ begin
  create type public.comment_status as enum ('pending','approved','rejected','spam','deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nav_location as enum ('header','footer','mobile','drawer','services');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nav_kind as enum ('home','category','city','page','url','video','search');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. SITE_SETTINGS — tek satır, panelden yönetilir
--
--  Site her istekte bunu okur (60 sn önbellekli). Bakım moduna
--  almak için tek UPDATE yeterli, deploy gerekmez.
-- ============================================================
create table if not exists public.site_settings (
  id boolean primary key default true,
  constraint site_settings_singleton check (id),

  -- ---- Kimlik ---------------------------------------------
  site_name        text not null default 'Kuzeybatı Haber',
  site_tagline     text,
  logo_light_key   text,           -- açık temada gösterilen dosya (white.png)
  logo_dark_key    text,           -- koyu temada gösterilen dosya (darkkk.png)
  favicon_key      text,
  og_image_key     text,

  -- ---- Bakım modu -----------------------------------------
  maintenance_mode     boolean not null default false,
  maintenance_title    text not null default 'Kısa bir ara',
  maintenance_message  text not null default 'Siteyi güncelliyoruz. Birazdan buradayız.',
  maintenance_until    timestamptz,

  -- ---- Diller ---------------------------------------------
  default_locale   text not null default 'tr',
  enabled_locales  jsonb not null default '["tr","en","ar","ru"]'::jsonb,

  -- ---- Header ---------------------------------------------
  header_sticky        boolean not null default true,
  header_progress_bar  boolean not null default true,
  ticker_enabled       boolean not null default true,
  ticker_speed_sec     int not null default 50,
  -- Şeritte hangi semboller, hangi sırayla görünecek
  ticker_symbols   jsonb not null default '[
    {"key":"XU100","label":"BIST 100","source":"bist"},
    {"key":"USDTRY=X","label":"USD/TRY","source":"yahoo"},
    {"key":"EURTRY=X","label":"EUR/TRY","source":"yahoo"},
    {"key":"GRAMALTIN","label":"Gram Altın","source":"derived"},
    {"key":"BZ=F","label":"Brent","source":"yahoo"},
    {"key":"BTC-USD","label":"BTC","source":"yahoo"},
    {"key":"ETH-USD","label":"ETH","source":"yahoo"}
  ]'::jsonb,

  city_strip_enabled boolean not null default true,
  -- Boşsa: en çok haberi olan iller otomatik gösterilir
  city_strip_slugs   jsonb not null default '[]'::jsonb,

  -- ---- Özellik anahtarları --------------------------------
  comments_enabled          boolean not null default true,
  comments_require_approval boolean not null default true,
  comments_min_len          int not null default 2,
  comments_max_len          int not null default 2000,
  comments_rate_per_hour    int not null default 10,
  likes_enabled             boolean not null default true,
  views_enabled             boolean not null default true,
  ai_summary_enabled        boolean not null default true,
  tts_enabled               boolean not null default true,
  weather_enabled           boolean not null default true,
  prayer_enabled            boolean not null default true,
  markets_enabled           boolean not null default true,
  ads_enabled               boolean not null default false,

  -- ---- Ana sayfa yerleşimi --------------------------------
  home_hero_count      int not null default 5,
  home_mostread_count  int not null default 5,
  home_featured_count  int not null default 6,
  home_video_count     int not null default 4,
  -- Ana sayfada blok olarak gösterilecek kategoriler (slug, sırayla)
  home_category_slugs  jsonb not null default '["asayis","ekonomi","spor","saglik"]'::jsonb,
  home_feed_count      int not null default 12,

  -- ---- İletişim / SEO / sosyal ----------------------------
  contact_email    text,
  contact_phone    text,
  contact_address  text,
  social_links     jsonb not null default '{}'::jsonb,
  seo_title_suffix text not null default ' — Kuzeybatı Haber',
  seo_description  text,
  analytics_id     text,

  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null,

  constraint chk_ss_locale  check (default_locale in ('tr','en','ar','ru')),
  constraint chk_ss_speed   check (ticker_speed_sec between 10 and 300),
  constraint chk_ss_clen    check (comments_max_len between 100 and 20000),
  constraint chk_ss_crate   check (comments_rate_per_hour between 1 and 200),
  constraint chk_ss_hero    check (home_hero_count between 1 and 12)
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

update public.site_settings
   set logo_light_key = coalesce(logo_light_key, 'site/white.png'),
       logo_dark_key  = coalesce(logo_dark_key,  'site/darkkk.png')
 where id;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- 3. NAV_ITEMS — menü öğeleri
--
--  Etiketler dile göre: {"tr":"Spor","en":"Sports","ar":"رياضة","ru":"Спорт"}
--  Eksik dil varsa tr'ye düşer.
-- ============================================================
create table if not exists public.nav_items (
  id          uuid primary key default gen_random_uuid(),
  location    public.nav_location not null default 'header',
  parent_id   uuid references public.nav_items(id) on delete cascade,

  kind        public.nav_kind not null default 'category',
  label       jsonb not null default '{}'::jsonb,
  -- kind='category' → categories.slug ; 'city' → cities.slug ; 'page' → pages.slug
  target_slug text,
  url         text,
  icon        text,

  sort_order  int not null default 100,
  is_active   boolean not null default true,
  open_new_tab boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint nav_needs_target check (
    kind not in ('category','city','page') or target_slug is not null),
  constraint nav_url_needed check (kind <> 'url' or url is not null),
  constraint nav_no_self check (parent_id is distinct from id)
);

create index if not exists nav_items_loc_idx
  on public.nav_items (location, sort_order) where is_active;

drop trigger if exists nav_items_touch on public.nav_items;
create trigger nav_items_touch before update on public.nav_items
  for each row execute function public.tg_set_updated_at();

-- ---- Tasarımdaki varsayılan header menüsü ------------------
insert into public.nav_items (location, kind, label, target_slug, url, sort_order)
select v.loc::public.nav_location, v.kind::public.nav_kind, v.label::jsonb, v.slug, v.url, v.ord
  from (values
    ('header','home',    '{"tr":"Anasayfa","en":"Home","ar":"الرئيسية","ru":"Главная"}', null, '/', 10),
    ('header','category','{"tr":"Spor","en":"Sports","ar":"رياضة","ru":"Спорт"}', 'spor', null, 20),
    ('header','category','{"tr":"Finans","en":"Finance","ar":"اقتصاد","ru":"Финансы"}', 'ekonomi', null, 30),
    ('header','category','{"tr":"Kültür","en":"Culture","ar":"ثقافة","ru":"Культура"}', 'kultur-sanat', null, 40),
    ('header','category','{"tr":"Teknoloji","en":"Technology","ar":"تقنية","ru":"Технологии"}', 'teknoloji', null, 50),
    ('header','video',   '{"tr":"Video","en":"Video","ar":"فيديو","ru":"Видео"}', null, null, 60),
    ('mobile','home',    '{"tr":"Anasayfa","en":"Home","ar":"الرئيسية","ru":"Главная"}', null, '/', 10),
    ('mobile','category','{"tr":"Gündem","en":"Agenda","ar":"الأجندة","ru":"Повестка"}', 'gundem', null, 20),
    ('mobile','video',   '{"tr":"Video","en":"Video","ar":"فيديو","ru":"Видео"}', null, null, 30),
    ('mobile','search',  '{"tr":"Ara","en":"Search","ar":"بحث","ru":"Поиск"}', null, null, 40)
  ) as v(loc, kind, label, slug, url, ord)
 where not exists (select 1 from public.nav_items n where n.location = v.loc::public.nav_location);

-- ============================================================
-- 4. PAGES — kurumsal sayfalar (Hakkımızda, Künye, Gizlilik…)
-- ============================================================
create table if not exists public.pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      jsonb not null default '{}'::jsonb,
  body       jsonb not null default '{}'::jsonb,   -- {"tr":"markdown", "en":"..."}
  seo_description jsonb not null default '{}'::jsonb,
  is_active  boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages
  for each row execute function public.tg_set_updated_at();

insert into public.pages (slug, title, sort_order)
values
  ('hakkimizda', '{"tr":"Hakkımızda","en":"About","ar":"من نحن","ru":"О нас"}'::jsonb, 10),
  ('kunye',      '{"tr":"Künye","en":"Imprint","ar":"بيانات الناشر","ru":"Выходные данные"}'::jsonb, 20),
  ('iletisim',   '{"tr":"İletişim","en":"Contact","ar":"اتصل بنا","ru":"Контакты"}'::jsonb, 30),
  ('gizlilik',   '{"tr":"Gizlilik","en":"Privacy","ar":"الخصوصية","ru":"Конфиденциальность"}'::jsonb, 40),
  ('kullanim-sartlari','{"tr":"Kullanım şartları","en":"Terms","ar":"شروط الاستخدام","ru":"Условия"}'::jsonb, 50),
  ('reklam',     '{"tr":"Reklam","en":"Advertise","ar":"إعلن معنا","ru":"Реклама"}'::jsonb, 60)
on conflict (slug) do nothing;

-- ============================================================
-- 5. ETKİLEŞİM
--
--  KARAR: Yorum ve beğeni ÜYELİK GEREKTİRİR. Anonim yok.
--  Bu yüzden fingerprint/rate-limit katmanına gerek kalmadı;
--  kimlik auth.uid() üzerinden kesin.
-- ============================================================

-- ---- 5.1 Yorumlar -----------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references public.articles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,

  body        text not null,
  status      public.comment_status not null default 'pending',

  -- Moderasyon
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reject_note text,
  report_count int not null default 0,

  -- Denetim izi (hukuki sorumluluk — 5651 sayılı kanun)
  ip_hash     text,
  user_agent  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint comments_body_len check (char_length(body) between 2 and 20000),
  constraint comments_no_self_parent check (parent_id is distinct from id)
);

create index if not exists comments_article_idx
  on public.comments (article_id, created_at desc)
  where status = 'approved' and deleted_at is null;
create index if not exists comments_queue_idx
  on public.comments (created_at)
  where status = 'pending' and deleted_at is null;
create index if not exists comments_user_idx on public.comments (user_id, created_at desc);
create index if not exists comments_parent_idx on public.comments (parent_id) where parent_id is not null;

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch before update on public.comments
  for each row execute function public.tg_set_updated_at();

-- ---- 5.2 Beğeniler ----------------------------------------
create table if not exists public.article_likes (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create index if not exists article_likes_user_idx
  on public.article_likes (user_id, created_at desc);

-- ---- 5.3 Görüntülenme (append-only olay tablosu) ----------
--  Her görüntüleme burada bir SATIR. articles'a HİÇ dokunulmaz.
--  session_hash: aynı oturumun aynı haberi şişirmesini engeller.
create table if not exists public.article_views (
  id           bigserial primary key,
  article_id   uuid not null references public.articles(id) on delete cascade,
  session_hash text not null,
  user_id      uuid references public.profiles(id) on delete set null,
  locale       text,
  referrer_host text,

  -- Saat kovası AYRI KOLON, index ifadesi DEĞİL.
  --
  -- `date_trunc('hour', timestamptz)` STABLE'dır (saat dilimi
  -- ayarına bağlı), IMMUTABLE değil; index ifadesinde kullanılamaz:
  --   ERROR 42P17: functions in index expression must be marked IMMUTABLE
  -- Varsayılan değer olarak kullanmakta ise bir sakınca yok.
  view_hour    timestamptz not null default date_trunc('hour', now()),

  created_at   timestamptz not null default now()
);

create index if not exists article_views_article_idx
  on public.article_views (article_id, created_at desc);

-- Aynı oturum + aynı haber 1 saat içinde tekrar sayılmasın
create unique index if not exists article_views_dedupe_idx
  on public.article_views (article_id, session_hash, view_hour);

-- ---- 5.4 Toplu sayaçlar -----------------------------------
create table if not exists public.article_stats (
  article_id    uuid primary key references public.articles(id) on delete cascade,
  view_count    bigint not null default 0,
  like_count    int not null default 0,
  comment_count int not null default 0,
  -- Son 24 saat — "en çok okunanlar" için
  views_24h     int not null default 0,
  score         numeric(12,4) not null default 0,
  updated_at    timestamptz not null default now()
);

create index if not exists article_stats_popular_idx
  on public.article_stats (views_24h desc);
create index if not exists article_stats_alltime_idx
  on public.article_stats (view_count desc);

-- ---- 5.5 Sayaç trigger'ları -------------------------------
create or replace function public.tg_bump_view()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.article_stats (article_id, view_count, views_24h)
  values (new.article_id, 1, 1)
  on conflict (article_id) do update set
    view_count = public.article_stats.view_count + 1,
    views_24h  = public.article_stats.views_24h + 1,
    updated_at = now();
  return null;
end; $$;

drop trigger if exists article_views_bump on public.article_views;
create trigger article_views_bump after insert on public.article_views
  for each row execute function public.tg_bump_view();

create or replace function public.tg_bump_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare a uuid := coalesce(new.article_id, old.article_id); d int;
begin
  d := case when tg_op = 'INSERT' then 1 else -1 end;
  insert into public.article_stats (article_id, like_count)
  values (a, greatest(0, d))
  on conflict (article_id) do update set
    like_count = greatest(0, public.article_stats.like_count + d),
    updated_at = now();
  return null;
end; $$;

drop trigger if exists article_likes_bump on public.article_likes;
create trigger article_likes_bump after insert or delete on public.article_likes
  for each row execute function public.tg_bump_like();

create or replace function public.tg_bump_comment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare a uuid := coalesce(new.article_id, old.article_id); n int;
begin
  select count(*) into n from public.comments c
   where c.article_id = a and c.status = 'approved' and c.deleted_at is null;
  insert into public.article_stats (article_id, comment_count)
  values (a, n)
  on conflict (article_id) do update set
    comment_count = n, updated_at = now();
  return null;
end; $$;

drop trigger if exists comments_bump on public.comments;
create trigger comments_bump after insert or update of status, deleted_at or delete
  on public.comments
  for each row execute function public.tg_bump_comment();

-- ============================================================
-- 6. RPC'LER
-- ============================================================

-- ---- 6.1 Görüntülenme kaydet (anon çağırabilir) -----------
--  Tabloya doğrudan INSERT yetkisi VERİLMEZ; sadece bu fonksiyon.
create or replace function public.track_article_view(
  p_article_id uuid,
  p_session text,
  p_locale text default 'tr',
  p_referrer text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_on boolean;
begin
  select ss.views_enabled into v_on from public.site_settings ss where ss.id;
  if not coalesce(v_on, true) then return; end if;

  -- Haber gerçekten yayında mı? (uydurma id ile sayaç şişirilemesin)
  if not exists (select 1 from public.articles a
                  where a.id = p_article_id and a.status = 'published'
                    and a.deleted_at is null) then
    return;
  end if;

  insert into public.article_views
         (article_id, session_hash, user_id, locale, referrer_host, view_hour)
  values (p_article_id, left(coalesce(p_session,'anon'), 64), auth.uid(),
          left(coalesce(p_locale,'tr'), 5), left(p_referrer, 120),
          date_trunc('hour', now()))
  on conflict do nothing;   -- aynı saat içinde tekrar sayma
end; $$;

-- ---- 6.2 Beğeni aç/kapa (ÜYELİK ZORUNLU) ------------------
create or replace function public.toggle_article_like(p_article_id uuid)
returns table (liked boolean, like_count int)
language plpgsql security definer set search_path = ''
as $$
declare v_on boolean; v_exists boolean; v_count int;
begin
  if auth.uid() is null then
    raise exception 'Beğenmek için giriş yapmalısınız' using errcode = '42501';
  end if;

  select ss.likes_enabled into v_on from public.site_settings ss where ss.id;
  if not coalesce(v_on, true) then
    raise exception 'Beğeni kapalı' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.article_likes l
                  where l.article_id = p_article_id and l.user_id = auth.uid())
    into v_exists;

  if v_exists then
    delete from public.article_likes
     where article_id = p_article_id and user_id = auth.uid();
  else
    insert into public.article_likes (article_id, user_id)
    values (p_article_id, auth.uid()) on conflict do nothing;
  end if;

  select coalesce(s.like_count, 0) into v_count
    from public.article_stats s where s.article_id = p_article_id;

  return query select (not v_exists), coalesce(v_count, 0);
end; $$;

-- ---- 6.3 Yorum gönder (ÜYELİK ZORUNLU + moderasyon) -------
create or replace function public.post_comment(
  p_article_id uuid,
  p_body text,
  p_parent_id uuid default null,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns public.comments
language plpgsql security definer set search_path = ''
as $$
declare ss public.site_settings; c public.comments; n int; v_status public.comment_status;
begin
  if auth.uid() is null then
    raise exception 'Yorum yapmak için giriş yapmalısınız' using errcode = '42501';
  end if;

  select * into ss from public.site_settings where id;
  if not ss.comments_enabled then
    raise exception 'Yorumlar kapalı' using errcode = 'P0001';
  end if;

  if char_length(trim(coalesce(p_body,''))) < ss.comments_min_len then
    raise exception 'Yorum çok kısa' using errcode = 'P0001';
  end if;
  if char_length(p_body) > ss.comments_max_len then
    raise exception 'Yorum çok uzun (en fazla % karakter)', ss.comments_max_len
      using errcode = 'P0001';
  end if;

  -- Hesap askıya alınmışsa yazamaz
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_active) then
    raise exception 'Hesabınız yorum yapamaz' using errcode = '42501';
  end if;

  -- Hız sınırı: saatte N yorum
  select count(*) into n from public.comments
   where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if n >= ss.comments_rate_per_hour then
    raise exception 'Saatlik yorum sınırına ulaştınız' using errcode = 'P0001';
  end if;

  -- Haber yayında mı?
  if not exists (select 1 from public.articles a
                  where a.id = p_article_id and a.status = 'published'
                    and a.deleted_at is null) then
    raise exception 'Haber bulunamadı' using errcode = 'P0002';
  end if;

  -- Yanıt verilen yorum aynı haberde ve onaylı mı?
  if p_parent_id is not null and not exists (
       select 1 from public.comments x
        where x.id = p_parent_id and x.article_id = p_article_id
          and x.status = 'approved' and x.deleted_at is null) then
    raise exception 'Yanıtlanan yorum bulunamadı' using errcode = 'P0002';
  end if;

  -- Editör/admin yorumu doğrudan yayında
  v_status := case
    when public.is_staff() then 'approved'::public.comment_status
    when ss.comments_require_approval then 'pending'::public.comment_status
    else 'approved'::public.comment_status end;

  insert into public.comments (article_id, user_id, parent_id, body, status,
                               ip_hash, user_agent)
  values (p_article_id, auth.uid(), p_parent_id, trim(p_body), v_status,
          left(p_ip_hash, 64), left(p_user_agent, 300))
  returning * into c;

  return c;
end; $$;

-- ---- 6.4 Yorum moderasyonu (staff) ------------------------
create or replace function public.moderate_comment(
  p_comment_id uuid,
  p_status public.comment_status,
  p_note text default null
)
returns public.comments
language plpgsql security definer set search_path = ''
as $$
declare c public.comments;
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  update public.comments set
    status = p_status, reviewed_by = auth.uid(), reviewed_at = now(),
    reject_note = left(p_note, 500),
    deleted_at = case when p_status = 'deleted' then now() else null end
  where id = p_comment_id
  returning * into c;
  if not found then raise exception 'Yorum bulunamadı' using errcode = 'P0002'; end if;
  return c;
end; $$;

-- ---- 6.5 Kendi yorumunu sil -------------------------------
create or replace function public.delete_own_comment(p_comment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.comments set deleted_at = now(), status = 'deleted'
   where id = p_comment_id and user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'Yorum bulunamadı' using errcode = 'P0002';
  end if;
end; $$;

-- ---- 6.6 Yorumu bildir ------------------------------------
create or replace function public.report_comment(p_comment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Giriş yapmalısınız' using errcode = '42501';
  end if;
  update public.comments set report_count = report_count + 1
   where id = p_comment_id and deleted_at is null;
end; $$;

-- ---- 6.7 24 saatlik sayacı tazele (pg_cron) ---------------
create or replace function public.refresh_view_windows()
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  update public.article_stats s set
    views_24h = coalesce((
      select count(*)::int from public.article_views v
       where v.article_id = s.article_id
         and v.created_at > now() - interval '24 hours'), 0),
    updated_at = now();
  get diagnostics n = row_count;

  -- Olay tablosu sonsuza kadar büyümesin: 90 günden eskiyi at.
  delete from public.article_views where created_at < now() - interval '90 days';
  return n;
end; $$;

do $$
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if not found then
    raise notice 'pg_cron yok — görüntülenme penceresi zamanlanmadı.';
    return;
  end if;
  perform cron.unschedule('refresh-view-windows')
    where exists (select 1 from cron.job where jobname = 'refresh-view-windows');
  perform cron.schedule('refresh-view-windows', '7 * * * *',
    $c$select public.refresh_view_windows()$c$);
end $$;

-- ============================================================
-- 7. SİTE İÇİN GÜVENLİ GÖRÜNÜMLER
-- ============================================================

-- Ayarların HERKESE açık kısmı (analytics_id, contact_* dahil değil)
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
       home_hero_count, home_mostread_count, home_featured_count, home_video_count,
       home_category_slugs, home_feed_count,
       social_links, seo_title_suffix, seo_description, analytics_id,
       contact_email, contact_phone, contact_address
  from public.site_settings where id;

-- Menü: kategori/şehir bilgisi çözülmüş halde
drop view if exists public.public_nav;
create view public.public_nav
with (security_invoker = true) as
select n.id, n.location, n.parent_id, n.kind, n.label, n.target_slug, n.url,
       coalesce(n.icon, c.icon, ci.icon) as icon,
       c.color as category_color, c.name as category_name, c.kind as category_kind,
       ci.name as city_name,
       n.sort_order, n.open_new_tab
  from public.nav_items n
  left join public.categories c on n.kind = 'category' and c.slug = n.target_slug
  left join public.cities     ci on n.kind = 'city'     and ci.slug = n.target_slug
 where n.is_active
 order by n.location, n.sort_order;

-- Yorumlar: sadece onaylı + yazar bilgisi
drop view if exists public.public_comments;
create view public.public_comments
with (security_invoker = true) as
select c.id, c.article_id, c.parent_id, c.body, c.created_at,
       c.user_id,
       p.display_name as author_name,
       p.username     as author_username,
       p.avatar_key   as author_avatar,
       p.role         as author_role
  from public.comments c
  join public.profiles p on p.id = c.user_id
 where c.status = 'approved' and c.deleted_at is null;

-- Panel: onay bekleyen yorumlar
drop view if exists public.pending_comments;
create view public.pending_comments as
select c.id, c.article_id, a.title as haber, a.slug as haber_slug,
       p.display_name as yazar, c.body, c.report_count, c.created_at
  from public.comments c
  join public.profiles p on p.id = c.user_id
  left join public.articles a on a.id = c.article_id
 where c.status = 'pending' and c.deleted_at is null
 order by c.created_at;

-- Ana sayfa "en çok okunanlar" için sayaçlı görünüm
drop view if exists public.public_article_stats;
create view public.public_article_stats
with (security_invoker = true) as
select s.article_id, s.view_count, s.like_count, s.comment_count, s.views_24h
  from public.article_stats s
  join public.articles a on a.id = s.article_id
 where a.status = 'published' and a.deleted_at is null;

-- ============================================================
-- 8. RLS + YETKİLER
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['site_settings','nav_items','pages','comments',
                           'article_likes','article_views','article_stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
  end loop;
end $$;

-- --- site_settings: herkes okur, sadece admin yazar ---------
drop policy if exists ss_select_all on public.site_settings;
create policy ss_select_all on public.site_settings for select using (true);
drop policy if exists ss_write_admin on public.site_settings;
create policy ss_write_admin on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- --- nav_items / pages: aktif olanlar herkese --------------
drop policy if exists nav_select_public on public.nav_items;
create policy nav_select_public on public.nav_items
  for select using (is_active or public.is_staff());
drop policy if exists nav_write_admin on public.nav_items;
create policy nav_write_admin on public.nav_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists pages_select_public on public.pages;
create policy pages_select_public on public.pages
  for select using (is_active or public.is_staff());
drop policy if exists pages_write_staff on public.pages;
create policy pages_write_staff on public.pages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- --- comments ----------------------------------------------
drop policy if exists comments_select_public on public.comments;
create policy comments_select_public on public.comments
  for select using (
    (status = 'approved' and deleted_at is null
     and exists (select 1 from public.articles a where a.id = comments.article_id
                  and a.status = 'published' and a.deleted_at is null))
    or user_id = auth.uid()
    or public.is_staff());

-- INSERT yetkisi YOK — sadece post_comment() RPC'si üzerinden.
drop policy if exists comments_update_staff on public.comments;
create policy comments_update_staff on public.comments
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- --- article_likes -----------------------------------------
drop policy if exists likes_select_own on public.article_likes;
create policy likes_select_own on public.article_likes
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
-- Yazma sadece toggle_article_like() üzerinden.

-- --- article_views: hiç kimse doğrudan okuyamaz/yazamaz ----
drop policy if exists views_select_staff on public.article_views;
create policy views_select_staff on public.article_views
  for select to authenticated using (public.is_staff());

-- --- article_stats: sayaçlar herkese açık ------------------
drop policy if exists stats_select_public on public.article_stats;
create policy stats_select_public on public.article_stats
  for select using (true);

-- ---- Tablo yetkileri --------------------------------------
revoke all on public.site_settings, public.nav_items, public.pages,
              public.comments, public.article_likes, public.article_views,
              public.article_stats
  from public, anon, authenticated;

grant select on public.site_settings, public.nav_items, public.pages,
                public.comments, public.article_stats
  to anon, authenticated;
grant select on public.article_likes to authenticated;

grant update on public.site_settings to authenticated;
grant insert, update, delete on public.nav_items, public.pages to authenticated;
grant update on public.comments to authenticated;

grant select on public.public_site_settings, public.public_nav,
                public.public_comments, public.public_article_stats
  to anon, authenticated;
grant select on public.pending_comments to authenticated;

-- ---- Fonksiyon yetkileri ----------------------------------
revoke all on function
  public.track_article_view(uuid, text, text, text),
  public.toggle_article_like(uuid),
  public.post_comment(uuid, text, uuid, text, text),
  public.moderate_comment(uuid, public.comment_status, text),
  public.delete_own_comment(uuid),
  public.report_comment(uuid),
  public.refresh_view_windows()
  from public, anon, authenticated;

-- Görüntülenme: anon da sayılmalı
grant execute on function public.track_article_view(uuid, text, text, text)
  to anon, authenticated, service_role;

-- Beğeni / yorum: SADECE giriş yapmış kullanıcı
grant execute on function
  public.toggle_article_like(uuid),
  public.post_comment(uuid, text, uuid, text, text),
  public.delete_own_comment(uuid),
  public.report_comment(uuid)
  to authenticated;

grant execute on function
  public.moderate_comment(uuid, public.comment_status, text)
  to authenticated;

grant execute on function public.refresh_view_windows() to postgres, service_role;

revoke all on function public.tg_bump_view(), public.tg_bump_like(),
                        public.tg_bump_comment()
  from public, anon, authenticated;

-- ============================================================
-- 9. MEVCUT HABERLER İÇİN SAYAÇ SATIRI AÇ
-- ============================================================
insert into public.article_stats (article_id)
select a.id from public.articles a
 where a.status = 'published' and a.deleted_at is null
on conflict (article_id) do nothing;

-- ============================================================
-- KONTROL
-- ============================================================
select maintenance_mode, default_locale, enabled_locales, ticker_enabled
  from public.site_settings;
select location, count(*) from public.nav_items group by location;
select slug from public.pages order by sort_order;

select 'Site katmani kuruldu. Bakim modu: update site_settings set maintenance_mode=true where id;' as durum;

notify pgrst, 'reload schema';
