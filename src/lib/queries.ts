import "server-only";
import { cache } from "react";
import { createPublicClient, createAuthedClient } from "./supabase/server";
import { getSiteSettings } from "./settings";
import type {
  Article, ArticleRow, MediaRow, ArticleAi, Translation,
  ArticleStats, CategoryRow, CityRow,
} from "./types";
import { defaultLocale, type Locale } from "@/i18n/config";
import { publicConfig } from "@/lib/config";
import {
  demoArticleBySlug, demoArticlesForCategory, demoArticlesForCity,
  demoSearch, demoCityBySlug, demoCategoryBySlug, demoVideos,
  demoFeatured, demoBreaking, demoFeed, demoFeedPool, demoMostRead, demoHero, demoPages,
} from "./demo";

const ART_COLS = "*";

/**
 * Liste sorguları gövdeyi (`body`) İSTEMEZ.
 *
 * 12 haberlik bir listede gövde onlarca kilobayt gereksiz metin
 * demekti. Okuma süresi artık `reading_minutes` kolonundan tek
 * tam sayı olarak geliyor.
 */
/**
 * ANA SAYFADA KAPAKSIZ HABER GÖSTERİLMEZ.
 *
 * `cover_media_id` iki durumdan birini işaret eder:
 *   • fotoğraf  → media.storage_key
 *   • video     → media.poster_key (bot her videoyu işlerken
 *                 posterini de kaydediyor)
 *
 * NULL ise gösterilebilir görsel yoktur; o haber listeye hiç
 * alınmaz. Boş gri kutu göstermektense haberi atlamak doğru.
 *
 * Filtre SORGU seviyesinde: veriyi çekip sonra elemek hem boşuna
 * bant genişliği hem de "10 istedim 6 geldi" gibi eksik listeler
 * demekti.
 */
const LIST_COLS =
  "id,slug,title,summary,byline,son_dakika,published_at,edited_at,tags," +
  "reading_minutes,category_slugs,has_video,category_id,city_id,source_id," +
  "cover_media_id,category_slug,category_name,category_color,category_icon," +
  "category_kind,city_slug,city_name,plate_code,region,is_domestic," +
  "source_name,source_logo,author_username,source_slug,cocuk_guvenli," +
  /* Yazar avatarı: künye satırında kaynak logosu yerine bu kullanılıyor */
  "author_avatar,author_name";

/**
 * Veri katmanı hiçbir koşulda SAYFAYI ÇÖKERTMEZ.
 *
 * Supabase yapılandırılmamışsa (ilk kurulum, eksik .env) ya da
 * geçici bir ağ hatası varsa boş sonuç döner; sayfa demo içerikle
 * dolar. Haber sitesinde beyaz ekran, eski içerikten kötüdür.
 */
