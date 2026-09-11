-- ############################################################
--  YAMA 32 — 6 HANELİ KOD İLE DOĞRULAMA VE ŞİFRE SIFIRLAMA
--
--  DEĞİŞEN NE
--    Eskiden yalnızca bağlantı vardı. Artık mailde 6 HANELİK KOD
--    gidiyor; kullanıcı kodu ekrana giriyor. Bağlantı da çalışmaya
--    devam ediyor (maili telefonda açıp masaüstünde girmek zor).
--
--  KUYRUK KALDIRILDI
--    Doğrulama ve şifre sıfırlama maili kullanıcının EKRANDA
--    BEKLEDİĞİ mailler. 15 saniyelik kuyruk turu burada yanlış:
--    doğrudan gönderiliyor. Kuyruk yalnızca toplu gönderim
--    (bülten) için duruyor.
--
--  GÜVENLİK
--    • Kod veritabanında AÇIK saklanmaz, SHA-256 özeti tutulur
--    • 6 hane = 1.000.000 ihtimal; 5 yanlış denemede kod yanar
--    • 15 dakika geçerli
--    • Şifre sıfırlamada e-postanın varlığı SIZDIRILMAZ
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. KOD ÜRETİMİ
--
--  `random()` KULLANILMAZ: tahmin edilebilir bir üreteç.
--  `gen_random_uuid()` kriptografik kaynaktan gelir.
-- ============================================================
create or replace function public.kb_code6()
returns text language sql volatile set search_path = ''
as $$
  select lpad(
    ((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint)
      % 1000000)::text,
    6, '0');
$$;

-- ============================================================
-- 2. E-POSTA DOĞRULAMA — KOD + BAĞLANTI
-- ============================================================
alter table public.email_verifications
  add column if not exists code_hash text,
  add column if not exists attempts  int not null default 0;

create index if not exists email_ver_lookup_idx
  on public.email_verifications (user_id, used_at, expires_at);

/**
 * Doğrulama isteği.
 *
 * Kodu ÇAĞIRANA döndürür. Çağıran sunucu tarafıdır ve kodu
 * doğrudan mail servisine iletir. Kod kullanıcının KENDİ
 * adresine gittiği için bu bir sızıntı değil; kullanıcı zaten
 * birazdan onu mailinde görecek.
 *
 * Saatte 5 istek: kod yağmuruyla kota tüketilmesin.
 */
/**
 * Dönüş tipi değiştiği için önce düşürülmeli:
 * "cannot change return type of existing function".
 * yama-30'da `returns text` idi, artık satır döndürüyor.
 */
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

  select u.email, p.display_name, p.locale
    into v_email, v_name, v_locale
    from auth.users u join public.profiles p on p.id = u.id
   where u.id = v_uid;

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

  -- Önceki kodlar geçersiz olsun: aynı anda iki geçerli kod olmasın
  update public.email_verifications
     set used_at = now()
   where user_id = v_uid and used_at is null;

  v_code  := public.kb_code6();
  v_token := public.kb_token();

  insert into public.email_verifications
         (user_id, email, token_hash, code_hash, expires_at)
  values (v_uid, v_email, public.kb_hash(v_token), public.kb_hash(v_code),
          now() + interval '15 minutes');

  return query select v_code, v_token, v_email, v_name, coalesce(v_locale, 'tr');
end; $$;

/**
 * Kodla doğrulama.
 *
 * Her yanlış deneme sayılır; 5'te kod yanar. Böylece 1.000.000
 * ihtimali deneyerek kırmak mümkün olmaz.
 */
