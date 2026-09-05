import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicConfig } from "@/lib/config";
import {
  locales, defaultLocale, canonicalFromLocalized, segments, href, isServiceSlug,
  type Locale, type CanonicalSegment,
} from "@/i18n/config";

/**
 * İki iş yapar:
 *
 *  1. DİL + YOL ÇÖZÜMLEME
 *     Görünen adres           →  App Router'ın gördüğü adres
 *     /haber/deprem           →  /tr/news/deprem
 *     /en/news/quake          →  /en/news/quake
 *     /ar/khabar/xyz          →  /ar/news/xyz
 *     Kullanıcı Türkçe segment görür, kod tek bir kanonik ad kullanır.
 *
 *  2. OTURUM TAZELEME
 *     Supabase erişim jetonu kısa ömürlü. Burada tazelenmezse
 *     kullanıcı yorum yazarken "giriş yapmalısın" hatası alır.
 */

/**
 * Statik dosya mı?
 *
 * Uzantısı olan HER yol statik sayılır. Eskiden burada elle
 * yazılmış bir uzantı listesi vardı ve `.ttf` içinde yoktu:
 * `/fonts/YahooSans-Regular.ttf` dil yönlendirmesine giriyor,
 * `/tr/fonts/...` olarak yeniden yazılıyor ve 404 dönüyordu —
 * yazı tipinin bir türlü yüklenmemesinin sebebi buydu.
 *
 * Haber slug'ları `^[a-z0-9]+(-[a-z0-9]+)*$` biçiminde; nokta
 * içeremezler. Bu yüzden "noktalıysa dosyadır" kuralı güvenli.
 */
const PUBLIC_FILE = /\.[a-z0-9]{2,5}$/i;

function detectLocale(path: string): { locale: Locale; rest: string } {
  const seg = path.split("/")[1];
  if (locales.includes(seg as Locale) && seg !== defaultLocale) {
    return { locale: seg as Locale, rest: "/" + path.split("/").slice(2).join("/") };
  }
  /*
   * ⚠ VARSAYILAN DİL ÖNEKİ DE AYIKLANIYOR.
   *
   * `/tr/yayinci/iha` gibi adresler geldiğinde `tr` bir yol
   * parçası sanılıyordu ve adres `/tr/tr/yayinci/iha` olarak
   * yeniden yazılıp 404 dönüyordu.
   *
   * Varsayılan dil önekli adres yanlış değil, sadece kanonik
   * değil — aşağıda kalıcı yönlendirmeyle öneksiz hâline
   * çevriliyor. Burada da doğru ayrıştırılıyor ki arada
   * kırılmasın.
   */
  if (seg === defaultLocale) {
    return {
      locale: defaultLocale,
      rest: "/" + path.split("/").slice(2).join("/"),
    };
  }
  return { locale: defaultLocale, rest: path };
}


/* ══════════════════════════════════════════════════════════════
   ZİYARET KAYDI

   ┌─ NEDEN MIDDLEWARE ⚠️ ─────────────────────────────────────┐
   │ Önce tarayıcıdan kaydediliyordu ve çalışmadı. Sebepleri    │
   │ tek tek elenemez:                                           │
   │   • reklam/izleme engelleyiciler isteği kesiyor             │
   │   • JS kapalıysa hiç çalışmıyor                             │
   │   • önbellekten gelen sayfada bileşen yeniden koşmuyor      │
   │   • hata sessizce yutuluyor, sebep görünmüyor               │
   │                                                              │
   │ Middleware HER İSTEKTE, sunucuda, önbellekten ÖNCE          │
   │ çalışıyor. Engellenemez, atlanamaz.                          │
   └──────────────────────────────────────────────────────────────┘

   ┌─ SİTEYE YÜK BİNMİYOR ⚠️ ──────────────────────────────────┐
   │ İstek BEKLENMİYOR (`await` yok). Kayıt arka planda gidiyor, │
   │ sayfa yanıtı hiç gecikmiyor.                                 │
   │                                                              │
   │ Ayrıca yalnızca GERÇEK sayfa istekleri sayılıyor: varlık,   │
   │ API, prefetch ve bot istekleri daha isteği kurmadan          │
   │ eleniyor.                                                    │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/** Sayılmayacak istekler — tek tek elenmesi ucuz */
