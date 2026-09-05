-- ############################################################
--  YAMA 30 — MAİL SERVİSİ, PROFİL VE KULLANICI ADI
--
--  KAPSAM
--    • Mail kuyruğu + ayarları (panelden aç/kapat)
--    • E-posta doğrulama — ZORUNLU DEĞİL, isteğe bağlı
--    • Profil fotoğrafı (Supabase Storage)
--    • Kullanıcı adı değiştirme (kural + benzersizlik)
--
--  TASARIM
--    Mail GÖNDERİMİ veritabanında değil, ayrı bir serviste.
--    Buradaki kuyruk sadece "ne gönderilecek"i tutar; servis
--    `mail_claim_jobs` ile kilitleyip alır, gönderir, sonucu
--    yazar. Böylece SMTP kimliği siteye hiç girmez ve servis
--    ayrı ölçeklenir.
--
--    Doğrulama ZORUNLU DEĞİL: doğrulamamış kullanıcı da yorum
--    yapar, haber kaydeder. Doğrulama yalnızca rozet ve ileride
--    bülten/bildirim izni için.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. MAİL AYARLARI (tek satır, panelden yönetilir)
-- ============================================================
create table if not exists public.mail_settings (
  id           boolean primary key default true,
  is_enabled   boolean not null default false,
  from_name    text    not null default 'Kuzeybatı Haber',
  from_email   text    not null default 'noreply@kuzeybatihaber.com.tr',
  reply_to     text,
  -- Servisin bir turda alacağı en fazla iş
  batch_size   int     not null default 20,
  -- Günlük gönderim tavanı: sağlayıcı kotasını aşma koruması
  daily_limit  int     not null default 2000,
  sent_today   int     not null default 0,
  day_stamp    date    not null default current_date,
  -- Hangi tür mailler açık
  send_verification boolean not null default true,
  send_welcome      boolean not null default true,
  send_newsletter   boolean not null default false,
  updated_at   timestamptz not null default now(),
  constraint mail_settings_one_row check (id),
  constraint mail_batch_range check (batch_size between 1 and 200),
  constraint mail_daily_range check (daily_limit between 0 and 200000)
);

insert into public.mail_settings (id) values (true) on conflict (id) do nothing;

