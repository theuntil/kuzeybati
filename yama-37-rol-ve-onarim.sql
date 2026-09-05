-- ############################################################
--  YAMA 37 — BELİRSİZ KOLON ONARIMI VE ROL SADELEŞTİRME
--
--  1. HATA: column reference "email" is ambiguous
--     `request_email_change` fonksiyonunun ÇIKTI parametresi
--     `email` adını taşıyor; gövdedeki `where lower(email)`
--     ifadesi hem bu parametreyi hem `profiles.email` kolonunu
--     işaret ediyordu. PostgreSQL hangisini kastettiğini
--     bilemiyor ve e-posta değiştirme hiç çalışmıyordu.
--
--     Çözüm: tablo kolonları takma adla nitelendirildi.
--
--  2. ROLLER ÜÇE İNDİ
--     okuyucu (reader) · yazar (author) · yönetici (admin)
--
--     `editor` kaldırıldı. İki ayrı yazar rolü karışıklık
--     yaratıyordu; yazar haber yazar, yönetici onaylar.
--     YAZARIN YÖNETİM ALANINA ERİŞİMİ YOK.
--
--  Supabase → SQL Editor → yapıştır → RUN
-- ############################################################

set lock_timeout = '5s';
set statement_timeout = '300s';

-- ============================================================
-- 1. BELİRSİZ KOLON ONARIMI
-- ============================================================
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

  /**
   * `p.email` OLARAK NİTELE.
   *
   * Çıktı parametresi de `email` adını taşıyor; niteliksiz
   * `email` ifadesi "column reference is ambiguous" hatası
   * veriyordu.
   */
  if exists (select 1 from public.profiles p where lower(p.email) = v_mail) then
    raise exception 'Bu adres baska bir hesapta kullaniliyor' using errcode = '23505';
  end if;

  select max(ec.created_at) into v_last
    from public.email_changes ec where ec.user_id = v_uid;
  if v_last is not null and v_last > now() - interval '2 minutes' then
    raise exception 'Yeni kod icin % saniye bekle',
      ceil(extract(epoch from (v_last + interval '2 minutes' - now())))
      using errcode = '22023';
  end if;

  select count(*) into v_recent from public.email_changes ec
   where ec.user_id = v_uid and ec.created_at > now() - interval '24 hours';
  if v_recent >= 5 then
    raise exception 'Gunluk degistirme siniri asildi' using errcode = '22023';
  end if;

  update public.email_changes ec set used_at = now()
   where ec.user_id = v_uid and ec.used_at is null;

  select p.display_name into v_name from public.profiles p where p.id = v_uid;
  v_code := public.kb_code6();

  insert into public.email_changes (user_id, new_email, code_hash)
  values (v_uid, v_mail, public.kb_hash(v_code));

  return query select v_code, v_mail, v_name;
end; $$;

revoke all on function public.request_email_change(text) from public, anon;
grant execute on function public.request_email_change(text) to authenticated;

-- Aynı tuzak `email_registered` içinde de vardı
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
    select 1 from public.profiles p
     where lower(p.email) = lower(trim(coalesce(p_email, '')))
       and p.is_active);
end; $$;

revoke all on function public.email_registered(text,text) from public, anon, authenticated;
grant execute on function public.email_registered(text,text) to service_role;

-- ============================================================
-- 2. ROLLER: okuyucu · yazar · yönetici
--
--  Mevcut `editor` kullanıcıları `author` oluyor. Enum değeri
--  silinmiyor (PostgreSQL enum değeri silmeye izin vermez ve
--  eski kayıtlar kırılırdı); artık KULLANILMIYOR.
-- ============================================================
do $$
declare n int;
begin
  alter table public.profiles disable trigger user_role_guard;
  update public.profiles set role = 'author', updated_at = now()
   where role = 'editor';
  get diagnostics n = row_count;
  alter table public.profiles enable trigger user_role_guard;
  raise notice 'editor -> author donusturulen: %', n;
exception when others then
  -- Trigger yoksa doğrudan güncelle
  update public.profiles set role = 'author', updated_at = now()
   where role = 'editor';
end $$;

/**
 * YAZARIN YÖNETİM ALANINA ERİŞİMİ YOK.
 *
 * `is_staff()` eskiden editörü de kapsıyordu; yönetim
 * görünümleri bu fonksiyona bağlı olduğu için yazar panele
 * girebiliyordu. Artık yalnızca yönetici.
 */
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_role() = 'admin'; $$;

/** Haber yazma yetkisi: yazar ve yönetici */
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_role() in ('author','admin'); $$;

/**
 * Yazarın KENDİ haberlerini görebilmesi için ayrı yetki.
 * `is_staff()` artık yalnızca yöneticiyi kapsadığı için
 * haber görünümleri bunu kullanıyor.
 */
create or replace function public.can_manage_own() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_role() in ('author','admin'); $$;

grant execute on function public.can_manage_own() to authenticated;

-- Haber kuyruğu: yazar KENDİ haberlerini görür, yönetici hepsini
create or replace view public.admin_articles
with (security_invoker = true) as
select a.id, a.slug, a.title, a.summary, a.status, a.source,
       a.published_at, a.created_at, a.edited_at, a.deleted_at,
       a.haber_kodu, a.son_dakika, a.media_state,
       c.name  as category_name, c.slug as category_slug,
       ci.name as city_name,
       p.display_name as author_name, p.username as author_username,
       ai.onem_puani, ai.cocuk_guvenli,
       coalesce(st.view_count, 0)    as view_count,
       coalesce(st.like_count, 0)    as like_count,
       coalesce(st.comment_count, 0) as comment_count
  from public.articles a
  left join public.categories c   on c.id  = a.category_id
  left join public.cities     ci  on ci.id = a.city_id
  left join public.profiles   p   on p.id  = a.author_id
  left join public.article_ai  ai on ai.article_id = a.id
  left join public.article_stats st on st.article_id = a.id
 where public.is_staff()
    or (public.can_manage_own() and a.author_id = auth.uid());

grant select on public.admin_articles to authenticated;

-- Medya kitaplığı: yazar kendi yüklediğini görür
drop policy if exists library_staff_read on public.library_media;
create policy library_staff_read on public.library_media
  for select using (public.is_staff() or uploaded_by = auth.uid());

-- ============================================================
-- KONTROL
-- ============================================================
select 'ROL DAGILIMI' as rapor, role::text, count(*)
  from public.profiles group by 2 order by 3 desc;

select 'YETKI' as rapor,
       'is_staff yalnizca admin' as kural,
       (select prosrc like '%admin%' and prosrc not like '%editor%'
          from pg_proc where proname = 'is_staff'
           and pronamespace = 'public'::regnamespace) as dogru;

select 'E-posta degistirme onarildi, roller ucе indi.' as durum;

notify pgrst, 'reload schema';