function sayilmaz(req: NextRequest, pathname: string): boolean {
  // Dosya uzantılı her şey (görsel, css, js, rss, sitemap)
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return true;
  if (/^\/(api|_next|panel)/.test(pathname)) return true;

  /*
   * Next.js prefetch: kullanıcı bağlantının ÜSTÜNE geldiğinde
   * sayfayı önceden çekiyor. Sayılırsa hiç açılmamış sayfalar
   * ziyaret görünür.
   */
  if (req.headers.get("next-router-prefetch")) return true;
  if (req.headers.get("purpose") === "prefetch") return true;
  if (req.headers.get("x-middleware-prefetch")) return true;
  // React Server Component isteği: yumuşak gezinme ya da prefetch
  if (req.headers.get("rsc")) return true;
  if (req.headers.get("next-router-state-tree")) return true;

  /*
   * ⚠ EN GÜVENİLİR İŞARET: `Accept` başlığı.
   *
   * Testte prefetch başlıkları tutmadı — istemciler onları her
   * zaman göndermiyor. Ama gerçek bir SAYFA açılışı DAİMA
   * `Accept: text/html` gönderiyor; veri istekleri ve prefetch
   * `*\/*` ya da `text/x-component` gönderiyor.
   *
   * Bu kural tek başına prefetch, RSC ve API isteklerini eliyor.
   */
  const kabul = req.headers.get("accept") ?? "";
  if (!kabul.includes("text/html")) return true;

  // Sayfa gezinmesi değil, gömülü kaynak isteği
  const dest = req.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return true;

  const ua = req.headers.get("user-agent") ?? "";
  if (!ua) return true;   // ajan yoksa istemci de yok
  if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|curl|wget|python|axios|node-fetch/i.test(ua)) {
    return true;
  }
  return false;
}

