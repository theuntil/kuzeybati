import type { Metadata } from "next";
import SavedList from "@/components/account/SavedList";
import SonucToast from "@/components/account/SonucToast";
import { redirect } from "next/navigation";
import { assertLocale, href, accountHref, type Locale, haberYolu} from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { createAuthedClient } from "@/lib/supabase/server";
import { publicConfig } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { pickImage, assetUrl } from "@/lib/media";
import Icon, { type IconName } from "@/components/ui/Icon";
import LogoutButton from "@/components/site/LogoutButton";
import AccountArticles from "@/components/account/AccountArticles";
import AccountComments from "@/components/account/AccountComments";
import ProfileSection from "@/components/account/ProfileSection";
import AccountProfile from "@/components/account/AccountProfile";
import { getCityOptions } from "@/lib/queries";
import Empty from "@/components/account/Empty";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(assertLocale(locale));
  return { title: dict.nav.account, robots: { index: false } };
}

type Tab = "profile" | "saved" | "likes" | "comments" | "articles" | "new" | "settings";

export default async function AccountPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale: raw }, q] = await Promise.all([params, searchParams]);
  const locale = assertLocale(raw) as Locale;

  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(href(locale, "login"));

  const dict = await getDictionary(locale);

  /**
   * HATA YUTULMUYOR.
   *
   * Eskiden `const { data: profile }` yazılıp `error` göz ardı
   * ediliyordu. `my_profile` görünümü yetki hatası verdiğinde
   * profil `null` oluyor ve sayfa sessizce BOŞ görünüyordu —
   * kullanıcının yaşadığı sorun buydu.
   *
   * Artık hata varsa ekranda yazıyor.
   */
  const [{ data: profile, error: profileError }, cityOptions] = await Promise.all([
    sb.from("my_profile").select("*").maybeSingle(),
    getCityOptions(),
  ]);

  if (profileError || !profile) {
    return (
      <div style={{ padding: "40px var(--gut)", maxWidth: 520, marginInline: "auto" }}>
        <div style={{
          background: "var(--s1)", border: "1px solid rgba(229,72,77,.35)",
          borderRadius: 16, padding: 22,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#E5484D", marginBottom: 10 }}>
            Profil okunamadı
          </h1>
          <p style={{ fontSize: 14, color: "var(--mu)", lineHeight: 1.6 }}>
            {profileError?.message ?? "Profil kaydı bulunamadı."}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--mu)", marginTop: 12, lineHeight: 1.6 }}>
            Veritabanında <code>yama-34-profil-onarim.sql</code> çalıştırılmamış
            olabilir.
          </p>
        </div>
      </div>
    );
  }

  // Eksik bilgi varsa önce tamamlansın
  if (!profile.onboarded_at) redirect(href(locale, "complete-profile"));

  const canWrite = profile?.role === "author" || profile?.role === "admin";

  /**
   * Avatar iki kaynaktan gelebilir: kullanıcının yüklediği dosya
   * (Supabase Storage) ya da Google/Apple'dan gelen adres.
   * Kendi yüklediği öncelikli.
   */
  // Avatarlar R2'de; assetUrl CDN tabanını ekler
  const avatarSrc = profile?.avatar_key
    ? assetUrl(String(profile.avatar_key))
    : (profile?.avatar_url ?? null);

  /** Kullanıcı adı 30 günde bir değişebilir */
  const canChangeUsername =
    !profile?.username_changed_at ||
    Date.now() - new Date(profile.username_changed_at).getTime() > 30 * 864e5;
  // "Haber ekle" bir sekme değil, ayrı sayfa
  if (q.tab === "new") redirect(accountHref(locale, "new"));

  const tab: Tab =
    q.tab === "profile" ? "profile"
    : q.tab === "likes" ? "likes"
    : q.tab === "comments" ? "comments"
    : q.tab === "settings" ? "settings"
    : q.tab === "articles" && canWrite ? "articles"
    : q.tab === "saved" ? "saved"
    /*
     * ⚠ VARSAYILAN "PROFİL", "KAYDETTİKLERİM" DEĞİL.
     * Hesabına giren biri önce kendi bilgilerini görmek
     * istiyor; kaydettikleri ikinci sırada.
     */
    : "profile";

  const [savedRes, likesRes, commentsRes, articlesRes] = await Promise.all([
    tab === "saved"
      ? sb.from("my_saved").select("*").order("saved_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    tab === "likes"
      ? sb.from("my_likes").select("*").order("liked_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    tab === "comments"
      ? sb.from("my_comments").select("*").order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    /*
     * Yazar haberleri.
     *
     * ⚠ PROFİL SEKMESİNDE DE ÇEKİLİYOR.
     * Yazarın onay bekleyen yazıları profil sayfasında da
     * listeleniyor; "yazımı gönderdim ama nerede?" sorusunun
     * cevabı hesabı açar açmaz görünsün.
     */
    (tab === "articles" || tab === "profile") && canWrite
      ? sb.from("my_articles").select("*").order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  /* Profil sekmesinde gösterilecek kaydedilenler */
  const profilKayit = tab === "profile"
    ? await sb.from("my_saved").select("*")
        .order("saved_at", { ascending: false }).limit(6)
    : { data: [] };

  /**
   * KAPAK GÖRSELLERİ
   *
   * `my_saved` / `my_likes` yalnızca `cover_media_id` taşıyor,
   * medya satırını değil. Kartlarda görsel gösterebilmek için
   * kapaklar TEK sorguda toplu çekiliyor — haber başına ayrı
   * sorgu atmak 50 gidiş-dönüş demekti.
   */
  const listRows = [
    ...((savedRes.data ?? []) as SavedRow[]),
    ...((likesRes.data ?? []) as SavedRow[]),
    /*
     * ⚠ YAZAR HABERLERİ VE PROFİLDEKİ KAYITLAR DA DAHİL.
     * Bunlar toplamaya girmediği için "haberlerim" kartları
     * görselsiz kalıyordu.
     */
    ...((articlesRes.data ?? []) as unknown as SavedRow[]),
    ...((profilKayit.data ?? []) as SavedRow[]),
  ];
  const coverIds = listRows
    .map((r) => r.cover_media_id)
    .filter((x): x is string => Boolean(x));

  const coverMap = new Map<string, MediaLite>();
  if (coverIds.length) {
    /*
     * ⚠ İKİ KAYNAKTAN OKUNUYOR.
     *
     * `public_media` yalnızca YAYINDAKİ haberlerin medyasını
     * veriyor (`a.status = 'published'`). Doğru bir kural ama
     * yazarın onay bekleyen haberinin kapağı hiç gelmiyordu.
     *
     * `my_media` yazarın kendi haberlerini durum farketmeksizin
     * açıyor. İkisi birleştiriliyor: okur için değişen bir şey
     * yok, yazar kendi kapağını görüyor.
     */
    const [genel, benim] = await Promise.all([
      sb.from("public_media")
        .select("id, type, storage_key, poster_key, variants, width, height")
        .in("id", coverIds),
      sb.from("my_media")
        .select("id, type, storage_key, poster_key, variants, width, height")
        .in("id", coverIds),
    ]);

    for (const m of (genel.data ?? []) as MediaLite[]) coverMap.set(m.id, m);
    for (const m of (benim.data ?? []) as MediaLite[]) coverMap.set(m.id, m);
  }

  const withCover = (rows: SavedRow[]) =>
    rows.map((r) => ({
      ...r,
      cover: r.cover_media_id ? coverMap.get(r.cover_media_id) ?? null : null,
    }));

  /** Yazar haberleri için aynı kapak eşlemesi */
  const withCoverArticles = (rows: ArticleRow[]) =>
    rows.map((r) => ({
      ...r,
      cover: r.cover_media_id ? coverMap.get(r.cover_media_id) ?? null : null,
    }));

  /** Profil sekmesindeki sayaçlar — tek turda üç sayım */
  const [savedCount, likeCount, commentCount] = await Promise.all([
    sb.from("saved_articles").select("article_id", { count: "exact", head: true }),
    sb.from("article_likes").select("article_id", { count: "exact", head: true }),
    sb.from("my_comments").select("id", { count: "exact", head: true }),
  ]);
  const counts = {
    saved: savedCount.count ?? 0,
    likes: likeCount.count ?? 0,
    comments: commentCount.count ?? 0,
  };

  const tabs: { key: Tab; label: string; icon: IconName }[] = [
    { key: "profile", label: dict.profile.myProfile, icon: "user" },
    { key: "saved", label: dict.auth.savedArticles, icon: "bookmark" },
    { key: "likes", label: dict.auth.likedArticles, icon: "heart" },
    { key: "comments", label: dict.auth.myComments, icon: "comment" },
    /*
     * ⚠ ÖNCE "sun" (güneş/tema) İKONU KULLANILIYORDU.
     * Güneş simgesi tema değiştirme demek; ayarlar sekmesiyle
     * hiç ilgisi yoktu.
     */
    { key: "settings", label: dict.profile.settings, icon: "settings" },
    ...(canWrite
      ? [{ key: "articles" as Tab, label: dict.auth.myArticles, icon: "news" as IconName },
         { key: "new" as Tab, label: dict.auth.newArticle, icon: "plus" as IconName }]
      : []),
  ];

  return (
    <div style={{ padding: "var(--g) var(--gut) 48px" }}>
      {/* ---- profil başlığı ---- */}


      {/* ---- panel düzeni: solda menü, sağda içerik ---- */}
      <SonucToast />
      <div className="kb-acc hesap-panel">
        <nav className="kb-acc-nav" data-hide-sb>
          {/* Menünün en üstünde anasayfa dönüşü */}
          <Link
            href={href(locale, "home")}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 14px", borderRadius: 11,
              color: "var(--mu)", fontSize: 14, fontWeight: 600,
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            <span style={{ display: "flex", transform: "rotate(180deg)" }}>
              <Icon name="chevronRight" size={16} />
            </span>
            {dict.auth.backHome}
          </Link>
          <span style={{ height: 1, background: "var(--bd)", margin: "6px 8px" }} />

          {tabs.map((t) => {
            const on = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`?tab=${t.key}`}
                aria-current={on}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 14px", borderRadius: 11,
                  background: on ? "var(--tx)" : "transparent",
                  color: on ? "var(--bg)" : "var(--tx)",
                  fontSize: 14, fontWeight: on ? 700 : 600,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
              </Link>
            );
          })}

          {/* Menünün altı: panel kısayolu ve çıkış */}
          <span style={{ height: 1, background: "var(--bd)", margin: "6px 8px" }} />

          {/* Yönetim paneli YALNIZCA yöneticiye. Yazarın burada
              işi yok; kendi haberlerini bu panelden yönetiyor. */}
          {profile.role === "admin" && (
            <Link
              href={`${href(locale, "home")}admin`.replace("//", "/")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px", borderRadius: 11,
                color: "var(--ac)", fontSize: 14, fontWeight: 700,
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              <Icon name="grid" size={16} />
              {dict.admin.panel}
            </Link>
          )}

          <span style={{ padding: "2px 6px" }}>
            <LogoutButton label={dict.nav.logout} homeHref={href(locale, "home")} />
          </span>
        </nav>

        <div style={{ flex: "1 1 480px", minWidth: 0 }}>



      {tab === "profile" && (
        <ProfileSection
          userId={auth.user.id}
          avatarKey={profile.avatar_key ?? null}
          avatarUrl={profile.avatar_url ?? null}
          coverKey={profile.cover_key ?? null}
          name={profile.display_name ?? ""}
          username={profile.username ?? ""}
          cityName={profile.city_name ?? null}
          role={String(profile.role ?? "reader")}
          verified={Boolean(profile.email_verified_at)}
          joinedAt={String(profile.created_at)}
          dict={dict}
          stats={counts}
        />
      )}

      {/* ---- Yazarın onay bekleyen yazıları ---- */}
      {tab === "profile" && canWrite && (() => {
        const bekleyen = withCoverArticles((articlesRes.data ?? []) as ArticleRow[])
          .filter((a) => a.status === "pending_review" || a.degisiklik_bekliyor);
        if (!bekleyen.length) return null;
        return (
          <section style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>
              Onay bekleyen yazıların
            </h2>
            <AccountArticles
              items={bekleyen}
              locale={locale}
              dict={dict}
            />
          </section>
        );
      })()}

      {/* ---- Kaydedilen haberler ---- */}
      {tab === "profile" && (profilKayit.data ?? []).length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>
            Kaydettiğin haberler
          </h2>
          <SavedList
            items={withCover((profilKayit.data ?? []) as SavedRow[])}
            locale={locale}
            dict={dict}
            empty={dict.auth.noSaved}
            tur="saved"
          />
        </section>
      )}

      {tab === "saved" && (
        <SavedList
          items={withCover((savedRes.data ?? []) as SavedRow[])}
          locale={locale}
          dict={dict}
          empty={dict.auth.noSaved}
          tur="saved"
        />
      )}

      {tab === "likes" && (
        <SavedList
          items={withCover((likesRes.data ?? []) as unknown as SavedRow[])}
          locale={locale}
          dict={dict}
          empty={dict.auth.noLikes}
          tur="likes"
        />
      )}

      {tab === "comments" && (
        <AccountComments
          items={(commentsRes.data ?? []) as CommentRow[]}
          locale={locale}
          dict={dict}
        />
      )}

      {tab === "settings" && (
        <AccountProfile
          firstName={profile?.first_name ?? ""}
          lastName={profile?.last_name ?? ""}
          username={profile?.username ?? ""}
          email={profile?.email ?? null}
          citySlug={profile?.city_slug ?? null}
          verifiedAt={profile?.email_verified_at ?? null}
          usernameChangedAt={profile?.username_changed_at ?? null}
          cities={cityOptions}
          dict={dict}
          locale={locale}
        />
      )}

      {tab === "articles" && canWrite && (
        <AccountArticles
          items={withCoverArticles((articlesRes.data ?? []) as ArticleRow[])}
          locale={locale}
          dict={dict}
        />
      )}
        </div>
      </div>

      <style>{`
        /**
         * PANEL DÜZENİ
         *
         * Masaüstünde içerik 780px'de duruyor. Ekranı baştan sona
         * doldurmak satırları aşırı uzatıyor ve "uzun bir sayfa"
         * hissi veriyordu; panelde okunabilirlik daha önemli.
         */
        .kb-acc {
          display: flex; gap: var(--g); align-items: flex-start;
          max-width: 1080px; margin-inline: auto;
        }
        .kb-acc > div { max-width: 780px; }

        /* Masaüstü: solda sabit menü. Mobil: üstte yatay şerit. */
        .kb-acc-nav {
          display: flex; flex-direction: column; gap: 4;
          flex: 0 0 210px; position: sticky; top: 84px;
          background: var(--s1); border: 1px solid var(--bd);
          border-radius: 16px; padding: 8px;
        }
        @media (max-width: 860px) {
          .kb-acc { flex-direction: column; max-width: 100%; }
          .kb-acc > div { max-width: 100%; }
          .kb-acc-nav {
            flex-direction: row; flex: 1 1 100%; position: static;
            overflow-x: auto; padding: 6px; gap: 6px; width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

interface MediaLite {
  id: string; type: "image" | "video";
  storage_key: string | null; poster_key: string | null;
  variants: Record<string, unknown>;
  width: number | null; height: number | null;
}

interface SavedRow {
  /** Haber adresi kategori altında kurulur; yoksa eski biçim */
  category_slug?: string | null;
  id: string; slug: string; title: string;
  summary: string | null; published_at: string; saved_at: string;
  cover_media_id?: string | null;
  cover?: MediaLite | null;
}
interface CommentRow {
  id: string; body: string; status: string; created_at: string;
  article_slug: string; article_title: string;
}
interface ArticleRow {
  id: string; slug: string; title: string; status: string;
  created_at: string; category_name: string | null;
  view_count: number; like_count: number; comment_count: number;
  /* Yayındaki habere yapılmış, onay bekleyen değişiklik var mı */
  degisiklik_bekliyor?: boolean | null;
  cover_media_id?: string | null;
  cover?: MediaLite | null;
}


