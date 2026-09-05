-- ############################################################
--  YAMA 22 — LİSTE SORGULARI + OKUMA SÜRESİ
--
--  SORUN 1 · Kategori blokları BOŞ geliyordu
--    Site önce `article_categories`'den yüzlerce article_id
--    çekip sonra `.in("id", [600 uuid])` ile haberleri istiyordu.
--    600 UUID ≈ 22 KB'lık sorgu dizesi; PostgREST bunu
--    "414 Request-URI Too Long" ile reddediyor. İstek hata
--    verince liste boş dönüyordu.
--
--    ÇÖZÜM: `articles.category_slugs` dizisi + GIN index.
--    Tek sorgu, tek tur, kısa URL.
--
--  SORUN 2 · Video listesi aynı hataya düşüyordu
--    ÇÖZÜM: `articles.has_video` bayrağı + kısmi index.
--
--  SORUN 3 · Okuma süresi her haberde "1 dakika"
--    Site süreyi ÖZETTEN hesaplıyordu; özet 1-2 cümle olduğu
--    için sonuç hep 1 çıkıyordu. Gövdeyi listelere taşımak ise
--    her kart için kilobaytlarca metin indirmek demekti.
--
--    ÇÖZÜM: `articles.reading_minutes` üretilmiş kolon.
--    Gövde metninden bir kez hesaplanır, listeye tek tam sayı iner.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. OKUMA SÜRESİ (üretilmiş kolon)
--
--  Kelime sayısı boşluk sayarak bulunur: regexp yerine length()
--  kullanıldı çünkü üretilmiş kolon IMMUTABLE ifade ister.
--  Türkçe için dakikada ~200 kelime.
-- ============================================================
do $$ begin
  alter table public.articles add column reading_minutes int
    generated always as (
      greatest(
        1,
        ceil(
          (length(coalesce(body_text, '')) -
           length(replace(coalesce(body_text, ''), ' ', '')) + 1) / 200.0
        )::int
      )
    ) stored;
exception when duplicate_column then null; end $$;

comment on column public.articles.reading_minutes is
'Gövde metninden hesaplanan okuma süresi (dakika). Liste kartları bunu okur; gövdeyi indirmeye gerek kalmaz.';

-- ============================================================
-- 2. KATEGORİ SLUG DİZİSİ
--
--  Haberin bağlı olduğu TÜM kategoriler (konu + kapsam).
--  article_categories değiştikçe trigger günceller.
-- ============================================================
alter table public.articles
  add column if not exists category_slugs text[] not null default '{}';

create index if not exists articles_category_slugs_idx
  on public.articles using gin (category_slugs);

