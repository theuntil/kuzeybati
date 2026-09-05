"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useGiris } from "@/components/auth/GirisPenceresi";
import { href, accountHref, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon, { type IconName } from "@/components/ui/Icon";
import Link from "next/link";

/**
 * MOBİL MENÜ — HESAP BÖLÜMÜ
 *
 * ⚠ Girişliyken "Giriş yap / Kayıt ol" düğmeleri duruyordu.
 * Kullanıcı zaten girmiş; ona kayıt teklif etmek kafa
 * karıştırıcıydı. Artık avatar, ad ve çıkış düğmesi var.
 */
export default function MenuHesap({
  locale, dict, cdn, onClose,
}: {
  locale: Locale;
  dict: Dictionary;
  cdn: string;
  onClose: () => void;
}) {
  const sb = supabaseBrowser();
  const { girisIste, girisli, hazir } = useGiris();
  const [profil, setProfil] = useState<{
    ad: string; username: string | null; avatar: string | null;
    /* Yazar/yönetici ek kısayollar görüyor */
    rol: string;
  } | null>(null);

  useEffect(() => {
    if (!girisli) { setProfil(null); return; }
    let iptal = false;
    void (async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user || iptal) return;
      const { data } = await sb.from("profiles")
        .select("display_name, username, avatar_key, role")
        .eq("id", u.user.id).maybeSingle();
      if (iptal || !data) return;
      const p = data as {
        display_name: string; username: string | null;
        avatar_key: string | null; role: string | null;
      };
      setProfil({
        ad: p.display_name, username: p.username,
        avatar: p.avatar_key, rol: p.role ?? "user",
      });
    })();
    return () => { iptal = true; };
  }, [girisli, sb]);

  async function cikis() {
    await sb.auth.signOut();
    window.location.reload();
  }

  /* Oturum durumu bilinene kadar boş: yanlış düğme yanıp sönmesin */
  if (!hazir) return <div style={{ height: 74 }} />;

  if (!girisli) {
    return (
      <div style={{ display: "flex", gap: 10, padding: "16px 18px" }}>
        <button
          type="button"
          onClick={() => { onClose(); girisIste(); }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 6, padding: "12px 6px", borderRadius: 12, border: "none",
            background: "var(--tx)", color: "var(--bg)", cursor: "pointer",
          }}
        >
          <Icon name="login" size={18} strokeWidth={1.8} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>{dict.auth.login}</span>
        </button>
        <button
          type="button"
          onClick={() => { onClose(); girisIste(); }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 6, padding: "12px 6px", borderRadius: 12, border: "none",
            background: "var(--s2)", color: "var(--tx)", cursor: "pointer",
          }}
        >
          <Icon name="user" size={18} strokeWidth={1.8} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>{dict.auth.signup}</span>
        </button>
      </div>
    );
  }

  const gorsel = profil?.avatar ? `${cdn.replace(/\/+$/, "")}/${profil.avatar}` : null;

  /* Yazar ve yönetici ek kısayollar görüyor */
  const yazar = profil?.rol === "author" || profil?.rol === "admin"
             || profil?.rol === "editor";

  /*
   * ⚠ VERİ GELENE KADAR İSKELET.
   * Önce ad yerine "…" yazıyordu; kart bir an boş görünüp
   * sonra zıplıyordu. İskelet aynı ölçülerde duruyor, yerleşim
   * kaymıyor.
   */
  const yukleniyor = !profil;

  const kisayollar: { ad: string; ikon: IconName; yol: string }[] = [
    { ad: "Profilim",    ikon: "user",  yol: href(locale, "account") },
    { ad: "Kaydedilen",  ikon: "bookmark",  yol: `${href(locale, "account")}?tab=saved` },
    { ad: "Beğenilen",   ikon: "heart", yol: `${href(locale, "account")}?tab=likes` },
    ...(yazar
      ? [
          { ad: "Haberlerim", ikon: "news" as IconName,
            yol: `${href(locale, "account")}?tab=articles` },
          { ad: "Yeni haber", ikon: "edit" as IconName,
            yol: accountHref(locale, "new") },
        ]
      : []),
  ];

  return (
    <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
      {/*
        KİŞİ KARTI

        ⚠ TAM GENİŞLİK, BOL DOLGU.
        Önce menünün içinde çıplak bir satırdı; menü öğelerinden
        ayrışmıyordu. Artık kendi kutusunda.
      */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: 18, borderRadius: 20,
        background: "var(--s2)", border: "1px solid var(--bd)",
      }}>
        <Link
          href={href(locale, "account")}
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: 14,
            flex: 1, minWidth: 0, color: "inherit", textDecoration: "none",
          }}
        >
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 54, height: 54, borderRadius: "50%", flexShrink: 0,
            background: "var(--s3)", overflow: "hidden",
            fontSize: 20, fontWeight: 800, color: "var(--mu)",
            ...(yukleniyor ? { animation: "kb-iskelet 1.2s ease-in-out infinite" } : {}),
          }}>
            {!yukleniyor && (gorsel ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={gorsel} alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (profil?.ad ?? "?").charAt(0).toLocaleUpperCase("tr"))}
          </span>

          <span style={{ minWidth: 0, flex: 1, display: "grid", gap: 6 }}>
            {yukleniyor ? (
              <>
                <span style={{
                  height: 15, width: "62%", borderRadius: 7,
                  background: "var(--s3)",
                  animation: "kb-iskelet 1.2s ease-in-out infinite",
                }} />
                <span style={{
                  height: 12, width: "40%", borderRadius: 6,
                  background: "var(--s3)",
                  animation: "kb-iskelet 1.2s ease-in-out infinite .15s",
                }} />
              </>
            ) : (
              <>
                <span style={{
                  display: "block", fontSize: 16.5, fontWeight: 800,
                  letterSpacing: "-.01em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {profil?.ad}
                </span>
                {profil?.username && (
                  <span style={{ display: "block", fontSize: 13, color: "var(--mu)" }}>
                    @{profil.username}
                  </span>
                )}
              </>
            )}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => void cikis()}
          title={dict.nav.logout}
          aria-label={dict.nav.logout}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: 999, flexShrink: 0,
            border: "1px solid var(--bd)", background: "var(--s1)",
            color: "var(--mu)", cursor: "pointer",
          }}
        >
          {/* Çıkış: `login` ikonu ters çevriliyor */}
          <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
            <Icon name="login" size={17} />
          </span>
        </button>
      </div>

      {/*
        HIZLI ERİŞİM
        Kaydedilenler ve beğeniler menüde derinlerde kalıyordu;
        en çok kullanılan yollar kartın hemen altında.
      */}
      <div style={{
        display: "grid", gap: 8,
        gridTemplateColumns: `repeat(${kisayollar.length > 3 ? 3 : kisayollar.length}, minmax(0, 1fr))`,
      }}>
        {kisayollar.map((k) => (
          <Link
            key={k.ad}
            href={k.yol}
            onClick={onClose}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 6, padding: "13px 6px", borderRadius: 14,
              background: "var(--s2)", border: "1px solid var(--bd)",
              color: "var(--tx)", textDecoration: "none",
              fontSize: 11.5, fontWeight: 700, textAlign: "center",
            }}
          >
            <Icon name={k.ikon} size={18} strokeWidth={1.7} />
            {k.ad}
          </Link>
        ))}
      </div>
    </div>
  );
}
