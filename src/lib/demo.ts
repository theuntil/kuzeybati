import type { Article, MediaRow, Quote } from "./types";

/**
 * DEMO İÇERİĞİ
 *
 * Veritabanı boşsa ya da bir servis (borsa, hava, skor) o an
 * yanıt vermiyorsa sayfa BOŞ KALMAZ; prototipteki içerikle
 * dolar. Böylece yerleşim her zaman tasarımdaki gibi görünür.
 *
 * Gerçek veri geldiği anda demo tamamen devre dışı kalır.
 */

const img = (seed: string, w = 900, h = 560): MediaRow => ({
  id: `demo-${seed}`,
  article_id: `demo-${seed}`,
  type: "image",
  sort_order: 0,
  storage_key: null,
  poster_key: null,
  variants: {},
  width: w,
  height: h,
  blurhash: null,
  dominant_color: "#1D1D1D",
  duration_sec: null,
  caption: null,
  credit: null,
  // Prototipteki görsel kaynağı
  demoUrl: `https://picsum.photos/seed/${seed}/${w}/${h}`,
} as MediaRow & { demoUrl: string });

/** Demo videosu — yalnızca demo modunda, oynatıcıyı denemek için */
const vid = (seed: string, dur: number): MediaRow => ({
  id: `demo-v-${seed}`,
  article_id: `demo-${seed}`,
  type: "video",
  sort_order: 1,
  storage_key: null,
  poster_key: null,
  variants: {},
  width: 1280,
  height: 720,
  blurhash: null,
  dominant_color: "#101010",
  duration_sec: dur,
  caption: "Olay anı güvenlik kamerasına yansıdı.",
  credit: "Kuzeybatı Haber",
  demoUrl: `https://picsum.photos/seed/${seed}v/1280/720`,
  demoVideo:
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
} as MediaRow & { demoUrl: string; demoVideo: string });

let n = 0;
/**
 * Demo haberlerin HEPSİ kapaklıdır — yayındaki kural da bu:
 * kapağı olmayan haber ana sayfada gösterilmez.
 */
function make(
  title: string,
  category: string,
  color: string,
  seed: string,
  summary?: string,
  city?: string,
  breaking = false,
  extra: MediaRow[] = [],
): Article {
  n += 1;
  const id = `demo-${seed}`;
  return {
    id,
    slug: `demo-${seed}`,
    title,
    summary: summary ?? null,
    body: [
      { type: "paragraph", text: summary ?? `${title}. Konuya ilişkin ilk değerlendirmeler bugün paylaşıldı.` },
      { type: "paragraph", text: "Yetkililer, sürecin önümüzdeki günlerde netleşeceğini ve ilgili kurumların koordinasyon içinde çalıştığını belirtti. Sahadan gelen ilk bilgiler, hazırlıkların planlandığı şekilde ilerlediğini gösteriyor." },
      { type: "heading", text: "Ne değişiyor?" },
      { type: "paragraph", text: "Uygulamanın ilk aşaması bu ay içinde başlıyor. İkinci aşamada kapsam genişletilecek; kurumlar arası veri paylaşımı için ortak bir takvim oluşturuldu." },
      { type: "paragraph", text: "Uzmanlar, kararın etkilerinin kısa vadede sınırlı kalacağını ancak orta vadede belirgin biçimde hissedileceğini söylüyor. Değerlendirme raporunun ay sonunda yayımlanması bekleniyor." },
      { type: "paragraph", text: "Konuyla ilgili gelişmeler yaşandıkça haberimiz güncellenecek." },
    ],
    byline: "Kuzeybatı Haber",
    son_dakika: breaking,
    published_at: new Date(Date.now() - n * 42 * 60000).toISOString(),
    edited_at: null,
    tags: [],
    // Demo sürelerini çeşitlendir: gerçekte bu değer DB'deki
    // reading_minutes kolonundan, gövde uzunluğuna göre gelir.
    reading_minutes: 2 + (seed.length + n) % 7,
    category_slugs: [category.toLocaleLowerCase("tr")],
    has_video: false,
    seo_title: null,
    seo_description: null,
    category_id: null,
    city_id: null,
    source_id: null,
    cover_media_id: null,
    category_slug: null,
    category_name: category,
    category_color: color,
    category_icon: null,
    category_kind: "topic",
    city_slug: city ? city.toLowerCase() : null,
    city_name: city ?? null,
    plate_code: null,
    region: null,
    is_domestic: true,
    source_name: "Kuzeybatı Haber",
    source_logo: null,
    media: [img(seed), ...extra],
    cover: img(seed),
    ai: summary
      ? {
          article_id: id,
          ozet: `${summary} Konuya ilişkin ilk değerlendirmeler paylaşıldı; ilgili kurumlar koordinasyon içinde çalışıyor.`,
          instagram: null,
          onem_puani: 5,
          onem_gerekce: null,
          cocuk_guvenli: true,
          guvenlik_sebepleri: [],
        }
      : null,
    stats: { article_id: id, view_count: 0, like_count: 0, comment_count: 0, views_24h: 0 },
    shownLocale: "tr",
    translated: false,
    isDemo: true,
  } as Article & { isDemo: true };
}