create or replace function public.verify_email_code(p_code text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.email_verifications;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  select * into v_row from public.email_verifications
   where user_id = v_uid and used_at is null and expires_at > now()
   order by created_at desc limit 1;

  if not found then return false; end if;

  if v_row.attempts >= 5 then
    update public.email_verifications set used_at = now() where id = v_row.id;
    raise exception 'Cok fazla yanlis deneme, yeni kod iste' using errcode = '22023';
  end if;

  if v_row.code_hash is distinct from public.kb_hash(trim(coalesce(p_code, ''))) then
    update public.email_verifications set attempts = attempts + 1 where id = v_row.id;
    return false;
  end if;

  update public.email_verifications set used_at = now() where id = v_row.id;
  update public.profiles
     set email_verified_at = now(), updated_at = now()
   where id = v_uid;
  return true;
end; $$;

revoke all on function public.request_email_verification() from public, anon;
revoke all on function public.verify_email_code(text) from public, anon;
grant execute on function public.request_email_verification() to authenticated;
grant execute on function public.verify_email_code(text) to authenticated;

-- ============================================================
-- 3. ŞİFRE SIFIRLAMA
--
--  E-POSTANIN VARLIĞI SIZDIRILMAZ: olmayan adres için de aynı
--  yanıt döner. Aksi hâlde adres listesi taranarak hangi
--  e-postaların kayıtlı olduğu öğrenilebilir.
-- ============================================================
create table if not exists public.password_resets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  email      text not null,
  code_hash  text not null,
  attempts   int not null default 0,
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at    timestamptz,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create index if not exists pw_reset_lookup_idx
  on public.password_resets (email, used_at, expires_at);

alter table public.password_resets enable row level security;
alter table public.password_resets force  row level security;
revoke all on public.password_resets from anon, authenticated;

/**
 * Sıfırlama kodu üret.
 *
 * YALNIZCA service_role çağırabilir — mail servisi. Web bu
 * fonksiyonu çağıramaz, dolayısıyla kodu hiç görmez.
 *
 * Kayıt yoksa NULL döner; çağıran yine "gönderildi" der.
 */
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
  select u.id, p.display_name, p.locale
    into v_uid, v_name, v_locale
    from auth.users u join public.profiles p on p.id = u.id
   where lower(u.email) = v_mail and p.is_active
   limit 1;

  if v_uid is null then return; end if;   -- kayıt yok: sessizce boş dön

  select count(*) into v_recent from public.password_resets
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 5 then return; end if;   -- hız sınırı: yine sessiz

  update public.password_resets set used_at = now()
   where user_id = v_uid and used_at is null;

  v_code := public.kb_code6();

  insert into public.password_resets (user_id, email, code_hash, ip_hash)
  values (v_uid, v_mail, public.kb_hash(v_code), p_ip_hash);

  return query select v_code, v_mail, v_name, coalesce(v_locale, 'tr');
end; $$;

/**
 * Kodu doğrula ve şifre değiştirilecek kullanıcıyı döndür.
 *
 * Şifreyi BU FONKSİYON DEĞİŞTİRMEZ: auth.users'a doğrudan yazmak
 * Supabase'in şifreleme ve oturum mantığını atlar. Değiştirme
 * işini mail servisi Admin API ile yapar.
 */
create or replace function public.consume_password_reset(
  p_email text, p_code text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_row public.password_resets;
begin
  select * into v_row from public.password_resets
   where email = lower(trim(coalesce(p_email, '')))
     and used_at is null and expires_at > now()
   order by created_at desc limit 1;

  if not found then return null; end if;

  if v_row.attempts >= 5 then
    update public.password_resets set used_at = now() where id = v_row.id;
    return null;
  end if;

  if v_row.code_hash is distinct from public.kb_hash(trim(coalesce(p_code, ''))) then
    update public.password_resets set attempts = attempts + 1 where id = v_row.id;
    return null;
  end if;

  update public.password_resets set used_at = now() where id = v_row.id;
  return v_row.user_id;
end; $$;

revoke all on function public.create_password_reset(text,text) from public, anon, authenticated;
revoke all on function public.consume_password_reset(text,text) from public, anon, authenticated;
grant execute on function public.create_password_reset(text,text) to service_role;
grant execute on function public.consume_password_reset(text,text) to service_role;

-- ============================================================
-- 4. PROFİL GÜNCELLEME (hesabım sayfası)
--
--  Ad, soyad ve şehir kullanıcı tarafından değiştirilebilir.
--  Görünen ad ad+soyaddan türetilir; ayrı alan tutmak ikisinin
--  birbirinden kopmasına yol açardı.
-- ============================================================
create or replace function public.update_my_profile(
  p_first_name text default null,
  p_last_name  text default null,
  p_city_slug  text default null,
  p_bio        text default null
)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_city uuid; v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  if p_city_slug is not null then
    select id into v_city from public.cities
     where slug = p_city_slug and is_active limit 1;
    if v_city is null then
      raise exception 'Gecersiz sehir' using errcode = '22023';
    end if;
  end if;

  if p_first_name is not null and nullif(trim(p_first_name), '') is null then
    raise exception 'Ad bos olamaz' using errcode = '22023';
  end if;

  update public.profiles p set
    first_name = coalesce(nullif(trim(p_first_name), ''), p.first_name),
    last_name  = case when p_last_name is null then p.last_name
                      else nullif(left(trim(p_last_name), 40), '') end,
    city_id    = coalesce(v_city, p.city_id),
    bio        = case when p_bio is null then p.bio
                      else nullif(left(trim(p_bio), 1000), '') end,
    display_name = left(coalesce(
      nullif(trim(concat_ws(' ',
        coalesce(nullif(trim(p_first_name), ''), p.first_name),
        case when p_last_name is null then p.last_name
             else nullif(trim(p_last_name), '') end)), ''),
      p.display_name), 80),
    updated_at = now()
  where p.id = v_uid
  returning * into v_row;

  return v_row;
end; $$;

revoke all on function public.update_my_profile(text,text,text,text) from public, anon;
grant execute on function public.update_my_profile(text,text,text,text) to authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'KOD TESTI' as rapor, public.kb_code6() as ornek,
       length(public.kb_code6()) = 6 as alti_hane;

select 'YENI RPC' as rapor, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('kb_code6','verify_email_code','create_password_reset',
                     'consume_password_reset','update_my_profile')
 order by 2;

select 'Kod dogrulama ve sifre sifirlama kuruldu.' as durum;

notify pgrst, 'reload schema';