create or replace function public.refresh_article_category_slugs(p_article_id uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.articles a
     set category_slugs = coalesce((
           select array_agg(distinct c.slug order by c.slug)
             from public.article_categories ac
             join public.categories c on c.id = ac.category_id
            where ac.article_id = p_article_id
         ), '{}')
   where a.id = p_article_id;
$$;

create or replace function public.tg_sync_category_slugs()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.refresh_article_category_slugs(
    coalesce(new.article_id, old.article_id));
  return null;
end; $$;

drop trigger if exists artcat_sync_slugs on public.article_categories;
create trigger artcat_sync_slugs
  after insert or update or delete on public.article_categories
  for each row execute function public.tg_sync_category_slugs();

-- Kategori slug'ı değişirse tüm bağlı haberleri tazele
create or replace function public.tg_category_slug_renamed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    update public.articles a
       set category_slugs = coalesce((
             select array_agg(distinct c.slug order by c.slug)
               from public.article_categories ac
               join public.categories c on c.id = ac.category_id
              where ac.article_id = a.id
           ), '{}')
     where a.id in (
       select ac.article_id from public.article_categories ac
        where ac.category_id = new.id);
  end if;
  return null;
end; $$;

drop trigger if exists categories_slug_renamed on public.categories;
create trigger categories_slug_renamed
  after update of slug on public.categories
  for each row execute function public.tg_category_slug_renamed();

-- ============================================================
-- 3. VİDEO BAYRAĞI
-- ============================================================
alter table public.articles
  add column if not exists has_video boolean not null default false;

create index if not exists articles_has_video_idx
  on public.articles (published_at desc)
  where has_video and deleted_at is null;

create or replace function public.tg_sync_has_video()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare a_id uuid := coalesce(new.article_id, old.article_id);
begin
  update public.articles
     set has_video = exists (
           select 1 from public.media m
            where m.article_id = a_id
              and m.type = 'video'
              and m.status in ('ready','skipped'))
   where id = a_id;
  return null;
end; $$;

drop trigger if exists media_sync_has_video on public.media;
create trigger media_sync_has_video
  after insert or update of status, type or delete on public.media
  for each row execute function public.tg_sync_has_video();

-- ============================================================
-- 4. GEÇMİŞ VERİYİ DOLDUR
-- ============================================================
/**
 * PARÇALI GÜNCELLEME — KİLİTLENMEYİ ÖNLER
 *
 * Tek büyük UPDATE tüm articles tablosunu kilitler. Bot aynı anda
 * haber yazıyorsa iki taraf birbirini bekler ve PostgreSQL
 * "deadlock detected" verir.
 *
 * `for update skip locked`: botun o an tuttuğu satır BEKLENMEZ,
 * atlanır. Beklenmediği için kilitlenme oluşamaz. Atlanan satır
 * kalırsa yama tekrar çalıştırılır.
 */
do $$
declare n_batch int; n_total int := 0;
begin
  loop
    with hedef as (
      select a.id from public.articles a
       where a.deleted_at is null
         and a.category_slugs = '{}'
         and exists (select 1 from public.article_categories ac
                      where ac.article_id = a.id)
       order by a.id limit 500
       for update skip locked
    )
    update public.articles a
       set category_slugs = coalesce((
             select array_agg(distinct c.slug order by c.slug)
               from public.article_categories ac
               join public.categories c on c.id = ac.category_id
              where ac.article_id = a.id
           ), '{}')
      from hedef h where a.id = h.id;

    get diagnostics n_batch = row_count;
    n_total := n_total + n_batch;
    exit when n_batch = 0;
  end loop;
  raise notice 'category_slugs dolduruldu: % haber', n_total;
end $$;

do $$
declare n_batch int; n_total int := 0;
begin
  loop
    with hedef as (
      select a.id from public.articles a
       where a.deleted_at is null
         and a.has_video is distinct from exists (
               select 1 from public.media m
                where m.article_id = a.id and m.type = 'video'
                  and m.status in ('ready','skipped'))
       order by a.id limit 500
       for update skip locked
    )
    update public.articles a
       set has_video = exists (
             select 1 from public.media m
              where m.article_id = a.id and m.type = 'video'
                and m.status in ('ready','skipped'))
      from hedef h where a.id = h.id;

    get diagnostics n_batch = row_count;
    n_total := n_total + n_batch;
    exit when n_batch = 0;
  end loop;
  raise notice 'has_video guncellendi: % haber', n_total;
end $$;

-- ============================================================
-- 4b. KATEGORİ EŞLEŞTİRMESİNİ SAĞLAMLAŞTIR
--
--  Eşleştirme ham metnin TAM eşleşmesine bakıyordu: sağlayıcı
--  'ASAYİŞ' yerine 'ASAYIS' gönderdiğinde eşleşme kaçıyor ve
--  haber 'genel'e düşüyordu. Türkçe İ/I, boşluk ve noktalama
--  farkları bu yüzden kategori kaybına yol açıyordu.
--
--  Artık tam eşleşme tutmazsa slugify edilmiş hâliyle
--  (a) kategori slug'ına, (b) mevcut eşleştirmelere bakılır.
-- ============================================================
create or replace function public.resolve_category_field(
  p_source_id uuid,
  p_field     text,
  p_value     text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_cat uuid;
  v_val text := nullif(upper(trim(coalesce(p_value,''))),'');
  v_key text;
begin
  if v_val is null then return null; end if;
  v_key := public.slugify(v_val);

  -- 1) Tam eşleşme
  select cm.category_id into v_cat
    from public.category_mappings cm
   where cm.source_id = p_source_id
     and cm.raw_field = p_field
     and cm.raw_value = v_val
     and cm.category_id is not null
   limit 1;

  -- 2) Normalleştirilmiş eşleşme (İ/I, boşluk, noktalama farkları)
  if v_cat is null and v_key <> '' then
    select cm.category_id into v_cat
      from public.category_mappings cm
     where cm.source_id = p_source_id
       and cm.raw_field = p_field
       and public.slugify(cm.raw_value) = v_key
       and cm.category_id is not null
     limit 1;
  end if;

  -- 3) Doğrudan kategori slug'ı ile eşleşme
  if v_cat is null and v_key <> '' then
    select c.id into v_cat
      from public.categories c
     where c.slug = v_key and c.is_active
     limit 1;
  end if;

  -- OTOMATİK KEŞİF: bilinmeyen değer panelde kuyruğa düşsün
  insert into public.category_mappings
         (source_id, raw_field, raw_value, category_id, hit_count, last_seen_at)
  values (p_source_id, p_field, v_val, v_cat, 1, now())
  on conflict (source_id, raw_field, raw_value) where raw_field is not null
  do update set hit_count = public.category_mappings.hit_count + 1,
                last_seen_at = now(),
                category_id  = coalesce(public.category_mappings.category_id,
                                        excluded.category_id);

  return v_cat;
end; $$;

