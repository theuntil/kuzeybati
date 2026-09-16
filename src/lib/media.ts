import type { MediaRow } from "./types";
import { publicConfig } from "./config";

/**
 * CDN adresi ÇAĞRI ANINDA okunur, modül yüklenirken değil.
 * Modül seviyesinde sabitlenirse tarayıcı tarafında
 * `window.__KB_CONFIG` henüz gömülmeden okunma riski doğar.
 */
const cdn = () => publicConfig().cdnBase;

export type Variant = "thumb" | "card" | "full";

/**
 * VARYANT GENİŞLİKLERİ — `bot_settings.image_variants` ile aynı.
 * Bot varsayılanı: thumb 400 / card 800 / full 1920.
 */
const VARIANT_W: Record<Variant, number> = { thumb: 400, card: 800, full: 1920 };
const ORDER: Variant[] = ["thumb", "card", "full"];

/**
 * HANGİ VARYANTLAR GERÇEKTEN VAR?
 *
 * Bot kaynaktan BÜYÜK varyant üretmez. `image-processor.ts`:
 *
 *   if (v.name !== "thumb" && meta.width < v.w * 0.9) {
 *     const already = variants.some((x) => x.width >= meta.width - 2);
 *     if (already) continue;          // varyant atlanır
 *   }
 *
 * 800px'lik bir video posteri için `poster-full.avif` HİÇ
 * üretilmez. Site körü körüne `full` isteyince CDN 404 döner ve
 * kapak boş görünür — yaşanan tam olarak buydu.
 *
 * Fotoğraflarda bot ürettiği varyantları `media.variants` içine
 * ad ad yazıyor; oradan KESİN okunur. Videoda yalnızca posterin
 * kaynak genişliği (`variants.poster.w`) kayıtlı, o yüzden
 * botun kuralı burada birebir tekrar edilir.
 */
function producedVariants(width: number): Variant[] {
  const out: { name: Variant; width: number }[] = [];
  for (const name of ORDER) {
    const w = VARIANT_W[name];
    if (name !== "thumb" && width < w * 0.9) {
      if (out.some((x) => x.width >= width - 2)) continue;
    }
    out.push({ name, width: Math.min(w, width) });
  }
  return out.map((x) => x.name);
}

/** Bir medya satırı için mevcut varyantlar */
function availableFor(m: MediaRow, poster: boolean): Variant[] {
  const v = m.variants as Record<string, { w?: number }> | null;

  if (poster) {
    const w = v?.poster?.w;
    // Genişlik bilinmiyorsa güvenli taraf: thumb + card.
    // Gözlemlenen tüm posterlerde bu ikisi var, full çoğu zaman yok.
    return typeof w === "number" && w > 0 ? producedVariants(w) : ["thumb", "card"];
  }

  // Fotoğraf: bot ürettiği varyantları ad ad yazıyor
  const named = v ? (Object.keys(v).filter((k) => k in VARIANT_W) as Variant[]) : [];
  if (named.length) return ORDER.filter((x) => named.includes(x));

  // Eski kayıt: genişlikten türet
  return m.width ? producedVariants(m.width) : ["thumb", "card"];
}

/**
 * İstenen varyant yoksa ELDEKİ EN BÜYÜĞÜNE düşer.
 * Asla var olmayan bir dosya istenmez.
 */
function resolveVariant(m: MediaRow, want: Variant, poster: boolean): Variant {
  const have = availableFor(m, poster);
  if (have.includes(want)) return want;
  for (let i = ORDER.indexOf(want) - 1; i >= 0; i--) {
    if (have.includes(ORDER[i])) return ORDER[i];
  }
  return have[0] ?? "thumb";
}

/**
 * Medya URL'i.
 *
 * Veritabanında TAM URL saklanmıyor, sadece storage_key. CDN alan adı
 * değişirse tek env değişkeni güncellenir; hiçbir satır dokunmaz.
 * Yol biçimi bot'un storage.ts dosyasıyla aynı:
 *   media/{yyyy}/{mm}/{dd}/{haberKodu}/{externalKey}/{variant}.avif
 */
export function mediaUrl(
  key: string | null | undefined,
  variant: Variant = "card",
  ext = "avif",
): string | null {
  const base = cdn();
  if (!key || !base) return null;
  return `${base}/${key}/${variant}.${ext}`;
}

export function videoUrl(key: string | null | undefined): string | null {
  const base = cdn();
  if (!key || !base) return null;
  return `${base}/${key}/video.mp4`;
}

/** Demo kaydında gömülü video adresi (yalnızca demo modunda) */
export function videoSrc(m: MediaRow | null): string | null {
  if (!m) return null;
  if ("demoVideo" in m) return (m as MediaRow & { demoVideo: string }).demoVideo;
  return videoUrl(m.storage_key);
}

/**
 * Video posteri.
 *
 * Bot posteri şu dosyalara yazar:
 *   {storage_key}/poster-thumb.avif
 *   {storage_key}/poster-card.avif
 *   {storage_key}/poster-full.avif
 * ve `media.poster_key = {storage_key}/poster` olarak kaydeder.
 *
 * Uzantı `bot_settings.image_format` ayarına bağlı ve bot bunu
 * `media.variants.poster.f` içine yazıyor. Sabit `.avif` yazmak,
 * ayar webp/jpeg'e çevrilirse tüm posterleri 404 yapardı.
 */
export function posterUrl(
  posterKey: string | null | undefined,
  variant: Variant = "card",
  format = "avif",
): string | null {
  const base = cdn();
  if (!posterKey || !base) return null;
  return `${base}/${posterKey}-${variant}.${format}`;
}

