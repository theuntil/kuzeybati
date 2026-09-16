-- ############################################################
--  YAMA 33 — HESAP SİLME, IP YASAĞI, MEDYA KİTAPLIĞI
--
--  • Kullanıcı KENDİ hesabını silebilir
--  • Yönetici kullanıcı silebilir ve IP yasaklayabilir
--  • Panelde medya kitaplığı (yükle / gör / sil / adres kopyala)
--  • Mail servisi varsayılan olarak AÇIK
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. MAİL VARSAYILANI AÇIK
--
--  `false` idi. Kurulumdan sonra kimse açmayınca doğrulama
--  maili hiç çıkmıyor, kullanıcı boş gelen kutusuna bakıyordu.
--  Panelden kapatılabilir; varsayılanın açık olması doğru.
-- ============================================================
alter table public.mail_settings alter column is_enabled set default true;

/**
 * MEVCUT SATIRI DA AÇ.
 *
 * Bölüm M satırı `false` ile ekliyor; yalnızca DEFAULT'u
 * değiştirmek var olan satırı etkilemiyordu. Sıfırdan kurulumda
 * bile mail kapalı kalıyor, kimse fark etmeden doğrulama maili
 * hiç çıkmıyordu.
 *
 * Panelden istediğin an kapatabilirsin; varsayılanın açık
 * olması doğru davranış.
 */
update public.mail_settings set is_enabled = true, updated_at = now() where id;

-- ============================================================
-- 2. HESAP SİLME
--
--  Kullanıcı kendi hesabını silebilir. Silme İKİ AŞAMALI:
--  önce profil pasifleşir ve kişisel veri temizlenir, sonra
--  auth kaydı silinir (bunu mail servisi Admin API ile yapar,
--  çünkü service_role gerekiyor).
--
--  YORUMLAR SİLİNMEZ, anonimleşir: 5651 sayılı kanun IP ve
--  zaman kaydının saklanmasını istiyor. Silinen kullanıcının
--  yorumları "Silinmiş kullanıcı" adıyla kalır.
-- ============================================================
create or replace function public.delete_my_account(p_confirm text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  -- Yanlışlıkla silmeyi zorlaştır: kullanıcı adını yazmalı
  if lower(trim(coalesce(p_confirm, ''))) is distinct from
     (select lower(username) from public.profiles where id = v_uid) then
    raise exception 'Onay metni kullanici adiyla eslesmiyor' using errcode = '22023';
  end if;

  -- Son yönetici kendini silemez: panele giriş kalmaz
  if exists (select 1 from public.profiles where id = v_uid and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin' and is_active) <= 1 then
    raise exception 'Son yonetici hesabini silemez' using errcode = '42501';
  end if;

  -- Kişisel veriyi temizle, kaydı anonimleştir
  update public.profiles set
    display_name = 'Silinmiş kullanıcı',
    username     = 'silinmis-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 10),
    first_name = null, last_name = null, bio = null,
    avatar_key = null, avatar_url = null,
    city_id = null, push_tokens = '[]'::jsonb,
    email_verified_at = null,
    is_active = false,
    role = 'reader',
    updated_at = now()
  where id = v_uid;

  -- Kaydedilenler ve beğeniler kişisel veri: silinir
  delete from public.saved_articles where user_id = v_uid;
  delete from public.article_likes   where user_id = v_uid;
  delete from public.email_verifications where user_id = v_uid;
  delete from public.password_resets     where user_id = v_uid;

  perform public.log_admin('account_deleted', v_uid::text, '{}'::jsonb);
end; $$;

revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

/** Yöneticinin kullanıcı silmesi — aynı anonimleştirme */
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Kendi hesabini buradan silemezsin' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
     and (select count(*) from public.profiles where role='admin' and is_active) <= 1 then
    raise exception 'Son yonetici silinemez' using errcode = '42501';
  end if;

  update public.profiles set
    display_name = 'Silinmiş kullanıcı',
    username = 'silinmis-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 10),
    first_name = null, last_name = null, bio = null,
    avatar_key = null, avatar_url = null, city_id = null,
    is_active = false, role = 'reader', updated_at = now()
  where id = p_user_id;

  delete from public.saved_articles where user_id = p_user_id;
  delete from public.article_likes   where user_id = p_user_id;

  perform public.log_admin('user_deleted', p_user_id::text, '{}'::jsonb);
end; $$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ============================================================
-- 3. IP YASAĞI
--
--  Yorum ve kayıt bu listeye takılır. IP AÇIK SAKLANMAZ:
--  kişisel veridir, özet olarak tutulur. Aynı özetleme yorum
--  tablosunda da kullanılıyor, böylece eşleşme mümkün.
-- ============================================================
create table if not exists public.ip_bans (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null unique,
  ip_hint    text,                    -- "88.x.x.41" gibi maskeli, tanıma için
  reason     text,
  banned_by  uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,             -- NULL = süresiz
  created_at timestamptz not null default now()
);

create index if not exists ip_bans_lookup_idx on public.ip_bans (ip_hash, expires_at);

alter table public.ip_bans enable row level security;
alter table public.ip_bans force  row level security;

drop policy if exists ip_bans_admin on public.ip_bans;
create policy ip_bans_admin on public.ip_bans
  for select using (public.is_admin());

revoke insert, update, delete on public.ip_bans from anon, authenticated;
grant select on public.ip_bans to authenticated;

create or replace function public.is_ip_banned(p_ip_hash text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ip_bans
     where ip_hash = p_ip_hash
       and (expires_at is null or expires_at > now()));
$$;

create or replace function public.admin_ban_ip(
  p_ip_hash text, p_hint text default null,
  p_reason text default null, p_days int default null
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_ip_hash,'')), '') is null then
    raise exception 'IP gerekli' using errcode = '22023';
  end if;

  insert into public.ip_bans (ip_hash, ip_hint, reason, banned_by, expires_at)
  values (p_ip_hash, p_hint, p_reason, auth.uid(),
          case when p_days is null then null else now() + make_interval(days => p_days) end)
  on conflict (ip_hash) do update
    set reason = excluded.reason, ip_hint = excluded.ip_hint,
        banned_by = excluded.banned_by, expires_at = excluded.expires_at,
        created_at = now();

  perform public.log_admin('ip_ban', p_ip_hash,
    jsonb_build_object('reason', p_reason, 'days', p_days));