function configured(): boolean {
  const c = publicConfig();
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
}

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  if (!configured()) return fallback;
  try {
    return await run();
  } catch (err) {
    /**
     * HATA ARTIK LOGLANIYOR.
     *
     * Eskiden burada sessizce yutuluyordu: bir sorgu yetki, şema
     * ya da bağlantı hatası verdiğinde site "haber yok" gösteriyor
     * ama loglarda hiçbir iz kalmıyordu — "gerçekten haber yok mu,
     * bir sorun mu var" sorusu cevapsız kalıyordu.
     *
     * Ziyaretçi yine boş bölüm görür (doğru davranış — hata
     * ekranı göstermek daha kötü), ama sunucu logunda artık
     * sebep yazıyor.
     */
    console.error("[queries] sorgu başarısız:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

/**
 * Demo içeriğe düşülmeli mi?
 *
 * VARSAYILAN HAYIR. Yayındaki bir haber sitesinde uydurma haber
 * göstermek kabul edilemez; boş bölüm göstermek daha dürüsttür.
 *
 * Evet olduğu tek durumlar:
 *  - Supabase hiç yapılandırılmamış (henüz .env doldurulmamış)
 *  - Panelden açıkça açılmış: site_settings.demo_mode = true
 *
 * Demo açıkken bile `demo-` önekli olmayan, gerçekten var olmayan
 * bir haber 404 döner — demo gerçek 404'leri maskelemez.
 */
async function useDemo(slug?: string): Promise<boolean> {
  if (!configured()) return true;
  const s = await getSiteSettings();
  if (!s.demo_mode) return false;
  return slug === undefined || slug.startsWith("demo-");
}


/**
 * Ham satırı, medyası/AI'ı/çevirisi birleştirilmiş Article'a çevirir.
 *
 * ÇEVİRİ KURALI: istenen dilde `status='ok'` bir çeviri varsa başlık,
 * özet ve gövde ondan gelir. Yoksa Türkçe gösterilir ve `translated`
 * false döner — arayüz bunu kullanıcıya söyler, sessizce Türkçe
 * göstermek okuru yanıltırdı.
 */
function assemble(
  row: ArticleRow,
  media: MediaRow[],
  ai: ArticleAi | null,
  stats: ArticleStats | null,
  tr: Translation | null,
  locale: Locale,
): Article {
  const useTr = locale !== defaultLocale && tr && tr.status === "ok" && tr.baslik;

  const merged: ArticleRow = useTr
    ? {
        ...row,
        title: tr!.baslik ?? row.title,
        summary: tr!.ozet ?? row.summary,
        body: tr!.icerik
          ? tr!.icerik
              .split(/\n{2,}/)
              .map((p) => ({ type: "paragraph" as const, text: p.trim() }))
              .filter((b) => b.text.length > 0)
          : row.body,
      }
    : row;

  const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order);

  /**
   * KAPAK SEÇİMİ
   *
   * Sıra: işaretli kapak → fotoğraf → POSTERİ OLAN video → ilk medya.
   *
   * Haberin fotoğrafı yok ama videosu varsa kapak olarak videonun
   * posteri kullanılır (bot her videoyu işlerken poster kaydediyor).
   * Posteri olmayan bir videoyu kapak yapmak boş gri kutu demekti;
   * o yüzden posterli olan öne alınıyor.
   */
  const cover =
    sorted.find((m) => m.id === row.cover_media_id && (m.type === "image" || m.poster_key)) ??
    sorted.find((m) => m.type === "image") ??
    sorted.find((m) => m.type === "video" && m.poster_key) ??
    sorted.find((m) => m.id === row.cover_media_id) ??
    sorted[0] ??
    null;

  return {
    ...merged,
    media: sorted,
    cover,
    ai,
    stats,
    shownLocale: useTr ? locale : defaultLocale,
    translated: Boolean(useTr),
  };
}

/**
 * Liste kartları için kapak görseli + sayaçlar.
 *
 * HIZ: Eskiden haberin TÜM medyası çekiliyordu — 12 haberlik bir
 * listede 60+ satır, hepsi de kart için gereksiz. Artık yalnızca
 * `cover_media_id` ile işaretli satırlar çekiliyor; kapağı
 * olmayan haberler için de ilk görsel bulunur.
 */
async function attachCovers(
  rows: ArticleRow[],
  opts: { withAi?: boolean } = {},
): Promise<Article[]> {
  if (rows.length === 0) return [];
  const sb = createPublicClient();
  const ids = rows.map((r) => r.id);
  const coverIds = rows.map((r) => r.cover_media_id).filter((x): x is string => Boolean(x));
  const missing = rows.filter((r) => !r.cover_media_id).map((r) => r.id);

  const [coverRes, fallbackRes, statsRes] = await Promise.all([
    coverIds.length
      ? sb.from("public_media").select("*").in("id", coverIds)
      : Promise.resolve({ data: [] as MediaRow[] }),
    // Kapağı işaretlenmemiş haberler: ilk medyayı çek. Video da
    // olabilir — posteri kapak olarak kullanılır.
    missing.length
      ? sb.from("public_media").select("*").in("article_id", missing).order("sort_order")
      : Promise.resolve({ data: [] as MediaRow[] }),
    sb.from("public_article_stats").select("*").in("article_id", ids),
  ]);

  const media = [
    ...((coverRes.data as MediaRow[]) ?? []),
    ...((fallbackRes.data as MediaRow[]) ?? []),
  ];
  const stats = statsRes.data;

  // AI özeti yalnızca istendiğinde çekilir (ana sayfa akışı).
  // Her listeye eklemek gereksiz bir sorgu turu olurdu.
  let aiMap = new Map<string, ArticleAi>();
  if (opts.withAi) {
    const { data: ai } = await sb
      .from("article_ai")
      .select("article_id, ozet, onem_puani, cocuk_guvenli, guvenlik_sebepleri, instagram, onem_gerekce")
      .in("article_id", ids);
    aiMap = new Map(((ai as ArticleAi[]) ?? []).map((x) => [x.article_id, x]));
  }

  const byArticle = new Map<string, MediaRow[]>();
  for (const m of media) {
    const list = byArticle.get(m.article_id) ?? [];
    list.push(m);
    byArticle.set(m.article_id, list);
  }
  const statMap = new Map(
    ((stats as ArticleStats[]) ?? []).map((s) => [s.article_id, s]),
  );

  return rows.map((r) =>
    assemble(
      r,
      byArticle.get(r.id) ?? [],
      aiMap.get(r.id) ?? null,
      statMap.get(r.id) ?? null,
      null,
      defaultLocale,
    ),
  );
}

/**
 * Akış kartları için AI özetlerini iliştirir.
 *
 * Tek sorgu, yalnızca listelenen haberlerin id'leriyle (12 UUID ≈
 * 450 karakter — URL sınırına yakın bile değil). Liste sorgusuna
 * join etmek yerine ayrı çekiliyor çünkü AI özeti sadece "Sana
 * Özel" bölümünde gösteriliyor; diğer listeler bu turu ödemesin.
 */
async function attachAi(list: Article[]): Promise<Article[]> {
  if (list.length === 0) return list;
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("article_ai")
      .select("article_id, ozet, onem_puani, cocuk_guvenli, guvenlik_sebepleri, instagram, onem_gerekce")
      .in("article_id", list.map((a) => a.id));

    const map = new Map(
      ((data as ArticleAi[]) ?? []).map((x) => [x.article_id, x]),
    );
    return list.map((a) => ({ ...a, ai: map.get(a.id) ?? null }));
  }, list);
}