-- ============================================================
-- 2. MAİL KUYRUĞU
-- ============================================================
do $$ begin
  create type public.mail_status as enum ('pending','sending','sent','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.mail_queue (
  id          uuid primary key default gen_random_uuid(),
  to_email    text not null,
  to_name     text,
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  locale      text not null default 'tr',

  status      public.mail_status not null default 'pending',
  attempts    int not null default 0,
  max_attempts int not null default 3,
  next_try_at timestamptz not null default now(),
  last_error  text,

  -- Servis işi kilitlerken doldurur; çökerse süre dolunca serbest kalır
  locked_by   text,
  locked_at   timestamptz,

  user_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,

  constraint mail_email_format check (to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint mail_template_len check (char_length(template) between 2 and 40)
);

create index if not exists mail_queue_pick_idx
  on public.mail_queue (next_try_at)
  where status = 'pending';
create index if not exists mail_queue_status_idx
  on public.mail_queue (status, created_at desc);

-- Aynı kullanıcıya aynı şablonu üst üste kuyruğa almayı engelle
create unique index if not exists mail_queue_dedupe_idx
  on public.mail_queue (user_id, template)
  where status = 'pending' and user_id is not null;

-- ============================================================
-- 3. KUYRUĞA EKLEME
--
--  Site ve trigger'lar bunu çağırır. Mail kapalıysa ya da o tür
--  kapalıysa sessizce hiçbir şey yapmaz — çağıran yerin ayarı
--  bilmesi gerekmesin.
-- ============================================================
create or replace function public.mail_enqueue(
  p_template text,
  p_to       text,
  p_payload  jsonb default '{}'::jsonb,
  p_user_id  uuid  default null,
  p_locale   text  default 'tr',
  p_to_name  text  default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare s public.mail_settings; v_id uuid;
begin
  select * into s from public.mail_settings where id;
  if not found or not s.is_enabled then return null; end if;

  if p_template = 'verify_email'  and not s.send_verification then return null; end if;
  if p_template = 'welcome'       and not s.send_welcome      then return null; end if;
  if p_template = 'newsletter'    and not s.send_newsletter   then return null; end if;

  insert into public.mail_queue (to_email, to_name, template, payload, user_id, locale)
  values (lower(trim(p_to)), p_to_name, p_template,
          coalesce(p_payload,'{}'::jsonb), p_user_id, coalesce(p_locale,'tr'))
  on conflict do nothing
  returning id into v_id;

  return v_id;
end; $$;

revoke all on function public.mail_enqueue(text,text,jsonb,uuid,text,text) from public, anon, authenticated;
grant execute on function public.mail_enqueue(text,text,jsonb,uuid,text,text) to service_role;

-- ============================================================
-- 4. SERVİSİN İŞ ALMASI
--
--  `for update skip locked`: iki kopya aynı anda çalışsa bile
--  aynı maili iki kez göndermez.
-- ============================================================
create or replace function public.mail_claim_jobs(
  p_worker text,
  p_limit  int default null
)
returns setof public.mail_queue
language plpgsql security definer set search_path = ''
as $$
declare s public.mail_settings; v_limit int; v_left int;
begin
  select * into s from public.mail_settings where id;
  if not found or not s.is_enabled then return; end if;

  -- Gün değiştiyse sayaç sıfırlanır
  if s.day_stamp <> current_date then
    update public.mail_settings
       set sent_today = 0, day_stamp = current_date, updated_at = now()
     where id;
    s.sent_today := 0;
  end if;

  v_left := greatest(0, s.daily_limit - s.sent_today);
  if v_left = 0 then return; end if;

  v_limit := least(coalesce(p_limit, s.batch_size), s.batch_size, v_left);

  return query
  with pick as (
    select q.id from public.mail_queue q
     where q.status = 'pending'
       and q.next_try_at <= now()
     order by q.next_try_at
     limit v_limit
     for update skip locked
  )
  update public.mail_queue m
     set status = 'sending', locked_by = left(p_worker, 60), locked_at = now(),
         attempts = m.attempts + 1
    from pick
   where m.id = pick.id
  returning m.*;
end; $$;

create or replace function public.mail_finish_job(
  p_id uuid, p_ok boolean, p_error text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_ok then
    update public.mail_queue
       set status = 'sent', sent_at = now(), last_error = null,
           locked_by = null, locked_at = null
     where id = p_id;

    update public.mail_settings
       set sent_today = sent_today + 1, updated_at = now()
     where id;
  else
    update public.mail_queue
       set status = case when attempts >= max_attempts
                         then 'failed'::public.mail_status
                         else 'pending'::public.mail_status end,
           -- Üstel geri çekilme: 2dk, 8dk, 32dk
           next_try_at = now() + (power(4, attempts) * interval '30 seconds'),
           last_error = left(p_error, 500),
           locked_by = null, locked_at = null
     where id = p_id;
  end if;
end; $$;

/** Servis çökerse kilitli kalan işleri serbest bırakır */
create or replace function public.mail_recover_stuck(p_minutes int default 10)
returns int language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  update public.mail_queue
     set status = 'pending', locked_by = null, locked_at = null
   where status = 'sending'
     and locked_at < now() - make_interval(mins => p_minutes);
  get diagnostics n = row_count;
  return n;
end; $$;

revoke all on function public.mail_claim_jobs(text,int) from public, anon, authenticated;
revoke all on function public.mail_finish_job(uuid,boolean,text) from public, anon, authenticated;
revoke all on function public.mail_recover_stuck(int) from public, anon, authenticated;
grant execute on function public.mail_claim_jobs(text,int) to service_role;
grant execute on function public.mail_finish_job(uuid,boolean,text) to service_role;
grant execute on function public.mail_recover_stuck(int) to service_role;

-- ============================================================
-- 5. E-POSTA DOĞRULAMA — İSTEĞE BAĞLI
--
--  Doğrulamamış kullanıcı da yorum yapar, haber kaydeder.
--  Doğrulama yalnızca rozet ve ileride bülten/bildirim izni için.
-- ============================================================
alter table public.profiles
  add column if not exists email_verified_at timestamptz;

create table if not exists public.email_verifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  email      text not null,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_ver_user_idx
  on public.email_verifications (user_id, created_at desc);

/**
 * TOKEN ÜRETİMİ VE ÖZETİ — EKLENTİSİZ
 *
 * `gen_random_bytes` ve `digest` pgcrypto'ya ait. Supabase'de
 * eklenti `extensions` şemasında; fonksiyonlarımız
 * `search_path = ''` ile çalıştığı için bulunamıyor ve
 * "function gen_random_bytes(integer) does not exist" hatası
 * veriyordu.
 *
 * Çekirdek fonksiyonlarla çözülüyor: `gen_random_uuid()` (PG13+)
 * ve `sha256()` (PG11+). İki UUID = 256 bit rastgelelik, token
 * için fazlasıyla yeterli. Eklenti bağımlılığı kalmadı.
 */
create or replace function public.kb_token()
returns text language sql volatile set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.kb_hash(p_text text)
returns text language sql immutable set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_text, ''), 'UTF8')), 'hex');
$$;

