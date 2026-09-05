-- ############################################################
--  YAMA 25 — VİDEOLU HABERİN KAPAĞI
--
--  SORUN
--    `media_sync_article_state` trigger'ı kapağı yalnızca
--    FOTOĞRAFTAN seçiyordu:
--
--      where m2.article_id = a_id and m2.type = 'image' ...
--
--    Haberin fotoğrafı yok, sadece videosu varsa
--    `articles.cover_media_id` NULL kalıyor ve ana sayfada kart
--    boş gri kutu olarak çıkıyordu.
--
--    Oysa bot her videoyu işlerken posterini de kaydediyor:
--      dosya  →  {storage_key}/poster-{thumb|card|full}.avif
--      kolon  →  media.poster_key = {storage_key}/poster
--
--  ÇÖZÜM
--    1. Trigger fotoğraf bulamazsa POSTERİ OLAN videoyu kapak yapar
--    2. Geçmiş haberler için aynı atama toplu uygulanır
--    3. Posteri hiç üretilmemiş videolar kuyruğa geri alınır
--       (bot bir sonraki turda posteri üretir)
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set statement_timeout = '300s';

-- ============================================================
-- 1. TRIGGER: fotoğraf yoksa posterli video kapak olsun
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

    /**
     * KAPAK SEÇİMİ
     *   1) fotoğraf
     *   2) POSTERİ OLAN video  ← eskiden yoktu
     *
     * Posteri olmayan video kapak yapılmaz: dosya yok, kart yine
     * boş çıkardı. O videolar aşağıda kuyruğa alınıyor.
     */
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

-- ============================================================
-- GEÇMİŞ KAYITLARIN ONARIMI YAMA-26'DA
--
--  Toplu güncelleme burada yapılıyordu; bot çalışırken tüm
--  articles tablosunu kilitleyip "deadlock detected" hatasına
--  yol açıyordu. Onarım artık yama-26'da PARÇALI ve
--  `for update skip locked` ile yapılıyor.
-- ============================================================

-- ============================================================
-- KONTROL
-- ============================================================
select 'videolu haber' as ne, count(*) as toplam,
       count(*) filter (where cover_media_id is not null) as kapagi_var,
       count(*) filter (where cover_media_id is null) as kapagi_yok
  from public.articles
 where has_video and deleted_at is null;

select 'video medya' as ne, count(*) as toplam,
       count(*) filter (where poster_key is not null) as posterli,
       count(*) filter (where poster_key is null) as postersiz
  from public.media where type = 'video';

select 'Videolu haberin kapagi duzeltildi.' as durum;

notify pgrst, 'reload schema';