export const demoHero: Article[] = [
  make("Marmara'da sıcaklık rekoru kırıldı", "Gündem", "#dc2626", "kbheat",
    "Meteoroloji hafta boyunca mevsim normallerinin sekiz derece üzerinde sıcaklık bekliyor.",
    "İstanbul", true,
    [img("kbheat2"), img("kbheat3"), img("kbheat4"), vid("kbheat", 45)]),
  make("Enflasyon beklentinin altında kaldı", "Ekonomi", "#15803d", "kbfinance",
    "Yıllık artış %28,4'e gerilerken piyasalar faiz indirimini fiyatlamaya başladı."),
  make("Milli takım gruptan lider çıktı", "Spor", "#ea580c", "kbfoot",
    "Son maçtaki 3-0'lık galibiyet çeyrek finalde ev sahibi avantajını getirdi.",
    undefined, false,
    [img("kbfoot2"), img("kbfoot3"), vid("kbfoot", 32)]),
];

/** Hero yalnızca medyalı haber gösterir; demo hero'nun hepsi medyalı. */
export const demoMostRead: Article[] = [
  make("Merkez Bankası faizi 250 baz puan indirdi", "Finans", "#15803d", "kbt1"),
  make("Ege'de 5,1 büyüklüğünde deprem", "Gündem", "#dc2626", "kbt2"),
  make("İstanbul'da toplu ulaşıma yeni hat", "Şehir", "#475569", "kbt3"),
  make("Elektrikli otomobilde ihracat rekoru", "Ekonomi", "#15803d", "kbt4"),
  make("Barajlarda doluluk %31'e geriledi", "Çevre", "#65a30d", "kbt5"),
];

export const demoFeatured: Article[] = [
  make("Kentsel dönüşümde yeni model: kira desteği iki katına çıkıyor", "Gündem", "#dc2626", "kbc1"),
  make("Günde 10 dakika merdiven: kalp riskini düşüren alışkanlık", "Sağlık", "#db2777", "kbc2"),
  make("Avrupa'da gece trenleri geri dönüyor: 12 başkent tek hatta", "Dünya", "#0891b2", "kbc3"),
  make("Okullarda yeni müfredat: haftada iki saat medya okuryazarlığı", "Eğitim", "#0369a1", "kbc4"),
  make("Yerli uydu haberleşme testlerinde ilk başarılı bağlantı", "Teknoloji", "#6d28d9", "kbc5"),
  make("Kıyı temizliği seferberliğinde 40 ton atık toplandı", "Çevre", "#65a30d", "kbc6"),
];

/**
 * Video rayı: her biri GERÇEKTEN video taşır (`has_video: true`).
 * Yayında bu liste `articles.has_video` bayrağıyla gelir.
 */