/** Listelerde çeviri: sadece başlık ve özet çekilir, gövde gerekmez */
async function localizeList(list: Article[], locale: Locale): Promise<Article[]> {
  if (locale === defaultLocale || list.length === 0) return list;
  const sb = createPublicClient();
  const { data } = await sb
    .from("article_translations")
    .select("article_id, locale, baslik, ozet, slug, status")
    .eq("locale", locale)
    .eq("status", "ok")
    .in("article_id", list.map((a) => a.id));

  const map = new Map(
    ((data as Translation[]) ?? []).map((t) => [t.article_id, t]),
  );
  return list.map((a) => {
    const tr = map.get(a.id);
    if (!tr?.baslik) return a;
    return {
      ...a,
      title: tr.baslik,
      summary: tr.ozet ?? a.summary,
      shownLocale: locale,
      translated: true,
    };
  });
}

// ============================================================
//  TEK HABER
// ============================================================
export const getArticleBySlug = cache(
  async (slug: string, locale: Locale): Promise<Article | null> => {
    if (await useDemo(slug)) {
      const d = demoArticleBySlug(slug);
      if (d) return d;
    }
    return safe(async () => {
    const sb = createPublicClient();

    // Çeviri slug'ıyla da bulunabilmeli: /en/news/{ingilizce-slug}
    let { data: row } = await sb
      .from("public_articles")
      .select(ART_COLS)
      .eq("slug", slug)
      .maybeSingle();

    if (!row && locale !== defaultLocale) {
      const { data: tr } = await sb
        .from("article_translations")
        .select("article_id")
        .eq("slug", slug)
        .eq("locale", locale)
        .maybeSingle();
      if (tr) {
        const res = await sb
          .from("public_articles")
          .select(ART_COLS)
          .eq("id", (tr as { article_id: string }).article_id)
          .maybeSingle();
        row = res.data;
      }
    }
    if (!row) return null;

    const a = row as ArticleRow;
    const [{ data: media }, { data: ai }, { data: stats }, { data: tr }] =
      await Promise.all([
        sb.from("public_media").select("*").eq("article_id", a.id),
        sb.from("article_ai").select("*").eq("article_id", a.id).maybeSingle(),
        sb.from("public_article_stats").select("*").eq("article_id", a.id).maybeSingle(),
        locale === defaultLocale
          ? Promise.resolve({ data: null })
          : sb
              .from("article_translations")
              .select("*")
              .eq("article_id", a.id)
              .eq("locale", locale)
              .maybeSingle(),
      ]);

    return assemble(
      a,
      (media as MediaRow[]) ?? [],
      (ai as ArticleAi) ?? null,
      (stats as ArticleStats) ?? null,
      (tr as Translation) ?? null,
      locale,
    );
      }, null);
  },
);

