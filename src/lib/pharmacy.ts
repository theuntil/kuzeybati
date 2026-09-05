import "server-only";

/**
 * NÖBETÇİ ECZANE — api.nobetecza.com
 *
 * ANAHTAR SUNUCUDA KALIR. Tüm çağrılar sunucudan yapılır;
 * tarayıcıya yalnızca sonuç iner. Anahtarı istemciye vermek
 * kotanın başkaları tarafından tüketilmesi demekti.
 *
 * .env:
 *   ECZANE_API_URL   (varsayılan https://api.nobetecza.com)
 *   ECZANE_API_KEY   zorunlu — yoksa hizmet gösterilmez
 *
 * Kota: dakikada 100 istek. Nöbet listesi günde bir değişir,
 * o yüzden yarım saat önbellek fazlasıyla yeterli.
 */

const BASE = (process.env.ECZANE_API_URL ?? "https://api.nobetecza.com").replace(/\/+$/, "");

export interface Pharmacy {
  id: number;
  ad: string;
  adres: string;
  telefon: string | null;
  il: string;
  ilce: string;
  tarif: string | null;
  konum: { lat: number; lng: number } | null;
  /** Konum aramasında metre cinsinden uzaklık */
  mesafe?: number;
}

export interface DutyResult {
  pharmacies: Pharmacy[];
  date: string | null;
  il: string | null;
  ilce: string | null;
}

export interface Province { id: number; ad: string; slug: string; plaka: number | null }
export interface District { id: number; ad: string; slug: string }

export function pharmacyConfigured(): boolean {
  return Boolean(process.env.ECZANE_API_KEY);
}

/**
 * Slug doğrulama — SSRF ve parametre enjeksiyonuna karşı.
 *
 * Kullanıcıdan gelen `il`/`ilce` doğrudan adrese ekleniyor.
 * Yalnızca küçük harf, rakam ve tire kabul edilir; plaka kodu
 * için 1-81 arası sayı da geçerli. Başka her şey reddedilir.
 */
export function safeSlug(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 81 ? s : null;
  }
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 40 ? s : null;
}

export type ApiError = "auth" | "rate" | "notfound" | "bad" | "down";

async function call<T>(
  path: string,
  params: Record<string, string>,
  revalidate: number,
): Promise<{ data: T | null; error: ApiError | null }> {
  const key = process.env.ECZANE_API_KEY;
  if (!key) return { data: null, error: "auth" };

  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
      headers: { "X-API-Key": key, Accept: "application/json" },
      /*
       * ⚠ ZAMAN AŞIMI ŞART.
       * Sağlayıcı yanıt vermediğinde istek süresiz asılı
       * kalıyor ve sayfa hiç açılmıyordu.
       */
      signal: AbortSignal.timeout(4000),
      next: { revalidate },
    });

    if (res.status === 401) return { data: null, error: "auth" };
    if (res.status === 429) return { data: null, error: "rate" };
    if (res.status === 404) return { data: null, error: "notfound" };
    if (res.status === 400) return { data: null, error: "bad" };
    if (!res.ok) return { data: null, error: "down" };

    const json = (await res.json()) as { success?: boolean } & Record<string, unknown>;
    if (json.success === false) return { data: null, error: "down" };
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: "down" };
  }
}

/** İl (+ ilçe) bazlı nöbetçi eczaneler */
export async function getDutyPharmacies(
  il: string,
  ilce?: string | null,
): Promise<{ result: DutyResult | null; error: ApiError | null }> {
  const safeIl = safeSlug(il);
  if (!safeIl) return { result: null, error: "bad" };

  const params: Record<string, string> = { il: safeIl };
  const safeIlce = safeSlug(ilce);
  if (safeIlce) params.ilce = safeIlce;

  const { data, error } = await call<{
    data: Pharmacy[];
    tarih?: string;
    il?: { ad: string };
    ilce?: { ad: string };
  }>("/v1/nobetci", params, 1800);

  if (!data) return { result: null, error };
  return {
    result: {
      pharmacies: data.data ?? [],
      date: data.tarih ?? null,
      il: data.il?.ad ?? null,
      ilce: data.ilce?.ad ?? null,
    },
    error: null,
  };
}

/** Koordinata en yakın nöbetçi eczaneler */
export async function getNearbyPharmacies(
  lat: number,
  lng: number,
  radius = 5000,
): Promise<{ result: DutyResult | null; error: ApiError | null }> {
  // Sınır kontrolü: API max 50 km kabul ediyor, koordinat aralığı sabit
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { result: null, error: "bad" };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { result: null, error: "bad" };
  const r = Math.min(50000, Math.max(500, Math.round(radius)));

  const { data, error } = await call<{ data: Pharmacy[]; tarih?: string }>(
    "/v1/konum",
    { lat: lat.toFixed(6), lng: lng.toFixed(6), radius: String(r) },
    // Konum sonucu kişiye özel; kısa önbellek yeterli
    300,
  );

  if (!data) return { result: null, error };
  return {
    result: { pharmacies: data.data ?? [], date: data.tarih ?? null, il: null, ilce: null },
    error: null,
  };
}

/** 81 il + Kıbrıs — haftalarca değişmez */
export async function getProvinces(): Promise<Province[]> {
  const { data } = await call<{ data: Province[] }>("/v1/iller", {}, 60 * 60 * 24 * 7);
  return data?.data ?? [];
}

/** Bir ilin ilçeleri */
export async function getDistricts(il: string): Promise<District[]> {
  const safe = safeSlug(il);
  if (!safe) return [];
  const { data } = await call<{ data: District[] }>(
    "/v1/ilceler",
    { il: safe },
    60 * 60 * 24 * 7,
  );
  return data?.data ?? [];
}
