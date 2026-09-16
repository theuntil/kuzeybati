-- ############################################################
--  YAMA 20 — BÜLTEN + REKLAM ALANLARI
--
--  1. newsletter_subscribers — Sabah Bülteni aboneleri
--  2. ad_slots               — reklam alanları (panelden)
--
--  İkisi de site tarafında görünen ama panelden yönetilen şeyler.
--  Reklam HTML'i admin girer; anon SADECE aktif ve tarihi geçerli
--  olanları görür.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set statement_timeout = '120s';

-- ============================================================
-- 1. BÜLTEN ABONELERİ
-- ============================================================
create table if not exists public.newsletter_subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  locale       text not null default 'tr',
  -- Çift onay: e-postaya tıklamadan liste kirlenir ve spam
  -- şikâyeti alırsın. Onaysız adrese gönderim yapılmaz.
  confirmed    boolean not null default false,
  confirm_token text not null default encode(gen_random_bytes(24), 'hex'),
  confirmed_at timestamptz,

  source       text,          -- 'footer' | 'article' | 'popup'
  ip_hash      text,
  user_id      uuid references public.profiles(id) on delete set null,

  unsubscribed_at timestamptz,
  created_at   timestamptz not null default now(),

  constraint nl_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint nl_locale check (locale in ('tr','en','ar','ru'))
);

create index if not exists nl_active_idx
  on public.newsletter_subscribers (locale)
  where confirmed and unsubscribed_at is null;
create index if not exists nl_token_idx
  on public.newsletter_subscribers (confirm_token) where not confirmed;

-- ---- Kayıt ol (anon çağırabilir) --------------------------
--
--  Tabloya anon INSERT yetkisi YOK. Tek giriş bu fonksiyon:
--  e-posta biçimi, tekrar kayıt ve hız sınırı burada denetlenir.
create or replace function public.subscribe_newsletter(
  p_email text,
  p_locale text default 'tr',
  p_source text default 'footer',
  p_ip_hash text default null
)
returns table (ok boolean, already boolean, message text)
language plpgsql security definer set search_path = ''
as $$
declare v_email text := lower(trim(coalesce(p_email,''))); n int; v_row public.newsletter_subscribers;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select false, false, 'gecersiz_eposta'; return;
  end if;

  -- Aynı IP'den saatte 5 kayıt: form botlarına karşı basit set
  if p_ip_hash is not null then
    select count(*) into n from public.newsletter_subscribers
     where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if n >= 5 then
      return query select false, false, 'cok_fazla_deneme'; return;
    end if;
  end if;

  select * into v_row from public.newsletter_subscribers where email = v_email;

  if found then
    -- Daha önce çıkmışsa geri al, yoksa dokunma
    if v_row.unsubscribed_at is not null then
      update public.newsletter_subscribers
         set unsubscribed_at = null, locale = coalesce(p_locale, locale)
       where email = v_email;
      return query select true, false, 'yeniden_abone'; return;
    end if;
    return query select true, true, 'zaten_abone'; return;
  end if;

  insert into public.newsletter_subscribers (email, locale, source, ip_hash, user_id)
  values (v_email, coalesce(p_locale,'tr'), left(p_source,30), left(p_ip_hash,64), auth.uid());

  return query select true, false, 'kaydedildi';
end; $$;

-- ---- Onayla / çık -----------------------------------------
create or replace function public.confirm_newsletter(p_token text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.newsletter_subscribers
     set confirmed = true, confirmed_at = now()
   where confirm_token = p_token and not confirmed;
  return found;
end; $$;

create or replace function public.unsubscribe_newsletter(p_token text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.newsletter_subscribers
     set unsubscribed_at = now()
   where confirm_token = p_token and unsubscribed_at is null;
  return found;
end; $$;

-- ============================================================
-- 2. REKLAM ALANLARI
--
--  placement: sitedeki sabit yuva adı. Bileşen bu adla sorar,
--  eşleşen aktif kayıt varsa gösterir, yoksa yuva hiç render
--  edilmez (boş kutu görünmez).
-- ============================================================
create table if not exists public.ad_slots (
  id          uuid primary key default gen_random_uuid(),
  placement   text not null,          -- 'home-top' | 'home-feed' | 'article-mid' | 'sidebar'
  name        text not null,
  advertiser  text,

  -- Görsel reklam
  image_key   text,                   -- R2 anahtarı
  image_dark_key text,
  target_url  text,
  headline    text,
  body        text,
  cta_label   text,

  -- Ya da doğrudan kod (ağ reklamı: AdSense vb.)
  embed_html  text,

  locale      text,                   -- null = tüm diller
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  int not null default 100,

  impressions bigint not null default 0,
  clicks      bigint not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint ad_needs_content check (
    image_key is not null or embed_html is not null or headline is not null),
  constraint ad_url_https check (
    target_url is null or target_url ~ '^https://')
);

create index if not exists ad_slots_live_idx
  on public.ad_slots (placement, sort_order)
  where is_active;

drop trigger if exists ad_slots_touch on public.ad_slots;
create trigger ad_slots_touch before update on public.ad_slots
  for each row execute function public.tg_set_updated_at();

-- Site sadece bunu okur: tarihi geçmiş / pasif kayıtlar hiç gelmez
drop view if exists public.public_ads;
create view public.public_ads
with (security_invoker = true) as
select id, placement, advertiser, image_key, image_dark_key, target_url,
       headline, body, cta_label, embed_html, locale, sort_order
  from public.ad_slots
 where is_active
   and (starts_at is null or starts_at <= now())
   and (ends_at   is null or ends_at   >  now());

create or replace function public.track_ad_click(p_ad_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.ad_slots set clicks = clicks + 1 where id = p_ad_id;
end; $$;

-- ============================================================
-- 3. RLS + YETKİLER
-- ============================================================
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_subscribers force  row level security;
alter table public.ad_slots enable row level security;
alter table public.ad_slots force  row level security;

-- Abone listesi SADECE staff. anon kendi kaydını bile göremez —
-- e-posta adresi listesi sızarsa spam malzemesi olur.
drop policy if exists nl_select_staff on public.newsletter_subscribers;
create policy nl_select_staff on public.newsletter_subscribers
  for select to authenticated using (public.is_staff());

drop policy if exists ads_select_public on public.ad_slots;
create policy ads_select_public on public.ad_slots
  for select using (is_active or public.is_staff());

drop policy if exists ads_write_admin on public.ad_slots;
create policy ads_write_admin on public.ad_slots
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.newsletter_subscribers, public.ad_slots
  from public, anon, authenticated;

grant select on public.newsletter_subscribers to authenticated;
grant select on public.ad_slots to anon, authenticated;
grant insert, update, delete on public.ad_slots to authenticated;
grant select on public.public_ads to anon, authenticated;

revoke all on function
  public.subscribe_newsletter(text, text, text, text),
  public.confirm_newsletter(text),
  public.unsubscribe_newsletter(text),
  public.track_ad_click(uuid)
  from public, anon, authenticated;

grant execute on function
  public.subscribe_newsletter(text, text, text, text),
  public.confirm_newsletter(text),
  public.unsubscribe_newsletter(text),
  public.track_ad_click(uuid)
  to anon, authenticated;

-- ============================================================
-- KONTROL
-- ============================================================
select count(*) as abone from public.newsletter_subscribers;
select placement, count(*) from public.ad_slots group by placement;

select 'Bulten ve reklam katmani kuruldu.' as durum;

notify pgrst, 'reload schema';
