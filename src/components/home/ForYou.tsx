"use client";
import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import { href, type Locale, haberYolu} from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Article } from "@/lib/types";
import { pickImage, assetUrl } from "@/lib/media";
import { articleMinutes, relativeTime, t } from "@/lib/format";
import ViewToggle, { type FeedView } from "./ViewToggle";
import Icon from "@/components/ui/Icon";
import CocukKapak from "@/components/site/CocukKapak";
import Link from "next/link";

/**
 * SANA ÖZEL AKIŞI
 *
 * İki görünüm, sağdaki anahtarla değişir:
 *   kart  — kaynak künyesi + büyük görsel + özet (varsayılan)
 *   liste — solda küçük görsel, sağda başlık (daha yoğun)
 *
 * Seçim `localStorage`'a yazılır; okur her ziyarette aynı
 * görünümle karşılaşır.
 */


/** Karta çizilen alanlar — API de bu biçimi döndürür. */
export interface FeedItem {
  /** Haber adresi kategori altında kurulur; yoksa eski biçim */
  category_slug?: string | null;
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  byline: string | null;
  son_dakika: boolean;
  /* Çocuk modunda kapak basmak için */
  cocuk_guvenli: boolean | null;
  published_at: string;
  category_name: string | null;
  category_color: string | null;
  city_name: string | null;
  city_slug: string | null;
  source_name: string | null;
  source_logo: string | null;
  minutes: number;
  comment_count: number;
  thumb: string | null;
  card: string | null;
  color: string | null;
  ai: string | null;
}

/** Sunucudan gelen tam Article'ı kart biçimine indir. */
function toItem(a: Article): FeedItem {
  return {
    id: a.id, slug: a.slug, title: a.title, summary: a.summary,
    byline: a.byline, son_dakika: a.son_dakika, published_at: a.published_at,
    cocuk_guvenli: a.cocuk_guvenli ?? null,
    category_name: a.category_name, category_color: a.category_color,
    city_name: a.city_name, city_slug: a.city_slug,
    source_name: a.source_name, source_logo: assetUrl(a.source_logo),
    minutes: articleMinutes(a), comment_count: a.stats?.comment_count ?? 0,
    thumb: pickImage(a.cover, "thumb"), card: pickImage(a.cover, "card"),
    color: a.cover?.dominant_color ?? null, ai: a.ai?.ozet ?? null,
  };
}

/*
 * ══════════════════════════════════════════════════════════════
 *  MOBİLDE WIDGET ARASI
 *
 *  ┌─ WIDGET'LAR EN ALTTA KALIYORDU ⚠️ ─────────────────────────┐
 *  │ Masaüstünde yan sütun haberlerin yanında duruyor. Mobilde │
 *  │ o sütun akışın ALTINA düşüyor: okur onlarca haberi geçmeden│
 *  │ piyasa, namaz ya da deprem bilgisini hiç görmüyordu.       │
 *  │                                                              │
 *  │ Artık her dört haberde bir araya giriyorlar.               │
 *  │                                                              │
 *  │ ⚠ SIRAYLA VE TEKRARSIZ. Widget sayısı bitince yenisi       │
 *  │ eklenmiyor; aynı widget iki kez çıkmıyor.                   │
 *  └──────────────────────────────────────────────────────────────┘
 * ══════════════════════════════════════════════════════════════
 */
const ARA_SIKLIK = 4;

function araVer(
  aralar: React.ReactNode[] | undefined,
  index: number,
): React.ReactNode {
  if (!aralar?.length) return null;

  /* 4. öğeden sonra ilk widget (index 3, 7, 11 …) */
  if ((index + 1) % ARA_SIKLIK !== 0) return null;

  const sira = Math.floor((index + 1) / ARA_SIKLIK) - 1;
  const w = aralar[sira];
  if (!w) return null;

  return <div className="kb-akis-ara">{w}</div>;
}

