import "server-only";
import { cookies } from "next/headers";

/**
 * SEÇİLİ ŞEHİR — SİTE GENELİ
 *
 * Hava durumu, namaz vakitleri ve nöbetçi eczane tek bir şehir
 * seçimine bağlıdır. Seçim çerezde tutulur ki sunucu da bilsin;
 * istemci tarafı ayrıca localStorage'a yazar (çerez silinirse
 * seçim kaybolmasın).
 *
 * Varsayılan: İstanbul.
 */
export const CITY_COOKIE = "kb-city";
export const DEFAULT_CITY = "istanbul";

/** Çerezdeki değeri doğrular; geçersizse null döner. */
function cerezdenSehir(ham: string | undefined): string | null {
  if (!ham) return null;
  /*
   * ⚠ ÇEREZ İSTEMCİDEN GELİYOR — DOĞRULANMALI.
   * Elle düzenlenebilir; sorguya ham girmemeli.
   */
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(ham) && ham.length <= 40 ? ham : null;
}

/**
 * ══════════════════════════════════════════════════════════════
 *  ANAHTAR ŞEHİR
 *
 *  ┌─ GİRİŞ YAPILDIYSA PROFİL KAYNAKTIR ⚠️ ────────────────────┐
 *  │ Önce yalnızca çereze bakılıyordu. Çerez tarayıcıya özel:  │
 *  │                                                              │
 *  │   • Mobil uygulamadan şehrini değiştiren okur, web'de      │
 *  │     eski şehri görüyordu.                                    │
 *  │   • Başka bir telefondan girince şehir yine yanlıştı.      │
 *  │   • Kayıt olurken şehir seçiliyordu ama siteye hiç         │
 *  │     yansımıyordu.                                            │
 *  │                                                              │
 *  │ Artık giriş yapılmışsa `profiles.city_id` KAYNAK. Nerede   │
 *  │ değiştirilirse değiştirilsin (web ayarları, mobil          │
 *  │ uygulama, başka cihaz) tüm yüzeyler aynı şehri gösteriyor. │
 *  │                                                              │
 *  │ Çerez giriş yapmamış ziyaretçi için ve profil okunamazsa   │
 *  │ yedek olarak duruyor.                                        │
 *  └──────────────────────────────────────────────────────────────┘
 * ══════════════════════════════════════════════════════════════
 */
/**
 * ══════════════════════════════════════════════════════════════
 *  ANAHTAR ŞEHİR
 *
 *  ┌─ BURADA OTURUM OKUNMAZ ⚠️⚠️ ───────────────────────────────┐
 *  │ Bir ara burada `auth.getUser()` çağrılıyordu; amaç, giriş  │
 *  │ yapmış okurun profil şehrini kaynak almaktı.               │
 *  │                                                              │
 *  │ SİTEYİ KIRDI: bu fonksiyon `layout.tsx`ten çağrılıyor,     │
 *  │ yani HER SAYFADA. `getUser()` erişim jetonu tazeyken       │
 *  │ yenileme tetikliyor ve yeni jetonu çereze yazmaya          │
 *  │ çalışıyor. Sunucu bileşeninden çerez YAZILAMIYOR, yazma    │
 *  │ sessizce düşüyor — ama yenileme jetonu Supabase tarafında  │
 *  │ zaten döndürülmüş oluyor. Tarayıcıdaki çerez artık        │
 *  │ geçersiz; middleware oturumu tazelemeye çalışıyor,         │
 *  │ başarısız oluyor, istemci oturum değişikliği görüp sayfayı │
 *  │ yeniliyor — ve döngü baştan başlıyor.                      │
 *  │                                                              │
 *  │ Belirtisi: tüm sayfalarda sonsuz yeniden yükleme ve her    │
 *  │ açılışta tema titremesi.                                    │
 *  │                                                              │
 *  │ ⚠ BU FONKSİYON YALNIZCA ÇEREZ OKUR. Profil ile eşitleme,   │
 *  │ oturum zaten tazelenmiş olan yerlerde yapılıyor: kayıt,    │
 *  │ giriş, ayarlar ve `SehirSenkron` istemci bileşeni.         │
 *  └──────────────────────────────────────────────────────────────┘
 * ══════════════════════════════════════════════════════════════
 */
export async function getSelectedCitySlug(): Promise<string> {
  try {
    const store = await cookies();
    return cerezdenSehir(store.get(CITY_COOKIE)?.value) ?? DEFAULT_CITY;
  } catch {
    /* İstek bağlamı yoksa (statik üretim) varsayılan */
    return DEFAULT_CITY;
  }
}