export const demoVideos: Article[] = [
  ["kbvh1", "Sahil şeridinde serinleme noktaları böyle çalışıyor", 42],
  ["kbvh2", "Merkez Bankası kararı sokakta nasıl karşılandı? Vatandaş ne dedi", 65],
  ["kbvh3", "Milli takımın kutlaması kamerada", 38],
  ["kbvh4", "Uydu haberleşme testinden ilk görüntüler geldi", 134],
  ["kbvh5", "Kentsel dönüşümde ilk yıkım başladı, mahalleli izledi", 96],
  ["kbvh6", "Sokak hayvanları için kurulan barınak hizmete girdi", 51],
  ["kbvh7", "Hasat başladı: incir bahçelerinde yoğun mesai", 73],
  ["kbvh8", "Yeni metro hattının test sürüşü yapıldı", 88],
  ["kbvh9", "Bienal hazırlıkları sürüyor: kırk sanatçı tek çatı altında", 112],
  ["kbvh10", "Deprem tatbikatı gerçeği aratmadı", 47],
  ["kbvh11", "Tarihi çarşıda restorasyon tamamlandı", 64],
  ["kbvh12", "Öğrenciler tasarladıkları robotu tanıttı", 79],
].map(([seed, title, dur]) => {
  const a = make(title as string, "Video", "#B3221E", seed as string,
    undefined, undefined, false, [vid(seed as string, dur as number)]);
  a.has_video = true;
  /**
   * Kapak = videonun posteri.
   *
   * Yayında bu `media.poster_key` üzerinden gelir; bot her videoyu
   * işlerken poster-thumb/card/full dosyalarını yazar. Haberin
   * fotoğrafı olmasa bile kart boş kalmaz.
   */
  a.cover = {
    ...(a.cover as MediaRow),
    type: "video",
    duration_sec: dur as number,
  };
  a.media = a.media.filter((m) => m.type === "video");
  return a;
});

export const demoByCategory: Record<string, Article[]> = {
  asayis: [
    make("Sahte kargo dolandırıcılığına 14 gözaltı", "Asayiş", "#7c2d12", "kbas1"),
    make("Otoyolda zincirleme kaza: trafik saatlerce kapandı", "Asayiş", "#7c2d12", "kbas2"),
    make("Kaçak elektrik operasyonunda 8 iş yerine ceza", "Asayiş", "#7c2d12", "kbas3"),
  ],
  ekonomi: [
    make("İhracatçılar dördüncü çeyrekte rekor bekliyor", "Ekonomi", "#15803d", "kbek1"),
    make("Konut satışlarında iki aylık ivme kesildi", "Ekonomi", "#15803d", "kbek2"),
    make("Küçük işletmelere yeni kredi paketi", "Ekonomi", "#15803d", "kbek3"),
  ],
  spor: [
    make("Trabzonspor deplasmanda 3 puanı 3 golle aldı", "Spor", "#ea580c", "kbsp1"),
    make("Milli voleybol takımı yarı finalde", "Spor", "#ea580c", "kbsp2"),
    make("Yeni sezon fikstürü açıklandı", "Spor", "#ea580c", "kbsp3"),
  ],
  saglik: [
    make("Sıcak hava uyarısı: risk grupları için 5 öneri", "Sağlık", "#db2777", "kbsg1"),
    make("Aile hekimliğinde randevu süresi uzuyor", "Sağlık", "#db2777", "kbsg2"),
    make("Aşı takviminde yeni düzenleme", "Sağlık", "#db2777", "kbsg3"),
  ],
};

export const demoFeed: Article[] = [
  make("Belediyeler ortak ulaşım kartına geçiyor: tek kartla 14 şehir", "Gündem", "#dc2626", "kbf1",
    "Kart, eylül sonunda 14 şehirde geçerli olacak; mevcut bakiyeler otomatik aktarılıyor."),
  make("Transfer sezonunun sürprizi: 19 yaşındaki forvet Avrupa yolunda", "Spor", "#ea580c", "kbf2",
    "Üç kulüp masada; bonservis bedeli kariyer rekoru olabilir."),
  make("Yerli işlemci projesinde ilk numune üretimi tamamlandı", "Teknoloji", "#6d28d9", "kbf3",
    "Test kartları üniversitelere dağıtıldı; seri üretim için takvim 2027."),
  make("Konut kredisi faizleri geriledi, başvurular üç ayın zirvesinde", "Ekonomi", "#15803d", "kbf4",
    "Bankalar yeni oranları açıkladı; ilk el konutta talep hızlandı."),
  make("İstanbul Bienali'nin teması açıklandı: \"Ortak Zemin\"", "Kültür", "#9333ea", "kbf5",
    "Kırk sanatçı altı mekâna dağılıyor; giriş ilk hafta ücretsiz."),
  make("Marketlerde geri çağırma: üç ürün raflardan kaldırıldı", "Yaşam", "#65a30d", "kbf6",
    "Bakanlık listesi güncellendi; iade için fiş şartı aranmıyor."),
];

