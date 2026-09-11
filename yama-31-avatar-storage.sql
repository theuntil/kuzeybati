-- ############################################################
--  YAMA 31 — PROFİL FOTOĞRAFI DEPOLAMA
--
--  Avatar dosyaları Supabase Storage'da `avatars` kovasında.
--  Yol düzeni: {user_id}/{zaman}.jpg
--
--  KURAL
--    Kullanıcı yalnızca KENDİ klasörüne yazabilir. Yol
--    kullanıcı kimliğiyle başlamıyorsa RLS reddeder. Aynı
--    kontrol `set_avatar()` içinde de var — iki katman.
--
--  Kova herkese AÇIK okunur: profil fotoğrafı zaten yorumlarda
--  görünüyor, imzalı adres üretmek gereksiz yük olurdu.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

-- ============================================================
-- 1. KOVA
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- ============================================================
-- 2. POLİTİKALAR
-- ============================================================
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

/**
 * Yazma yalnızca kendi klasörüne.
 *
 * `storage.foldername(name)` yolu parçalara ayırır; ilk parça
 * kullanıcı kimliği olmalı. Başkasının klasörüne yazma denemesi
 * politikada takılır.
 */
drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 3. ESKİ FOTOĞRAFLARI TEMİZLEME
--
--  Kullanıcı fotoğrafını değiştirdikçe eskiler birikir. Bu
--  fonksiyon profilde artık kayıtlı olmayan avatar dosyalarını
--  siler. Zamanlanmış görev olarak günde bir çalıştırılabilir.
-- ============================================================
create or replace function public.cleanup_orphan_avatars()
returns int language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  with silinecek as (
    select o.id from storage.objects o
     where o.bucket_id = 'avatars'
       and o.created_at < now() - interval '1 day'
       and not exists (
         select 1 from public.profiles p where p.avatar_key = o.name)
     limit 500
  )
  delete from storage.objects o using silinecek s where o.id = s.id;

  get diagnostics n = row_count;
  return n;
end; $$;

revoke all on function public.cleanup_orphan_avatars() from public, anon;
grant execute on function public.cleanup_orphan_avatars() to authenticated;

select 'Avatar deposu kuruldu.' as durum;