revoke all on function public.resolve_category_field(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.resolve_category_field(uuid,text,text) to service_role;

-- Kategorisi 'genel'e düşmüş haberleri yeniden çözümle
do $$
declare r record; n int := 0; v_genel uuid; v_cat uuid;
begin
  select id into v_genel from public.categories where slug = 'genel';
  for r in
    select a.id, a.source_id, a.ust_kategori, a.kategori
      from public.articles a
     where a.deleted_at is null
       and (a.category_id = v_genel or a.category_id is null)
       and (a.ust_kategori is not null or a.kategori is not null)
     order by a.id
     limit 20000
     for update skip locked
  loop
    /**
     * İKİ AYRI İFADE — tek UPDATE içinde birleştirilemez.
     *
     * `apply_article_categories` article_categories tablosunu
     * değiştirir; bu da `artcat_sync_slugs` trigger'ını tetikleyip
     * AYNI articles satırını günceller. Fonksiyon çağrısı UPDATE'in
     * içindeyken PostgreSQL şu hatayı verir:
     *
     *   tuple to be updated was already modified by an operation
     *   triggered by the current command
     *
     * Önce fonksiyonu çalıştırıp trigger'ın işini bitirmesini
     * bekliyoruz, sonra kolonu yazıyoruz.
     */
    v_cat := public.apply_article_categories(
               r.id, r.source_id, r.ust_kategori, r.kategori);

    update public.articles set category_id = v_cat
     where id = r.id and category_id is distinct from v_cat;

    n := n + 1;
  end loop;
  raise notice 'Yeniden çözümlenen haber: %', n;
end $$;

-- ============================================================
-- 5. GÖRÜNÜMÜ GÜNCELLE
--
--  `body` liste sorgularında da iniyordu — 12 haberlik bir
--  listede onlarca kilobayt gereksiz metin. Artık gövde yalnızca
--  haber sayfasında istenir; listeler `reading_minutes` okur.
-- ============================================================
/**
 * CASCADE ŞART: `my_saved` görünümü buna bağlı.
 *
 * `drop view public_articles` bağımlı görünüm yüzünden hata
 * verir ve ardından `create view` "zaten var" der. CASCADE ile
 * bağımlı görünüm de düşer; aşağıda yeniden oluşturulur.
 */
drop view if exists public.public_articles cascade;
create view public.public_articles
with (security_invoker = true) as
select a.id, a.slug, a.title, a.summary, a.body, a.byline,
       a.son_dakika, a.published_at, a.edited_at, a.tags,
       a.seo_title, a.seo_description,
       a.reading_minutes, a.category_slugs, a.has_video,
       a.category_id, a.city_id, a.source_id, a.cover_media_id,
       c.slug  as category_slug, c.name  as category_name,
       c.color as category_color, c.icon as category_icon, c.kind as category_kind,
       ci.slug as city_slug, ci.name as city_name,
       ci.plate_code, ci.region, ci.is_domestic,
       s.short_name as source_name, s.logo_key as source_logo
  from public.articles a
  left join public.categories c  on c.id  = a.category_id
  left join public.cities     ci on ci.id = a.city_id
  left join public.sources    s  on s.id  = a.source_id
 where a.status = 'published'
   and a.deleted_at is null
   and a.published_at <= now();

grant select on public.public_articles to anon, authenticated;

/**
 * `public_articles` CASCADE ile düştüğü için ona bağlı görünüm
 * yeniden kurulur. Tanım yama-28 ile birebir aynı; burada
 * olmazsa kurulum sırası bozulduğunda görünüm kaybolur.
 */
do $$ begin
  if to_regclass('public.saved_articles') is not null then
    execute $v$
      create or replace view public.my_saved
      with (security_invoker = true) as
      select s.created_at as saved_at, a.*
        from public.saved_articles s
        join public.public_articles a on a.id = s.article_id
       where s.user_id = auth.uid()
    $v$;
    execute 'grant select on public.my_saved to authenticated';
  end if;
end $$;


-- Sütun bazlı yetki: yeni kolonlar anon'a açık olsun
grant select (reading_minutes, category_slugs, has_video)
  on public.articles to anon, authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'kategori dizisi dolu' as ne,
       count(*) filter (where category_slugs <> '{}') as adet,
       count(*) as toplam
  from public.articles where deleted_at is null;

select 'videolu haber' as ne, count(*) from public.articles where has_video;

select slug, reading_minutes,
       length(coalesce(body_text,'')) as govde_karakter
  from public.articles
 where deleted_at is null
 order by published_at desc limit 5;

select unnest(category_slugs) as kategori, count(*)
  from public.articles where deleted_at is null
 group by 1 order by 2 desc limit 10;

select 'Liste sorgulari hizlandirildi, okuma suresi eklendi.' as durum;

notify pgrst, 'reload schema';