/**
 * Doğrulama isteği.
 *
 * TOKEN AÇIK SAKLANMAZ — yalnızca SHA-256 özeti tutulur.
 * Veritabanı sızsa bile kimse başkasının bağlantısını üretemez.
 * Açık token yalnızca maile gider.
 *
 * Saatte en fazla 3 istek: kötüye kullanımla kota tüketilmesin.
 */
/**
 * ESKİ SÜRÜM — Bölüm O bunu 6 haneli kod döndürecek şekilde
 * yeniden tanımlıyor. Dönüş tipi değiştiği için orada önce
 * `drop function` var; burada da düşürülüyor ki bölümler
 * bağımsız çalıştırılabilsin.
 */
drop function if exists public.request_email_verification();
create function public.request_email_verification()
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_name text; v_locale text;
  v_token text; v_recent int;
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
  if exists (select 1 from public.profiles where id = v_uid and email_verified_at is not null) then
    raise exception 'Zaten dogrulanmis' using errcode = '22023';
  end if;

  select count(*) into v_recent from public.email_verifications
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 3 then
    raise exception 'Cok fazla istek, bir saat sonra tekrar dene' using errcode = '22023';
  end if;

  v_token := public.kb_token();

  insert into public.email_verifications (user_id, email, token_hash)
  values (v_uid, v_email, public.kb_hash(v_token));

  perform public.mail_enqueue(
    'verify_email', v_email,
    jsonb_build_object('token', v_token, 'name', v_name),
    v_uid, v_locale, v_name);

  -- Token çağırana DÖNMEZ; yalnızca maile gider.
  return 'queued';
end; $$;

