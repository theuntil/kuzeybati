"use client";
import { useEffect, useState } from "react";
import { useGiris } from "@/components/auth/GirisPenceresi";
import DilSecici from "@/components/site/DilSecici";
import AksiyonIkon from "@/components/ui/AksiyonIkon";
import Icon from "@/components/ui/Icon";
import ShareSheet from "./ShareSheet";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, localeFlags, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Link from "next/link";

/**
 * Haber başlığının altındaki künye satırı — prototipteki yapı:
 * kaynak logosu · ad + tarih · sağda yuvarlak eylem düğmeleri
 * (paylaş · beğen · kaydet · dil).
 */
export default function ArticleHeader({
  articleId, sourceName, sourceLogo, avatarMi = false, meta, locale, dict,
  initialLikes, likesEnabled, initialSaved = false,
  profilHref = null,
  cocukGuvenli = null,
}: {
  articleId: string;
  sourceName: string;
  sourceLogo: string | null;
  /** Görsel bir yazar avatarı mı (kırpılarak dolduruluyor) */
  avatarMi?: boolean;
  /**
   * Yazar ya da yayıncı sayfasının adresi.
   *
   * Varsa künye tıklanabilir oluyor. Yoksa (elle girilmiş bir
   * künye metni gibi) düz metin kalıyor — hiçbir yere gitmeyen
   * bir bağlantı okuru boşa tıklatır.
   */
  profilHref?: string | null;
  /**
   * AI değerlendirmesi: true/false/null.
   *
   * ⚠ Uyarı KÜNYENİN ALTINDA. Başlığın hemen altındayken
   * özetin önüne geçiyordu; burası daha doğal — kaynağı ve
   * tarihi okuyan göz zaten oraya bakıyor.
   */
  cocukGuvenli?: boolean | null;
  meta: string;
  locale: Locale;
  dict: Dictionary;
  initialLikes: number;
  likesEnabled: boolean;
  /** Sunucudan gelir: kullanıcı bu haberi daha önce kaydetmiş mi */
  initialSaved?: boolean;
}) {
  const { girisIste, girisli } = useGiris();
  const [likes, setLikes] = useState(initialLikes);
  /*
   * ⚠ DURUM ÖNCE TARAYICI BELLEĞİNDEN.
   *
   * Sunucudan gelmesi ~1 saniye sürüyor ve düğme o süre
   * boyunca boş görünüyordu — okur "beğenim gitti mi?" diye
   * düşünüyordu.
   *
   * Son bilinen durum `localStorage`'da; sayfa açılır açılmaz
   * doğru görünüm çiziliyor, sunucu yanıtı gelince
   * doğrulanıyor. Yanlışsa sessizce düzeltiliyor.
   */
  const [liked, setLiked] = useState(() => yerelOku(`kb_like_${articleId}`));

  /*
   * ⚠ BEĞENİ VE KAYIT DURUMU İSTEMCİDE OKUNUYOR.
   *
   * Haber sayfası önbellekli (`revalidate = 300`); sunucu
   * render'ı tüm okurlar arasında paylaşılıyor. "Bu okur
   * beğenmiş mi" bilgisi orada doğru olamaz — `liked` hep
   * `false` başlıyordu ve sayfa yenilenince beğeni düğmesi
   * boş görünüyordu.
   */
  useEffect(() => {
    let iptal = false;
    void (async () => {
      const sb = supabaseBrowser();
      const { data: u } = await sb.auth.getUser();
      if (iptal || !u.user) return;

      const [begeni, kayit] = await Promise.all([
        sb.from("article_likes")
          .select("article_id")
          .eq("article_id", articleId)
          .eq("user_id", u.user.id)
          .maybeSingle(),
        sb.from("saved_articles")
          .select("article_id")
          .eq("article_id", articleId)
          .eq("user_id", u.user.id)
          .maybeSingle(),
      ]);
      if (iptal) return;
      const b = Boolean(begeni.data);
      const k = Boolean(kayit.data);
      setLiked(b);
      setSaved(k);
      yerelYaz(`kb_like_${articleId}`, b);
      yerelYaz(`kb_save_${articleId}`, k);
    })();
    return () => { iptal = true; };
  }, [articleId]);
  const [saved, setSaved] = useState(() => yerelOku(`kb_save_${articleId}`) || initialSaved);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

/**
 * Beğeni ve kayıt durumunun son bilinen hâli.
 *
 * ⚠ GÜVENLİK DEĞİL, HIZ İÇİN. Gerçek durum her zaman
 * veritabanında; bu yalnızca ilk çizimi doğru yapıyor.
 * Biri buradaki değeri değiştirirse sunucu yanıtı gelince
 * düzeliyor ve hiçbir yetki kazanmıyor.
 */
function yerelOku(anahtar: string): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(anahtar) === "1"; } catch { return false; }
}

function yerelYaz(anahtar: string, deger: boolean) {
  try { localStorage.setItem(anahtar, deger ? "1" : "0"); } catch { /* depolama kapalı */ }
}

