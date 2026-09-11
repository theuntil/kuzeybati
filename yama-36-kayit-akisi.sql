-- ############################################################
--  YAMA 36 — OTOMATİK GİRİŞ VE E-POSTA KONTROLÜ
--
--  1. KAYIT SONRASI OTOMATİK GİRİŞ
--     Supabase'de "Confirm email" AÇIKSA `signUp` oturum
--     döndürmez ve kullanıcı giriş ekranına atılır. Bizim kendi
--     doğrulama sistemimiz var, Supabase'inki gereksiz.
--
--     `can_autoconfirm` yeni açılmış ve henüz doğrulanmamış bir
--     hesabı işaretler; mail servisi Admin API ile onaylar ve
--     kullanıcı hemen giriş yapabilir.
--
--     SINIR: yalnızca son 2 DAKİKADA açılmış hesaplar. Böylece
--     bu uç ele geçirilse bile eski hesaplar onaylanamaz.
--
--  2. E-POSTA KAYITLI MI
--     Şifre sıfırlamada kayıtsız adresle ilerlenmemeli.
--     `email_registered` yalnızca service_role'e açık; mail
--     servisi üzerinden, sıkı hız sınırıyla sorulur.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. OTOMATİK ONAY UYGUNLUĞU
-- ============================================================
create or replace function public.can_autoconfirm(p_email text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  select u.id into v_id
    from auth.users u
   where lower(u.email) = lower(trim(coalesce(p_email, '')))
     and u.email_confirmed_at is null
     -- YALNIZCA yeni açılmış hesap: eski hesap onaylanamaz
     and u.created_at > now() - interval '2 minutes'
   limit 1;

  return v_id;
end; $$;

revoke all on function public.can_autoconfirm(text) from public, anon, authenticated;
grant execute on function public.can_autoconfirm(text) to service_role;

-- ============================================================
-- 2. E-POSTA KAYITLI MI
--
--  Bu bir SAYIM ORACLE'ı: adres listesi taranarak kimlerin üye
--  olduğu öğrenilebilir. Bu yüzden:
--    • yalnızca service_role çağırabilir (site doğrudan çağıramaz)
--    • mail servisinde IP başına dakikada 5 istekle sınırlı
--    • yasaklı IP'den hiç sorulmaz
-- ============================================================
create or replace function public.email_registered(
  p_email text, p_ip_hash text default null
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_ip_hash is not null and public.is_ip_banned(p_ip_hash) then
    return false;
  end if;

  return exists (
    select 1 from public.profiles
     where lower(email) = lower(trim(coalesce(p_email, '')))
       and is_active);
end; $$;

revoke all on function public.email_registered(text,text) from public, anon, authenticated;
grant execute on function public.email_registered(text,text) to service_role;

-- ============================================================
-- 3. E-POSTA DEĞİŞTİRME
--
--  Yeni adrese kod gönderilir; doğrulanınca adres değişir.
--  Adres AÇIK olarak beklemede tutulur ama kod özetlenir.
-- ============================================================
create table if not exists public.email_changes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  new_email  text not null,
  code_hash  text not null,
  attempts   int not null default 0,
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint email_change_format
    check (new_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists email_change_lookup_idx
  on public.email_changes (user_id, used_at, expires_at);

alter table public.email_changes enable row level security;
alter table public.email_changes force  row level security;
revoke all on public.email_changes from anon, authenticated;

create or replace function public.request_email_change(p_new_email text)
returns table (code text, email text, name text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_mail text := lower(trim(coalesce(p_new_email, '')));
  v_name text; v_code text; v_last timestamptz; v_recent int;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;
  if v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Gecersiz e-posta' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where lower(email) = v_mail) then
    raise exception 'Bu adres baska bir hesapta kullaniliyor' using errcode = '23505';
  end if;

  select max(created_at) into v_last from public.email_changes where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '2 minutes' then
    raise exception 'Yeni kod icin % saniye bekle',
      ceil(extract(epoch from (v_last + interval '2 minutes' - now())))
      using errcode = '22023';
  end if;

  select count(*) into v_recent from public.email_changes
   where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= 5 then
    raise exception 'Gunluk degistirme siniri asildi' using errcode = '22023';
  end if;

  update public.email_changes set used_at = now()
   where user_id = v_uid and used_at is null;

  select display_name into v_name from public.profiles where id = v_uid;
  v_code := public.kb_code6();

  insert into public.email_changes (user_id, new_email, code_hash)
  values (v_uid, v_mail, public.kb_hash(v_code));

  return query select v_code, v_mail, v_name;
end; $$;

/**
 * Kod doğruysa adres değişir.
 *
 * `auth.users` GÜNCELLENMEZ — Supabase'in kendi mantığını
 * atlamamak için onu mail servisi Admin API ile yapar. Burada
 * yalnızca doğrulama yapılıp yeni adres döndürülür.
 */
create or replace function public.verify_email_change(p_code text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.email_changes;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  select * into v_row from public.email_changes
   where user_id = v_uid and used_at is null and expires_at > now()
   order by created_at desc limit 1;

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

  update public.profiles
     set email = v_row.new_email,
         email_verified_at = now(),   -- kodla doğrulandı
         updated_at = now()
   where id = v_uid;

  return v_row.new_email;
end; $$;

revoke all on function public.request_email_change(text) from public, anon;
revoke all on function public.verify_email_change(text) from public, anon;
grant execute on function public.request_email_change(text) to authenticated;
grant execute on function public.verify_email_change(text) to authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'YENI RPC' as rapor, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public'
   and p.proname in ('can_autoconfirm','email_registered',
                     'request_email_change','verify_email_change')
 order by 2;

select 'Kayit akisi ve e-posta degistirme kuruldu.' as durum;

notify pgrst, 'reload schema';