// ============================================================
//  LİSTELER
// ============================================================
export const getLatest = cache(
  async (limit = 12, locale: Locale = defaultLocale, offset = 0, withAi = false) => {
    if (await useDemo()) return [...demoFeatured, ...demoFeedPool].slice(offset, offset + limit);
    return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("public_articles")
      .select(LIST_COLS)
      .not("cover_media_id", "is", null)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);
    return localizeList(
      await attachCovers((data as unknown as ArticleRow[]) ?? [], { withAi }),
      locale,
    );
      }, []);
  },
);

export const getBreaking = cache(async (limit = 5, locale: Locale = defaultLocale) => {
  if (await useDemo()) return demoBreaking.slice(0, limit);
    return safe(async () => {
  const sb = createPublicClient();
  const { data } = await sb
    .from("public_articles")
    .select(ART_COLS)
    .eq("son_dakika", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  return localizeList(await attachCovers((data as unknown as ArticleRow[]) ?? []), locale);
    }, []);
  });

/**
 * Hero: önem puanı yüksek olanlar önce.
 *
 * AI zaten her habere 0-10 puan veriyor; "manşetlik" kararını
 * elle vermek yerine o puanı kullanıyoruz. Puanı olmayan yeni
 * haberler tarih sırasıyla devreye girer.
 */
export const getHero = cache(async (limit = 5, locale: Locale = defaultLocale) => {
  if (await useDemo()) return demoHero.slice(0, limit);
    return safe(async () => {
  const sb = createPublicClient();
  const since = new Date(Date.now() - 3 * 864e5).toISOString();

  /**
   * HERO EŞİĞİ: 8 ve ÜSTÜ.
   *
   * AI her habere 0-10 önem puanı veriyor. Manşet yalnızca
   * gerçekten manşetlik haberler içindir; 6 eşiği belediye
   * faaliyetlerini de yukarı taşıyordu.
   *
   * Puanı olmayan yeni haberler (AI henüz işlememiş) aşağıdaki
   * yedek sorguyla tarih sırasına göre devreye girer.
   */
  const { data: scored } = await sb
    .from("article_ai")
    .select("article_id, onem_puani")
    .gte("onem_puani", 8)
    .order("onem_puani", { ascending: false })
    .limit(40);

  const ids = ((scored as { article_id: string }[]) ?? []).map((s) => s.article_id);

  let rows: ArticleRow[] = [];
  if (ids.length) {
    const { data } = await sb
      .from("public_articles")
      .select(LIST_COLS)
      .in("id", ids)
      .gte("published_at", since)
      .not("cover_media_id", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit);
    rows = (data as unknown as ArticleRow[]) ?? [];
  }
  if (rows.length < limit) {
    const { data } = await sb
      .from("public_articles")
      .select(LIST_COLS)
      .not("cover_media_id", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit * 2);
    const seen = new Set(rows.map((r) => r.id));
    for (const r of (data as unknown as ArticleRow[]) ?? []) {
      if (rows.length >= limit) break;
      if (!seen.has(r.id)) rows.push(r);
    }
  }
  return localizeList(await attachCovers(rows.slice(0, limit)), locale);
    }, []);
  });

/** En çok okunanlar — article_stats.views_24h üzerinden */
export const getMostRead = cache(async (limit = 5, locale: Locale = defaultLocale) => {
  if (await useDemo()) return demoMostRead.slice(0, limit);
    return safe(async () => {
  const sb = createPublicClient();
  const { data: stats } = await sb
    .from("public_article_stats")
    .select("article_id, views_24h")
    .order("views_24h", { ascending: false })
    .limit(limit);

  const ids = ((stats as { article_id: string }[]) ?? []).map((s) => s.article_id);
  if (!ids.length) return getLatest(limit, locale);

  const { data } = await sb.from("public_articles").select(ART_COLS).in("id", ids);
  const rows = (data as unknown as ArticleRow[]) ?? [];
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return localizeList(await attachCovers(rows), locale);
    }, []);
  });

export const getByCategory = cache(
  async (slug: string, limit = 12, locale: Locale = defaultLocale, offset = 0) => {
    if (await useDemo()) return demoArticlesForCategory(slug).slice(offset, offset + limit);
    return safe(async () => {
      const sb = createPublicClient();

      /**
       * TEK SORGU. Eskiden önce `article_categories`'den yüzlerce
       * id çekilip `.in("id", [600 uuid])` yapılıyordu; bu ~22 KB
       * URL üretiyor ve PostgREST 414 ile reddediyordu — kategori
       * blokları bu yüzden boş kalıyordu.
       *
       * `category_slugs` dizisi konu VE kapsamı birlikte tuttuğu
       * için "Ulusal Haber" gibi kapsam sayfaları da doğru çalışır.
       */
      const { data } = await sb
        .from("public_articles")
        .select(LIST_COLS)
        .contains("category_slugs", [slug])
        .not("cover_media_id", "is", null)
        .order("published_at", { ascending: false })
        .range(offset, offset + limit - 1);

      return localizeList(await attachCovers((data as unknown as ArticleRow[]) ?? []), locale);
    }, []);
  },
);

export const getByCity = cache(
  async (slug: string, limit = 12, locale: Locale = defaultLocale, offset = 0) => {
    if (await useDemo()) return demoArticlesForCity(slug).slice(offset, offset + limit);
    return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("public_articles")
      .select(LIST_COLS)
      .eq("city_slug", slug)
      .not("cover_media_id", "is", null)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);
    return localizeList(await attachCovers((data as unknown as ArticleRow[]) ?? []), locale);
      }, []);
  },
);