/**
 * 2600 → 2.6k
 *
 * Dört haneli sayı düğmeyi gereksiz genişletiyor ve okunması
 * zorlaşıyor.
 */
function kisaSayi(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const b = n / 1000;
    return (b < 10 ? b.toFixed(1).replace(/\.0$/, "") : Math.round(b)) + "k";
  }
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

  const act: React.CSSProperties = {
    width: "var(--actBtn)", height: "var(--actBtn)", borderRadius: 999,
    border: "1px solid var(--bd)", background: "var(--s1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, color: "var(--tx)",
  };

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  /**
   * Paylaş: her zaman KENDİ penceremizi açar.
   *
   * `navigator.share` işletim sisteminin tabakasını açardı; tasarım
   * masaüstünde ortada açılan pencere, mobilde alttan kayan tabaka
   * istiyor. Kendi arayüzümüz her platformda aynı görünüyor.
   */
  function share() {
    setShareOpen(true);
  }

  /** Haberi kaydet / kaydı kaldır — üyelik zorunlu */
  async function save() {
    /*
     * ⚠ `getUser()` ÇAĞRILMIYOR.
     *
     * Her tıklamada Supabase'e "kim bu" diye soruluyordu; ağ
     * gidiş dönüşü yüzünden düğme bir saniye sonra tepki
     * veriyordu. Oturum bilgisi zaten bağlamda hazır duruyor.
     */
    if (!girisli) { girisIste(); return; }

    /*
     * İyimser güncelleme: düğme ANINDA değişiyor, istek arka
     * planda gidiyor. Başarısız olursa geri alınıyor.
     */
    const before = saved;
    setSaved(!saved);
    yerelYaz(`kb_save_${articleId}`, !saved);

    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("toggle_saved_article", { p_article_id: articleId });
    if (error) {
      setSaved(before);
      flash(dict.common.error);
    } else {
      const next = Array.isArray(data) ? Boolean(data[0]?.saved) : Boolean(data);
      setSaved(next);
    }
  }

  async function like() {
    if (!girisli) { girisIste(); return; }

    /* Anında değişiyor, istek arka planda — bkz. `save()` */
    const before = { liked, likes };
    const sb = supabaseBrowser();
    setLiked(!liked);
    yerelYaz(`kb_like_${articleId}`, !liked);
    setLikes((n) => n + (liked ? -1 : 1));
    const { data, error } = await sb.rpc("toggle_article_like", { p_article_id: articleId });
    if (error) {
      setLiked(before.liked);
      setLikes(before.likes);
      flash(dict.common.error);
    } else if (Array.isArray(data) && data[0]) {
      setLiked(Boolean(data[0].liked));
      setLikes(Number(data[0].like_count));
    }
  }

  return (
    <div
      style={{
        display: "flex", gap: 10, alignItems: "center",
        margin: "18px 0", paddingBottom: 18, borderBottom: "1px solid var(--bd)",
      }}
    >
      <span
        style={{
          width: 36, height: 36, borderRadius: 999, overflow: "hidden",
          flexShrink: 0,
          /*
           * ⚠ LOGOYA ZEMİN VERİLMİYOR.
           * Kaynak logoları saydam PNG; arkasına beyaz koyunca
           * koyu temada beyaz bir kare olarak çıkıyordu.
           * Logo yoksa baş harf gösterilecek, o zaman zemin gerekli.
           */
          background: sourceLogo ? "transparent" : "var(--s2)",
          display: "grid", placeItems: "center",
          fontSize: 14, fontWeight: 800, color: "var(--mu)",
        }}
      >
        {sourceLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          /*
            ⚠ `contain` DEĞİL, AVATARDA `cover`.
            Kaynak logosu saydam ve kırpılmamalı (`contain`), ama
            yazar avatarı bir fotoğraf: `contain` ile yuvarlağın
            içinde boşluklu duruyordu.
          */
          <img
            src={sourceLogo}
            alt=""
            style={{
              width: "100%", height: "100%",
              objectFit: avatarMi ? "cover" : "contain",
            }}
          />
        ) : (
          sourceName.slice(0, 1)
        )}
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        {profilHref ? (
          <Link
            href={profilHref}
            style={{
              display: "block",
              fontSize: 13.5, fontWeight: 700, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              color: "inherit", textDecoration: "none",
            }}
            title={`${sourceName} sayfası`}
          >
            {sourceName}
          </Link>
        ) : (
          <div
            style={{
              fontSize: 13.5, fontWeight: 700, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {sourceName}
          </div>
        )}
        <div
          style={{
            fontSize: 12, color: "var(--mu)", marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {/*
            ⚠ BEĞENİ SAYISI BURADAN KALDIRILDI.
            Düğmenin üstünde zaten görünüyor; künyede tekrar
            etmek aynı bilgiyi iki kez göstermekti.
          */}
          {meta}
        </div>

        {/*
          Çocuk uygunluğu — künyenin altında, tek satır.

          ⚠ ÜÇ DURUM, ÜÇ RENK:
            true  → yeşil, "Çocuklar için uygun"
            false → koyu kırmızı, "Çocuklar için uygun değil"
            null  → sönük, "Çocuklar için uygun olmayabilir"

          `null` AI'nın bakmadığı haber demek. Sessiz kalmak
          yerine belirsizliği söylemek daha dürüst — okur
          "değerlendirilmiş ve uygun" sanmasın.
        */}
        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            marginTop: 5, fontSize: 11.5, fontWeight: 600,
            color:
              cocukGuvenli === true ? "#16a34a"
              : cocukGuvenli === false ? "#b91c1c"
              : "var(--mu)",
            opacity: cocukGuvenli === null || cocukGuvenli === undefined ? 0.75 : 1,
          }}
        >
          {cocukGuvenli === true ? (
            /* Çocuk figürü */
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="7" r="3.2" />
              <path d="M6 20v-1.5A6 6 0 0 1 12 13a6 6 0 0 1 6 5.5V20" />
            </svg>
          ) : cocukGuvenli === false ? (
            /* Kilit */
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            </svg>
          ) : (
            /*
              Değerlendirilmedi — AÇIK KİLİT.
              Soru işareti "bir sorun mu var" hissi veriyordu.
              Açık kilit "kapalı değil ama emin de değiliz"
              anlamını daha iyi taşıyor.
            */
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
              <path d="M8 10.5V7a4 4 0 0 1 7.5-1.9" />
            </svg>
          )}
          {cocukGuvenli === true ? "Çocuklar için uygun"
            : cocukGuvenli === false ? "Çocuklar için uygun değil"
            : "Çocuklar için uygun olmayabilir"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginInlineStart: "auto", flexShrink: 0 }}>
        <button onClick={share} title={dict.article.share} aria-label={dict.article.share} style={act}>
          <Icon name="share" size={17} strokeWidth={1.5} />
        </button>

        {likesEnabled && (
          <button
            onClick={like}
            title={dict.article.like}
            aria-label={dict.article.like}
            aria-pressed={liked}
            data-aksiyon={liked ? "secili" : undefined}
            className="kb-tap"
            style={{
              ...act,
              /*
               * ⚠ SAYI VARSA GENİŞLİYOR.
               * Sıfırken sade yuvarlak düğme; beğeni geldikçe
               * hap biçimine dönüp sayıyı gösteriyor. "0"
               * göstermek boş bir bilgi.
               */
              width: likes > 0 ? "auto" : "var(--actBtn)",
              minWidth: "var(--actBtn)",
              paddingInline: likes > 0 ? 13 : 0,
              gap: likes > 0 ? 7 : 0,
              background: liked ? "var(--ac)" : "var(--s1)",
              color: liked ? "#fff" : "var(--tx)",
              borderColor: liked ? "var(--ac)" : "var(--bd)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                /* Basınca kalp hafif büyüyüp yerine oturuyor */
                transform: liked ? "scale(1.12)" : "scale(1)",
                transition: "transform .28s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <AksiyonIkon tur="heart" aktif={liked} size={18} />
            </span>
            {likes > 0 && (
              <span className="kb-num" style={{ fontSize: 13.5, fontWeight: 700 }}>
                {kisaSayi(likes)}
              </span>
            )}
          </button>
        )}

        <button
          onClick={save}
          data-aksiyon={saved ? "secili" : undefined}
          data-tur="bookmark"
          className="kb-tap"
          title={dict.auth.save}
          aria-label={dict.auth.save}
          aria-pressed={saved}
          style={{
            ...act,
            background: saved ? "var(--tx)" : "var(--s1)",
            color: saved ? "var(--bg)" : "var(--tx)",
            borderColor: saved ? "var(--tx)" : "var(--bd)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              transform: saved ? "scale(1.12)" : "scale(1)",
              transition: "transform .28s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <AksiyonIkon tur="bookmark" aktif={saved} size={18} />
          </span>
        </button>

        {/*
          ⚠ BU BİR BAĞLANTIYDI VE ANA SAYFAYA GİDİYORDU.
          `href(locale, "home")` — dil bile değiştirmiyordu.
          Artık header'daki ile aynı bileşen: pencere açılıyor,
          seçilen dilde AYNI haber açılıyor.
        */}
        <span style={{ display: "inline-flex" }}>
          <DilSecici locale={locale} etiket={dict.nav.language} boyut={15} />
        </span>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={typeof window === "undefined" ? "" : window.location.href}
        title={typeof document === "undefined" ? "" : document.title}
        dict={dict}
        onCopied={() => flash(dict.article.copied)}
      />

      {toast && (
        <span
          role="status"
          style={{
            position: "fixed", insetInline: 0, bottom: 90, textAlign: "center",
            fontSize: 13, fontWeight: 700, zIndex: 220, pointerEvents: "none",
          }}
        >
          <span
            style={{
              background: "var(--tx)", color: "var(--bg)",
              padding: "9px 16px", borderRadius: 999,
            }}
          >
            {toast}
          </span>
        </span>
      )}
    </div>
  );
}