/**
 * AKIŞ HAVUZU
 *
 * "Sana Özel" kaydırdıkça 10'ar haber yükler, tavan 50. Demo
 * modunda bunu görebilmek için havuzun 50'yi geçmesi gerekiyor;
 * yukarıdaki altı haber çeşitlendirilerek çoğaltılıyor.
 */
const FEED_TOPICS: [string, string, string, string][] = [
  ["Belediye meclisi bütçeyi onayladı", "Gündem", "#dc2626", "Oylama sonrası açıklama yapıldı; kalemler önümüzdeki hafta paylaşılacak."],
  ["Sanayi üretimi beklentiyi aştı", "Ekonomi", "#15803d", "Aylık artış yüzde 3,2 olarak açıklandı; imalat kolu öne çıktı."],
  ["Yeni hastane ek binası hizmete girdi", "Sağlık", "#db2777", "Poliklinik kapasitesi iki katına çıktı, randevu süreleri kısalıyor."],
  ["Ligde haftanın maçı bu akşam", "Spor", "#ea580c", "İki takım da eksiksiz kadroyla sahaya çıkıyor."],
  ["Okullarda yeni dönem hazırlığı", "Eğitim", "#0369a1", "Kayıt takvimi açıklandı; nakil başvuruları ay sonunda bitiyor."],
  ["Kültür yolu festivali başlıyor", "Kültür", "#9333ea", "Otuz mekânda iki hafta boyunca ücretsiz etkinlik olacak."],
  ["Elektrikli otobüs filosu büyüyor", "Teknoloji", "#6d28d9", "İlk parti otuz araç bu ay içinde hatlara giriyor."],
  ["Sahil temizliğinde rekor katılım", "Çevre", "#65a30d", "Gönüllüler bir günde sekiz ton atık topladı."],
  ["Trafikte yeni düzenleme", "Asayiş", "#7c2d12", "Merkezdeki üç cadde tek yöne çevriliyor."],
  ["Tarımda destek başvuruları açıldı", "Ekonomi", "#15803d", "Üreticiler için son başvuru tarihi ay sonu."],
];

const demoFeedExtra: Article[] = Array.from({ length: 48 }, (_, i) => {
  const [title, cat, color, summary] = FEED_TOPICS[i % FEED_TOPICS.length];
  const round = Math.floor(i / FEED_TOPICS.length) + 1;
  return make(
    round > 1 ? `${title} (${round})` : title,
    cat, color, `kbx${i}`, summary,
  );
});

export const demoBreaking: Article[] = [
  make("Ege'de 5,1 büyüklüğünde deprem", "Gündem", "#dc2626", "kbb1", undefined, "İzmir", true),
  make("Merkez Bankası faiz kararını açıkladı", "Ekonomi", "#15803d", "kbb2", undefined, "Ankara", true),
  make("Milli takım çeyrek finalde", "Spor", "#ea580c", "kbb3", undefined, undefined, true),
];

/** Borsa erişilemezse şerit boş kalmasın */
/** Demo mini grafik: deterministik dalga, her sembolde farklı */
function demoSpark(seed: number, up: boolean): number[] {
  return Array.from({ length: 28 }, (_, i) => {
    const wave = Math.sin((i + seed) / 3.4) * 4 + Math.sin((i + seed) / 1.7) * 1.8;
    const trend = (up ? 1 : -1) * i * 0.42;
    return 100 + wave + trend;
  });
}