export default function ForYou({
  articles, locale, dict, mobilAralar, title, sidebar,
  sonsuzAkis = true, ikiKolon = false, kategori, sehir,
}: {
  articles: Article[];
  /*
   * Mobilde haberlerin ARASINA serpiştirilecek widget'lar.
   *
   * ⚠ MASAÜSTÜNDE BASILMIYOR.
   * Orada yan sütun var; aynı widget iki kez görünürdü.
   */
  mobilAralar?: React.ReactNode[];
  locale: Locale;
  dict: Dictionary;
  title: string;
  /*
   * ⚠ SONSUZ AKIŞ ANA SAYFAYA ÖZEL.
   *
   * Kaydırınca `/api/feed`'den TÜM SİTEDEN haber çekiliyor.
   * Ana sayfada doğru davranış ama yazar/yayıncı sayfasında
   * felaket: bir yazarın tek haberi varken altına başkalarının
   * haberleri diziliyor ve hepsi o yazara aitmiş gibi
   * görünüyordu.
   *
   * O sayfalarda `false` geçiliyor — yalnızca sunucudan gelen
   * liste gösteriliyor.
   */
  sonsuzAkis?: boolean;
  /*
   * ⚠ AÇIK SEÇENEK — `sidebar`DAN TÜRETİLMİYOR.
   *
   * Önce "yan sütun yoksa iki kolon" varsayılıyordu. Ama ana
   * sayfa da `sidebar` geçmiyor (yan sütununu kendi
   * yerleşiminde ayrı çiziyor); sonuçta ana sayfadaki "size
   * özel" akışı istenmediği hâlde iki kolona düştü.
   *
   * Artık yalnızca açıkça isteyen sayfa (yazar, yayıncı)
   * alıyor.
   */
  ikiKolon?: boolean;
  /*
   * Sonsuz akışın hangi listeden devam edeceği.
   * Verilmezse ana sayfa akışı kullanılıyor.
   */
  kategori?: string;
  sehir?: string;
  /**
   * Yan sütun (bülten, lig tablosu, piyasalar…).
   *
   * Sunucu bileşeni olarak dışarıdan geçiliyor. Böylece başlık
   * satırı SAYFANIN TAMAMINI kaplayabiliyor ve görünüm anahtarı
   * en sağa, bültenin üstüne hizalanıyor. Anahtar akış sütununun
   * içinde kalsaydı sayfanın ortasında duruyordu.
   */
  sidebar?: React.ReactNode;
}) {
  const [view, setView] = useState<FeedView>("large");
  const [items, setItems] = useState<FeedItem[]>(() => articles.map(toItem));
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinel = useRef<HTMLDivElement>(null);

  /**
   * KAYDIRDIKÇA YÜKLE
   *
   * Sayfa sonuna yaklaşınca 10 haber daha çekilir, en fazla 50.
   * `IntersectionObserver` kaydırma olayından iyidir: her pikselde
   * tetiklenmez, yalnızca nöbetçi eleman görününce çalışır.
   */
  const loadMore = useCallback(async () => {
    /* Sonsuz akış kapalıysa hiç istek atılmıyor */
    if (!sonsuzAkis || loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/feed?locale=${locale}&offset=${items.length}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("feed");
      const data = (await res.json()) as { items: FeedItem[]; hasMore: boolean };
      setItems((prev) => {
        // Aynı haber iki kez eklenmesin (yarış durumu)
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...data.items.filter((x) => !seen.has(x.id))];
      });
      setHasMore(data.hasMore);
    } catch {
      // Ağ hatasında sessizce dur; okur kaydırmaya devam edebilir
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [sonsuzAkis, loading, hasMore, items.length, locale, kategori, sehir]);

  useEffect(() => {
    const el = sentinel.current;
    if (!sonsuzAkis || !el || !hasMore) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) void loadMore(); },
      { rootMargin: "600px 0px" }, // ekrana girmeden önce başlat
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sonsuzAkis, loadMore, hasMore]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kb-feed-view");
      if (saved === "small" || saved === "large") setView(saved);
    } catch {
      /* gizli sekmede localStorage kapalı olabilir */
    }
  }, []);

  function pick(v: FeedView) {
    setView(v);
    try { localStorage.setItem("kb-feed-view", v); } catch { /* yok say */ }
  }

  if (!items.length) return null;

  return (
    <section>
      {/* ---- başlık + görünüm anahtarı: TAM GENİŞLİK ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2
          style={{
            fontSize: "var(--h2)", fontWeight: 800,
            letterSpacing: "-.03em", overflowWrap: "anywhere",
          }}
        >
          {title}
        </h2>

        {/*
          ⚠ "Akış görünümü" YAZISI KALDIRILDI.
          Yanındaki iki ikonlu anahtar zaten ne yaptığını
          gösteriyor; etiket masaüstünde yer kaplıyordu.
        */}
        {/*
          ⚠ GÖRÜNÜM ANAHTARI HER YERDE.
          Bir ara profil sayfalarında gizlenmişti; ama akış
          ana sayfadakiyle BİREBİR aynı olmalı — okur orada
          liste görünümünü seçtiyse burada da seçebilmeli.
          Tercih `localStorage`'da, iki sayfa arasında taşınıyor.
        */}
        <span style={{ marginInlineStart: "auto" }}>
          <ViewToggle
            value={view}
            onChange={pick}
            labels={{ small: dict.home.viewList, large: dict.home.viewCard }}
          />
        </span>
      </div>

      {/* ---- akış ---- */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "var(--g)",
          alignItems: "flex-start",
        }}
      >
        {/*
          ⚠ YAN SÜTUN YOKSA GENİŞLİK SINIRI DA YOK.

          `--feedMax` ana sayfada bültenin/piyasaların oturduğu
          sağ sütuna yer ayırıyor. Yazar ve yayıncı sayfasında
          yan sütun geçilmiyor; sınır kalınca kartlar ekranın
          yarısını kaplayıp diğer yarısı bomboş kalıyordu.
        */}
        <div
          data-home-wrap
          style={{
            /*
             * Genişlik sınırı yalnızca iki kolonlu sayfalarda
             * kalkıyor. Ana sayfada `--feedMax` korunuyor —
             * orada akış tek kolon ve okunabilir genişlikte.
             */
            flex: ikiKolon ? "1 1 100%" : "2 1 var(--main)",
            minWidth: 0,
            maxWidth: ikiKolon ? "100%" : "var(--feedMax)",
          }}
        >
      {view === "large" ? (
        /*
          ⚠ YAN SÜTUN YOKSA İKİ KOLON.

          Kart tasarımı ana sayfadakiyle AYNI (`CardRow`). Ama
          yan sütun olmayan sayfalarda (yazar, yayıncı) tek
          kolonda basılınca kart tüm genişliğe geriliyor ve
          orantısı bozuluyordu.

          Aynı kart, geniş ekranda iki kolona diziliyor: tasarım
          değişmiyor, boş alan kalmıyor.
        */
        <div
          className={ikiKolon ? "kb-akis-izgara" : undefined}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {items.map((a, i) => (
            <Fragment key={a.id}>
              <CardRow a={a} locale={locale} dict={dict} />
              {araVer(mobilAralar, i)}
            </Fragment>
          ))}
          {loading && <CardSkeleton />}
        </div>
      ) : (
        <div
          style={{
            background: "var(--s1)", border: "1px solid var(--bd)",
            borderRadius: 18, padding: "6px 18px",
          }}
        >
          {items.map((a, i) => (
            <Fragment key={a.id}>
              <ListRow
                a={a}
                locale={locale}
                dict={dict}
                last={i === items.length - 1 && !loading}
              />
              {araVer(mobilAralar, i)}
            </Fragment>
          ))}
          {loading && <ListSkeleton />}
        </div>
      )}

      {/* nöbetçi: görününce sonraki sayfa çekilir */}
      {hasMore && <div ref={sentinel} aria-hidden style={{ height: 1 }} />}

      {!hasMore && items.length > 12 && (
        <p
          style={{
            textAlign: "center", color: "var(--mu)", fontSize: 13.5,
            fontWeight: 600, padding: "24px 0 4px",
          }}
        >
          {dict.home.endOfFeed}
        </p>
      )}
        </div>

        {sidebar && (
          <aside
            style={{
              flex: "1 1 var(--side)", minWidth: 0,
              display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            {sidebar}
          </aside>
        )}
      </div>

    </section>
  );
}

