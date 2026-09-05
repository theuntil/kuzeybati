-- ############################################################
--  YAMA 28 — ÜYELİK SİSTEMİ
--
--  KAPSAM
--    • Kayıt / giriş (e-posta + Google + Apple)
--    • Profil: ad, soyad, şehir, otomatik kullanıcı adı
--    • Eksik bilgi tamamlama (OAuth'ta şehir gelmez)
--    • Haber kaydetme (yer imi)
--    • Yorum silme (yalnızca kendi yorumu)
--    • Editör: haber ekle/düzenle/sil → admin onayı
--    • Gelişmiş görüntülenme: haber + sayfa
--    • Panelden kayıt kapatma
--
--  TASARIM KARARLARI
--    Kullanıcı adı e-postadan ÜRETİLİR ve çakışırsa sayı eklenir.
--    Kullanıcıya sorulmaz: kayıt formunu uzatır, çoğu okur
--    umursamaz, sonradan panelden değiştirilebilir.
--
--    Editörün düzenlediği YAYINDAKİ haber yayında kalır, düzenleme
--    ayrı bir taslak olarak beklemez — bunun yerine haber
--    `pending_review`e döner ve yayından kalkar. Basit ve
--    öngörülebilir; "iki sürüm" karmaşası üretmez.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. PROFİL ALANLARI
-- ============================================================
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists city_id    uuid references public.cities(id) on delete set null,
  add column if not exists avatar_url text,
  add column if not exists onboarded_at timestamptz,
  add column if not exists last_seen_at timestamptz;

do $$ begin
  alter table public.profiles
    add constraint profiles_first_len check (first_name is null or char_length(first_name) between 1 and 40);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_last_len check (last_name is null or char_length(last_name) between 1 and 40);
exception when duplicate_object then null; end $$;

comment on column public.profiles.onboarded_at is
'Zorunlu bilgiler tamamlandığı an. NULL ise site kullanıcıyı tamamlama ekranına yönlendirir.';

create index if not exists profiles_city_idx on public.profiles (city_id);

-- ============================================================
-- 2. KULLANICI ADI ÜRETİMİ
--
--  ahmet.yilmaz@gmail.com → ahmet-yilmaz
--  Çakışırsa ahmet-yilmaz-2, -3 …
-- ============================================================
create or replace function public.generate_username(p_email text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_base text;
  v_try  text;
  v_n    int := 1;
begin
  v_base := public.slugify(split_part(coalesce(p_email, ''), '@', 1));
  v_base := nullif(left(v_base, 24), '');
  if v_base is null then
    v_base := 'okur';
  end if;

  v_try := v_base;
  while exists (select 1 from public.profiles where username = v_try) loop
    v_n := v_n + 1;
    v_try := v_base || '-' || v_n;
    -- Sonsuz döngü olmasın
    if v_n > 9999 then
      v_try := v_base || '-' || substr(gen_random_uuid()::text, 1, 6);
      exit;
    end if;
  end loop;

  return v_try;
end; $$;

-- ============================================================
-- 3. YENİ KULLANICI → PROFİL
--
--  Supabase Auth'a kayıt olan herkes için profil satırı açılır.
--  E-posta, Google ve Apple aynı yoldan geçer; farkları
--  `raw_user_meta_data` içindeki alanlardır.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  m         jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first   text  := nullif(trim(coalesce(m->>'first_name', m->>'given_name', '')), '');
  v_last    text  := nullif(trim(coalesce(m->>'last_name',  m->>'family_name', '')), '');
  v_full    text  := nullif(trim(coalesce(m->>'full_name', m->>'name', '')), '');
  v_city    uuid;
  v_display text;
begin
  -- Google/Apple tek parça ad gönderebilir; ilk boşluktan böl
  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last  := nullif(trim(substr(v_full, length(split_part(v_full,' ',1)) + 1)), '');
  end if;

  v_display := coalesce(
    nullif(trim(concat_ws(' ', v_first, v_last)), ''),
    v_full,
    split_part(coalesce(new.email,''), '@', 1),
    'Okur');

  if (m ? 'city_slug') then
    select id into v_city from public.cities
     where slug = m->>'city_slug' and is_active limit 1;
  end if;

  insert into public.profiles
    (id, role, display_name, username, first_name, last_name, city_id, avatar_url,
     locale, onboarded_at)
  values (
    new.id,
    'reader',
    left(v_display, 80),
    public.generate_username(new.email),
    v_first, v_last, v_city,
    nullif(m->>'avatar_url', ''),
    coalesce(nullif(m->>'locale',''), 'tr'),
    -- Zorunlular tamamsa onboarding'e gerek yok
    case when v_first is not null and v_city is not null then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4. PROFİL TAMAMLAMA
--
--  OAuth ile gelen kullanıcıda şehir yok. Site onu tamamlama
--  ekranına yönlendirir; bu fonksiyon eksikleri doldurur.
-- ============================================================
create or replace function public.complete_profile(
  p_first_name text,
  p_last_name  text,
  p_city_slug  text
)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_city uuid;
  v_row  public.profiles;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_first_name,'')), '') is null then
    raise exception 'Ad zorunlu' using errcode = '22023';
  end if;

  select id into v_city from public.cities
   where slug = p_city_slug and is_active limit 1;
  if v_city is null then
    raise exception 'Gecersiz sehir' using errcode = '22023';
  end if;

  update public.profiles set
    first_name   = left(trim(p_first_name), 40),
    last_name    = nullif(left(trim(coalesce(p_last_name,'')), 40), ''),
    city_id      = v_city,
    display_name = left(nullif(trim(concat_ws(' ', trim(p_first_name), trim(p_last_name))), ''), 80),
    onboarded_at = coalesce(onboarded_at, now()),
    updated_at   = now()
  where id = v_uid
  returning * into v_row;

  return v_row;