export const demoQuotes: Quote[] = [
  { key: "XU100", label: "BIST 100", value: 10842, changePercent: 0.84, spark: demoSpark(1, true) },
  { key: "USDTRY=X", label: "USD/TRY", value: 41.26, changePercent: -0.12, spark: demoSpark(5, false) },
  { key: "EURTRY=X", label: "EUR/TRY", value: 44.91, changePercent: 0.31, spark: demoSpark(9, true) },
  { key: "GRAMALTIN", label: "Gram Altın", value: 4612, changePercent: 0.58, spark: demoSpark(3, true) },
  { key: "BZ=F", label: "Brent", value: 68.4, changePercent: -0.45, spark: demoSpark(7, false) },
  { key: "BTC-USD", label: "BTC", value: 77502, changePercent: 0.58, spark: demoSpark(2, true) },
  { key: "ETH-USD", label: "ETH", value: 2452, changePercent: 1.25, spark: demoSpark(6, true) },
];

export const demoWeather = {
  city: "Ankara", temp: 28, feels: 30, humidity: 28, code: 0,
  high: 32, low: 19, wind: 12,
  daily: [
    { date: "2026-08-26", high: 30, low: 18, code: 0 },
    { date: "2026-08-27", high: 31, low: 19, code: 1 },
    { date: "2026-08-28", high: 27, low: 17, code: 3 },
    { date: "2026-08-29", high: 25, low: 16, code: 61 },
    { date: "2026-08-30", high: 24, low: 15, code: 3 },
    { date: "2026-08-31", high: 26, low: 17, code: 2 },
  ],
  hourly: Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setHours(d.getHours() + i, 0, 0, 0);
    return {
      time: d.toISOString(),
      temp: 28 + Math.round(Math.sin(i / 3.6) * 5),
      code: i % 7 === 0 ? 2 : i % 11 === 0 ? 3 : 0,
    };
  }),
};

/** Canlı skor sağlayıcısı seçilene kadar şeritteki maç kutusu */
export const demoLive = {
  minute: "67'",
  home: "Trabzonspor",
  away: "Beşiktaş",
  score: "1 – 1",
  league: "Süper Lig",
};

/** Süper Lig tablosu — sağlayıcı bağlanana kadar */
export const demoLeague = {
  name: "Süper Lig",
  week: "3. hafta",
  next: { label: "Bugün 21:45", match: "Fenerbahçe – Samsunspor" },
  rows: [
    { pos: 1, team: "Galatasaray", form: ["w", "w", "w"], gd: "+6", pts: 9 },
    { pos: 2, team: "Fenerbahçe", form: ["w", "d", "w"], gd: "+4", pts: 7 },
    { pos: 3, team: "Trabzonspor", form: ["w", "w", "d"], gd: "+3", pts: 7 },
    { pos: 4, team: "Beşiktaş", form: ["d", "w", "l"], gd: "+1", pts: 5 },
    { pos: 5, team: "Samsunspor", form: ["l", "w", "d"], gd: "0", pts: 4 },
  ],
};

export const isDemo = (a: Article) => "isDemo" in a;
export const demoImage = (m: MediaRow | null): string | null =>
  m && "demoUrl" in m ? (m as MediaRow & { demoUrl: string }).demoUrl : null;

/** DB'ye ulaşılamadığında kategori bloklarının başlıkları */
export const demoCategoryNames: Record<string, string> = {
  gundem: "Gündem", asayis: "Asayiş", politika: "Politika", ekonomi: "Ekonomi",
  spor: "Spor", dunya: "Dünya", saglik: "Sağlık", teknoloji: "Teknoloji",
  egitim: "Eğitim", "kultur-sanat": "Kültür Sanat", yasam: "Yaşam",
  magazin: "Magazin", genel: "Genel", ulusal: "Ulusal Haber",
  "yerel-haber": "Yerel Haber", bolgesel: "Bölgesel", uluslararasi: "Uluslararası",
};


/* =============================================================
   MENÜ VE ŞEHİR YEDEĞİ

   HEADER'IN BOŞ GÖRÜNME SEBEBİ BUYDU: menü `nav_items`,
   şehir şeridi `cities` tablosundan geliyor. Tablolar boşken
   header'da ne kategori ne şehir kalıyordu.

   Artık DB boşsa prototipteki menü ve şehirler gösteriliyor.
   Tablolara kayıt girildiği an bunlar devre dışı kalır.
   ============================================================= */

import type { NavItem, CityRow } from "./types";

