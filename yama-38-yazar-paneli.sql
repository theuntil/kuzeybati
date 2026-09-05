-- ############################################################
--  YAMA 38 — YAZAR PANELİ: KAPAK, MEDYA, İSTATİSTİK
--
--  1. Yazarın yüklediği kapak ve galeri
--     Bot medyası `media` tablosunda ve R2'de. Yazarın elle
--     yüklediği görseller Supabase Storage'da; bot hattını
--     bozmamak için AYRI alanlarda tutuluyor.
--
--  2. Haber detay/istatistik verisi
--     Görüntülenme, beğeni, kaydetme, yorum — tek RPC.
--
--  3. E-posta değiştirince YENİ ADRES ONAYLI SAYILIR
--     Zaten kodla doğrulanıyor; ikinci kez doğrulama istemek
--     anlamsızdı.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. YAZAR MEDYASI
-- ============================================================
alter table public.articles
  add column if not exists cover_url    text,
  add column if not exists editor_media jsonb not null default '[]'::jsonb;

comment on column public.articles.cover_url is
'Yazarın yüklediği kapak (Supabase Storage). Bot kapağı cover_media_id''de; ikisi karışmasın diye ayrı.';

comment on column public.articles.editor_media is
'Yazarın eklediği galeri: [{url, type, caption}]. En fazla 10 öğe.';

do $$ begin
  alter table public.articles
    add constraint articles_editor_media_limit
    check (jsonb_array_length(editor_media) <= 10);
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. HABER OLUŞTURMA / DÜZENLEME — KAPAK VE MEDYA İLE
-- ============================================================
create or replace function public.editor_create_article(
  p_title     text,
  p_summary   text,
  p_body      jsonb,
  p_category  text,
  p_city      text default null,
  p_tags      text[] default '{}',
  p_cover_url text default null,
  p_media     jsonb default '[]'::jsonb
)
returns public.articles
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cat uuid; v_city uuid; v_row public.articles; v_slug text;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;
  if not public.can_write() then
    raise exception 'Yetkisiz: yazar veya yonetici olmalisin' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_title,'')), '') is null then
    raise exception 'Baslik zorunlu' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) > 10 then
    raise exception 'En fazla 10 medya eklenebilir' using errcode = '22023';
  end if;

  select id into v_cat from public.categories
   where slug = p_category and is_active limit 1;
  if v_cat is null then
    raise exception 'Gecersiz kategori' using errcode = '22023';
  end if;
  if p_city is not null then
    select id into v_city from public.cities where slug = p_city and is_active limit 1;
  end if;

  v_slug := public.unique_slug(p_title);

  insert into public.articles
    (source, status, slug, title, summary, body, category_id, city_id,
     author_id, byline, tags, is_manually_edited, published_at,
     cover_url, editor_media)
  values
    ('editorial', 'pending_review', v_slug, left(trim(p_title), 300),
     nullif(trim(coalesce(p_summary,'')), ''), coalesce(p_body, '[]'::jsonb),
     v_cat, v_city, v_uid,
     (select display_name from public.profiles where id = v_uid),
     coalesce(p_tags, '{}'), true, now(),
     nullif(trim(coalesce(p_cover_url,'')), ''), coalesce(p_media, '[]'::jsonb))
  returning * into v_row;

  return v_row;
end; $$;

