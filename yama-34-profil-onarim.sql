-- ############################################################
--  YAMA 34 — PROFİL ONARIMI (KRİTİK)
--
--  BULUNAN HATA
--    `my_profile` görünümü e-posta için `auth.users`a bağlanıyor
--    ve `security_invoker = true` ile çalışıyordu. `authenticated`
--    rolü `auth.users`ı OKUYAMAZ:
--
--      ERROR: permission denied for table users
--
--    Görünüm tamamen çöküyordu. Hesabım sayfası profili `null`
--    alıyor, tüm alanlar BOŞ görünüyordu. Kaydetme çalışıyordu
--    (RPC security definer) ama sayfa yenilenince yine boştu —
--    kullanıcının gördüğü tam olarak buydu.
--
--  ÇÖZÜM
--    E-posta `profiles` tablosunda tutulur, trigger ile
--    `auth.users`tan senkronlanır. Görünümler artık `auth.users`a
--    hiç dokunmuyor. Hem hata biter hem sorgu hızlanır.
--
--  AYRICA
--    • Kapak fotoğrafı (profil arka planı)
--    • `admin_users` da aynı hatadan etkileniyordu, düzeltildi
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. E-POSTA VE KAPAK ALANLARI
-- ============================================================
alter table public.profiles
  add column if not exists email     text,
  add column if not exists cover_key text;

create index if not exists profiles_email_idx on public.profiles (lower(email));

comment on column public.profiles.email is
'auth.users.email kopyası. Görünümler auth.users okuyamadığı için burada tutulur; trigger senkronlar.';

-- ============================================================
-- 2. E-POSTA SENKRONU
-- ============================================================
create or replace function public.tg_sync_profile_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email, updated_at = now()
   where id = new.id
     and email is distinct from new.email;
  return null;
end; $$;

drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email
  after insert or update of email on auth.users
  for each row execute function public.tg_sync_profile_email();

-- Mevcut kayıtları doldur
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- Yeni kullanıcıda profil açılırken e-posta da yazılsın
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
    (id, role, display_name, username, first_name, last_name, city_id,
     avatar_url, email, locale, onboarded_at)
  values (
    new.id, 'reader', left(v_display, 80),
    public.generate_username(new.email),
    v_first, v_last, v_city,
    nullif(m->>'avatar_url', ''),
    new.email,
    coalesce(nullif(m->>'locale',''), 'tr'),
    case when v_first is not null and v_city is not null then now() else null end)
  on conflict (id) do update
    set email = excluded.email,
        -- Profil zaten varsa ad bilgisini EZME; kullanıcı
        -- sonradan değiştirmiş olabilir
        first_name = coalesce(public.profiles.first_name, excluded.first_name),
        last_name  = coalesce(public.profiles.last_name,  excluded.last_name);

  return new;
end; $$;

-- ============================================================
-- 3. TABLO YETKİSİ — İKİNCİ HATA
--
--  `profiles` tablosunda `authenticated` rolüne yalnızca UPDATE
--  verilmişti, SELECT YOKTU. RLS politikası olsa bile tablo
--  yetkisi olmadan okuma yapılamaz:
--
--    ERROR: permission denied for table profiles
--
--  Bu yüzden profil bilgisini okuyan HER görünüm çöküyordu.
--
--  E-POSTA HARİÇ tutuluyor: kolon bazlı yetki veriliyor. Aksi
--  hâlde herkes tüm kullanıcıların e-postasını okuyabilirdi.
-- ============================================================
grant select (
  id, role, display_name, username, first_name, last_name,
  avatar_key, avatar_url, cover_key, bio, title, social_links,
  locale, is_active, created_at, city_id, email_verified_at
) on public.profiles to anon, authenticated;

-- ============================================================
-- 4. GÖRÜNÜMLER
--
--  `security_invoker` KALDIRILDI (yani tanımlayıcı hakkıyla
--  çalışıyorlar). Sebebi: e-posta kolonu kimseye açık değil ama
--  kullanıcının KENDİ e-postasını görmesi gerekiyor.
--
--  Güvenlik WHERE koşuluyla sağlanıyor:
--    my_profile  → `p.id = auth.uid()`  (yalnızca kendi satırı)
--    admin_users → `public.is_admin()`  (yalnızca yönetici)
--
--  Bu koşullar atlanamaz; görünüm başka satır döndüremez.
-- ============================================================
drop view if exists public.my_profile;
create view public.my_profile as
select p.id, p.role, p.display_name, p.username,
       p.first_name, p.last_name, p.email,
       p.avatar_key, p.avatar_url, p.cover_key, p.bio, p.locale,
       p.is_active, p.onboarded_at, p.created_at,
       p.email_verified_at, p.username_changed_at,
       c.slug as city_slug, c.name as city_name
  from public.profiles p
  left join public.cities c on c.id = p.city_id
 where p.id = auth.uid();

grant select on public.my_profile to authenticated;