/** Video haberler: video medyası olan haberler */
export const getVideoArticles = cache(
  async (limit = 8, locale: Locale = defaultLocale) => {
    if (await useDemo()) return demoVideos.slice(0, limit);
    return safe(async () => {
      // `has_video` bayrağı: video id listesi taşımaya gerek yok.
      const sb = createPublicClient();
      const { data } = await sb
        .from("public_articles")
        .select(LIST_COLS)
        .eq("has_video", true)
        // Posteri üretilmemiş video kapaksız kalır; onu göstermeyiz
        .not("cover_media_id", "is", null)
        .order("published_at", { ascending: false })
        .limit(limit);
      return localizeList(await attachCovers((data as unknown as ArticleRow[]) ?? []), locale);
    }, []);
  },
);

export const getRelated = cache(
  async (article: Article, limit = 4, locale: Locale = defaultLocale) => {
    if (await useDemo(article.slug)) {
      return demoFeatured.filter((a) => a.id !== article.id).slice(0, limit);
    }
    return safe(async () => {
    const sb = createPublicClient();
    let rows: ArticleRow[] = [];

    if (article.category_slug) {
      const { data } = await sb
        .from("public_articles")
        .select(LIST_COLS)
        .eq("category_slug", article.category_slug)
        .not("cover_media_id", "is", null)
        .neq("id", article.id)
        .order("published_at", { ascending: false })
        .limit(limit);
      rows = (data as unknown as ArticleRow[]) ?? [];
    }
    if (rows.length < limit && article.city_slug) {
      const { data } = await sb
        .from("public_articles")
        .select(LIST_COLS)
        .eq("city_slug", article.city_slug)
        .not("cover_media_id", "is", null)
        .neq("id", article.id)
        .order("published_at", { ascending: false })
        .limit(limit);
      const seen = new Set(rows.map((r) => r.id));
      for (const r of (data as unknown as ArticleRow[]) ?? []) {
        if (rows.length >= limit) break;
        if (!seen.has(r.id)) rows.push(r);
      }
    }
    return localizeList(await attachCovers(rows.slice(0, limit)), locale);
      }, []);
  },
);

