import { NextResponse, type NextRequest } from "next/server";
import { getLatest, getByCategory, getByCity } from "@/lib/queries";
import { assertLocale } from "@/i18n/config";
import { getSiteSettings } from "@/lib/settings";
import { pickImage, assetUrl } from "@/lib/media";
import { articleMinutes } from "@/lib/format";

/**
 * SANA ÖZEL — SAYFALAMA
 *
 * Kaydırdıkça 10'ar haber. Tam `Article` nesnesini göndermek
 * gereksiz ağır: gövde, ham medya ve sayaçların çoğu kartta
 * kullanılmıyor. Yalnızca kartın çizdiği alanlar dönüyor.
 */
export const dynamic = "force-dynamic";

/** Bir seferde en fazla bu kadar; sonsuz kaydırmanın sonu olmalı. */
const PAGE = 12;

/*
 * ⚠ ANA SAYFA SINIRI — KATEGORİ VE ŞEHİR İÇİN DEĞİL.
 *
 * Ana sayfada akış sonsuza kadar sürmemeli: okur bir noktadan
 * sonra kategoriye ya da aramaya yönlendirilmeli. Ama kategori
 * ve şehir sayfalarında amaç TÜM arşive ulaşmak; 50'de kesmek
 * "bu kadar" deyip listeyi erken bitiriyordu.
 */
const ANASAYFA_MAX = 60;
const LISTE_MAX = 600;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const locale = assertLocale(sp.get("locale") ?? "tr");
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);

  const kategoriErken = sp.get("category")?.trim() || null;
  const sehirErken = sp.get("city")?.trim() || null;
  const listeMi = Boolean(kategoriErken || sehirErken);
  const tavan = listeMi ? LISTE_MAX : ANASAYFA_MAX;

  if (offset >= tavan) {
    return NextResponse.json({ items: [], hasMore: false });
  }

  const s = await getSiteSettings();
  const limit = Math.min(PAGE, tavan - offset);

  /*
   * ⚠ KATEGORİ VE ŞEHİR SÜZGECİ.
   *
   * Uç yalnızca ana sayfa akışını döndürüyordu. Kategori ve
   * şehir sayfalarında aşağı kaydırınca liste bitiyor,
   * devamı gelmiyordu.
   *
   * `atla` yalnızca ana sayfada gerekli: orada ilk kartlar
   * manşette gösteriliyor ve akışın onları tekrarlamaması
   * lazım. Kategori/şehir sayfasında liste baştan başlıyor.
   */
  const kategori = kategoriErken;
  const sehir = sehirErken;

  const rows = kategori
    ? await getByCategory(kategori, limit, locale, offset)
    : sehir
      ? await getByCity(sehir, limit, locale, offset)
      : await getLatest(limit, locale, s.home_featured_count + offset, true);

  const items = rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    byline: a.byline,
    son_dakika: a.son_dakika,
    published_at: a.published_at,
    category_name: a.category_name,
    category_color: a.category_color,
    city_name: a.city_name,
    city_slug: a.city_slug,
    source_name: a.source_name,
    source_logo: assetUrl(a.source_logo),
    minutes: articleMinutes(a),
    comment_count: a.stats?.comment_count ?? 0,
    thumb: pickImage(a.cover, "thumb"),
    card: pickImage(a.cover, "card"),
    color: a.cover?.dominant_color ?? null,
    ai: a.ai?.ozet ?? null,
  }));

  return NextResponse.json({
    items,
    hasMore: items.length === limit && offset + limit < tavan,
  });
}