create or replace function public.editor_update_article(
  p_id        uuid,
  p_title     text,
  p_summary   text,
  p_body      jsonb,
  p_category  text,
  p_city      text default null,
  p_tags      text[] default '{}',
  p_cover_url text default null,
  p_media     jsonb default null
)
returns public.articles
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cat uuid; v_city uuid; v_row public.articles; v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  select author_id into v_owner from public.articles
   where id = p_id and deleted_at is null;
  if v_owner is null then
    raise exception 'Haber bulunamadi' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid and not public.is_admin() then
    raise exception 'Yalnizca kendi haberini duzenleyebilirsin' using errcode = '42501';
  end if;
  if p_media is not null and jsonb_array_length(p_media) > 10 then
    raise exception 'En fazla 10 medya eklenebilir' using errcode = '22023';
  end if;

  select id into v_cat from public.categories
   where slug = p_category and is_active limit 1;
  if v_cat is null then
    raise exception 'Gecersiz kategori' using errcode = '22023';
  end if;
  if p_city is not null then
    select id into v_city from public.cities where slug = p_city and is_active limit 1;
  end if;

  update public.articles a set
    title = left(trim(p_title), 300),
    summary = nullif(trim(coalesce(p_summary,'')), ''),
    body = coalesce(p_body, '[]'::jsonb),
    category_id = v_cat,
    city_id = v_city,
    tags = coalesce(p_tags, '{}'),
    cover_url = case when p_cover_url is null then a.cover_url
                     else nullif(trim(p_cover_url), '') end,
    editor_media = coalesce(p_media, a.editor_media),
    -- Düzenlenen haber yayından kalkar, yeniden onaya düşer
    status = case when public.is_admin() then a.status
                  else 'pending_review'::public.article_status end,
    is_manually_edited = true,
    edited_at = now(),
    updated_at = now()
  where a.id = p_id
  returning * into v_row;

  return v_row;
end; $$;

revoke all on function public.editor_create_article(text,text,jsonb,text,text,text[],text,jsonb) from public, anon;
revoke all on function public.editor_update_article(uuid,text,text,jsonb,text,text,text[],text,jsonb) from public, anon;
grant execute on function public.editor_create_article(text,text,jsonb,text,text,text[],text,jsonb) to authenticated;
grant execute on function public.editor_update_article(uuid,text,text,jsonb,text,text,text[],text,jsonb) to authenticated;

-- ============================================================
-- 3. YAYINDAKİ GÖRÜNÜME KAPAK ADRESİ EKLE
--
--  Site kapağı önce `cover_media_id`den (bot), yoksa
--  `cover_url`den (yazar) alır.
-- ============================================================
drop view if exists public.public_articles cascade;
create view public.public_articles
with (security_invoker = true) as
select a.id, a.slug, a.title, a.summary, a.body, a.published_at, a.updated_at,
       a.son_dakika, a.tags, a.category_id, a.city_id, a.cover_media_id,
       a.cover_url, a.editor_media,
       a.category_slugs, a.has_video, a.reading_minutes,
       a.haber_kodu, a.byline, a.source, a.author_id,
       c.slug as category_slug, c.name as category_name, c.color as category_color,
       ci.slug as city_slug, ci.name as city_name
  from public.articles a
  left join public.categories c on c.id = a.category_id
  left join public.cities ci on ci.id = a.city_id
 where a.status = 'published' and a.deleted_at is null;

grant select on public.public_articles to anon, authenticated;

-- Bağımlı görünümler yeniden kurulur
do $$ begin
  if to_regclass('public.saved_articles') is not null then
    execute $v$
      create or replace view public.my_saved as
      select s.created_at as saved_at, a.*
        from public.saved_articles s
        join public.public_articles a on a.id = s.article_id
       where s.user_id = auth.uid()
    $v$;
    execute 'grant select on public.my_saved to authenticated';
  end if;
  if to_regclass('public.article_likes') is not null then
    execute $v$
      create or replace view public.my_likes as
      select l.created_at as liked_at, a.*
        from public.article_likes l
        join public.public_articles a on a.id = l.article_id
       where l.user_id = auth.uid()
    $v$;
    execute 'grant select on public.my_likes to authenticated';
  end if;
end $$;

-- ============================================================
-- 4. HABER DETAY / İSTATİSTİK (yazar)
-- ============================================================
create or replace function public.my_article_detail(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v jsonb; v_owner uuid;
begin
  select author_id into v_owner from public.articles
   where id = p_id and deleted_at is null;
  if v_owner is null then
    raise exception 'Haber bulunamadi' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'title', a.title, 'summary', a.summary,
    'status', a.status, 'published_at', a.published_at,
    'created_at', a.created_at, 'edited_at', a.edited_at,
    'cover_url', a.cover_url, 'cover_media_id', a.cover_media_id,
    'category_name', c.name, 'city_name', ci.name,
    'view_count',    coalesce(st.view_count, 0),
    'views_24h',     coalesce(st.views_24h, 0),
    'like_count',    coalesce(st.like_count, 0),
    'comment_count', coalesce(st.comment_count, 0),
    'save_count',    (select count(*) from public.saved_articles s
                       where s.article_id = a.id),
    -- Son 14 günün günlük okunması: grafiğe hazır
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('gun', d.gun, 'sayi', d.sayi)
                       order by d.gun)
        from (
          select date_trunc('day', v.created_at)::date as gun, count(*) as sayi
            from public.article_views v
           where v.article_id = a.id
             and v.created_at > now() - interval '14 days'
           group by 1
        ) d), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'body', x.body, 'status', x.status,
        'created_at', x.created_at,
        'author_name', p.display_name)
        order by x.created_at desc)
      from public.comments x
      join public.profiles p on p.id = x.user_id
     where x.article_id = a.id and x.status <> 'deleted'
     limit 50), '[]'::jsonb)
  ) into v
  from public.articles a
  left join public.categories c on c.id = a.category_id
  left join public.cities ci on ci.id = a.city_id
  left join public.article_stats st on st.article_id = a.id
  where a.id = p_id;

  return v;