const nav = (
  id: string,
  location: NavItem["location"],
  kind: NavItem["kind"],
  label: Record<string, string>,
  target: string | null,
  order: number,
): NavItem => ({
  id: `demo-nav-${id}`,
  location,
  parent_id: null,
  kind,
  label,
  target_slug: target,
  url: null,
  icon: null,
  category_color: null,
  sort_order: order,
  open_new_tab: false,
});

/** Prototipteki header menüsü: Anasayfa · Spor · Finans · Kültür · Teknoloji · Video */
export const demoNav: NavItem[] = [
  nav("home", "header", "home",
    { tr: "Anasayfa", en: "Home", ar: "الرئيسية", ru: "Главная" }, null, 10),
  nav("spor", "header", "category",
    { tr: "Spor", en: "Sports", ar: "رياضة", ru: "Спорт" }, "spor", 20),
  nav("finans", "header", "category",
    { tr: "Finans", en: "Finance", ar: "اقتصاد", ru: "Финансы" }, "ekonomi", 30),
  nav("kultur", "header", "category",
    { tr: "Kültür", en: "Culture", ar: "ثقافة", ru: "Культура" }, "kultur-sanat", 40),
  nav("tek", "header", "category",
    { tr: "Teknoloji", en: "Technology", ar: "تقنية", ru: "Технологии" }, "teknoloji", 50),
  nav("video", "header", "video",
    { tr: "Video", en: "Video", ar: "فيديو", ru: "Видео" }, null, 60),

  nav("m-home", "mobile", "home",
    { tr: "Anasayfa", en: "Home", ar: "الرئيسية", ru: "Главная" }, null, 10),
  nav("m-spor", "mobile", "category",
    { tr: "Spor", en: "Sports", ar: "رياضة", ru: "Спорт" }, "spor", 20),
  nav("m-finans", "mobile", "category",
    { tr: "Finans", en: "Finance", ar: "اقتصاد", ru: "Финансы" }, "ekonomi", 30),
  nav("m-kultur", "mobile", "category",
    { tr: "Kültür", en: "Culture", ar: "ثقافة", ru: "Культура" }, "kultur-sanat", 40),
  nav("m-tek", "mobile", "category",
    { tr: "Teknoloji", en: "Technology", ar: "تقنية", ru: "Технологии" }, "teknoloji", 50),
  nav("m-video", "mobile", "video",
    { tr: "Video", en: "Video", ar: "فيديو", ru: "Видео" }, null, 60),
];

const city = (slug: string, name: string, plate: number, region: string): CityRow => ({
  id: `demo-city-${slug}`,
  slug, name, plate_code: plate, region,
  is_domestic: true, country_code: "TR",
  latitude: null, longitude: null,
});

/** Prototipteki şehir şeridi */
export const demoCities: CityRow[] = [
  city("istanbul", "İstanbul", 34, "Marmara"),
  city("ankara", "Ankara", 6, "İç Anadolu"),
  city("izmir", "İzmir", 35, "Ege"),
  city("bursa", "Bursa", 16, "Marmara"),
  city("antalya", "Antalya", 7, "Akdeniz"),
  city("adana", "Adana", 1, "Akdeniz"),
  city("konya", "Konya", 42, "İç Anadolu"),
  city("gaziantep", "Gaziantep", 27, "Güneydoğu Anadolu"),
  city("trabzon", "Trabzon", 61, "Karadeniz"),
  city("samsun", "Samsun", 55, "Karadeniz"),
  city("kayseri", "Kayseri", 38, "İç Anadolu"),
  city("eskisehir", "Eskişehir", 26, "İç Anadolu"),
];


/* =============================================================
   DEMO ARAMA

   Ana sayfadaki demo haberlerin BAĞLANTILARI da çalışmalı.
   Aksi halde başlığa tıklayan 404 görür ve haber sayfasını
   hiç göremez — canlıda tam olarak bu oluyordu.
   ============================================================= */

const ALL: Article[] = [
  ...demoHero, ...demoMostRead, ...demoFeatured, ...demoVideos,
  ...demoFeed, ...demoBreaking,
  ...Object.values(demoByCategory).flat(),
];

export function demoArticleBySlug(slug: string): Article | null {
  return ALL.find((a) => a.slug === slug) ?? null;
}

