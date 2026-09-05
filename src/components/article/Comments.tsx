"use client";
import { useEffect, useState, type FormEvent } from "react";
import { publicConfig } from "@/lib/config";
import { useGiris } from "@/components/auth/GirisPenceresi";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Comment } from "@/lib/types";
import { t, relativeTime } from "@/lib/format";
import Icon from "@/components/ui/Icon";

/**
 * Yorumlar. Üyelik zorunlu, moderasyon açık.
 *
 * Yazma DOĞRUDAN tabloya değil `post_comment()` RPC'si üzerinden:
 * uzunluk, hız sınırı, hesap durumu ve onay kuralı tek yerde
 * (veritabanında) uygulanıyor. İstemciyi atlatan biri bu
 * kuralları da atlayamaz.
 */
export default function Comments({
  articleId, initial, locale, dict, enabled, requireApproval, maxLen,
}: {
  articleId: string;
  initial: Comment[];
  locale: Locale;
  dict: Dictionary;
  enabled: boolean;
  requireApproval: boolean;
  maxLen: number;
}) {
  const { girisIste } = useGiris();
  const [list, setList] = useState<Comment[]>(initial);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  /** Kendi yorumunu silebilmek için oturum sahibinin kimliği */
  const [meId, setMeId] = useState<string | null>(null);

  /*
   * ⚠ YORUMLAR İSTEMCİDE YENİDEN ÇEKİLİYOR.
   *
   * Haber sayfası `revalidate = 300` ile ÖNBELLEKLİ: sunucu
   * render'ı tüm okurlar arasında paylaşılıyor. Kişiye özel
   * veri (kendi bekleyen yorumum) o render'da doğru olamaz —
   * ilk isteği kim yaptıysa onun görüşü herkese gidiyordu.
   *
   * Tarayıcı istemcisi oturumu taşıyor; `auth.uid()` doğru
   * çalışıyor ve okur kendi bekleyen yorumunu görüyor.
   */
  useEffect(() => {
    let iptal = false;
    void (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb
        .from("public_comments")
        .select("*")
        .eq("article_id", articleId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (iptal || !data) return;
      setList(data as unknown as Comment[]);
    })();
    return () => { iptal = true; };
  }, [articleId]);

  /*
   * ══════════════════════════════════════════════════════════
   * PAYLAŞILAN YORUMA İNME
   *
   * ⚠ ÜÇ AYRI ŞEY BOZUYORDU:
   *
   *  1. Yorumlar İSTEMCİDE çekiliyor; adres çentiği sayfa
   *     açılırken var ama hedef DOM'da henüz yok.
   *  2. Tarayıcı kendi kaydırma geri yüklemesini uyguluyor ve
   *     bizim inişimizi eziyor.
   *  3. Görseller yüklendikçe sayfa uzuyor, hedef kayıyor.
   *
   * Sabit gecikme tahmin etmek yerine `MutationObserver`
   * kullanılıyor: hedef DOM'a girer girmez haber veriyor,
   * ağ hızından bağımsız çalışıyor.
   * ══════════════════════════════════════════════════════════
   */
  useEffect(() => {
    const hedef = window.location.hash;
    if (!hedef.startsWith("#yorum-")) return;

    let eski: ScrollRestoration | undefined;
    try {
      eski = history.scrollRestoration;
      history.scrollRestoration = "manual";
    } catch { /* eski tarayıcı */ }

    let bitti = false;
    const zamanlayicilar: ReturnType<typeof setTimeout>[] = [];

    /** Sticky header'ı hesaba katarak ortala */
    function konumlan(el: HTMLElement) {
      const y = el.getBoundingClientRect().top + window.scrollY
        - window.innerHeight / 2 + el.offsetHeight / 2;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }

    function bak() {
      const el = document.getElementById(hedef.slice(1));
      if (!el || bitti) return;
      bitti = true;
      gozlemci.disconnect();

      konumlan(el);
      el.classList.add("kb-yorum-vurgu");

      /* Görseller yerleştikçe iki kez düzelt */
      zamanlayicilar.push(setTimeout(() => konumlan(el), 500));
      zamanlayicilar.push(setTimeout(() => konumlan(el), 1300));
      zamanlayicilar.push(
        setTimeout(() => el.classList.remove("kb-yorum-vurgu"), 3800),
      );
    }

    const gozlemci = new MutationObserver(bak);
    gozlemci.observe(document.body, { childList: true, subtree: true });
    bak();   // zaten oradaysa beklemeye gerek yok

    /* 10 saniyede gelmezse vazgeç — sonsuz gözlem yapmasın */
    zamanlayicilar.push(setTimeout(() => gozlemci.disconnect(), 10_000));

    return () => {
      gozlemci.disconnect();
      zamanlayicilar.forEach(clearTimeout);
      try { if (eski) history.scrollRestoration = eski; } catch { /* yok say */ }
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const cdnBase = publicConfig().cdnBase;
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Yorum bağlantısını panoya kopyalar.
   *
   * Adres `#yorum-{id}` taşıyor; açan kişi doğrudan o yoruma
   * iniyor ve yorum kısaca vurgulanıyor.
   */
  function paylas(id: string) {
    const adres = `${window.location.origin}${window.location.pathname}#yorum-${id}`;
    void navigator.clipboard?.writeText(adres)
      .then(() => setNotice(dict.article.copied))
      .catch(() => setNotice(dict.common.error));
  }

  /* Toast: 2.6 saniye sonra kendiliğinden kayboluyor */
  useEffect(() => {
    if (!notice) return;
    const z = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(z);
  }, [notice]);


  /* Giriş sonrası dönüşte yazdığı yorum kaybolmasın */
  useEffect(() => {
    try {
      const taslak = sessionStorage.getItem("kb_yorum_taslak");
      if (taslak) {
        setBody(taslak);
        sessionStorage.removeItem("kb_yorum_taslak");
      }
    } catch { /* depolama kapalı */ }
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabaseBrowser().auth.getUser();
      setAuthed(Boolean(data.user));
      setMeId(data.user?.id ?? null);
    })();
  }, []);

  if (!enabled) {
    return (
      <p className="muted" style={{ fontSize: 14 }}>
        {dict.comments.closed}
      </p>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    /*
     * ⚠ GİRİŞ KONTROLÜ BURADA.
     * Yazdığı metin `body` durumunda duruyor; giriş yapınca
     * sayfa yenilense bile kutu boş kalmıyor (taslak
     * `sessionStorage`'da).
     */
    if (authed === false) {
      try { sessionStorage.setItem("kb_yorum_taslak", body); } catch { /* yok say */ }
      girisIste();
      return;
    }
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);

    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("post_comment", {
      p_article_id: articleId,
      p_body: body,
      p_parent_id: replyTo,
      p_user_agent: navigator.userAgent.slice(0, 300),
    });

    if (error) {
      const msg = error.message ?? "";
      setNotice(
        /giriş/i.test(msg) ? dict.comments.loginRequired
        : /kısa/i.test(msg) ? dict.comments.tooShort
        : /sınır/i.test(msg) ? dict.comments.rateLimit
        : dict.common.error,
      );
    } else {
      setBody("");
      setReplyTo(null);
      setNotice(requireApproval ? dict.comments.pending : dict.comments.published);

      /*
       * ⚠ ONAY BEKLESE BİLE LİSTEYE EKLENİYOR.
       *
       * Önce yalnızca onay gerekmiyorsa ekleniyordu. Okur
       * yorumunu gönderiyor, hiçbir şey olmuyor ve "gitti mi"
       * diye merak ediyordu.
       *
       * Yorum artık hemen görünüyor; onay bekliyorsa "Onay
       * bekliyor" etiketiyle. Bu yorumu YALNIZCA yazan görüyor —
       * liste sunucudan gelirken onaysızlar zaten süzülüyor,
       * bu satır sadece bu oturumda, bu ekranda duruyor.
       */
      if (data) {
        const { data: auth } = await sb.auth.getUser();
        const user = auth.user;
        if (!user) { setBusy(false); return; }
        const { data: me } = await sb
          .from("profiles").select("display_name, username, avatar_key, role")
          .eq("id", user.id).maybeSingle();
        const row = data as { id: string; body: string; created_at: string; parent_id: string | null };
        setList((l) => [...l, {
          id: row.id, article_id: articleId, parent_id: row.parent_id,
          body: row.body, created_at: row.created_at, user_id: user.id,
          author_name: me?.display_name ?? "", author_username: me?.username ?? null,
          author_avatar: me?.avatar_key ?? null, author_role: me?.role ?? "reader",
          /* Etiket için: onay bekleyen kendi yorumumuz */
          bekliyor: requireApproval,
        }]);
      }
    }
    setBusy(false);
  }

  /**
   * Kendi yorumunu silme.
   *
   * Yetki kontrolü `delete_own_comment` içinde, veritabanı
   * tarafında. Buradaki `meId` karşılaştırması yalnızca düğmeyi
   * göstermek için — istemciyi atlatan biri yine RPC'ye takılır.
   *
   * Cevabı olan bir yorum silinirse cevaplar öksüz kalmasın diye
   * listeden yalnızca o yorum çıkarılır; alt yorumlar kalır.
   */
  async function remove(id: string) {
    if (!window.confirm(dict.auth.deleteConfirm)) return;
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("delete_own_comment", { p_comment_id: id });
    if (error) {
      setNotice(dict.common.error);
      return;
    }
    setList((prev) => prev.filter((c) => c.id !== id));
  }

  const roots = list.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => list.filter((c) => c.parent_id === id);

  return (
    <section id="yorumlar" style={{ marginTop: 34 }}>
      <div className="section-head">
        <h2>{dict.comments.title}</h2>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          {t(dict.comments.count, { n: list.length })}
        </span>
      </div>

      {/*
        ⚠ KUTU HER ZAMAN GÖRÜNÜYOR.

        Girişsiz okura "giriş yap" düğmesi gösteriliyordu; yorum
        yazma isteği olan biri önce ne yazacağını görmek istiyor.
        Artık kutu duruyor, yazabiliyor — GÖNDERİRKEN giriş
        penceresi açılıyor ve yazdığı metin kaybolmuyor.
      */}
      {/* Yanıt yazılırken üstteki kutu gizli — iki kutu birden
          açık olsaydı hangisinin gönderileceği belirsizdi */}
      <form
        onSubmit={submit}
        style={{ marginBottom: 22, display: replyTo ? "none" : undefined }}
      >
          {/*
            Yanıt göstergesi buradan kaldırıldı; yanıt kutusu
            artık ilgili yorumun altında açılıyor.
          */}
          <textarea
            className="field"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={dict.comments.placeholder}
            maxLength={maxLen}
            rows={3}
            style={{ resize: "vertical", minHeight: 84 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
            <button className="btn btn-primary" disabled={busy || body.trim().length < 2}>
              {busy ? dict.comments.sending : dict.comments.submit}
            </button>
            <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }}>
              {body.length}/{maxLen}
            </span>
          </div>
          {/*
            ⚠ BİLDİRİM ARTIK TOAST.
            Form içinde bir kutu olarak duruyordu; okur onu
            görmüyor, yorumunun gidip gitmediğini anlamıyordu.
            Toast ekranın altında beliriyor.
          */}
          {false && notice && (
            <p role="status" style={{ fontSize: 13, marginTop: 10, color: "var(--ac2)" }}>
              {notice}
            </p>
          )}
      </form>

      {roots.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>{dict.comments.empty}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
          {roots.map((c) => (
            <li key={c.id}>
              <CommentItem c={c} locale={locale} dict={dict} onReply={setReplyTo} meId={meId} onDelete={remove} cdn={cdnBase} onPaylas={paylas} />
              {/*
                ⚠ YANIT KUTUSU YORUMUN ALTINDA.
                Sayfanın en üstündeki kutuya odaklanıyordu;
                okur hangi yoruma yanıt yazdığını göremiyor,
                yukarı kaydırmak zorunda kalıyordu.
              */}
              {replyTo === c.id && (
                <YanitKutusu
                  deger={body}
                  onDegis={setBody}
                  onVazgec={() => { setReplyTo(null); setBody(""); }}
                  onGonder={submit}
                  bekliyor={busy}
                  dict={dict}
                  kime={c.author_name}
                />
              )}
              {childrenOf(c.id).length > 0 && (
                <ul
                  style={{
                    listStyle: "none", margin: "10px 0 0", padding: 0,
                    marginInlineStart: 26, display: "grid", gap: 10,
                    borderInlineStart: "2px solid var(--bd)", paddingInlineStart: 14,
                  }}
                >
                  {childrenOf(c.id).map((r) => (
                    <li key={r.id}>
                      <CommentItem c={r} locale={locale} dict={dict} onReply={setReplyTo} meId={meId} onDelete={remove} cdn={cdnBase} onPaylas={paylas} />
                      {replyTo === r.id && (
                        <YanitKutusu
                          deger={body}
                          onDegis={setBody}
                          onVazgec={() => { setReplyTo(null); setBody(""); }}
                          onGonder={submit}
                          bekliyor={busy}
                          dict={dict}
                          kime={r.author_name}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <div
          role="status"
          style={{
            position: "fixed", insetInline: 0, bottom: 28,
            display: "flex", justifyContent: "center",
            zIndex: 240, pointerEvents: "none",
          }}
        >
          <span
            style={{
              background: "var(--tx)", color: "var(--bg)",
              fontSize: 13.5, fontWeight: 600,
              padding: "11px 20px", borderRadius: 999,
              boxShadow: "0 6px 24px rgba(0,0,0,.28)",
              maxWidth: "86vw", textAlign: "center",
            }}
          >
            {notice}
          </span>
        </div>
      )}

    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   TEK YORUM

   ┌─ KUTU DEĞİL, SATIR ⚠️ ────────────────────────────────────┐
   │ Yorumlar zeminli kutular hâlindeydi ve sayfa form gibi     │
   │ görünüyordu. Artık solda avatar, sağda içerik — okuma      │
   │ akışını bölmeyen bir düzen.                                 │
   └──────────────────────────────────────────────────────────────┘

   ┌─ PAYLAŞ BAĞLANTISI YORUMA GİDİYOR ⚠️ ─────────────────────┐
   │ Bağlantı `#yorum-{id}` taşıyor. Açan kişi haberin o        │
   │ yorumuna kadar iniyor ve yorum kısaca vurgulanıp sönüyor — │
   │ hangi yorumdan bahsedildiği belli oluyor.                   │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */
function CommentItem({
  c, locale, dict, onReply, meId, onDelete, cdn, onPaylas,
}: {
  c: Comment;
  locale: Locale;
  dict: Dictionary;
  onReply: (id: string) => void;
  meId: string | null;
  onDelete: (id: string) => void;
  cdn: string;
  onPaylas: (id: string) => void;
}) {
  const mine = meId !== null && c.user_id === meId;
  const avatar = c.author_avatar
    ? `${cdn.replace(/\/+$/, "")}/${c.author_avatar}`
    : null;

  return (
    <article
      id={`yorum-${c.id}`}
      className="kb-yorum"
      style={{ display: "flex", gap: 12, paddingBlock: 4 }}
    >
      <span
        aria-hidden
        style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: "var(--s2)", display: "grid", placeItems: "center",
          overflow: "hidden",
          fontSize: 14, fontWeight: 800, color: "var(--mu)",
        }}
      >
        {avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatar} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (c.author_name || "?").slice(0, 1).toLocaleUpperCase("tr")}
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 3, flexWrap: "wrap",
        }}>
          <strong style={{ fontSize: 14 }}>{c.author_name}</strong>
          {/* Şu ana bağlı: hidrasyonda saniye kayması olabiliyor */}
          <time
            className="muted"
            style={{ fontSize: 12.5 }}
            dateTime={c.created_at}
            suppressHydrationWarning
          >
            {relativeTime(c.created_at, locale)}
          </time>
          {c.bekliyor && (
            <span
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: "var(--s2)", color: "var(--mu)",
                fontSize: 11, fontWeight: 600,
              }}
            >
              {dict.comments.pending}
            </span>
          )}
          {["author", "admin"].includes(c.author_role) && (
            <span className="badge" style={{ background: "var(--ac)", color: "#fff" }}>
              {c.author_role === "admin" ? "Yönetici" : "Yazar"}
            </span>
          )}
        </div>

        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.6,
          overflowWrap: "anywhere",
        }}>
          {c.body}
        </p>

        <div style={{
          display: "flex", alignItems: "center", gap: 18, marginTop: 8,
        }}>
          {/*
            ⚠ ONAY BEKLEYEN YORUMDA YANIT YOK.
            Bu yorumu yalnızca yazan görüyor; kendi kendine
            yanıt yazmak anlamsız. Onaylandıktan sonra düğme
            geliyor.
          */}
          {!c.bekliyor && (
            <button
              onClick={() => onReply(c.id)}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--mu)" }}
            >
              {dict.comments.reply}
            </button>
          )}

          {/* Paylaş — bağlantı doğrudan bu yoruma gidiyor */}
          <button
            onClick={() => onPaylas(c.id)}
            title={dict.article.share}
            style={{
              fontSize: 13, fontWeight: 700, color: "var(--mu)",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.5.6l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
              <path d="M14 11a5 5 0 0 0-7.5-.6l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            {dict.article.share}
          </button>

          {mine && (
            <button
              onClick={() => onDelete(c.id)}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--dn)" }}
            >
              {dict.common.delete}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════
   YANIT KUTUSU

   Yanıtlanan yorumun hemen altında açılıyor. Kime yazıldığı
   yer tutucuda görünüyor — ayrı bir "şuna yanıt veriyorsun"
   satırına gerek kalmıyor.
   ══════════════════════════════════════════════════════════════ */
function YanitKutusu({
  deger, onDegis, onVazgec, onGonder, bekliyor, dict, kime,
}: {
  deger: string;
  onDegis: (v: string) => void;
  onVazgec: () => void;
  onGonder: (e: React.FormEvent) => void;
  bekliyor: boolean;
  dict: Dictionary;
  kime: string;
}) {
  return (
    <form
      onSubmit={onGonder}
      style={{
        display: "flex", flexDirection: "column", gap: 10,
        margin: "10px 0 6px", marginInlineStart: 48,
        padding: 14, borderRadius: 16, background: "var(--s2)",
      }}
    >
      <textarea
        value={deger}
        onChange={(e) => onDegis(e.target.value)}
        placeholder={`${dict.comments.reply}: ${kime}`}
        rows={3}
        autoFocus
        style={{
          width: "100%", resize: "vertical", minHeight: 68,
          border: "none", outline: "none", background: "transparent",
          fontSize: 14.5, lineHeight: 1.55, color: "var(--tx)",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onVazgec}
          style={{
            padding: "9px 16px", borderRadius: 999,
            fontSize: 13.5, fontWeight: 600, color: "var(--mu)",
          }}
        >
          {dict.common.close}
        </button>
        <button
          type="submit"
          disabled={bekliyor || !deger.trim()}
          style={{
            padding: "9px 20px", borderRadius: 999, border: "none",
            fontSize: 13.5, fontWeight: 700,
            background: "var(--tx)", color: "var(--bg)",
            cursor: "pointer",
            opacity: bekliyor || !deger.trim() ? 0.45 : 1,
          }}
        >
          {bekliyor ? dict.comments.sending : dict.comments.submit}
        </button>
      </div>
    </form>
  );
}