/* ============================================================
   KART GÖRÜNÜMÜ
   ============================================================ */
function CardRow({
  a, locale, dict,
}: {
  a: FeedItem;
  locale: Locale;
  dict: Dictionary;
}) {
  const img = a.card;
  const logo = a.source_logo;
  const link = haberYolu(locale, a.slug, a.category_slug);

  return (
    <article
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18,
      }}
    >
      {/* künye satırı */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span
          style={{
            position: "relative", width: 38, height: 38, borderRadius: 999, overflow: "hidden",
            flexShrink: 0,
            /* Saydam PNG logolar — arkasına renk konmuyor */
            background: logo ? "transparent" : "var(--s3)",
            display: "grid", placeItems: "center",
            fontSize: 15, fontWeight: 800, color: "var(--mu)",
          }}
        >
          {logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt="" style={{ objectFit: "contain" }} />
          ) : (
            (a.source_name ?? "K").slice(0, 1)
          )}
        </span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              position: "relative", display: "block", fontSize: 15.5, fontWeight: 700,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {a.source_name ?? a.byline}
          </span>
          {a.byline && a.byline !== a.source_name && (
            <span
              style={{
                position: "relative", display: "block", fontSize: 13.5, color: "var(--mu)", marginTop: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {a.byline}
            </span>
          )}
        </span>

        {a.city_slug && (
          <Link
            href={href(locale, "city", a.city_slug)}
            style={{
              flexShrink: 0, padding: "7px 16px", borderRadius: 999,
              border: "1px solid var(--bd)", fontSize: 13.5, fontWeight: 600,
              color: "var(--ac)",
            }}
          >
            {a.city_name}
          </Link>
        )}
      </div>

      <Link href={link} style={{ display: "block", color: "var(--tx)" }}>
        <span
          style={{
            position: "relative", display: "block", width: "100%",
            aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden",
            background: a.color ?? "var(--s2)",
          }}
        >
          {img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={img}
              sizes="(max-width: 860px) 100vw, 620px"
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            /*
              ⚠ VARSAYILAN GÖRSEL BURADA DA GEREKLİ.
              Panelden ayarlanan görsel yalnızca üç ana sayfa
              bileşeninde çiziliyordu; akış kartlarında,
              profil listelerinde ve haber sayfasında görselsiz
              haber boş bir renk kutusu olarak kalıyordu.
            */
            <VarsayilanGorsel />
          )}
          {/* Çocuk modunda uygunsuz haberin kapağı buzlanıyor */}
          <CocukKapak guvenli={a.cocuk_guvenli} />
          {(a.category_name || a.son_dakika) && (
            <span
              style={{
                position: "absolute", insetInlineStart: 14, bottom: 14,
                background: a.son_dakika ? "var(--dn)" : "rgba(20,20,20,.72)",
                backdropFilter: "blur(10px)", color: "#fff",
                fontSize: 14, fontWeight: 600, padding: "7px 16px", borderRadius: 999,
              }}
            >
              {a.son_dakika ? dict.home.breaking : a.category_name}
            </span>
          )}
        </span>

        <h3
          style={{
            fontSize: 21, fontWeight: 800, lineHeight: 1.24,
            letterSpacing: "-.02em", marginTop: 16, textWrap: "pretty",
            overflowWrap: "anywhere",
          }}
        >
          {a.title}
        </h3>

        {a.summary && (
          <p
            style={{
              fontSize: 15.5, lineHeight: 1.5, color: "var(--mu)", marginTop: 8,
              // TEK SATIR: kart yüksekliği sabit kalsın, akış düzenli aksın
              display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {a.summary}
          </p>
        )}

        {/* AI özeti — varsa özetin altında */}
        {a.ai && (
          <div
            style={{
              marginTop: 12, borderRadius: 14, padding: "13px 15px",
              background: "var(--ai-bg)", border: "1px solid var(--ai-bd)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="sparkles" size={16} color="var(--ai-fg)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {dict.article.keyTakeaways}
              </span>
            </span>
            <span
              style={{
                display: "block", marginTop: 8, fontSize: 13.5, lineHeight: 1.5,
                color: "var(--mu)",
              }}
            >
              <span aria-hidden style={{ marginInlineEnd: 7 }}>•</span>
              <span
                style={{
                  position: "relative", display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}
              >
                {a.ai}
              </span>
              <span
                style={{
                  display: "block", marginTop: 6, textAlign: "end",
                  color: "var(--ai-fg)", fontWeight: 600, fontSize: 13.5,
                }}
              >
                {dict.article.seeMore}
              </span>
            </span>
          </div>
        )}

        <div
          style={{
            display: "flex", alignItems: "center", gap: 14, marginTop: 14,
            fontSize: 13.5, color: "var(--mu)", fontWeight: 500,
          }}
        >
          {a.comment_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="comment" size={15} />
              {a.comment_count}
            </span>
          )}
          {/* Okuma süresi yerine yayın zamanı — tazelik daha bilgilendirici */}
          {/*
            ⚠ `suppressHydrationWarning` ŞART.

            Bu bir istemci bileşeni. Sunucu HTML'i üretirken
            "5 dakika önce" yazıyor; tarayıcı hidrasyon anında
            aynı hesabı yapınca saniyeler geçmiş oluyor ve
            "6 dakika önce" çıkabiliyor.

            React bu uyuşmazlıkta sunucu HTML'ini ÇÖPE ATIP tüm
            ağacı istemcide yeniden çiziyor. Ekranda "yüklendi,
            sonra baştan yükleniyor" gibi görünüyordu.

            Bu bayrak yalnızca metin farkını görmezden geliyor;
            sunucunun bastığı değer korunuyor.
          */}
          <span suppressHydrationWarning>
            {/* Aynı gerekçe: hidrasyonda saniye kayması */}
            <span suppressHydrationWarning>
              {relativeTime(a.published_at, locale)}
            </span>
          </span>
          <time
            dateTime={a.published_at}
            style={{ marginInlineStart: "auto" }}
            suppressHydrationWarning
          >
            {relativeTime(a.published_at, locale)}
          </time>
        </div>
      </Link>
    </article>
  );
}

/* ============================================================
   LİSTE GÖRÜNÜMÜ
   ============================================================ */
function ListRow({
  a, locale, dict, last,
}: {
  a: FeedItem;
  locale: Locale;
  dict: Dictionary;
  last: boolean;
}) {
  const img = a.thumb;
  const logo = a.source_logo;

  return (
    <Link
      href={haberYolu(locale, a.slug, a.category_slug)}
      className="kb-listrow"
      style={{
        display: "flex", gap: 16, alignItems: "flex-start",
        padding: "16px 0", color: "var(--tx)",
        borderBottom: last ? undefined : "1px solid var(--bd)",
      }}
    >
      <span
        style={{
          position: "relative", width: "var(--fy-thumb)", flexShrink: 0, aspectRatio: "4 / 3",
          borderRadius: 8, overflow: "hidden",
          background: a.color ?? "var(--s2)",
        }}
      >
        {img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={img} alt="" loading="lazy" decoding="async" />
        ) : (
          <VarsayilanGorsel />
        )}
      </span>

      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block", fontSize: 14, fontWeight: 600,
            color: a.son_dakika ? "var(--dn)" : a.category_color ?? "var(--ac)",
          }}
        >
          {a.son_dakika ? dict.home.breaking : a.category_name ?? a.city_name}
        </span>

        <span
          className="kb-listrow-title"
          style={{
            display: "block", fontSize: 18, fontWeight: 700, lineHeight: 1.28,
            letterSpacing: "-.01em", marginTop: 5, textWrap: "pretty",
            overflowWrap: "anywhere",
          }}
        >
          {a.title}
        </span>

        <span
          style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 9,
            fontSize: 13.5, color: "var(--mu)", fontWeight: 500,
          }}
        >
          {logo && (
            <span style={{ position: "relative", width: 20, height: 20, borderRadius: 999, overflow: "hidden", flexShrink: 0, background: "transparent" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" style={{ objectFit: "contain" }} />
            </span>
          )}
          <span style={{ position: "relative", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.source_name ?? a.byline}
          </span>
          <span aria-hidden>/</span>
          {/* Şu ana bağlı: hidrasyonda saniye kayması olabiliyor */}
          <span style={{ flexShrink: 0 }} suppressHydrationWarning>
            {relativeTime(a.published_at, locale)}
          </span>
        </span>
      </span>
    </Link>
  );
}


/* ============================================================
   İSKELETLER

   Yükleme sırasında gösterilen yer tutucular. Ölçüleri gerçek
   kartla AYNI: yeni haberler gelince sayfa zıplamaz, okur
   kaydırdığı yeri kaybetmez.
   ============================================================ */
const shimmer: React.CSSProperties = {
  background: "var(--s2)",
  borderRadius: 8,
  animation: "shimmer 1.4s ease-in-out infinite",
};

function CardSkeleton() {
  return (
    <article
      aria-hidden
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18,
      }}
    >
      {/* künye satırı */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ ...shimmer, width: 38, height: 38, borderRadius: 999, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...shimmer, display: "block", height: 13, width: "38%" }} />
          <span style={{ ...shimmer, display: "block", height: 11, width: "24%", marginTop: 6 }} />
        </span>
      </div>

      {/* görsel */}
      <span style={{ ...shimmer, display: "block", width: "100%", aspectRatio: "16 / 9", borderRadius: 12 }} />

      {/* başlık iki satır */}
      <span style={{ ...shimmer, display: "block", height: 20, width: "94%", marginTop: 16 }} />
      <span style={{ ...shimmer, display: "block", height: 20, width: "62%", marginTop: 8 }} />

      {/* özet tek satır */}
      <span style={{ ...shimmer, display: "block", height: 14, width: "80%", marginTop: 12 }} />

      {/* AI kutusu */}
      <span
        style={{
          display: "block", height: 74, marginTop: 12, borderRadius: 14,
          background: "var(--ai-bg)", border: "1px solid var(--ai-bd)",
          animation: "shimmer 1.4s ease-in-out infinite",
        }}
      />

      {/* alt satır */}
      <span style={{ ...shimmer, display: "block", height: 13, width: "34%", marginTop: 16 }} />
    </article>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: "flex", gap: 16, alignItems: "flex-start",
            padding: "16px 0",
            borderBottom: i === 2 ? undefined : "1px solid var(--bd)",
          }}
        >
          <span
            style={{
              ...shimmer, width: "var(--fy-thumb)", flexShrink: 0,
              aspectRatio: "4 / 3", borderRadius: 8,
            }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...shimmer, display: "block", height: 12, width: "22%" }} />
            <span style={{ ...shimmer, display: "block", height: 18, width: "92%", marginTop: 8 }} />
            <span style={{ ...shimmer, display: "block", height: 18, width: "58%", marginTop: 6 }} />
            <span style={{ ...shimmer, display: "block", height: 12, width: "40%", marginTop: 11 }} />
          </span>
        </div>
      ))}
    </div>
  );
}