end; $$;

revoke all on function public.complete_profile(text,text,text) from public, anon;
grant execute on function public.complete_profile(text,text,text) to authenticated;

-- ============================================================
-- 5. HABER KAYDETME (yer imi)
-- ============================================================
create table if not exists public.saved_articles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists saved_articles_user_idx
  on public.saved_articles (user_id, created_at desc);

create or replace function public.toggle_saved_article(p_article_id uuid)
returns table (saved boolean)
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_del int;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  delete from public.saved_articles
   where user_id = v_uid and article_id = p_article_id;
  get diagnostics v_del = row_count;

  if v_del = 0 then
    -- Yalnızca yayındaki haber kaydedilebilir
    if not exists (
      select 1 from public.articles a
       where a.id = p_article_id and a.status = 'published' and a.deleted_at is null
    ) then
      raise exception 'Haber bulunamadi' using errcode = 'P0002';
    end if;

    insert into public.saved_articles (user_id, article_id)
    values (v_uid, p_article_id)
    on conflict do nothing;
    return query select true;
  else
    return query select false;
  end if;
end; $$;

revoke all on function public.toggle_saved_article(uuid) from public, anon;
grant execute on function public.toggle_saved_article(uuid) to authenticated;

-- ============================================================
-- 6. KENDİ YORUMUNU SİLME
--
--  Kayıt fiziksel silinmez: 5651 sayılı kanun gereği IP ve
--  zaman bilgisi saklanmalı. Gövde temizlenir, durum 'deleted'
--  olur ve site "silinmiş yorum" gösterir.
-- ============================================================
create or replace function public.delete_own_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  select user_id into v_owner from public.comments where id = p_comment_id;
  if v_owner is null then
    raise exception 'Yorum bulunamadi' using errcode = 'P0002';
  end if;

  if v_owner <> v_uid and not public.is_staff() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  update public.comments
     set status = 'deleted', body = '[silindi]',
         deleted_at = now(), updated_at = now()
   where id = p_comment_id;
end; $$;

revoke all on function public.delete_own_comment(uuid) from public, anon;
grant execute on function public.delete_own_comment(uuid) to authenticated;