/** Kategori sayfası: hem eşleşen blok hem de genel liste */
/**
 * Kategori bloğu için haber.
 *
 * Her kategorinin KENDİ haberleri var. Ortak havuzdan doldurmak
 * yanlıştı: ana sayfada aynı haber iki kez çıkmasın diye eleme
 * yapılınca bloklar boşalıyordu. Gerçek veritabanında her
 * kategoride yeterince haber olur; demo da bunu yansıtmalı.
 */
const CAT_TOPICS: Record<string, string[]> = {
  asayis: [
    "Kaçak avlanmaya geçit yok: üç kişi yakalandı",
    "Dolandırıcılık operasyonunda dokuz gözaltı",
    "Otoyolda ters yöne giren sürücüye ceza",
    "Kayıp çocuk sekiz saat sonra bulundu",
    "Sahte içki imalathanesi çökertildi",
    "Hırsızlık şüphelisi kamerayla yakalandı",
    "Trafik denetiminde 400 sürücüye işlem",
    "Kaçak kazıya suçüstü müdahale",
  ],
  ekonomi: [
    "İhracatta aylık rekor kırıldı",
    "Asgari ücret görüşmeleri başlıyor",
    "Konut kredisinde faizler geriledi",
    "Turizmde sezon beklentinin üzerinde",
    "Küçük esnafa yeni destek paketi",
    "Enflasyon verisi açıklandı",
    "Sanayi üretimi ivme kazandı",
    "Kira artış oranı belirlendi",
  ],
  spor: [
    "Derbi öncesi son hazırlıklar tamamlandı",
    "Milli sporcu Avrupa şampiyonu oldu",
    "Transfer sezonu hareketli geçiyor",
    "Voleybolda yarı final heyecanı",
    "Genç takım turnuvayı lider bitirdi",
    "Yeni stadyumda ilk maç oynandı",
    "Basketbolda seri devam ediyor",
    "Atletizmde ülke rekoru kırıldı",
  ],
  saglik: [
    "Grip aşısı için randevular açıldı",
    "Uzmanlardan sıcak hava uyarısı",
    "Aile hekimliğinde yeni düzenleme",
    "Kalp sağlığı için beş öneri",
    "Şehir hastanesinde yeni ünite",
    "Kan bağışı kampanyası başladı",
    "Uyku düzeni üzerine yeni araştırma",
    "Çocuklarda göz taraması başlıyor",
  ],
};

const CAT_COLORS: Record<string, string> = {
  asayis: "#7c2d12", ekonomi: "#15803d", spor: "#ea580c", saglik: "#db2777",
  gundem: "#dc2626", teknoloji: "#6d28d9", dunya: "#0891b2", egitim: "#0369a1",
};

const catCache = new Map<string, Article[]>();

export function demoArticlesForCategory(slug: string): Article[] {
  const hit = catCache.get(slug);
  if (hit) return hit;

  const titles = CAT_TOPICS[slug];
  const name = demoCategoryNames[slug] ?? slug;
  const color = CAT_COLORS[slug] ?? "#64748b";

  const list = titles
    ? titles.map((t, i) =>
        make(t, name, color, `kbc-${slug}-${i}`,
          "Konuya ilişkin ayrıntılar gün içinde paylaşılacak."))
    : [...(demoByCategory[slug] ?? []), ...demoFeatured].slice(0, 8);

  catCache.set(slug, list);
  return list;
}

export function demoArticlesForCity(slug: string): Article[] {
  const named = ALL.filter((a) => a.city_slug === slug);
  return named.length ? named : demoFeed.slice(0, 4);
}

/** Akış: temel altı haber + çeşitlendirilmiş havuz */
export const demoFeedPool: Article[] = [...demoFeed, ...demoFeedExtra];

export function demoSearch(q: string): Article[] {
  const term = q.toLocaleLowerCase("tr");
  const hit = ALL.filter(
    (a) =>
      a.title.toLocaleLowerCase("tr").includes(term) ||
      (a.summary ?? "").toLocaleLowerCase("tr").includes(term),
  );
  // Hiç eşleşme yoksa boş dön; "sonuç yok" ekranı da tasarımın parçası.
  return hit;
}