create or replace function public.verify_email(p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_row public.email_verifications;
begin
  select * into v_row from public.email_verifications
   where token_hash = public.kb_hash(p_token)
     and used_at is null
     and expires_at > now()
   limit 1;

  if not found then return false; end if;

  update public.email_verifications set used_at = now() where id = v_row.id;
  update public.profiles
     set email_verified_at = now(), updated_at = now()
   where id = v_row.user_id;

  return true;
end; $$;

revoke all on function public.kb_token() from public, anon;
revoke all on function public.kb_hash(text) from public, anon;
revoke all on function public.request_email_verification() from public, anon;
grant execute on function public.request_email_verification() to authenticated;
-- Doğrulama bağlantısına oturumsuz da tıklanabilir
revoke all on function public.verify_email(text) from public;
grant execute on function public.verify_email(text) to anon, authenticated;

-- ============================================================
-- 6. KULLANICI ADI DEĞİŞTİRME
--
--  Kurallar: 3-24 karakter, küçük harf/rakam/tire, tire ile
--  başlayıp bitemez, ardışık tire olamaz, rezerve adlar yasak.
--  30 günde bir değiştirilebilir: kimlik karışıklığını önler.
-- ============================================================
alter table public.profiles
  add column if not exists username_changed_at timestamptz;

create or replace function public.change_username(p_username text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_new text := lower(trim(coalesce(p_username, '')));
  v_last timestamptz;
  reserved text[] := array['admin','administrator','root','system','api','www',
                           'moderator','mod','support','destek','yonetici',
                           'kuzeybati','kuzeybatihaber','haber','editor','null','undefined'];
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  -- Büyük harfle yazılan ad küçültülür (GitHub/X davranışı);
  -- "Mehmet" → "mehmet". Reddetmek yerine düzeltmek daha dostça.
  if char_length(v_new) < 3 or char_length(v_new) > 24 then
    raise exception 'Kullanici adi 3-24 karakter olmali' using errcode = '22023';
  end if;
  if v_new !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Yalnizca kucuk harf, rakam ve tire kullanilabilir' using errcode = '22023';
  end if;
  if v_new = any(reserved) then
    raise exception 'Bu kullanici adi kullanilamaz' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where username = v_new and id <> v_uid) then
    raise exception 'Bu kullanici adi alinmis' using errcode = '23505';
  end if;

  select username_changed_at into v_last from public.profiles where id = v_uid;
  if v_last is not null and v_last > now() - interval '30 days' then
    raise exception 'Kullanici adi 30 gunde bir degistirilebilir' using errcode = '22023';
  end if;

  update public.profiles
     set username = v_new, username_changed_at = now(), updated_at = now()
   where id = v_uid;

  return v_new;
end; $$;

/** Panelde/kayıtta anlık kontrol için — yalnızca müsaitlik döner */
create or replace function public.username_available(p_username text)
returns boolean language sql security definer set search_path = ''
as $$
  select lower(trim(coalesce(p_username,''))) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and char_length(trim(coalesce(p_username,''))) between 3 and 24
     and not exists (
       select 1 from public.profiles
        where username = lower(trim(p_username))
          and id is distinct from auth.uid());
$$;

revoke all on function public.change_username(text) from public, anon;
revoke all on function public.username_available(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;
grant execute on function public.username_available(text) to authenticated;

-- ============================================================
-- 7. PROFİL FOTOĞRAFI
--
--  Dosya Supabase Storage'da (`avatars` kovası). Veritabanı
--  yalnızca anahtarı tutar. Kullanıcı yalnızca KENDİ klasörüne
--  yazabilir: {user_id}/{dosya}
-- ============================================================
create or replace function public.set_avatar(p_key text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Giris gerekli' using errcode = '42501';
  end if;

  -- Anahtar kendi klasörünü göstermeli; başkasınınkini gösteremez
  if p_key is not null and p_key !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,80}$') then
    raise exception 'Gecersiz dosya yolu' using errcode = '22023';
  end if;

  update public.profiles
     set avatar_key = p_key, updated_at = now()
   where id = v_uid;
end; $$;

revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;

-- ============================================================
-- 8. PROFİL GÖRÜNÜMÜNÜ TAZELE
-- ============================================================
/**
 * `create or replace view` KOLON SIRASINI değiştiremez:
 *   cannot change name of view column "city_slug" to "email_verified_at"
 * Yeni kolonlar araya girdiği için önce düşürülüp yeniden kurulur.
 */
drop view if exists public.my_profile;
create view public.my_profile
with (security_invoker = true) as
select p.id, p.role, p.display_name, p.username, p.first_name, p.last_name,
       p.avatar_key, p.avatar_url, p.bio, p.locale, p.is_active,
       p.onboarded_at, p.created_at,
       p.email_verified_at, p.username_changed_at,
       c.slug as city_slug, c.name as city_name,
       u.email
  from public.profiles p
  left join public.cities c on c.id = p.city_id
  left join auth.users u on u.id = p.id
 where p.id = auth.uid();

grant select on public.my_profile to authenticated;

-- ============================================================
-- 9. RLS + YETKİLER
-- ============================================================
alter table public.mail_settings enable row level security;
alter table public.mail_settings force  row level security;
alter table public.mail_queue    enable row level security;
alter table public.mail_queue    force  row level security;
alter table public.email_verifications enable row level security;
alter table public.email_verifications force  row level security;

drop policy if exists mail_settings_admin on public.mail_settings;
create policy mail_settings_admin on public.mail_settings
  for select using (public.is_admin());

drop policy if exists mail_queue_admin on public.mail_queue;
create policy mail_queue_admin on public.mail_queue
  for select using (public.is_admin());

-- Doğrulama kayıtları KİMSEYE okutulmaz; yalnızca RPC üzerinden
revoke all on public.email_verifications from anon, authenticated;
revoke insert, update, delete on public.mail_settings from anon, authenticated;
revoke insert, update, delete on public.mail_queue    from anon, authenticated;
grant select on public.mail_settings to authenticated;
grant select on public.mail_queue    to authenticated;

-- ============================================================
-- 10. MAİL AYARLARI GÜNCELLEME (panel)
-- ============================================================
create or replace function public.admin_update_mail(p_patch jsonb)
returns public.mail_settings
language plpgsql security definer set search_path = ''
as $$
declare k text; v_row public.mail_settings;
  allowed text[] := array['is_enabled','from_name','from_email','reply_to',
                          'batch_size','daily_limit',
                          'send_verification','send_welcome','send_newsletter'];
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any(allowed)) then
      raise exception 'Bilinmeyen mail ayari: %', k using errcode = '22023';
    end if;
  end loop;

  update public.mail_settings s set
    is_enabled = coalesce((p_patch->>'is_enabled')::boolean, s.is_enabled),
    from_name  = coalesce(p_patch->>'from_name',  s.from_name),
    from_email = coalesce(p_patch->>'from_email', s.from_email),
    reply_to   = coalesce(p_patch->>'reply_to',   s.reply_to),
    batch_size = coalesce((p_patch->>'batch_size')::int, s.batch_size),
    daily_limit = coalesce((p_patch->>'daily_limit')::int, s.daily_limit),
    send_verification = coalesce((p_patch->>'send_verification')::boolean, s.send_verification),
    send_welcome = coalesce((p_patch->>'send_welcome')::boolean, s.send_welcome),
    send_newsletter = coalesce((p_patch->>'send_newsletter')::boolean, s.send_newsletter),
    updated_at = now()
  where s.id
  returning * into v_row;

  perform public.log_admin('mail_settings', null, p_patch);
  return v_row;
end; $$;

revoke all on function public.admin_update_mail(jsonb) from public, anon;
grant execute on function public.admin_update_mail(jsonb) to authenticated;

-- Panel için kuyruk özeti
create or replace view public.mail_health
with (security_invoker = true) as
select
  (select is_enabled from public.mail_settings where id)   as acik,
  (select sent_today from public.mail_settings where id)   as bugun_gonderilen,
  (select daily_limit from public.mail_settings where id)  as gunluk_limit,
  count(*) filter (where status = 'pending')  as bekleyen,
  count(*) filter (where status = 'sending')  as gonderiliyor,
  count(*) filter (where status = 'sent')     as gonderildi,
  count(*) filter (where status = 'failed')   as basarisiz,
  max(sent_at)                                as son_gonderim
  from public.mail_queue
 where public.is_admin();

grant select on public.mail_health to authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select 'MAIL TABLOLARI' as rapor, table_name
  from information_schema.tables
 where table_schema='public' and table_name in ('mail_settings','mail_queue','email_verifications')
 order by table_name;

select 'YENI RPC' as rapor, p.proname
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in ('mail_enqueue','mail_claim_jobs','mail_finish_job','mail_recover_stuck',
                     'request_email_verification','verify_email','change_username',
                     'username_available','set_avatar','admin_update_mail')
 order by 2;

select 'Mail servisi ve profil ozellikleri kuruldu.' as durum;

notify pgrst, 'reload schema';