end; $$;

create or replace function public.admin_unban_ip(p_ip_hash text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  delete from public.ip_bans where ip_hash = p_ip_hash;
  perform public.log_admin('ip_unban', p_ip_hash, '{}'::jsonb);
end; $$;

revoke all on function public.admin_ban_ip(text,text,text,int) from public, anon;
revoke all on function public.admin_unban_ip(text) from public, anon;
grant execute on function public.admin_ban_ip(text,text,text,int) to authenticated;
grant execute on function public.admin_unban_ip(text) to authenticated;

-- ============================================================
-- 4. KULLANICI DETAYI (panel)
-- ============================================================
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'email', u.email,
    'role', p.role,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'last_seen_at', p.last_seen_at,
    'email_verified_at', p.email_verified_at,
    'city_name', c.name,
    'avatar_key', p.avatar_key,
    'avatar_url', p.avatar_url,
    'comment_count', (select count(*) from public.comments x
                       where x.user_id = p.id and x.status <> 'deleted'),
    'article_count', (select count(*) from public.articles a
                       where a.author_id = p.id and a.deleted_at is null),
    'saved_count',   (select count(*) from public.saved_articles s where s.user_id = p.id),
    'like_count',    (select count(*) from public.article_likes l where l.user_id = p.id),
    'recent_comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'body', left(x.body, 200), 'status', x.status,
        'created_at', x.created_at, 'ip_hash', x.ip_hash,
        'article_title', a2.title))
      from (select * from public.comments cc
             where cc.user_id = p.id order by cc.created_at desc limit 20) x
      join public.articles a2 on a2.id = x.article_id), '[]'::jsonb),
    'ip_hashes', coalesce((
      select jsonb_agg(distinct x.ip_hash)
        from public.comments x
       where x.user_id = p.id and x.ip_hash is not null), '[]'::jsonb)
  ) into v
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.cities c on c.id = p.city_id
  where p.id = p_user_id;

  if v is null then
    raise exception 'Kullanici bulunamadi' using errcode = 'P0002';
  end if;
  return v;