/** `media.variants` içinden posterin gerçek uzantısını okur. */
function posterFormat(m: MediaRow): string {
  const v = m.variants as { poster?: { f?: string } } | null;
  return v?.poster?.f ?? "avif";
}

/** Video posteri: demo kaydında gömülü görsel, gerçekte poster_key */
export function posterFor(m: MediaRow | null, variant: Variant = "full"): string | null {
  if (!m) return null;
  if ("demoUrl" in m) return pickImage(m, variant);
  return posterUrl(m.poster_key, resolveVariant(m, variant, true), posterFormat(m));
}

/** Site logosu / kaynak logosu gibi tek parçalı dosyalar */
/**
 * MARKA GÖRSELİ ADRESİ (logo, favicon, paylaşım görseli)
 *
 * İki kaynak olabilir:
 *   • Panelden yüklenenler Supabase Storage'daki `library`
 *     kovasında — anahtar `brand/` ile başlar
 *   • Eskiden elle konulanlar R2/CDN'de
 *
 * Anahtarın kendisi hangisi olduğunu söylüyor; ayrı bir alan
 * tutmaya gerek yok.
 */
export function assetUrl(key: string | null | undefined): string | null {
  if (!key) return null;

  // Tam adres verilmişse olduğu gibi kullan
  if (/^https?:\/\//i.test(key)) return key;

  /*
   * ARTIK HER ŞEY R2'DE.
   *
   * `library/`, `avatar/`, `editor/` ve `media/` öneklerinin
   * hepsi aynı bucket'ta; adres tek tabandan kurulur. Eskiden
   * `library/` Supabase Storage'a gidiyordu — iki CDN, iki
   * fatura, iki silme mantığı demekti.
   */
  const base = cdn();
  if (!base) return null;
  return `${base}/${key}`;
}

/**
 * Bir medya satırından gösterilecek görsel.
 *
 * Demo kayıtlarında `demoUrl` doğrudan kullanılır — veritabanı
 * boşken de sayfa tasarımdaki gibi dolu görünsün diye.
 */
const DEMO_SIZE: Record<Variant, [number, number]> = {
  thumb: [400, 250],
  card: [800, 500],
  full: [1600, 900],
};

export function pickImage(m: MediaRow | null, variant: Variant = "card") {
  if (!m) return null;

  /*
   * ⚠ PANELDEN YÜKLENEN MEDYA.
   *
   * Botun ürettiği medyada `storage_key` bir KLASÖR ve gerçek
   * dosyalar içinde (`card.avif`). Panelden yüklenende ise
   * anahtarın kendisi DOSYA.
   *
   * `variants.direct` işareti olmadan buraya `/card.avif`
   * ekleniyor ve panel medyasının tamamı 404 veriyordu.
   */
  const v = m.variants as Record<string, unknown> | null;
  if (v && "direct" in v) {
    const base = cdn();
    const anahtar = m.type === "video" ? (m.poster_key ?? m.storage_key) : m.storage_key;
    return anahtar && base ? `${base}/${anahtar}` : null;
  }

  if ("demoUrl" in m) {
    // Demo görselini de istenen boyutta iste; kart için 900px
    // indirmek demo modunu gereksiz yavaşlatıyordu.
    const [w, h] = DEMO_SIZE[variant];
    return (m as MediaRow & { demoUrl: string }).demoUrl.replace(
      /\/\d+\/\d+$/,
      `/${w}/${h}`,
    );
  }
  // Videoda kapak = posteri. Bot her videoyu işlerken üretiyor.
  if (m.type === "video") {
    return posterUrl(m.poster_key, resolveVariant(m, variant, true), posterFormat(m));
  }
  return mediaUrl(m.storage_key, resolveVariant(m, variant, false));
}

/** srcset: retina ekranlarda tam çözünürlük */
/**
 * srcset — YALNIZCA var olan varyantlar.
 *
 * Olmayan bir varyantı listeye koymak tarayıcının 404 indirmesine
 * ve görselin boş kalmasına yol açar.
 */
export function srcSet(m: MediaRow | null): string | undefined {
  /* Panelden yüklenen medyada tek dosya var — varyant yok */
  const dv = m?.variants as Record<string, unknown> | null;
  if (dv && "direct" in dv) return undefined;

  if (!m || "demoUrl" in m) return undefined;
  if (m.type === "video" || !m.storage_key) return undefined;

  const parts = availableFor(m, false)
    .map((v) => {
      const url = mediaUrl(m.storage_key, v);
      return url ? `${url} ${Math.min(VARIANT_W[v], m.width ?? VARIANT_W[v])}w` : null;
    })
    .filter((x): x is string => x !== null);

  return parts.length > 1 ? parts.join(", ") : undefined;
}

/**
 * Görsel yüklenene kadar gösterilecek düz renk.
 * width/height ile birlikte CLS'i sıfırlar.
 */
export function placeholder(m: MediaRow | null): string {
  return m?.dominant_color ?? "var(--s2)";
}

/**
 * Görselin gerçek oranı ARTIK KULLANILMIYOR.
 *
 * Kart oranını medya boyutundan türetmek düzeni patlatıyordu:
 * dikey bir fotoğraf (1080×1920) kartı ekran boyu uzatıyor,
 * başlık ve okuma süresi çok aşağıda kalıyordu. Kartlar artık
 * SABİT oran kullanır (16/10, 4/3, 9/16) ve görsel `object-fit:
 * cover` ile kırpılır.
 */