/**
 * Arama — Postgres tam metin araması (search_tsv, Türkçe sözlük).
 * `websearch_to_tsquery` tırnak ve `-` gibi kullanıcı sözdizimini anlar.
 */
export const searchArticles = cache(
  async (q: string, limit = 20, locale: Locale = defaultLocale) => {
    if (await useDemo()) return demoSearch(q).slice(0, limit);
    return safe(async () => {
    const term = q.trim();
    if (term.length < 2) return [];
    const sb = createPublicClient();
    const { data } = await sb
      .from("public_articles")
      .select(LIST_COLS)
      .textSearch("search_tsv", term, { type: "websearch", config: "turkish" })
      .order("published_at", { ascending: false })
      .limit(limit);

    let rows = (data as unknown as ArticleRow[]) ?? [];
    if (!rows.length) {
      // Tam metin tutmadıysa başlıkta parça arama (trigram index var)
      const { data: like } = await sb
        .from("public_articles")
        .select(LIST_COLS)
        .ilike("title", `%${term}%`)
        .order("published_at", { ascending: false })
        .limit(limit);
      rows = (like as unknown as ArticleRow[]) ?? [];
    }
    return localizeList(await attachCovers(rows), locale);
      }, []);
  },
);

// ============================================================
//  TAKSONOMİ
// ============================================================
export const getCategories = cache(async (): Promise<CategoryRow[]> => {
    return safe(async () => {
  const sb = createPublicClient();
  const { data } = await sb
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data as CategoryRow[]) ?? [];
    }, []);
  });

export const getCategory = cache(async (slug: string) => {
  if (await useDemo()) return demoCategoryBySlug(slug) as CategoryRow | null;
    return safe(async () => {
  const sb = createPublicClient();
  const { data } = await sb.from("categories").select("*").eq("slug", slug).maybeSingle();
  return (data as CategoryRow) ?? null;
    }, null);
  });

export const getCity = cache(async (slug: string) => {
  if (await useDemo()) return demoCityBySlug(slug);
    return safe(async () => {
  const sb = createPublicClient();
  const { data } = await sb.from("cities").select("*").eq("slug", slug).maybeSingle();
  return (data as CityRow) ?? null;
    }, null);
  });

/** Header şehir şeridi: en çok haberi olan iller */
export const getTopCities = cache(async (limit = 12): Promise<CityRow[]> => {
    return safe(async () => {
  const sb = createPublicClient();
  const { data } = await sb
    .from("city_stats")
    .select("id, slug, name, plate_code, region, is_domestic, yayinda")
    .order("yayinda", { ascending: false })
    .limit(limit);
  return ((data as (CityRow & { yayinda: number })[]) ?? []).filter((c) => c.slug);
    }, []);
  });

