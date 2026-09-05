import { USER_AGENT, FETCH_TIMEOUT_MS } from "./config";

/*
 * ══════════════════════════════════════════════════════════════
 *  WIKIMEDIA HTTP KATMANI
 *
 *  Zaman aşımı, yeniden deneme ve hata sınıflandırma burada.
 *  Çağıran taraf yalnızca "veri" ya da "boş" görüyor.
 * ══════════════════════════════════════════════════════════════
 */

export type WikiHataTuru =
  | "notfound"      // o güne kayıt yok
  | "unsupported"   // dil desteklenmiyor (501)
  | "ratelimit"     // 429
  | "server"        // 5xx ya da bozuk gövde
  | "network";      // bağlantı kurulamadı / zaman aşımı

export class WikiError extends Error {
  constructor(public status: number, public kind: WikiHataTuru) {
    super(`WikiError ${status} (${kind})`);
    this.name = "WikiError";
  }
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function wikiFetch(
  url: string,
  /* Varsayılan tek deneme — bütçe için, bkz. FETCH_TIMEOUT_MS */
  { revalidate, retries = 1 }: { revalidate: number; retries?: number },
): Promise<unknown> {
  let sonHata: unknown;

  for (let deneme = 0; deneme <= retries; deneme++) {
    try {
      const res = await fetch(url, {
        next: { revalidate },
        /*
         * ⚠ ZAMAN AŞIMI ŞART.
         * Wikimedia yavaşladığında istek süresiz asılı kalıyor
         * ve sayfa hiç açılmıyordu.
         */
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          accept: "application/json",
          "user-agent": USER_AGENT,
          "api-user-agent": USER_AGENT,
        },
      });

      if (res.ok) {
        try {
          return await res.json();
        } catch {
          /* Gövde bozuksa sunucu hatası sayılıyor — yeniden denenebilir */
          throw new WikiError(200, "server");
        }
      }

      /*
       * ⚠ BU İKİSİ YENİDEN DENENMİYOR.
       * 404 "o güne veri yok", 501 "bu dil desteklenmiyor"
       * demek; tekrar istemek sonucu değiştirmez, yalnızca
       * Wikimedia'yı gereksiz yorar.
       */
      if (res.status === 404) throw new WikiError(404, "notfound");
      if (res.status === 501) throw new WikiError(501, "unsupported");

      if (res.status === 429) {
        /* Sunucu ne kadar bekleneceğini söylüyorsa ona uyuluyor */
        const ra = Number(res.headers.get("retry-after"));
        await bekle(Number.isFinite(ra) && ra > 0
          ? ra * 1000
          : 1000 * (deneme + 1));
        sonHata = new WikiError(429, "ratelimit");
        continue;
      }

      if (res.status >= 500) {
        sonHata = new WikiError(res.status, "server");
        await bekle(300 * 2 ** deneme);   // 300 · 600 · 1200 ms
        continue;
      }

      throw new WikiError(res.status, "server");
    } catch (e) {
      if (e instanceof WikiError
          && (e.kind === "notfound" || e.kind === "unsupported")) {
        throw e;
      }
      sonHata = e instanceof WikiError ? e : new WikiError(0, "network");
      if (deneme < retries) await bekle(300 * 2 ** deneme);
    }
  }

  throw sonHata ?? new WikiError(0, "network");
}