drop view if exists public.admin_users;
create view public.admin_users as
select p.id, p.role, p.display_name, p.username,
       p.first_name, p.last_name, p.is_active, p.email,
       p.created_at, p.last_seen_at, p.onboarded_at,
       ci.name as city_name,
       (select count(*) from public.comments c
         where c.user_id = p.id and c.status <> 'deleted') as comment_count,
       (select count(*) from public.articles a
         where a.author_id = p.id and a.deleted_at is null) as article_count
  from public.profiles p
  left join public.cities ci on ci.id = p.city_id
 where public.is_admin();

grant select on public.admin_users to authenticated;

-- Kullanıcı detayı da profiles.email kullanacak
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'username', p.username,
    'first_name', p.first_name, 'last_name', p.last_name,
    'email', p.email, 'role', p.role, 'is_active', p.is_active,
    'created_at', p.created_at, 'last_seen_at', p.last_seen_at,
    'email_verified_at', p.email_verified_at,
    'city_name', c.name, 'avatar_key', p.avatar_key,
    'avatar_url', p.avatar_url, 'cover_key', p.cover_key,
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
      select jsonb_agg(distinct x.ip_hash) from public.comments x
       where x.user_id = p.id and x.ip_hash is not null), '[]'::jsonb)
  ) into v
  from public.profiles p
  left join public.cities c on c.id = p.city_id
  where p.id = p_user_id;

  if v is null then
    raise exception 'Kullanici bulunamadi' using errcode = 'P0002';
  end if;
  return v;
end; $$;

-- Doğrulama isteği de profiles.email kullansın
drop function if exists public.request_email_verification();
create function public.request_email_verification()
returns table (code text, token text, email text, name text, locale text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_name text; v_locale text;
  v_code text; v_token text; v_recent int;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  select p.email, p.display_name, p.locale
    into v_email, v_name, v_locale
    from public.profiles p where p.id = v_uid;

  if v_email is null then
    raise exception 'E-posta bulunamadi' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles
              where id = v_uid and email_verified_at is not null) then
    raise exception 'Zaten dogrulanmis' using errcode = '22023';
  end if;

  select count(*) into v_recent from public.email_verifications
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Cok fazla istek, bir saat sonra tekrar dene' using errcode = '22023';
  end if;

  update public.email_verifications set used_at = now()
   where user_id = v_uid and used_at is null;

  v_code  := public.kb_code6();
  v_token := public.kb_token();

  insert into public.email_verifications
         (user_id, email, token_hash, code_hash, expires_at)
  values (v_uid, v_email, public.kb_hash(v_token), public.kb_hash(v_code),
          now() + interval '15 minutes');

  return query select v_code, v_token, v_email, v_name, coalesce(v_locale, 'tr');
end; $$;

revoke all on function public.request_email_verification() from public, anon;
grant execute on function public.request_email_verification() to authenticated;

-- Şifre sıfırlama da profiles.email üzerinden
create or replace function public.create_password_reset(
  p_email text, p_ip_hash text default null
)
returns table (code text, email text, name text, locale text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid; v_name text; v_locale text; v_code text;
  v_mail text := lower(trim(coalesce(p_email, '')));
  v_recent int;
begin
  select p.id, p.display_name, p.locale
    into v_uid, v_name, v_locale
    from public.profiles p
   where lower(p.email) = v_mail and p.is_active
   limit 1;

  if v_uid is null then return; end if;

  select count(*) into v_recent from public.password_resets
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 5 then return; end if;

  update public.password_resets set used_at = now()
   where user_id = v_uid and used_at is null;

  v_code := public.kb_code6();
  insert into public.password_resets (user_id, email, code_hash, ip_hash)
  values (v_uid, v_mail, public.kb_hash(v_code), p_ip_hash);

  return query select v_code, v_mail, v_name, coalesce(v_locale, 'tr');
end; $$;

revoke all on function public.create_password_reset(text,text) from public, anon, authenticated;
grant execute on function public.create_password_reset(text,text) to service_role;

-- ============================================================
-- 5. KAPAK FOTOĞRAFI
-- ============================================================
create or replace function public.set_cover(p_key text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;
  -- Yol kendi klasörünü göstermeli
  if p_key is not null and p_key !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,80}$') then
    raise exception 'Gecersiz dosya yolu' using errcode = '22023';
  end if;

  update public.profiles set cover_key = p_key, updated_at = now()
   where id = v_uid;
end; $$;

revoke all on function public.set_cover(text) from public, anon;
grant execute on function public.set_cover(text) to authenticated;

-- Kapak da avatars kovasında; aynı politikalar geçerli

-- ============================================================
-- KONTROL
-- ============================================================
select 'PROFIL EPOSTA' as rapor,
       count(*) as toplam,
       count(email) as eposta_dolu
  from public.profiles;

select 'GORUNUM auth.users KULLANIYOR MU' as rapor,
       count(*) as sorunlu_gorunum
  from pg_views
 where schemaname = 'public'
   and viewname in ('my_profile','admin_users')
   and definition ilike '%auth.users%';

select 'PROFILES SELECT YETKISI' as rapor, count(*) as kolon
  from information_schema.column_privileges
 where table_schema='public' and table_name='profiles'
   and grantee='authenticated' and privilege_type='SELECT';

select 'Profil onarimi tamamlandi.' as durum;

notify pgrst, 'reload schema';
