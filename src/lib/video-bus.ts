/**
 * VİDEO KOORDİNASYONU
 *
 * Sayfada birden çok oynatıcı olabilir (kapak videosu, alttaki
 * videolar, galeri). Aynı anda ikisinin sesli oynaması kabul
 * edilemez ve galeri açılınca arkadaki video susmalıdır.
 *
 * Küçük bir yayın kanalı: her oynatıcı kaydolur, biri başlayınca
 * diğerleri durur. React context yerine bunu seçtim çünkü galeri
 * portal ile <body> altına basılıyor ve ağaç dışında kalıyor.
 */
type Entry = { id: string; pause: () => void };

const players = new Map<string, Entry>();

export function registerPlayer(id: string, pause: () => void): () => void {
  players.set(id, { id, pause });
  return () => {
    players.delete(id);
  };
}

/** `exceptId` dışındaki tüm oynatıcıları durdurur. */
export function pauseOthers(exceptId?: string) {
  players.forEach((p) => {
    if (p.id !== exceptId) p.pause();
  });
}
