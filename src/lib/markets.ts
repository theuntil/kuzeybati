import "server-only";
import type { Quote, TickerSymbol } from "./types";
import { piyasaQuotes } from "./piyasa/quotes";

/**
 * PİYASA VERİSİ
 *
 * ┌─ KAYNAK DEĞİŞTİ ⚠️ ────────────────────────────────────────┐
 * │ Eskiden Yahoo Finance ve `borsa-api` kullanılıyordu. İkisi │
 * │ de gecikmeli ve halka açık veri sunuyor; paketin kendi     │
 * │ belgesi ticari kullanıma uygun olmadığını söylüyordu.      │
 * │                                                              │
 * │ Artık tek kaynak var: Piyasa API                            │
 * │   döviz  → TCMB günlük kur bülteni                         │
 * │   maden  → Borsa İstanbul (TCMB EVDS üzerinden)            │
 * │   kripto → FreeCryptoAPI                                     │
 * │                                                              │
 * │ ⚠ ESKİ YOL SİLİNDİ, YEDEK OLARAK BIRAKILMADI.              │
 * │ Kullanılmayan kod bırakmak ileride "yedek olarak açayım"   │
 * │ cazibesi yaratıyordu — o veri lisanssız.                    │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ⚠ ANAHTAR YOKSA BOŞ LİSTE.
 * `PIYASA_API_KEY` tanımlı değilse piyasa bölümleri kendiliğinden
 * gizleniyor. Sebep sunucu günlüğüne yazılıyor.
 */
export async function fetchQuotes(symbols: TickerSymbol[]): Promise<Quote[]> {
  return piyasaQuotes(symbols);
}

export { piyasaHazir } from "./piyasa/client";
