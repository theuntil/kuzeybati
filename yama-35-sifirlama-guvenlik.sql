-- ############################################################
--  YAMA 35 — ŞİFRE SIFIRLAMA GÜVENLİĞİ VE BEĞENİLENLER
--
--  DÜZELTİLEN
--    1. Kod ÖNCE doğrulanır, sonra şifre ekranına geçilir.
--       Eskiden kod ancak şifre yazıldıktan sonra kontrol
--       ediliyordu; kullanıcı yanlış kodla ilerleyip son adımda
--       hata alıyordu.
--    2. IP yasağı entegre: yasaklı IP'den HİÇBİR istek işlenmez.
--    3. Günde en fazla 5 sıfırlama — hem kullanıcı hem IP başına.
--    4. Kayıtsız adrese asla mail gitmez (zaten öyleydi,
--       artık sayaçla doğrulanabiliyor).
--
--  İKİ AŞAMALI AKIŞ
--    check_password_reset(email, code) → doğruysa TEK KULLANIMLIK
--      BİLET döner. Kod burada harcanır.
--    finish_password_reset(email, ticket) → bileti doğrular ve
--      kullanıcıyı döndürür. Şifreyi mail servisi değiştirir.
--
--    Bilet 10 dakika geçerli. Kod ile şifre arasındaki adımda
--    kodun tekrar sorulmasına gerek kalmıyor.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. BİLET ALANLARI
-- ============================================================
alter table public.password_resets
  add column if not exists ticket_hash text,
  add column if not exists ticket_expires_at timestamptz,
  add column if not exists verified_at timestamptz;

create index if not exists pw_reset_ticket_idx
  on public.password_resets (ticket_hash)
  where ticket_hash is not null;

-- ============================================================
-- 2. KOD ÜRETİMİ — IP YASAĞI VE GÜNLÜK SINIR
-- ============================================================
create or replace function public.create_password_reset(
  p_email text, p_ip_hash text default null
)
returns table (code text, email text, name text, locale text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid; v_name text; v_locale text; v_code text;
  v_mail text := lower(trim(coalesce(p_email, '')));
  v_day int; v_ip_day int;
begin
  /**
   * IP YASAĞI — İLK KONTROL.
   *
   * Yasaklı adresten gelen istek hiç işlenmez: kullanıcı
   * aranmaz, kod üretilmez, mail gönderilmez. Yönetici bir IP'yi
   * yasakladıysa o adres sistemle hiçbir şekilde etkileşemez.
   */
  if p_ip_hash is not null and public.is_ip_banned(p_ip_hash) then
    return;
  end if;

  select p.id, p.display_name, p.locale
    into v_uid, v_name, v_locale
    from public.profiles p
   where lower(p.email) = v_mail and p.is_active
   limit 1;

  -- Kayıtsız adres: sessizce çık. Mail GÖNDERİLMEZ.
  if v_uid is null then return; end if;

  -- Kullanıcı başına günde 5
  select count(*) into v_day from public.password_resets
   where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_day >= 5 then return; end if;

  -- IP başına günde 5: aynı kişi farklı adreslerle deneyemesin
  if p_ip_hash is not null then
    select count(*) into v_ip_day from public.password_resets
     where ip_hash = p_ip_hash and created_at > now() - interval '24 hours';
    if v_ip_day >= 5 then return; end if;
  end if;

  -- Önceki kodları geçersiz kıl
  update public.password_resets set used_at = now()
   where user_id = v_uid and used_at is null;

  v_code := public.kb_code6();

  insert into public.password_resets (user_id, email, code_hash, ip_hash)
  values (v_uid, v_mail, public.kb_hash(v_code), p_ip_hash);

  return query select v_code, v_mail, v_name, coalesce(v_locale, 'tr');
end; $$;

-- ============================================================
-- 3. KOD DOĞRULAMA → BİLET
--
--  Kod BURADA kontrol edilir. Yanlışsa kullanıcı sonraki adıma
--  geçemez. Doğruysa kod harcanır ve 10 dakikalık bilet verilir.
-- ============================================================
create or replace function public.check_password_reset(
  p_email text, p_code text, p_ip_hash text default null
)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_row public.password_resets; v_ticket text;
begin
  if p_ip_hash is not null and public.is_ip_banned(p_ip_hash) then
    return null;
  end if;

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

  -- Kod doğru: harca ve bilet ver
  v_ticket := public.kb_token();
  update public.password_resets
     set used_at = now(), verified_at = now(),
         ticket_hash = public.kb_hash(v_ticket),
         ticket_expires_at = now() + interval '10 minutes'
   where id = v_row.id;

  return v_ticket;
end; $$;

-- ============================================================
-- 4. BİLETLE BİTİRME
-- ============================================================
create or replace function public.finish_password_reset(
  p_email text, p_ticket text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_row public.password_resets;
begin
  select * into v_row from public.password_resets
   where email = lower(trim(coalesce(p_email, '')))
     and ticket_hash = public.kb_hash(coalesce(p_ticket, ''))
     and ticket_expires_at > now()
   limit 1;

  if not found then return null; end if;

  -- Bilet tek kullanımlık
  update public.password_resets
     set ticket_hash = null, ticket_expires_at = null
   where id = v_row.id;

  return v_row.user_id;
end; $$;

revoke all on function public.create_password_reset(text,text) from public, anon, authenticated;
revoke all on function public.check_password_reset(text,text,text) from public, anon, authenticated;
revoke all on function public.finish_password_reset(text,text) from public, anon, authenticated;
grant execute on function public.create_password_reset(text,text) to service_role;
grant execute on function public.check_password_reset(text,text,text) to service_role;
grant execute on function public.finish_password_reset(text,text) to service_role;

-- ============================================================
-- 5. DOĞRULAMA KODU — 2 DAKİKA BEKLEME
--
--  Kullanıcı iki dakikada bir yeni kod isteyebilir. Saatlik
--  tavan (5) korunuyor; bu ek kural arka arkaya basmayı önler.
-- ============================================================
drop function if exists public.request_email_verification();
create function public.request_email_verification()
returns table (code text, token text, email text, name text,
               locale text, retry_after int)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_name text; v_locale text;
  v_code text; v_token text; v_recent int; v_last timestamptz;
  v_wait int;
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

  -- İki dakika kuralı
  select max(created_at) into v_last from public.email_verifications
   where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '2 minutes' then
    v_wait := ceil(extract(epoch from (v_last + interval '2 minutes' - now())));
    raise exception 'Yeni kod icin % saniye bekle', v_wait
      using errcode = '22023';
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

  return query select v_code, v_token, v_email, v_name,
                      coalesce(v_locale, 'tr'), 120;
end; $$;

revoke all on function public.request_email_verification() from public, anon;
grant execute on function public.request_email_verification() to authenticated;

-- ============================================================
-- 6. BEĞENİLENLER
-- ============================================================
create or replace view public.my_likes
with (security_invoker = true) as
select l.created_at as liked_at, a.*
  from public.article_likes l
  join public.public_articles a on a.id = l.article_id
 where l.user_id = auth.uid();

grant select on public.my_likes to authenticated;
grant select on public.article_likes to authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'YENI RPC' as rapor, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public'
   and p.proname in ('check_password_reset','finish_password_reset',
                     'create_password_reset','request_email_verification')
 order by 2;

select 'BEGENILENLER GORUNUMU' as rapor,
       count(*) as var from information_schema.views
 where table_schema='public' and table_name='my_likes';

select 'Sifirlama guvenligi ve begenilenler kuruldu.' as durum;

notify pgrst, 'reload schema';
