-- ############################################################
--  YAMA 27 — POSTER GENİŞLİĞİNİ KAYDA GEÇİR
--
--  SORUN
--    Bot kaynaktan BÜYÜK varyant üretmiyor (image-processor.ts):
--
--      if (v.name !== 'thumb' && meta.width < v.w * 0.9) {
--        const already = variants.some(x => x.width >= meta.width - 2);
--        if (already) continue;        -- varyant atlanır
--      }
--
--    800px'lik bir video posteri için `poster-full.avif` HİÇ
--    üretilmiyor. Site körü körüne `full` isteyince CDN 404
--    döndürüyor ve kapak boş görünüyordu.
--
--  ÇÖZÜM (site tarafında yapıldı)
--    Site artık `media.variants` içindeki bilgiden hangi
--    varyantların gerçekten var olduğunu hesaplıyor ve
--    olmayanı istemiyor.
--
--  BU YAMA
--    Site bu hesabı posterin KAYNAK GENİŞLİĞİNDEN yapıyor
--    (`variants -> 'poster' -> 'w'`). Eski kayıtlarda bu alan
--    boşsa video genişliğinden tamamlanır; yoksa site güvenli
--    tarafta kalıp `card` kullanır.
--
--    Ayrıca kaç posterde bu bilginin eksik olduğunu raporlar.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. POSTER GENİŞLİĞİ EKSİK OLANLARI TAMAMLA
--
--  Poster kaynağı çoğunlukla videonun kendi çözünürlüğünden
--  gelir. Kesin değer değil ama varyant hesabı için yeterli:
--  site zaten olmayan varyantı istemiyor.
-- ============================================================
do $$
declare n_batch int; n_total int := 0;
begin
  loop
    with hedef as (
      select id, width from public.media
       where type = 'video'
         and poster_key is not null
         and (variants -> 'poster' ->> 'w') is null
         and width is not null
       order by id limit 500
       for update skip locked
    )
    update public.media m
       set variants = jsonb_set(
             coalesce(m.variants, '{}'::jsonb),
             '{poster}',
             coalesce(m.variants -> 'poster', '{}'::jsonb)
               || jsonb_build_object('w', h.width),
             true)
      from hedef h
     where m.id = h.id;

    get diagnostics n_batch = row_count;
    n_total := n_total + n_batch;
    exit when n_batch = 0;
  end loop;
  raise notice 'Poster genisligi tamamlanan video: %', n_total;
end $$;

-- ============================================================
-- RAPOR
-- ============================================================

-- Posterlerde genişlik bilgisi var mı
select 'POSTER GENISLIGI' as rapor,
       count(*)                                                     as posterli_video,
       count(*) filter (where (variants -> 'poster' ->> 'w') is not null) as genisligi_var,
       count(*) filter (where (variants -> 'poster' ->> 'w') is null)     as genisligi_yok
  from public.media
 where type = 'video' and poster_key is not null;

-- Genişlik dağılımı: hangi varyantların üretildiğini gösterir
--   < 445  → yalnızca thumb
--   < 890  → thumb + card
--   >= 890 → thumb + card + full
select 'VARYANT DAGILIMI' as rapor,
       case
         when (variants -> 'poster' ->> 'w')::int < 445 then 'yalniz thumb'
         when (variants -> 'poster' ->> 'w')::int < 890 then 'thumb + card'
         else 'thumb + card + full'
       end as uretilen,
       count(*) as adet
  from public.media
 where type = 'video' and poster_key is not null
   and (variants -> 'poster' ->> 'w') is not null
 group by 1, 2 order by 3 desc;

select 'Poster genisligi kayda gecirildi.' as durum;

notify pgrst, 'reload schema';
