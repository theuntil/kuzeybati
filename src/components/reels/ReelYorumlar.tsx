"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { assetUrl } from "@/lib/media";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/* ══════════════════════════════════════════════════════════════
   REELS YORUMLARI

   Masaüstü: sağ sütun · Mobil: alttan açılan sayfa

   ⚠ YORUMLAR İSTEMCİDE ÇEKİLİYOR.
   Akış sunucuda önbelleklenebiliyor; yorumlar sürekli
   değiştiği için oraya karıştırılmıyor.

   ⚠ KART GÖRÜNENE KADAR ÇEKİLMİYOR.
   Sekiz kartın yorumları peşinen çekilseydi ilk açılış
   sekiz gereksiz sorgu demekti.
   ══════════════════════════════════════════════════════════════ */

interface Yorum {
  id: string;
  body: string;
  created_at: string;
  user_id: string | null;
  display_name: string | null;
  username: string | null;
  avatar_key: string | null;
  /** Kendi gönderdiği, henüz onaylanmamış yorum */
  bekliyor?: boolean;
}

export default function ReelYorumlar({
  articleId, acik, onKapat, mobil, locale, dict, girisli, girisIste, onSayi,
}: {
  articleId: string;
  acik: boolean;
  onKapat: () => void;
  mobil: boolean;
  locale: Locale;
  dict: Dictionary;
  girisli: boolean;
  girisIste: () => void;
  onSayi: (n: number) => void;
}) {
  const sb = supabaseBrowser();
  const [liste, setListe] = useState<Yorum[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [cekildi, setCekildi] = useState(false);
  const [metin, setMetin] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const alan = useRef<HTMLTextAreaElement>(null);

  const yukle = useCallback(async () => {
    if (cekildi || yukleniyor) return;
    setYukleniyor(true);

    const { data } = await sb
      .from("public_comments")
      .select("id, body, created_at, user_id, display_name, username, avatar_key")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(50);

    setYukleniyor(false);
    setCekildi(true);
    const satirlar = (data ?? []) as Yorum[];
    setListe(satirlar);
    onSayi(satirlar.length);
  }, [sb, articleId, cekildi, yukleniyor, onSayi]);

  useEffect(() => { if (acik) void yukle(); }, [acik, yukle]);

  /* Mobilde açıkken arka plan kaymasın */
  useEffect(() => {
    if (!mobil || !acik) return;
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = eski;
      window.removeEventListener("keydown", esc);
    };
  }, [mobil, acik, onKapat]);

  async function gonder() {
    if (!girisli) { girisIste(); return; }
    const govde = metin.trim();
    if (govde.length < 2) { setHata("Yorum çok kısa"); return; }

    setGonderiliyor(true);
    setHata(null);

    const { error } = await sb.rpc("post_comment", {
      p_article_id: articleId,
      p_body: govde,
    });

    setGonderiliyor(false);
    if (error) {
      setHata(
        error.message.includes("rate") || error.message.includes("sik")
          ? "Çok sık yorum yapıyorsun, biraz bekle"
          : "Yorum gönderilemedi",
      );
      return;
    }

    setMetin("");

    /*
     * ⚠ KENDİ YORUMU LİSTEYE EKLENİYOR.
     *
     * Yorum onaydan geçiyor ve başkalarına görünmüyor — ama
     * yazan kişiye görünmeli. Eklenmediğinde kullanıcı
     * "gitmedi" sanıp aynı yorumu tekrar tekrar gönderiyordu.
     *
     * Haber sayfasındaki davranışın aynısı: satır "onay
     * bekliyor" etiketiyle listede duruyor.
     */
    const { data: u } = await sb.auth.getUser();
    let ad: string | null = null;
    let kullanici: string | null = null;
    let avatar: string | null = null;

    if (u.user) {
      const { data: prof } = await sb
        .from("profiles")
        .select("display_name, username, avatar_key")
        .eq("id", u.user.id)
        .maybeSingle();
      const o = prof as {
        display_name?: string | null;
        username?: string | null;
        avatar_key?: string | null;
      } | null;
      ad = o?.display_name ?? null;
      kullanici = o?.username ?? null;
      avatar = o?.avatar_key ?? null;
    }

    setListe((p) => [{
      id: `bekleyen-${Date.now()}`,
      body: govde,
      created_at: new Date().toISOString(),
      user_id: u.user?.id ?? null,
      display_name: ad,
      username: kullanici,
      avatar_key: avatar,
      bekliyor: true,
    }, ...p]);
    onSayi(liste.length + 1);
  }

  const zaman = (t: string) => {
    const fark = Date.now() - new Date(t).getTime();
    const dk = Math.floor(fark / 60000);
    if (dk < 1) return "az önce";
    if (dk < 60) return `${dk} dk`;
    const sa = Math.floor(dk / 60);
    if (sa < 24) return `${sa} sa`;
    return new Date(t).toLocaleDateString(locale, { day: "numeric", month: "short" });
  };

  const govde = (
    <>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: mobil ? "16px 18px 12px" : "22px 20px 14px",
        borderBottom: `1px solid ${mobil ? "rgba(255,255,255,.12)" : "var(--bd)"}`,
        fontSize: 14, fontWeight: 700,
        color: mobil ? "#fff" : "var(--tx)",
        flexShrink: 0,
      }}>
        <span>Yorumlar{liste.length ? ` · ${liste.length}` : ""}</span>
        <button
          type="button"
          onClick={onKapat}
          aria-label="Kapat"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "inherit", opacity: .6, padding: 4, lineHeight: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{
        flex: 1, overflowY: "auto",
        padding: mobil ? "14px 18px" : "16px 20px",
      }}>
        {yukleniyor && (
          <p style={{
            fontSize: 13, textAlign: "center", paddingBlock: 24,
            color: mobil ? "rgba(255,255,255,.5)" : "var(--mu)",
          }}>…</p>
        )}

        {!yukleniyor && !liste.length && (
          <p style={{
            fontSize: 13.5, textAlign: "center", paddingBlock: 30,
            color: mobil ? "rgba(255,255,255,.5)" : "var(--mu)",
          }}>
            İlk yorumu sen yaz.
          </p>
        )}

        {liste.map((y) => (
          <div key={y.id} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <span style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: mobil ? "rgba(255,255,255,.15)" : "var(--s2)",
              display: "grid", placeItems: "center", overflow: "hidden",
              fontSize: 12.5, fontWeight: 700,
              color: mobil ? "#fff" : "var(--tx)",
            }}>
              {y.avatar_key
                ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={assetUrl(y.avatar_key) ?? ""} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )
                : (y.display_name ?? y.username ?? "?").slice(0, 1).toUpperCase()}
            </span>

            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: mobil ? "#fff" : "var(--tx)",
                marginInlineEnd: 7,
              }}>
                {y.display_name ?? y.username ?? "Okur"}
              </span>
              <span style={{
                fontSize: 13.5, lineHeight: 1.5,
                color: mobil ? "rgba(255,255,255,.86)" : "var(--tx)",
                overflowWrap: "anywhere",
              }}>
                {y.body}
              </span>
              <div style={{
                fontSize: 11.5, marginTop: 3,
                display: "flex", alignItems: "center", gap: 7,
                color: mobil ? "rgba(255,255,255,.45)" : "var(--mu)",
              }}>
                {zaman(y.created_at)}
                {y.bekliyor && (
                  <span
                    title="Yorumun onaylandıktan sonra herkese görünecek"
                    style={{
                      fontSize: 10.5, fontWeight: 700,
                      padding: "2px 7px", borderRadius: 999,
                      background: "rgba(255,159,10,.18)", color: "#FF9F0A",
                    }}
                  >
                    Onay bekliyor
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: mobil
          ? "12px 16px calc(14px + env(safe-area-inset-bottom))"
          : "14px 18px 18px",
        borderTop: `1px solid ${mobil ? "rgba(255,255,255,.12)" : "var(--bd)"}`,
        flexShrink: 0,
      }}>
        {hata && (
          <p style={{
            fontSize: 12.5, marginBottom: 8,
            color: hata.includes("onaya") ? "#16a34a" : "#e5484d",
          }}>
            {hata}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={alan}
            value={metin}
            onChange={(e) => { setMetin(e.target.value); setHata(null); }}
            onFocus={() => { if (!girisli) { alan.current?.blur(); girisIste(); } }}
            placeholder="Yorum yaz…"
            rows={1}
            maxLength={800}
            style={{
              flex: 1, resize: "none", borderRadius: 12,
              border: `1px solid ${mobil ? "rgba(255,255,255,.18)" : "var(--bd)"}`,
              background: mobil ? "rgba(255,255,255,.08)" : "var(--s2)",
              color: mobil ? "#fff" : "var(--tx)",
              padding: "11px 13px", fontSize: 14, lineHeight: 1.4,
              outline: "none", fontFamily: "inherit",
              maxHeight: 96, boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void gonder(); }
            }}
          />
          <button
            type="button"
            onClick={() => void gonder()}
            disabled={gonderiliyor || metin.trim().length < 2}
            style={{
              padding: "11px 17px", borderRadius: 12, border: "none",
              background: metin.trim().length < 2
                ? (mobil ? "rgba(255,255,255,.12)" : "var(--s2)")
                : "var(--ac)",
              color: metin.trim().length < 2
                ? (mobil ? "rgba(255,255,255,.4)" : "var(--mu)")
                : "#fff",
              fontSize: 13.5, fontWeight: 700,
              cursor: metin.trim().length < 2 ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            {gonderiliyor ? "…" : "Gönder"}
          </button>
        </div>
      </div>
    </>
  );

  /* ---- mobil: alttan açılan sayfa ---- */
  if (mobil) {
    return (
      <>
        <div
          onClick={onKapat}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
            opacity: acik ? 1 : 0,
            pointerEvents: acik ? "auto" : "none",
            transition: "opacity .25s ease", zIndex: 60,
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-hidden={!acik}
          style={{
            position: "fixed", insetInline: 0, bottom: 0,
            height: "72dvh", zIndex: 61,
            background: "#16181a",
            borderRadius: "20px 20px 0 0",
            display: "flex", flexDirection: "column",
            transform: acik ? "translateY(0)" : "translateY(100%)",
            transition: "transform .32s cubic-bezier(.32,.72,0,1)",
          }}
        >
          <div style={{
            width: 36, height: 4, borderRadius: 2, flexShrink: 0,
            background: "rgba(255,255,255,.25)", margin: "10px auto 2px",
          }} />
          {govde}
        </div>
      </>
    );
  }

  /* ---- masaüstü: sağ sütun ---- */
  return (
    <aside style={{
      display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
      borderInlineStart: "1px solid var(--bd)",
      background: "var(--s1)",
    }}>
      {govde}
    </aside>
  );
}
