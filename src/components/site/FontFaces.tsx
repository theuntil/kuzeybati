import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * YAZI TİPİ YÜKLEYİCİ
 *
 * `public/fonts` klasörünü OKUR ve bulduğu her dosya için
 * @font-face kuralı üretir.
 *
 * NEDEN BÖYLE: CSS'e sabit dosya adı yazmak kırılgan. Dosya
 * `YahooSans-Regular.ttf` yerine `YahooSans_Rg.otf` ya da
 * `Yahoo Sans Regular.woff2` olarak konursa adres 404 döner ve
 * site sessizce Inter'e düşer — tam olarak yaşanan buydu.
 *
 * Artık ad ne olursa olsun bulunur; ağırlık ve italik bilgisi
 * dosya adından çıkarılır. Klasör boşsa hiç kural üretilmez ve
 * site Inter ile çalışmaya devam eder.
 */

/**
 * Dosya adından yazı tipi ailesi adı üretir.
 *
 * Ağırlık ve stil sözcükleri atılıyor; kalan kısım aile adı.
 * "YahooSans" gibi bitişik yazımlar boşlukla ayrılıyor.
 */
function aileAdi(dosya: string): string {
  let ad = dosya
    .replace(/\.[a-z0-9]+$/i, "")
    /* ağırlık ve stil ekleri */
    .replace(/[-_ ]?(variable|vf|italic|oblique|thin|extralight|ultralight|light|regular|normal|book|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy)\b/gi, "")
    /* Kısaltmalar: Rg, Bd, Lt, Md, Sb, Bk, It — tek başına ise */
    .replace(/[-_ ](rg|bd|lt|md|sb|bk|it|blk)\b/gi, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!ad) return "Yahoo Sans";

  /* "YahooSans" → "Yahoo Sans" */
  ad = ad.replace(/([a-z])([A-Z])/g, "$1 $2");

  /* Her sözcüğün ilk harfi büyük */
  return ad
    .split(/\s+/)
    .map((s) => s.charAt(0).toLocaleUpperCase("en") + s.slice(1))
    .join(" ");
}

const EXT: Record<string, string> = {
  ".woff2": "woff2",
  ".woff": "woff",
  ".ttf": "truetype",
  ".otf": "opentype",
};

/**
 * Dosya adından ağırlık çıkar.
 *
 * DİKKAT: Marka adı ("YahooSans") ağırlık sözcüğüne karışabilir.
 * "Yahoo Sans Bold" → boşluksuz "yahoosansbold" olur ve içinde
 * "sbold" geçtiği için bir ara YARI KALIN sanılıyordu. O yüzden
 * marka adı önce silinir ve ağırlık sözcükleri sınırlarıyla aranır.
 * Sıralama da önemli: "extrabold", "bold"tan önce denenmeli.
 */
function weightOf(name: string): number {
  const n = name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")        // uzantı
    .replace(/yahoo\s*sans/g, "")        // marka adı
    .replace(/[^a-z]/g, " ");

  if (/(extra|ultra)\s*black/.test(n)) return 950;
  if (/(black|heavy)/.test(n)) return 900;
  if (/(extra|ultra|x)\s*bold/.test(n)) return 800;
  if (/(semi|demi)\s*bold|^\s*demi|\bsemi\b/.test(n)) return 600;
  if (/\bbold\b|bold/.test(n)) return 700;
  if (/\bmed(ium)?\b|medium/.test(n)) return 500;
  if (/(extra|ultra)\s*light/.test(n)) return 200;
  if (/\blight\b|light/.test(n)) return 300;
  if (/\bthin\b|thin/.test(n)) return 100;
  return 400; // regular / book / normal / rg / adsız
}

function isItalic(name: string) {
  return /italic|oblique/i.test(name);
}

/** Değişken (variable) yazı tipi mi? Öyleyse tüm ağırlıkları kapsar. */
function isVariable(name: string) {
  return /variable|vf\b|\bvf/i.test(name);
}

