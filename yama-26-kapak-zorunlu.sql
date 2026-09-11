-- ############################################################
--  YAMA 26 — ANA SAYFADA KAPAKSIZ HABER YOK
--
--  KURAL
--    Ana sayfadaki her kart bir görsel gösterir. Kaynağı:
--      • fotoğraf → media.storage_key
--      • video    → media.poster_key  (bot her videoyu işlerken
--                   posterini de kaydeder)
--
--    `articles.cover_media_id` bu ikisinden birini işaret eder.
--    NULL ise gösterilebilir görsel yoktur; site o haberi ana
--    sayfada hiç sormaz.
--
--  ⚠️ BOTU DURDURMANA GEREK YOK
--    Toplu güncellemeler PARÇALI ve `for update skip locked` ile
--    yapılır: botun o an tuttuğu satırlar atlanır, kilit
--    beklenmez. Böylece kilitlenme (deadlock) oluşmaz.
--    Atlanan satır kalırsa yamayı tekrar çalıştır — kaldığı
--    yerden devam eder.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

-- Kilit beklemesi uzarsa hata ver, kilitlenme oluşmasın
set lock_timeout = '5s';
set statement_timeout = '600s';

-- ============================================================
-- 1. TRIGGER — fotoğraf yoksa posterli video kapak olsun
-- ============================================================
create or replace function public.tg_sync_article_media_state()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare a_id uuid := coalesce(new.article_id, old.article_id);
        total int; ready int; failed int;
begin
  select count(*), count(*) filter (where m.status='ready'),
         count(*) filter (where m.status in ('failed','skipped'))
    into total, ready, failed from public.media m where m.article_id = a_id;

  update public.articles set
    media_state = case
      when total = 0 then media_state
      when ready = total then 'complete'::public.media_state
      when ready + failed = total then 'partial'::public.media_state
      when ready > 0 then 'partial'::public.media_state
      else media_state end,

    cover_media_id = coalesce(
      cover_media_id,
      (select m2.id from public.media m2
        where m2.article_id = a_id and m2.type = 'image' and m2.status = 'ready'
        order by m2.sort_order limit 1),
      (select m3.id from public.media m3
        where m3.article_id = a_id and m3.type = 'video'
          and m3.status in ('ready','skipped') and m3.poster_key is not null
        order by m3.sort_order limit 1))
  where id = a_id;
  return null;
end; $$;

drop trigger if exists media_sync_article_state on public.media;
create trigger media_sync_article_state
  after insert or update or delete on public.media
  for each row execute function public.tg_sync_article_media_state();

-- ============================================================
-- 2. GEÇMİŞ KAYITLARI ONAR — PARÇALI ve KİLİTSİZ
--
--  Tek büyük UPDATE binlerce satırı aynı anda kilitler ve bot
--  yazarken kilitlenmeye yol açar. Bunun yerine 500'lük partiler
--  hâlinde, `skip locked` ile ilerliyoruz: botun tuttuğu satır
--  beklenmeden atlanır.
-- ============================================================
do $$
declare
  n_batch int;
  n_total int := 0;
  n_skip  int := 0;
begin
  loop
    with hedef as (
      select a.id
        from public.articles a
       where a.cover_media_id is null
         and a.deleted_at is null
         and exists (
           select 1 from public.media m
            where m.article_id = a.id
              and ((m.type = 'image' and m.status = 'ready')
                or (m.type = 'video' and m.status in ('ready','skipped')
                    and m.poster_key is not null)))
       order by a.id
       limit 500
       for update skip locked
    )
    update public.articles a
       set cover_media_id = coalesce(
             (select m.id from public.media m
               where m.article_id = a.id and m.type = 'image' and m.status = 'ready'
               order by m.sort_order limit 1),
             (select m.id from public.media m
               where m.article_id = a.id and m.type = 'video'
                 and m.status in ('ready','skipped') and m.poster_key is not null
               order by m.sort_order limit 1))
      from hedef h
     where a.id = h.id;

    get diagnostics n_batch = row_count;
    n_total := n_total + n_batch;
    exit when n_batch = 0;
  end loop;

  select count(*) into n_skip
    from public.articles a
   where a.cover_media_id is null
     and a.deleted_at is null
     and exists (
       select 1 from public.media m
        where m.article_id = a.id
          and ((m.type = 'image' and m.status = 'ready')
            or (m.type = 'video' and m.status in ('ready','skipped')
                and m.poster_key is not null)));

  raise notice 'Kapak atanan haber: %', n_total;
  if n_skip > 0 then
    raise notice 'Bot o an tuttugu icin atlanan: % — yamayi tekrar calistir.', n_skip;
  end if;
end $$;

-- ============================================================
-- 3. POSTERİ OLMAYAN VİDEOLARI KUYRUĞA AL
--
--  Bot bir sonraki turda videoyu yeniden işler ve posteri üretir.
--  Tek seferlik işaret YOK: sonradan gelen postersiz videolar da
--  yakalanır. `updated_at` koşulu bottan yeni çıkmış kayda dokunmaz.
-- ============================================================
do $$
declare n int;
begin
  with hedef as (
    select id from public.media
     where type = 'video'
       and status in ('ready','skipped')
       and poster_key is null
       and updated_at < now() - interval '1 hour'
     order by id
     limit 2000
     for update skip locked
  )
  update public.media m
     set status = 'pending', attempts = 0, next_try_at = now(), last_error = null
    from hedef h
   where m.id = h.id;

  get diagnostics n = row_count;
  raise notice 'Postersiz % video kuyruga alindi.', n;
end $$;

-- ============================================================
-- 4. INDEX — ana sayfa filtresi için
-- ============================================================
create index if not exists articles_with_cover_idx
  on public.articles (published_at desc)
  where cover_media_id is not null
    and status = 'published'
    and deleted_at is null;

-- ============================================================
--  DURUM RAPORU
--  (Supabase editöründe her sorgu ayrı sonuç sekmesinde çıkar)
-- ============================================================

-- Yayındaki haberler: kaçının kapağı var
select 'YAYINDAKI HABERLER' as rapor,
       count(*)                                          as toplam,
       count(*) filter (where cover_media_id is not null) as kapagi_var,
       count(*) filter (where cover_media_id is null)     as kapagi_yok
  from public.articles
 where status = 'published' and deleted_at is null;

-- Kapak türü dağılımı: video kapaklar burada görünmeli
select 'KAPAK TURU' as rapor, m.type::text as tur, count(*) as adet
  from public.articles a
  join public.media m on m.id = a.cover_media_id
 where a.status = 'published' and a.deleted_at is null
 group by 1, 2 order by 3 desc;

-- Video medyası: postersiz kaç tane kaldı
select 'VIDEO MEDYASI' as rapor,
       status::text,
       count(*)                                       as adet,
       count(*) filter (where poster_key is not null) as posterli,
       count(*) filter (where poster_key is null)     as postersiz
  from public.media where type = 'video'
 group by 1, 2 order by 3 desc;

-- Kapaksız kalan haberler: ana sayfada GÖSTERİLMEZ.
-- 'medya' 0 ise normal; 'video' > 0 ise poster bekliyor.
select 'KAPAKSIZ HABERLER' as rapor,
       a.haber_kodu, a.slug,
       (select count(*) from public.media m where m.article_id = a.id) as medya,
       (select count(*) from public.media m
         where m.article_id = a.id and m.type = 'video') as video
  from public.articles a
 where a.status = 'published' and a.deleted_at is null
   and a.cover_media_id is null
 order by a.published_at desc limit 20;

select 'Kapak zorunlulugu kuruldu.' as durum;

notify pgrst, 'reload schema';