export const getPage = cache(async (slug: string) => {
  if (await useDemo()) return demoPages[slug] ?? null;
    return safe(async () => {
  const sb = createPublicClient();
  const { data } = await sb
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data as {
    slug: string;
    title: Record<string, string>;
    body: Record<string, string>;
    seo_description: Record<string, string>;
  } | null;
    }, null);
  });

export const getComments = cache(async (articleId: string) => {
    return safe(async () => {
  /*
   * ⚠ OTURUMLU İSTEMCİ ŞART.
   *
   * `createPublicClient()` çerez okumuyor; `auth.uid()`
   * veritabanında null kalıyor. `public_comments` görünümü
   * "kendi bekleyen yorumum" kuralını `auth.uid()` ile
   * uyguluyor — oturum gitmeyince okur kendi bekleyen
   * yorumunu göremiyordu.
   */
  const sb = await createAuthedClient();
  const { data } = await sb
    .from("public_comments")
    .select("*")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true })
    .limit(200);
  return data ?? [];
    }, []);
  });


/** Tüm şehirler sayfası — bölgeye göre gruplanmak üzere */
export const getAllCities = cache(async (): Promise<CityRow[]> => {
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("cities")
      .select("id, slug, name, plate_code, region, is_domestic, country_code, latitude, longitude")
      .eq("is_active", true)
      .order("plate_code", { nullsFirst: false });
    return (data as CityRow[]) ?? [];
  }, []);
});


/**
 * Ana sayfa "Sana Özel" akışı.
 * Kartlarda AI özeti gösterildiği için liste AI ile zenginleştirilir.
 */
export const getFeed = cache(
  async (limit = 12, locale: Locale = defaultLocale, offset = 0) => {
    const list = await getLatest(limit, locale, offset);
    return attachAi(list);
  },
);


/** Şehir seçici: 81 il + yurt dışı, plaka sırasıyla */
export const getCityOptions = cache(async () => {
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("cities")
      .select("slug, name, plate_code, is_domestic")
      .eq("is_active", true)
      .order("plate_code", { nullsFirst: false });

    return ((data as { slug: string; name: string; plate_code: number | null }[]) ?? [])
      .map((c) => ({ slug: c.slug, name: c.name, plate: c.plate_code }));
  }, []);
});


/**
 * Kullanıcı bu haberi kaydetmiş mi?
 *
 * Oturum yoksa sorgu bile atılmaz. RLS zaten yalnızca kendi
 * satırını gösteriyor; bu kontrol boşuna istek atmamak için.
 */
export async function isArticleSaved(articleId: string): Promise<boolean> {
  if (!configured()) return false;
  try {
    const sb = await createAuthedClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return false;

    const { data } = await sb
      .from("saved_articles")
      .select("article_id")
      .eq("article_id", articleId)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}


/** Editör formu: seçilebilir kategoriler (konu ekseni) */
export const getCategoryOptions = cache(async () => {
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("categories")
      .select("slug, name, kind")
      .eq("is_active", true)
      .eq("kind", "topic")
      .order("sort_order");
    return ((data as { slug: string; name: string }[]) ?? [])
      .map((c) => ({ slug: c.slug, name: c.name }));
  }, []);
});

/* ══════════════════════════════════════════════════════════════
   YAZAR VE YAYINCI
   ══════════════════════════════════════════════════════════════ */

export interface YazarProfil {
  id: string; username: string; display_name: string;
  first_name: string | null; last_name: string | null;
  title: string | null; bio: string | null;
  avatar_key: string | null; cover_key: string | null;
  social_links: Record<string, string> | null;
  bas_harf: string; haber_sayisi: number;
}

export interface YayinciProfil {
  id: string; slug: string; name: string; short_name: string;
  logo_key: string | null; logo_dark_key: string | null;
  cover_key: string | null; website: string | null;
  description: string | null;
  social_links: Record<string, string> | null;
  is_agency: boolean; haber_sayisi: number;
}