export function demoCityBySlug(slug: string): CityRow | null {
  return demoCities.find((c) => c.slug === slug) ?? null;
}

export function demoCategoryBySlug(slug: string) {
  const name = demoCategoryNames[slug];
  if (!name) return null;
  const colors: Record<string, string> = {
    gundem: "#dc2626", asayis: "#7c2d12", politika: "#1d4ed8", ekonomi: "#15803d",
    spor: "#ea580c", dunya: "#0891b2", saglik: "#db2777", teknoloji: "#6d28d9",
    egitim: "#0369a1", "kultur-sanat": "#9333ea", yasam: "#65a30d",
    magazin: "#e11d48", genel: "#64748b",
  };
  return {
    id: `demo-cat-${slug}`,
    slug,
    name,
    short_name: name,
    kind: "topic" as const,
    color: colors[slug] ?? "#64748b",
    text_color: "#ffffff",
    icon: null,
    sort_order: 100,
    show_in_menu: true,
    show_in_home: true,
  };
}


/** Kurumsal sayfalar — `pages` tablosu boşken de açılsın */
export const demoPages: Record<string, {
  slug: string;
  title: Record<string, string>;
  body: Record<string, string>;
  seo_description: Record<string, string>;
}> = {
  hakkimizda: {
    slug: "hakkimizda",
    title: { tr: "Hakkımızda", en: "About", ar: "من نحن", ru: "О нас" },
    body: {
      tr: "Kuzeybatı Haber, güncel gelişmeleri hızlı ve doğru biçimde aktarmayı amaçlayan bir haber platformudur.\n\nHaberlerimiz İhlas Haber Ajansı kaynaklı içeriklerin yanı sıra kendi editör kadromuz tarafından hazırlanır. Yayına giren her içerik editör onayından geçer.\n\nBu sayfanın içeriği yönetim panelinden düzenlenebilir.",
      en: "Kuzeybatı Haber is a news platform that aims to deliver current developments quickly and accurately.\n\nThis page can be edited from the admin panel.",
    },
    seo_description: {},
  },
  kunye: {
    slug: "kunye",
    title: { tr: "Künye", en: "Imprint", ar: "بيانات الناشر", ru: "Выходные данные" },
    body: { tr: "Yayın sahibi, sorumlu yazı işleri müdürü ve iletişim bilgileri yönetim panelinden girilir." },
    seo_description: {},
  },
  iletisim: {
    slug: "iletisim",
    title: { tr: "İletişim", en: "Contact", ar: "اتصل بنا", ru: "Контакты" },
    body: { tr: "Haber ihbarı, düzeltme talebi ve reklam başvuruları için iletişim bilgileri panelden girilir." },
    seo_description: {},
  },
  gizlilik: {
    slug: "gizlilik",
    title: { tr: "Gizlilik", en: "Privacy", ar: "الخصوصية", ru: "Конфиденциальность" },
    body: { tr: "Kişisel verilerin işlenmesine ilişkin aydınlatma metni panelden girilir." },
    seo_description: {},
  },
  "kullanim-sartlari": {
    slug: "kullanim-sartlari",
    title: { tr: "Kullanım şartları", en: "Terms", ar: "شروط الاستخدام", ru: "Условия" },
    body: { tr: "Siteyi kullanırken geçerli olan koşullar panelden girilir." },
    seo_description: {},
  },
  reklam: {
    slug: "reklam",
    title: { tr: "Reklam", en: "Advertise", ar: "إعلن معنا", ru: "Реклама" },
    body: { tr: "Reklam alanları, ölçüler ve başvuru bilgileri panelden girilir." },
    seo_description: {},
  },
};


/** Namaz vakitleri — servis erişilemezse demo modunda gösterilir */
export const demoPrayer = {
  city: "Ankara",
  date: "",
  times: [
    { key: "imsak", time: "04:42" }, { key: "gunes", time: "06:14" },
    { key: "ogle", time: "13:08" }, { key: "ikindi", time: "16:47" },
    { key: "aksam", time: "19:52" }, { key: "yatsi", time: "21:16" },
  ],
  next: { key: "ikindi", time: "16:47" },
};