export default function FontFaces() {
  let files: string[] = [];
  try {
    files = fs.readdirSync(path.join(process.cwd(), "public", "fonts"));
  } catch {
    return null; // klasör yoksa sessizce geç
  }

  const kullanilabilir = files.filter((f) => EXT[path.extname(f).toLowerCase()]);

  /*
   * ┌─ TEK YÜZLÜ AİLE HER AĞIRLIĞA AÇILIYOR ⚠️ ─────────────────┐
   * │ `wise.ttf` gibi tek dosyalık bir aile 400 ağırlıkla       │
   * │ kaydediliyordu. Başlık `font-weight: 800` isteyince       │
   * │ tarayıcı eşleşme bulamıyor ve YAPAY KALINLAŞTIRMA        │
   * │ uyguluyor — zaten kalın olan yazı tipi hantal görünüyor,  │
   * │ bazı tarayıcılarda ise yedek yazı tipine düşüyor.        │
   * │                                                              │
   * │ Ailede tek yüz varsa `font-weight: 100 900` veriliyor:    │
   * │ hangi ağırlık istenirse istensin O yüz kullanılıyor,      │
   * │ sentez devreye girmiyor.                                    │
   * │                                                              │
   * │ Birden çok yüzü olan ailelerde (Yahoo Sans) davranış      │
   * │ değişmiyor; her dosya kendi ağırlığında kalıyor.          │
   * └──────────────────────────────────────────────────────────────┘
   */
  const yuzSayisi = new Map<string, number>();
  for (const f of kullanilabilir) {
    const a = aileAdi(f);
    yuzSayisi.set(a, (yuzSayisi.get(a) ?? 0) + 1);
  }

  const faces = kullanilabilir
    .map((f) => {
      const fmt = EXT[path.extname(f).toLowerCase()];
      const url = `/fonts/${encodeURIComponent(f)}`;
      const style = isItalic(f) ? "italic" : "normal";
      const aile = aileAdi(f);
      const weight =
        isVariable(f) || yuzSayisi.get(aile) === 1
          ? "100 900"
          : String(weightOf(f));

      /*
       * ┌─ HER DOSYA "YAHOO SANS" OLUYORDU ⚠️ ────────────────┐
       * │ Aile adı sabit yazılmıştı. `wise.ttf` klasöre        │
       * │ konunca o da "Yahoo Sans" adıyla kaydediliyor,       │
       * │ "Wise" diye bir aile HİÇ oluşmuyordu. CSS'te         │
       * │ `font-family: "Wise"` yazmak bu yüzden işe           │
       * │ yaramıyordu.                                          │
       * │                                                        │
       * │ Artık aile adı DOSYA ADINDAN çıkarılıyor:            │
       * │   YahooSans-Bold.woff2 → "Yahoo Sans"                │
       * │   wise.ttf             → "Wise"                       │
       * │   Wise-Bold.otf        → "Wise"                       │
       * │                                                        │
       * │ Böylece yeni bir yazı tipi eklemek için yalnızca     │
       * │ dosyayı klasöre koymak yetiyor.                       │
       * └────────────────────────────────────────────────────────┘
       */
      return `@font-face{font-family:"${aile}";src:url("${url}") format("${fmt}");font-weight:${weight};font-style:${style};font-display:swap;}`;
    });

  /*
   * ⚠ TANILAMA.
   * Yazı tipi görünmediğinde sebebi anlamak zor: dosya klasörde
   * mi, adres 404 mü, aile adı mı tutmuyor? Bulunan aileler
   * sunucu günlüğüne yazılıyor ve `<html data-fonts>` olarak
   * işaretleniyor — tarayıcıda tek bakışta görülüyor.
   */
  const aileler = [...new Set(kullanilabilir.map(aileAdi))];

  /*
   * ┌─ VURGU YAZI TİPİ ADA BAĞLI OLMASIN ⚠️ ────────────────────┐
   * │ Tanıtım başlığı CSS'te `font-family: "Wise"` diye sabit   │
   * │ yazıyordu. Dosya `wise-font.ttf` ya da `WiseDisplay.otf`  │
   * │ olarak konursa aile adı "Wise Font" / "Wise Display"      │
   * │ oluyor ve CSS TUTMUYOR — okur "font çalışmıyor" diyor.    │
   * │                                                              │
   * │ Artık gövde tipi (Yahoo Sans / Inter) DIŞINDAKİ ilk aile  │
   * │ vurgu tipi kabul edilip `--font-vurgu` değişkenine        │
   * │ yazılıyor. Dosya adı ne olursa olsun çalışıyor.           │
   * │                                                              │
   * │ Klasörde yalnızca gövde tipi varsa değişken hiç           │
   * │ yazılmıyor; CSS kendi yedeğine düşüyor.                    │
   * └──────────────────────────────────────────────────────────────┘
   */
  const govde = new Set(["Yahoo Sans", "Inter"]);
  const vurgu = aileler.find((a) => !govde.has(a)) ?? null;
  if (aileler.length) {
    console.log(`[YAZI TIPI] aileler: ${aileler.join(", ")} · vurgu: ${vurgu ?? "(yok)"}`);
  } else {
    console.warn("[YAZI TIPI] public/fonts BOŞ — site yedek tiple çalışıyor");
  }

  if (faces.length === 0) return null;

  /**
   * Öne yüklenecek dosya: gövde metninin kullandığı NORMAL ağırlık.
   * Kalın bir dosyayı öne yüklemek ilk boyamayı hızlandırmaz.
   * woff2 varsa o tercih edilir — en küçük dosya.
   */
  const usable = files.filter((f) => EXT[path.extname(f).toLowerCase()] && !isItalic(f));
  const normals = usable.filter((f) => weightOf(f) === 400);
  const pool = normals.length ? normals : usable;
  const preload =
    pool.find((f) => f.toLowerCase().endsWith(".woff2")) ?? pool[0];

  return (
    <>
      <meta name="kb-fonts" content={aileler.join(",")} />
      {vurgu && (
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--font-vurgu:"${vurgu.replace(/"/g, "")}"}`,
          }}
        />
      )}
      {preload && (
        <link
          rel="preload"
          as="font"
          type={`font/${path.extname(preload).slice(1)}`}
          href={`/fonts/${encodeURIComponent(preload)}`}
          crossOrigin=""
        />
      )}
      <style dangerouslySetInnerHTML={{ __html: faces.join("") }} />
    </>
  );
}