end; $$;

revoke all on function public.my_article_detail(uuid) from public, anon;
grant execute on function public.my_article_detail(uuid) to authenticated;

/** Yazar kendi haberindeki yorumu silebilir */
create or replace function public.delete_article_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_author uuid; v_owner uuid;
begin
  select a.author_id, c.user_id into v_author, v_owner
    from public.comments c
    join public.articles a on a.id = c.article_id
   where c.id = p_comment_id;

  if v_author is null then
    raise exception 'Yorum bulunamadi' using errcode = 'P0002';
  end if;
  -- Haberin sahibi, yorumun sahibi ya da yönetici silebilir
  if v_author <> auth.uid() and v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  update public.comments
     set status = 'deleted', body = '[silindi]',
         deleted_at = now(), updated_at = now()
   where id = p_comment_id;
end; $$;

revoke all on function public.delete_article_comment(uuid) from public, anon;
grant execute on function public.delete_article_comment(uuid) to authenticated;

-- ============================================================
-- 5. YAZAR MEDYA KOVASI
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('articles', 'articles', true, 104857600,
        array['image/jpeg','image/png','image/webp','image/avif',
              'video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
  set public = true, file_size_limit = 104857600,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists articles_public_read on storage.objects;
create policy articles_public_read on storage.objects
  for select using (bucket_id = 'articles');

drop policy if exists articles_author_write on storage.objects;
create policy articles_author_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'articles' and public.can_write());

drop policy if exists articles_author_delete on storage.objects;
create policy articles_author_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'articles' and public.can_write());

-- ============================================================
-- 6. E-POSTA DEĞİŞTİRİNCE YENİ ADRES ONAYLI
--
--  Zaten koda ile doğrulanıyor; ikinci kez doğrulama istemek
--  anlamsızdı. (Bu davranış yama-36'da vardı, burada teyit
--  ediliyor.)
-- ============================================================
create or replace function public.verify_email_change(p_code text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.email_changes;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  select * into v_row from public.email_changes ec
   where ec.user_id = v_uid and ec.used_at is null and ec.expires_at > now()
   order by ec.created_at desc limit 1;

  if not found then return null; end if;

  if v_row.attempts >= 5 then
    update public.email_changes set used_at = now() where id = v_row.id;
    return null;
  end if;

  if v_row.code_hash is distinct from public.kb_hash(trim(coalesce(p_code, ''))) then
    update public.email_changes set attempts = attempts + 1 where id = v_row.id;
    return null;
  end if;

  update public.email_changes set used_at = now() where id = v_row.id;

  -- Kodla doğrulandı: yeni adres ONAYLI sayılır
  update public.profiles
     set email = v_row.new_email,
         email_verified_at = now(),
         updated_at = now()
   where id = v_uid;

  return v_row.new_email;
end; $$;

revoke all on function public.verify_email_change(text) from public, anon;
grant execute on function public.verify_email_change(text) to authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'YENI KOLONLAR' as rapor, count(*) as adet
  from information_schema.columns
 where table_schema='public' and table_name='articles'
   and column_name in ('cover_url','editor_media');

select 'YENI RPC' as rapor, p.proname from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in ('my_article_detail','delete_article_comment')
 order by 2;

select 'Yazar paneli kuruldu.' as durum;

notify pgrst, 'reload schema';