export const getYazar = cache(async (username: string) => {
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("public_authors").select("*")
      .eq("username", username).maybeSingle();
    return (data as unknown as YazarProfil) ?? null;
  }, null);
});

export const getYayinci = cache(async (slug: string) => {
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb
      .from("public_sources").select("*")
      .eq("slug", slug).maybeSingle();
    return (data as unknown as YayinciProfil) ?? null;
  }, null);
});

export const getYazarHaberleri = cache(
  async (authorId: string, limit = 24, locale: Locale = defaultLocale, offset = 0) => {
    return safe(async () => {
      const sb = createPublicClient();
      const { data } = await sb
        .from("public_articles").select(LIST_COLS)
        .eq("author_id", authorId)
        .order("published_at", { ascending: false })
        .range(offset, offset + limit - 1);
      return localizeList(await attachCovers((data as unknown as ArticleRow[]) ?? []), locale);
    }, []);
  },
);

export const getYayinciHaberleri = cache(
  async (sourceId: string, limit = 24, locale: Locale = defaultLocale, offset = 0) => {
    return safe(async () => {
      const sb = createPublicClient();
      const { data } = await sb
        .from("public_articles").select(LIST_COLS)
        .eq("source_id", sourceId)
        .order("published_at", { ascending: false })
        .range(offset, offset + limit - 1);
      return localizeList(await attachCovers((data as unknown as ArticleRow[]) ?? []), locale);
    }, []);
  },
);

/**
 * Haberlerin çocuk güvenliği durumu.
 *
 * ⚠ AYRI SORGU. `public_articles` görünümüne alan eklemek
 * riskli — o görünüm 33 kolonuyla kırılgan (bkz. yama-41) ve
 * bir kolon kaybı ana sayfayı komple boşaltıyor. Bunun yerine
 * liste geldikten sonra tek çağrıda toplanıyor.
 *
 * Dönen harita: { articleId: true | false }. Haritada OLMAYAN
 * haber AI'dan geçmemiş demek — hiçbir işlem yapılmıyor.
 */
export const getCocukGuvenlik = cache(async (ids: string[]) => {
  if (ids.length === 0) return {};
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb.rpc("cocuk_guvenlik", { p_ids: ids });
    const harita: Record<string, boolean> = {};
    for (const r of (data ?? []) as { article_id: string; guvenli: boolean | null }[]) {
      if (r.guvenli !== null) harita[r.article_id] = r.guvenli;
    }
    return harita;
  }, {} as Record<string, boolean>);
});

/**
 * Kategori adlarının çevirileri.
 *
 * ⚠ AYRI ÇAĞRI, GÖRÜNÜME EKLENMEDİ.
 * `public_articles` tanımına alan eklemek denendi ve görünümü
 * bozdu (içindeki alt sorgular yüzünden). O görünüm 40
 * kolonuyla kırılgan; bir kolon kaybı ana sayfayı komple
 * boşaltıyor.
 *
 * Kategori sayısı ~20, veri birkaç KB. `cache()` sayesinde
 * istek başına bir kez çekiliyor.
 */
export const getKategoriAdlari = cache(async () => {
  return safe(async () => {
    const sb = createPublicClient();
    const { data } = await sb.rpc("kategori_adlari");
    return (data ?? {}) as Record<string, Record<string, string>>;
  }, {} as Record<string, Record<string, string>>);
});

/**
 * Kategori adını istenen dilde ver.
 *
 * Çeviri yoksa Türkçe ada düşüyor — boş bırakmaktansa
 * anlaşılmayan bir dilde göstermek daha iyi.
 */
export function kategoriAdi(
  adlar: Record<string, Record<string, string>>,
  slug: string | null | undefined,
  locale: Locale,
  varsayilan: string | null | undefined,
): string {
  if (!slug) return varsayilan ?? "";
  const k = adlar[slug];
  return k?.[locale] || k?.tr || varsayilan || slug;
}
