"use client";

/**
 * R2'YE YÜKLEME — İSTEMCİ TARAFI
 *
 * İki adım:
 *   1. Sunucudan imzalı adres al (`POST /api/yukleme`)
 *   2. Dosyayı DOĞRUDAN R2'ye PUT et
 *
 * Dosya Next.js sunucusundan geçmez.
 */

export interface YuklemeSonuc {
  key: string;
  url: string;
}

export type Onek = "avatar" | "library" | "editor" | "mail";

/**
 * @param onek  Hedef klasör. `avatar` ve `editor` kullanıcının
 *              kendi klasörüne yazar; klasör sunucuda belirlenir.
 * @param ilerleme  0–100 arası yüzde. Büyük videolarda kullanıcı
 *              donmuş sanmasın diye.
 */
export async function r2Yukle(
  dosya: Blob,
  onek: Onek,
  ad?: string,
  ilerleme?: (yuzde: number) => void,
): Promise<YuklemeSonuc> {
  const contentType = dosya.type || "application/octet-stream";

  const imza = await fetch("/api/yukleme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      onek, contentType, bytes: dosya.size, fileName: ad,
    }),
  });

  if (!imza.ok) {
    const j = (await imza.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Yükleme adresi alınamadı");
  }

  const { url, key, publicUrl } = (await imza.json()) as {
    url: string; key: string; publicUrl: string;
  };

  /*
   * XHR KULLANILIYOR, FETCH DEĞİL.
   *
   * `fetch` yükleme ilerlemesi vermiyor (upload stream desteği
   * tarayıcılarda hâlâ eksik). 80 MB'lık bir videoda ilerleme
   * çubuğu olmadan kullanıcı sekmeyi kapatıyor.
   */
  /*
   * ⚠ DOĞRUDAN R2'YE.
   *
   * Bir ara sunucu üzerinden yükleyen bir yedek yol vardı
   * (CORS engeli için). Artık R2 bucket'ında CORS tanımlı;
   * dosyanın kendi sunucumuzdan geçmesine gerek yok.
   *
   * Doğrudan yükleme hem daha hızlı hem de büyük dosyalarda
   * sunucu belleğini meşgul etmiyor.
   *
   * CORS hatası alınırsa R2 panelinden bucket'ın CORS
   * ayarına sitenin alan adı eklenmelidir.
   */
  await new Promise<void>((cozum, hata) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    if (ilerleme) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) ilerleme(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) cozum();
      else hata(new Error(`R2 yükleme hatası (${xhr.status})`));
    };
    /*
     * ⚠ CORS HATASI DA BURAYA DÜŞÜYOR.
     *
     * Tarayıcı CORS engelini `onerror` olarak bildiriyor ve
     * ayrıntı vermiyor; "ağ hatası" demek yanıltıcı oluyordu.
     * Gerçek sebep genelde R2 bucket'ında alan adının kayıtlı
     * olmaması.
     */
    xhr.onerror = () => hata(new Error(
      "Yükleme tamamlanamadı. Depolama ayarları alan adına izin " +
      "vermiyor olabilir (R2 → bucket → CORS).",
    ));
    xhr.ontimeout = () => hata(new Error("Yükleme zaman aşımına uğradı"));
    xhr.timeout = 10 * 60_000;   // 10 dakika: büyük video için

    xhr.send(dosya);
  });


  ilerleme?.(100);
  return { key, url: publicUrl };
}

/** Yarıda kalan yüklemeyi temizle — kullanıcı vazgeçtiğinde */
export async function r2Vazgec(key: string): Promise<void> {
  try {
    await fetch(`/api/yukleme?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  } catch {
    // Temizlenemese de sorun değil: yetim tarayıcı günde bir yakalar
  }
}