-- ============================================================
-- 7. EDİTÖR HABER İŞLEMLERİ
--
--  Editör haber ekler → 'pending_review'.
--  Admin onaylayınca yayına girer (approve_article, mevcut).
--  Editör YAYINDAKİ haberini düzenlerse haber yayından kalkar
--  ve yeniden onaya düşer.
-- ============================================================
create or replace function public.editor_create_article(
  p_title    text,
  p_summary  text,
  p_body     jsonb,
  p_category text,
  p_city     text default null,
  p_tags     text[] default '{}'
)
returns public.articles
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cat uuid; v_city uuid; v_row public.articles;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;
  if not public.can_write() then
    raise exception 'Yetkisiz: editor veya admin olmalisin' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_title,'')), '') is null then
    raise exception 'Baslik zorunlu' using errcode = '22023';
  end if;

  select id into v_cat  from public.categories where slug = p_category and is_active limit 1;
  if v_cat is null then
    raise exception 'Gecersiz kategori' using errcode = '22023';
  end if;
  if p_city is not null then
    select id into v_city from public.cities where slug = p_city and is_active limit 1;
  end if;

  -- Şemadaki yardımcı: unique_slug(base, suffix)
  v_slug := public.unique_slug(p_title);

  /**
   * `source` enum'unda 'editor' YOK — değer 'editorial'.
   * Bot haberleri 'iha', elle yazılanlar 'editorial'.
   */
  insert into public.articles
    (source, status, slug, title, summary, body, category_id, city_id,
     author_id, byline, tags, is_manually_edited, published_at)
  values
    ('editorial', 'pending_review', v_slug, left(trim(p_title), 300),
     nullif(trim(coalesce(p_summary,'')), ''), coalesce(p_body, '[]'::jsonb),
     v_cat, v_city, v_uid,
     (select display_name from public.profiles where id = v_uid),
     coalesce(p_tags, '{}'), true, now())
  returning * into v_row;

  return v_row;
end; $$;

create or replace function public.editor_update_article(
  p_id       uuid,
  p_title    text,
  p_summary  text,
  p_body     jsonb,
  p_category text,
  p_city     text default null,
  p_tags     text[] default '{}'
)
returns public.articles
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cat uuid; v_city uuid; v_row public.articles; v_owner uuid; v_status public.article_status;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  select author_id, status into v_owner, v_status
    from public.articles where id = p_id and deleted_at is null;
  if v_owner is null then
    raise exception 'Haber bulunamadi' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid and not public.is_admin() then
    raise exception 'Yalnizca kendi haberini duzenleyebilirsin' using errcode = '42501';
  end if;

  select id into v_cat from public.categories where slug = p_category and is_active limit 1;
  if v_cat is null then
    raise exception 'Gecersiz kategori' using errcode = '22023';
  end if;
  if p_city is not null then
    select id into v_city from public.cities where slug = p_city and is_active limit 1;
  end if;

  update public.articles set
    title    = left(trim(p_title), 300),
    summary  = nullif(trim(coalesce(p_summary,'')), ''),
    body     = coalesce(p_body, '[]'::jsonb),
    category_id = v_cat,
    city_id  = v_city,
    tags     = coalesce(p_tags, '{}'),
    -- Düzenlenen haber yayından kalkar, yeniden onaya düşer.
    -- Admin düzenliyorsa durum korunur.
    status   = case when public.is_admin() then status else 'pending_review'::public.article_status end,
    is_manually_edited = true,
    edited_at = now(),
    updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end; $$;

