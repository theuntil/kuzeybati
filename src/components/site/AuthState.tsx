"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { assetUrl } from "@/lib/media";
import { href, accountHref, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon, { type IconName } from "@/components/ui/Icon";
import Link from "next/link";

/**
 * HEADER'DA OTURUM DURUMU
 *
 * Giriş yapmış kullanıcıya "Giriş yap" düğmesi gösteriliyordu.
 * Sebep: header sunucuda önbelleklenen bir bileşen, oturum ise
 * kişiye özel — sunucu tarafında okunamaz.
 *
 * Çözüm istemcide: oturum kontrol edilir ve düğme buna göre
 * çizilir. `onAuthStateChange` ile giriş/çıkış anında da
 * güncellenir; sayfa yenilemeye gerek kalmaz.
 *
 * İlk boyamada hangisinin çizileceği bilinmediği için yer tutucu
 * gösterilir — yanlış düğmeyi gösterip sonra değiştirmek daha
 * kötü olurdu.
 */
export default function AuthState({
  locale, dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [rol, setRol] = useState<string>("user");

  /*
   * `acik` görünürlüğü, `basildi` DOM'da olup olmadığını tutuyor.
   * İkisi ayrı: kapanma animasyonu bitene kadar öğe DOM'da
   * kalmalı, yoksa animasyon hiç görünmez.
   */
  const [acik, setAcik] = useState(false);
  const [basildi, setBasildi] = useState(false);
  const kap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (acik) { setBasildi(true); return; }
    const z = setTimeout(() => setBasildi(false), 200);
    return () => clearTimeout(z);
  }, [acik]);

  /* Dışarı tıklayınca ve Esc ile kapanıyor */
  useEffect(() => {
    if (!acik) return;
    const tik = (e: MouseEvent) => {
      if (!kap.current?.contains(e.target as Node)) setAcik(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    document.addEventListener("mousedown", tik);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", tik);
      window.removeEventListener("keydown", esc);
    };
  }, [acik]);
  const [initial, setInitial] = useState("?");

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;

    async function load() {
      const { data } = await sb.auth.getUser();
      if (!alive) return;

      if (!data.user) {
        setState("out");
        return;
      }
      setState("in");

      const { data: p } = await sb
        .from("my_profile")
        .select("display_name, avatar_url, avatar_key, role")
        .maybeSingle();

      if (!alive || !p) return;
      setInitial((p.display_name ?? "?").slice(0, 1).toLocaleUpperCase("tr"));
      setAvatar(p.avatar_url ?? avatarUrl(p.avatar_key));
      setRol((p as { role?: string | null }).role ?? "user");
    }

    void load();

    // Giriş/çıkış anında düğme kendiliğinden güncellensin
    const { data: sub } = sb.auth.onAuthStateChange((_event: string, session: { user?: unknown } | null) => {
      if (!alive) return;
      if (session?.user) void load();
      else { setState("out"); setAvatar(null); }
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (state === "loading") {
    // Yer tutucu: yanlış düğmeyi gösterip değiştirmekten iyidir
    return (
      <span
        aria-hidden
        style={{
          width: 34, height: 34, borderRadius: 999,
          background: "var(--s2)", flexShrink: 0,
          animation: "kbPulse 1.4s ease-in-out infinite",
        }}
      />
    );
  }

  if (state === "out") {
    return (
      <Link
        data-only="desktop"
        href={href(locale, "login")}
        style={{
          padding: "8px 15px", borderRadius: 999,
          background: "var(--tx)", color: "var(--bg)",
          fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        {dict.nav.login}
      </Link>
    );
  }

  const yazar = rol === "author" || rol === "admin" || rol === "editor";

  const kisayollar: { ad: string; ikon: IconName; yol: string }[] = [
    { ad: "Profilim",   ikon: "user",     yol: href(locale, "account") },
    { ad: "Kaydedilen", ikon: "bookmark", yol: `${href(locale, "account")}?tab=saved` },
    { ad: "Beğenilen",  ikon: "heart",    yol: `${href(locale, "account")}?tab=likes` },
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
    <div ref={kap} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        title={dict.nav.account}
        aria-label={dict.nav.account}
        aria-expanded={acik}
        style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0,
          overflow: "hidden", display: "grid", placeItems: "center",
          background: "var(--s2)", color: "var(--tx)",
          fontSize: 14, fontWeight: 800, padding: 0, cursor: "pointer",
          border: acik ? "1px solid var(--tx)" : "1px solid var(--bd)",
          transition: "border-color .16s ease",
        }}
      >
        {avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initial
        )}
      </button>

      {/*
        HESAP AÇILIR KUTUSU

        ⚠ DÜĞMEDEN BÜYÜYEREK AÇILIYOR.
        `transform-origin` sağ üstte, yani kutunun kaynağı
        avatarın kendisi. "Pat" diye belirmek yerine düğmeden
        çıkıyor, kapanırken oraya geri çekiliyor.

        DOM'dan hemen sökülmüyor: kapanma animasyonu görünsün
        diye süre kadar bekletiliyor.
      */}
      {basildi && (
        <div
          role="menu"
          style={{
            position: "absolute", insetInlineEnd: 0, top: "calc(100% + 8px)",
            minWidth: 220, padding: 8, zIndex: 130,
            borderRadius: 16, background: "var(--s1)",
            border: "1px solid var(--bd)",
            boxShadow: "0 14px 40px rgba(0,0,0,.28)",
            transformOrigin: "top right",
            opacity: acik ? 1 : 0,
            transform: acik ? "scale(1) translateY(0)" : "scale(.9) translateY(-6px)",
            pointerEvents: acik ? "auto" : "none",
            transition: "opacity .16s ease, transform .18s cubic-bezier(.32,.72,0,1)",
          }}
        >
          {kisayollar.map((k) => (
            <Link
              key={k.ad}
              href={k.yol}
              onClick={() => setAcik(false)}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "10px 12px", borderRadius: 11,
                color: "var(--tx)", textDecoration: "none",
                fontSize: 14, fontWeight: 600,
              }}
            >
              <Icon name={k.ikon} size={17} strokeWidth={1.7} />
              {k.ad}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Supabase Storage'daki avatar için genel adres */
function avatarUrl(key: string | null | undefined): string | null {
  // Avatarlar artık R2'de; adres CDN tabanından kurulur
  return assetUrl(key);
}
