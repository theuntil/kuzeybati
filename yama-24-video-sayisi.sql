-- ############################################################
--  YAMA 24 — VİDEO SAYISI
--
--  yama-23 video sayısını yalnızca değer 4 ise 10'a çekiyordu.
--  Panelden başka bir değere ayarlanmışsa (5, 6 …) dokunmuyor
--  ve ana sayfada beklenenden az kart çıkıyordu.
--
--  Bu yama 10'un ALTINDAKİ her değeri 10'a çeker; 10 ve üzerini
--  olduğu gibi bırakır — bilinçli olarak yükseltilmiş bir ayarı
--  geri almaz.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set statement_timeout = '60s';

update public.site_settings
   set home_video_count = 10
 where id and home_video_count < 10;

update public.site_settings
   set home_category_count = 8
 where id and home_category_count < 8;

select home_video_count    as "video_rayi",
       home_category_count as "kategori_basina",
       home_featured_count as "one_cikan",
       home_feed_count     as "akis"
  from public.site_settings;

select 'Video sayisi 10 yapildi.' as durum;

notify pgrst, 'reload schema';