create or replace function public.editor_delete_article(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;
  select author_id into v_owner from public.articles where id = p_id and deleted_at is null;
  if v_owner is null then
    raise exception 'Haber bulunamadi' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid and not public.is_admin() then
    raise exception 'Yalnizca kendi haberini silebilirsin' using errcode = '42501';
  end if;

  -- Yumuşak silme: medya ve istatistikler korunur
  update public.articles
     set deleted_at = now(), status = 'archived', updated_at = now()
   where id = p_id;
end; $$;

revoke all on function public.editor_create_article(text,text,jsonb,text,text,text[]) from public, anon;
revoke all on function public.editor_update_article(uuid,text,text,jsonb,text,text,text[]) from public, anon;
revoke all on function public.editor_delete_article(uuid) from public, anon;
grant execute on function public.editor_create_article(text,text,jsonb,text,text,text[]) to authenticated;
grant execute on function public.editor_update_article(uuid,text,text,jsonb,text,text,text[]) to authenticated;
grant execute on function public.editor_delete_article(uuid) to authenticated;

-- ============================================================
-- 8. SAYFA GÖRÜNTÜLENMESİ
--
--  Haber görüntülenmesi `article_views` içinde zaten tutuluyor.
--  Bu tablo HABER DIŞI sayfaları izler: kategori, şehir, hizmet,
--  arama, kurumsal sayfalar. Mobil uygulama da aynı uçtan yazar.
--
--  Ham olay append-only; sayaçlar `page_stats` içinde toplanır.
-- ============================================================
create table if not exists public.page_views (
  id            bigserial primary key,
  path          text not null,
  page_type     text not null default 'other',
  ref_id        uuid,
  session_hash  text not null,
  user_id       uuid references public.profiles(id) on delete set null,
  locale        text,
  referrer_host text,
  platform      text not null default 'web',
  view_hour     timestamptz not null default date_trunc('hour', now()),
  created_at    timestamptz not null default now(),
  constraint page_views_path_len check (char_length(path) between 1 and 300)
);

create index if not exists page_views_path_idx on public.page_views (path, created_at desc);
create index if not exists page_views_type_idx on public.page_views (page_type, created_at desc);

-- Aynı oturum + aynı sayfa saatte bir kez sayılır
create unique index if not exists page_views_dedupe_idx
  on public.page_views (path, session_hash, view_hour);

create table if not exists public.page_stats (
  path        text primary key,
  page_type   text not null default 'other',
  view_count  bigint not null default 0,
  views_24h   bigint not null default 0,
  last_view_at timestamptz
);

create or replace function public.track_page_view(
  p_path      text,
  p_type      text default 'other',
  p_ref_id    uuid default null,
  p_session   text default null,
  p_locale    text default 'tr',
  p_referrer  text default null,
  p_platform  text default 'web'
)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_path text := left(coalesce(p_path,'/'), 300);
begin
  insert into public.page_views
         (path, page_type, ref_id, session_hash, user_id, locale,
          referrer_host, platform, view_hour)
  values (v_path, left(coalesce(p_type,'other'), 32), p_ref_id,
          left(coalesce(p_session,'anon'), 64), auth.uid(),
          left(coalesce(p_locale,'tr'), 5), left(p_referrer, 120),
          left(coalesce(p_platform,'web'), 16), date_trunc('hour', now()))
  on conflict do nothing;

  if found then
    insert into public.page_stats (path, page_type, view_count, views_24h, last_view_at)
    values (v_path, left(coalesce(p_type,'other'), 32), 1, 1, now())
    on conflict (path) do update
      set view_count = public.page_stats.view_count + 1,
          views_24h  = public.page_stats.views_24h + 1,
          last_view_at = now();
  end if;
end; $$;

revoke all on function public.track_page_view(text,text,uuid,text,text,text,text) from public;
grant execute on function public.track_page_view(text,text,uuid,text,text,text,text)
  to anon, authenticated;

-- ============================================================
-- 9. KAYIT AÇIK/KAPALI
-- ============================================================
alter table public.site_settings
  add column if not exists registration_enabled boolean not null default true,
  add column if not exists registration_message text;

comment on column public.site_settings.registration_enabled is
'false ise kayıt sayfası kapanır. Mevcut kullanıcılar giriş yapmaya devam eder.';

-- ============================================================
-- 10. KULLANICI PANELİ GÖRÜNÜMLERİ
-- ============================================================
create or replace view public.my_profile
with (security_invoker = true) as
select p.id, p.role, p.display_name, p.username, p.first_name, p.last_name,
       p.avatar_key, p.avatar_url, p.bio, p.locale, p.is_active,
       p.onboarded_at, p.created_at,
       c.slug as city_slug, c.name as city_name
  from public.profiles p
  left join public.cities c on c.id = p.city_id
 where p.id = auth.uid();

grant select on public.my_profile to authenticated;

create or replace view public.my_saved
with (security_invoker = true) as
select s.created_at as saved_at, a.*
  from public.saved_articles s
  join public.public_articles a on a.id = s.article_id
 where s.user_id = auth.uid();

grant select on public.my_saved to authenticated;

create or replace view public.my_comments
with (security_invoker = true) as
select c.id, c.article_id, c.parent_id, c.body, c.status,
       c.created_at, c.updated_at,
       a.slug as article_slug, a.title as article_title
  from public.comments c
  join public.articles a on a.id = c.article_id
 where c.user_id = auth.uid()
   and c.status <> 'deleted';

grant select on public.my_comments to authenticated;

create or replace view public.my_articles
with (security_invoker = true) as
select a.id, a.slug, a.title, a.summary, a.status, a.published_at,
       a.edited_at, a.created_at, a.cover_media_id,
       c.slug as category_slug, c.name as category_name,
       ci.slug as city_slug, ci.name as city_name,
       coalesce(st.view_count, 0)    as view_count,
       coalesce(st.like_count, 0)    as like_count,
       coalesce(st.comment_count, 0) as comment_count
  from public.articles a
  left join public.categories c   on c.id  = a.category_id
  left join public.cities     ci  on ci.id = a.city_id
  left join public.article_stats st on st.article_id = a.id
 where a.author_id = auth.uid()
   and a.deleted_at is null;

grant select on public.my_articles to authenticated;

-- ============================================================
-- 11. RLS
-- ============================================================
alter table public.saved_articles enable row level security;
alter table public.saved_articles force  row level security;
alter table public.page_views     enable row level security;
alter table public.page_views     force  row level security;
alter table public.page_stats     enable row level security;
alter table public.page_stats     force  row level security;

drop policy if exists saved_own on public.saved_articles;
create policy saved_own on public.saved_articles
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists pv_staff_read on public.page_views;
create policy pv_staff_read on public.page_views
  for select using (public.is_staff());

drop policy if exists ps_public_read on public.page_stats;
create policy ps_public_read on public.page_stats
  for select using (true);

-- Yazma yalnızca RPC üzerinden; doğrudan INSERT yok
revoke insert, update, delete on public.saved_articles from anon, authenticated;
revoke insert, update, delete on public.page_views     from anon, authenticated;
revoke insert, update, delete on public.page_stats     from anon, authenticated;
grant select on public.saved_articles to authenticated;
grant select on public.page_stats     to anon, authenticated;

-- Profil: kendi satırını okur ve sınırlı alanları günceller
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

grant update (display_name, bio, locale, avatar_key, avatar_url)
  on public.profiles to authenticated;

-- ============================================================
-- 12. GÖRÜNÜMÜ TAZELE (yeni ayar kolonları)
-- ============================================================
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
       demo_mode, registration_enabled, registration_message,
       home_hero_count, home_mostread_count, home_featured_count, home_video_count,
       home_category_slugs, home_category_count, home_feed_count,
       social_links, seo_title_suffix, seo_description, analytics_id,
       contact_email, contact_phone, contact_address
  from public.site_settings where id;

grant select on public.public_site_settings to anon, authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'PROFIL ALANLARI' as rapor, count(*) as kolon
  from information_schema.columns
 where table_schema='public' and table_name='profiles'
   and column_name in ('first_name','last_name','city_id','onboarded_at');

select 'YENI TABLOLAR' as rapor, table_name
  from information_schema.tables
 where table_schema='public' and table_name in ('saved_articles','page_views','page_stats')
 order by table_name;

select 'KULLANICI GORUNUMLERI' as rapor, table_name
  from information_schema.views
 where table_schema='public' and table_name like 'my_%'
 order by table_name;

select 'Uyelik sistemi kuruldu.' as durum;

notify pgrst, 'reload schema';