end; $$;

revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ============================================================
-- 5. MEDYA KİTAPLIĞI
--
--  Yöneticinin elle yüklediği görseller. Bot medyası
--  `media` tablosunda; bu ayrı çünkü habere bağlı değil.
-- ============================================================
create table if not exists public.library_media (
  id          uuid primary key default gen_random_uuid(),
  storage_key text not null unique,
  file_name   text not null,
  mime_type   text not null,
  bytes       bigint not null default 0,
  width       int,
  height      int,
  title       text,
  alt_text    text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint lib_name_len check (char_length(file_name) between 1 and 200)
);

create index if not exists library_media_time_idx on public.library_media (created_at desc);

alter table public.library_media enable row level security;
alter table public.library_media force  row level security;

drop policy if exists library_staff_read on public.library_media;
create policy library_staff_read on public.library_media
  for select using (public.is_staff());

revoke insert, update, delete on public.library_media from anon, authenticated;
grant select on public.library_media to authenticated;

create or replace function public.library_add(
  p_key text, p_name text, p_mime text, p_bytes bigint,
  p_width int default null, p_height int default null,
  p_title text default null, p_alt text default null
) returns public.library_media
language plpgsql security definer set search_path = ''
as $$
declare v_row public.library_media;
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if p_mime not in ('image/jpeg','image/png','image/webp','image/avif','image/gif') then
    raise exception 'Desteklenmeyen dosya turu' using errcode = '22023';
  end if;

  insert into public.library_media
    (storage_key, file_name, mime_type, bytes, width, height, title, alt_text, uploaded_by)
  values (p_key, left(p_name, 200), p_mime, p_bytes, p_width, p_height,
          nullif(trim(coalesce(p_title,'')), ''), nullif(trim(coalesce(p_alt,'')), ''),
          auth.uid())
  returning * into v_row;

  return v_row;
end; $$;

create or replace function public.library_delete(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_key text; v_owner uuid;
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  select storage_key, uploaded_by into v_key, v_owner
    from public.library_media where id = p_id;
  if v_key is null then
    raise exception 'Dosya bulunamadi' using errcode = 'P0002';
  end if;
  -- Editör yalnızca kendi yüklediğini siler; yönetici hepsini
  if v_owner is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Yalnizca kendi yukledigini silebilirsin' using errcode = '42501';
  end if;

  delete from public.library_media where id = p_id;
  return v_key;   -- çağıran dosyayı depodan da silsin
end; $$;

revoke all on function public.library_add(text,text,text,bigint,int,int,text,text) from public, anon;
revoke all on function public.library_delete(uuid) from public, anon;
grant execute on function public.library_add(text,text,text,bigint,int,int,text,text) to authenticated;
grant execute on function public.library_delete(uuid) to authenticated;

-- Medya kovası
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists library_public_read on storage.objects;
create policy library_public_read on storage.objects
  for select using (bucket_id = 'library');

drop policy if exists library_staff_write on storage.objects;
create policy library_staff_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library' and public.is_staff());

drop policy if exists library_staff_delete on storage.objects;
create policy library_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'library' and public.is_staff());

-- ============================================================
-- KONTROL
-- ============================================================
select 'YENI TABLOLAR' as rapor, table_name from information_schema.tables
 where table_schema='public' and table_name in ('ip_bans','library_media') order by 2;

select 'YENI RPC' as rapor, p.proname from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in
   ('delete_my_account','admin_delete_user','admin_ban_ip','admin_unban_ip',
    'is_ip_banned','admin_user_detail','library_add','library_delete')
 order by 2;

select 'MAIL VARSAYILANI' as rapor, is_enabled from public.mail_settings where id;

select 'Hesap yonetimi, IP yasagi ve medya kitapligi kuruldu.' as durum;

notify pgrst, 'reload schema';