function sayfaTuru(p: string): string {
  const s = p.replace(/^\/(tr|en|ar|ru)(?=\/|$)/, "") || "/";
  if (s === "/") return "anasayfa";
  if (/^\/(haber|news|khabar|novosti)\//.test(s)) return "haber";
  if (/^\/(kategori|category|fia|kategoriya)\//.test(s)) return "kategori";
  if (/^\/(sehir|city)\//.test(s)) return "sehir";
  if (/^\/(arama|search)/.test(s)) return "arama";
  if (/^\/yazar\//.test(s)) return "yazar";
  if (/^\/yayinci\//.test(s)) return "yayinci";
  if (/^\/(sayfa|page)\//.test(s)) return "sayfa";
  if (/^\/(giris|login|kayit|signup)/.test(s)) return "hesap";
  if (/^\/(video|etiket|tag)/.test(s)) return "diger";
  return "diger";
}

function tarayici(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/YaBrowser/.test(ua)) return "Yandex";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Diğer";
}

function isletim(ua: string): string {
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Diğer";
}

/**
 * Oturum kimliği — çerezden.
 *
 * ⚠ Tarayıcı deposu KULLANILMIYOR: middleware sunucuda çalışıyor
 * ve `sessionStorage`'ı göremiyor. Çerez hem sunucuya geliyor
 * hem de tekil ziyaretçi saymaya yetiyor.
 *
 * Kimliğin karması veritabanında saklanıyor; ham değer yalnızca
 * tarayıcıda, oturum boyunca.
 */
const OTURUM_CEREZ = "kb_vid";

function ziyaretKaydet(
  req: NextRequest,
  res: NextResponse,
  pathname: string,
  locale: string,
): void {
  if (sayilmaz(req, pathname)) return;

  const { supabaseUrl, supabaseAnonKey } = publicConfig();
  if (!supabaseUrl || !supabaseAnonKey) return;

  let vid = req.cookies.get(OTURUM_CEREZ)?.value;
  if (!vid) {
    vid = crypto.randomUUID();
    /*
     * 30 dakikalık oturum. `sameSite: lax` — başka siteden
     * gelen ziyaret de aynı oturuma bağlansın.
     */
    res.cookies.set(OTURUM_CEREZ, vid, {
      maxAge: 1800, httpOnly: true, sameSite: "lax", path: "/",
    });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const ref = req.headers.get("referer");
  const ulke =
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country-code");

  /*
   * ⚠ `await` YOK — sayfa yanıtı beklemiyor.
   * Kayıt başarısız olsa bile okur hiçbir şey fark etmiyor.
   * Hata sunucu günlüğüne düşüyor.
   */
  void fetch(`${supabaseUrl}/rest/v1/rpc/izle_sayfa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      p: {
        path: pathname.slice(0, 300),
        type: sayfaTuru(pathname),
        session: vid,
        locale,
        referrer: ref && !ref.includes(req.nextUrl.host) ? ref.slice(0, 300) : null,
        // Cihaz ekran genişliğinden bilinemiyor; ajandan tahmin
        platform: /Mobile|Android|iPhone/i.test(ua)
          ? "mobile"
          : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop",
        country: ulke && ulke.length === 2 ? ulke.toUpperCase() : null,
        browser: tarayici(ua),
        os: isletim(ua),
      },
    }),
  }).catch((e) => {
    console.error("[izleme] kayit yazilamadi:", e instanceof Error ? e.message : e);
  });
}


/* ══════════════════════════════════════════════════════════════
   TEMİZ ADRES ÇÖZÜMLEME

   /egitim          → kategori
   /bursa           → şehir
   /hakkimizda      → sayfa
   /egitim/deprem   → haber (kategori altında)

   ┌─ HARİTA BELLEKTE TUTULUYOR ⚠️ ────────────────────────────┐
   │ Her istekte "bu bir kategori mi" diye veritabanına sormak  │
   │ sayfa yanıtına gecikme ekler. Harita bir kez çekilip 5     │
   │ dakika bellekte tutuluyor — birkaç yüz kısa metin, birkaç  │
   │ KB.                                                          │
   │                                                              │
   │ Süre dolunca ARKA PLANDA yenileniyor; istek beklemiyor.    │
   │ Yeni bir kategori en geç 5 dakikada tanınır hâle geliyor.  │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface YolHaritasi {
  kategori: Set<string>;
  sehir: Set<string>;
  sayfa: Set<string>;
}

let _harita: YolHaritasi | null = null;
let _haritaZaman = 0;
let _yenileniyor = false;
const HARITA_OMUR = 5 * 60_000;

async function haritayiCek(): Promise<YolHaritasi | null> {
  const { supabaseUrl, supabaseAnonKey } = publicConfig();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/yol_haritasi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: "{}",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      kategori?: string[]; sehir?: string[]; sayfa?: string[];
    };
    return {
      kategori: new Set(j.kategori ?? []),
      sehir: new Set(j.sehir ?? []),
      sayfa: new Set(j.sayfa ?? []),
    };
  } catch {
    return null;
  }
}

async function harita(): Promise<YolHaritasi | null> {
  const simdi = Date.now();

  /* Taze harita varsa doğrudan */
  if (_harita && simdi - _haritaZaman < HARITA_OMUR) return _harita;

  /*
   * Harita eskiyse ama ELDE VARSA: eskisini döndür, yenilemeyi
   * arka plana at. Okur beklemesin.
   */
  if (_harita) {
    if (!_yenileniyor) {
      _yenileniyor = true;
      void haritayiCek().then((y) => {
        if (y) { _harita = y; _haritaZaman = Date.now(); }
        _yenileniyor = false;
      });
    }
    return _harita;
  }

  /* İlk istek: beklemek zorunda */
  const y = await haritayiCek();
  if (y) { _harita = y; _haritaZaman = simdi; }
  return y;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/fonts") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const { locale, rest } = detectLocale(pathname);

  /*
   * `/tr/...` → `/...` kalıcı yönlendirme.
   * Aynı içeriğin iki adresten açılması arama motorları için
   * yinelenen içerik sayılıyor.
   */
  if (pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`)) {
    const hedef = req.nextUrl.clone();
    hedef.pathname = rest === "/" ? "/" : rest;
    hedef.search = search;
    return NextResponse.redirect(hedef, 308);
  }

  const parts = rest.split("/").filter(Boolean);

  /*
   * ESKİ HİZMET ADRESLERİ → YENİ KÖK ADRESLER
   *
   * ┌─ ADRES KISALDI, ESKİLER KIRILMADI ⚠️ ─────────────────────┐
   * │ `/hizmetler/hava-durumu` → `/hava-durumu`                  │
   * │                                                              │
   * │ Eski adresler arama motorlarında kayıtlı ve paylaşılmış    │
   * │ bağlantılarda duruyor. Rotayı taşıyıp yönlendirme          │
   * │ kurmasaydık hepsi 404 verir, biriken SEO değeri kaybolurdu.│
   * │                                                              │
   * │ 308 kullanılıyor (301 değil): 301 bazı tarayıcılarda POST  │
   * │ isteğini GET'e çeviriyor, 308 yöntemi koruyor. İkisi de    │
   * │ arama motorları için "kalıcı taşındı" anlamına geliyor.    │
   * │                                                              │
   * │ ⚠ Yalnızca ALT SAYFALAR yönlendiriliyor. `/hizmetler`      │
   * │ listesi kendi sayfası olarak duruyor.                       │
   * └──────────────────────────────────────────────────────────────┘
   */
  if (parts.length >= 2) {
    const ilk = canonicalFromLocalized(locale, parts[0]) ?? parts[0];
    if (ilk === "services" && isServiceSlug(parts[1])) {
      const redirect = req.nextUrl.clone();
      redirect.pathname = `/${locale}/${parts.slice(1).join("/")}`;
      redirect.search = search;
      return NextResponse.redirect(redirect, 308);
    }
  }

  let canonicalPath = `/${locale}`;
  if (parts.length > 0) {
    const canon = canonicalFromLocalized(locale, parts[0]);
    if (canon) {
      canonicalPath += `/${canon}` + (parts.length > 1 ? "/" + parts.slice(1).join("/") : "");
    } else if ((Object.keys(segments) as CanonicalSegment[]).includes(parts[0] as CanonicalSegment)) {
      /**
       * Kanonik ad doğrudan yazılmış: /city, /news ...
       *
       * Bunu sessizce kabul edersek aynı içerik hem /sehir hem
       * /city adresinden açılır — arama motoru için yinelenen
       * içerik. Kalıcı yönlendirmeyle tek adrese indiriyoruz.
       */
      const key = parts[0] as CanonicalSegment;
      const target = href(locale, key, parts.slice(1).join("/") || undefined);
      const redirect = req.nextUrl.clone();
      redirect.pathname = target;
      return NextResponse.redirect(redirect, 308);
    } else {
      /*
       * ⚠ TEMİZ ADRES ÇÖZÜMLEME.
       *
       * Buraya düşen adres bilinen bir segment değil. Kategori,
       * şehir ya da sayfa olabilir:
       *   /egitim         → kategori
       *   /bursa          → şehir
       *   /hakkimizda     → sayfa
       *   /egitim/deprem  → o kategorideki haber
       *
       * Harita bellekte; veritabanına her istekte gidilmiyor.
       */
      const ilk = parts[0]!;

      /*
       * ⚠ HİZMET SAYFALARI ARTIK KÖKTE.
       *
       * `/hava-durumu`, `/nobetci-eczane` gibi adresler
       * `app/[locale]/(hizmet)/[service]` rotasına düşüyor.
       * Rota grubu `(hizmet)` adrese yansımıyor.
       *
       * Bu kontrol kategori/şehir çözümlemesinden ÖNCE
       * yapılmalı: bir şehir ya da kategori yanlışlıkla
       * "trafik" adını taşıyorsa hizmet sayfası kazanmalı,
       * yoksa hizmete hiç erişilemez.
       */
      if (parts.length === 1 && isServiceSlug(ilk)) {
        canonicalPath += `/${ilk}`;
        const urlS = req.nextUrl.clone();
        urlS.pathname = canonicalPath;
        urlS.search = search;
        const rhS = new Headers(req.headers);
        rhS.set("x-locale", locale);
        rhS.set("x-pathname", pathname);
        rhS.set("x-kb-bare", "0");
        rhS.set("x-kb-panel", "0");
        return NextResponse.rewrite(urlS, { request: { headers: rhS } });
      }

      /*
       * ⚠ YAZAR VE YAYINCI SAYFALARI.
       *
       * Bu adresler `segments` listesinde yok — dile göre
       * değişmiyorlar, her dilde aynı. Middleware onları
       * "tanınmayan segment" sayıp olduğu gibi geçiriyordu ve
       * `/tr/yazar/ahmet` diye bir dosya yolu olmadığı için
       * 404 dönüyordu.
       *
       * Dosya yolları: app/[locale]/yazar/[username] ve
       * app/[locale]/yayinci/[slug] — doğrudan eşleşiyor.
       */
      if ((ilk === "yazar" || ilk === "yayinci") && parts.length === 2) {
        canonicalPath += `/${parts.join("/")}`;
        const url0 = req.nextUrl.clone();
        url0.pathname = canonicalPath;
        url0.search = search;
        const rh = new Headers(req.headers);
        rh.set("x-locale", locale);
        rh.set("x-pathname", pathname);
        rh.set("x-kb-bare", "0");
        rh.set("x-kb-panel", "0");
        const r0 = NextResponse.rewrite(url0, { request: { headers: rh } });
        r0.headers.set("x-locale", locale);
        r0.headers.set("x-pathname", pathname);
        ziyaretKaydet(req, r0, pathname, locale);
        return r0;
      }

      const h = await harita();

      if (h && parts.length === 1) {
        if (h.kategori.has(ilk))      canonicalPath += `/category/${ilk}`;
        else if (h.sehir.has(ilk))    canonicalPath += `/city/${ilk}`;
        else if (h.sayfa.has(ilk))    canonicalPath += `/page/${ilk}`;
        else canonicalPath += `/${parts.join("/")}`;
      } else if (
        h && parts.length === 2
        && (h.kategori.has(ilk) || h.sehir.has(ilk))
      ) {
        /*
         * ┌─ HABER HER KATEGORİ VE ŞEHİR ÖNEKİNDEN AÇILIR ⚠️ ────┐
         * │ İkinci parça haberin adresi. Önekin haberin GERÇEK   │
         * │ kategorisi olup olmadığı burada denetlenmiyor:       │
         * │                                                        │
         * │   /spor/mac-sonucu     → açılır (gerçek kategori)   │
         * │   /cevre/mac-sonucu    → açılır (başka kategori)    │
         * │   /karabuk/mac-sonucu  → açılır (şehir öneki)       │
         * │                                                        │
         * │ Önce yalnızca kategori kabul ediliyordu; şehir       │
         * │ önekiyle paylaşılan bağlantılar 404 veriyordu.       │
         * │                                                        │
         * │ ⚠ YİNELENEN İÇERİK SORUNU YOK. Haber sayfası         │
         * │ `alternates.canonical` ile haberin GERÇEK kategori   │
         * │ adresini bildiriyor; arama motoru hangi adresten     │
         * │ gelirse gelsin tek adresi dizinliyor. Okur kırık     │
         * │ bağlantı görmüyor, SEO bozulmuyor.                    │
         * │                                                        │
         * │ Haber gerçekten yoksa sayfa katmanı 404 veriyor —    │
         * │ bu kural var olmayan içeriği var göstermiyor.        │
         * └────────────────────────────────────────────────────────┘
         */
        canonicalPath += `/news/${parts[1]}`;
      } else {
        // Gerçekten tanınmayan: geçir, 404'ü sayfa katmanı versin.
        canonicalPath += `/${parts.join("/")}`;
      }
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = canonicalPath;
  url.search = search;

  /**
   * SADE SAYFALAR
   *
   * Giriş, kayıt, şifre sıfırlama, profil tamamlama ve hesap
   * sayfalarında header/footer gösterilmez — bunlar uygulama
   * ekranları, site sayfası değil.
   *
   * Bilgi bir istek başlığıyla taşınıyor; layout sunucuda okuyor.
   * İstemcide `usePathname` ile yapılsaydı ilk boyamada header
   * görünüp sonra kaybolurdu.
   */
  /**
   * TAM SADE: header de footer de yok (giriş ekranları).
   * YARI SADE: header var, footer yok (hesap paneli) — kullanıcı
   * panelde de siteye dönebilmeli.
   */
  const bareSegments = ["login", "signup", "reset-password",
                        "complete-profile", "verify-email",
                        /*
                         * ⚠ REELS DE TAM SADE.
                         *
                         * Tam ekran video akışı; başlık, alt bilgi ve
                         * mobil sekme çubuğu ekranı bölüyordu. Çıkış
                         * için sol üstte kendi "Ana sayfa" düğmesi var.
                         */
                        "reels"];
  const panelSegments = ["account"];
  const isBare = bareSegments.some(
    (seg) => url.pathname === `/${locale}/${seg}` ||
             url.pathname.startsWith(`/${locale}/${seg}/`),
  );

  const isPanel = panelSegments.some(
    (seg) => url.pathname === `/${locale}/${seg}` ||
             url.pathname.startsWith(`/${locale}/${seg}/`),
  );

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-kb-bare", isBare ? "1" : "0");
  requestHeaders.set("x-kb-panel", isPanel ? "1" : "0");

  const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  res.headers.set("x-locale", locale);
  res.headers.set("x-pathname", pathname);

  // --- Oturum tazeleme -------------------------------------
  const { supabaseUrl, supabaseAnonKey: supabaseKey } = publicConfig();
  if (supabaseUrl && supabaseKey) {
    const sb = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    });
    await sb.auth.getUser();
  }

  // Ziyaret kaydı — beklenmiyor, sayfa yanıtı gecikmiyor
  ziyaretKaydet(req, res, pathname, locale);

  return res;
}

export const config = {
  // Statik varlıklar middleware'e hiç uğramasın.
  matcher: ["/((?!_next/static|_next/image|fonts|favicon.ico).*)"],
};
