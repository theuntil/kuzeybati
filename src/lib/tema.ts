/**
 * TEMA DEĞİŞTİRME
 *
 * ┌─ NEDEN ÇEREZ DE YAZILIYOR ⚠️ ─────────────────────────────┐
 * │ Tema yalnızca `localStorage`'da tutuluyordu. Sunucu onu    │
 * │ okuyamadığı için gönderdiği HTML'de `data-theme` hiç       │
 * │ olmuyor, CSS varsayılanı (koyu tema) devreye giriyordu.    │
 * │ Açık temadaki kullanıcı her tam sayfa yüklemesinde bir     │
 * │ an siyah ekran görüyordu.                                   │
 * │                                                              │
 * │ Çerez sunucuya da gidiyor; `[locale]/layout.tsx` onu okuyup│
 * │ `<html data-theme>` olarak ilk bayta gömüyor. Çakma bitiyor.│
 * │                                                              │
 * │ İkisi birden yazılıyor: localStorage aynı cihazda kalıcı,  │
 * │ çerez ise sunucunun görebildiği tek yer.                    │
 * └──────────────────────────────────────────────────────────────┘
 */

export type Tema = "light" | "dark";

/** Şu anki tema — DOM'dan okunuyor, tek doğru kaynak orası */
export function temaOku(): Tema {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** Temayı uygula ve iki yere birden kaydet */
export function temaYaz(tema: Tema): void {
  if (typeof document === "undefined") return;

  document.documentElement.setAttribute("data-theme", tema);

  try {
    localStorage.setItem("kb-theme", tema);
  } catch {
    /* gizli sekmede localStorage kapalı olabilir; tema yine değişir */
  }

  /*
   * Bir yıl geçerli, site kökü, `samesite=lax`.
   * `lax` yeterli: bu bir güvenlik değeri değil, yalnızca görünüm
   * tercihi. `secure` bayrağı konulmuyor çünkü yerel geliştirme
   * HTTP üzerinden çalışıyor ve orada çerez düşerdi.
   */
  document.cookie = `kb-theme=${tema};path=/;max-age=31536000;samesite=lax`;
}

/** Açık ↔ koyu — yeni temayı döndürür */
export function temaDegistir(): Tema {
  const yeni: Tema = temaOku() === "light" ? "dark" : "light";
  temaYaz(yeni);
  return yeni;
}
