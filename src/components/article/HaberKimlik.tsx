"use client";
import { useEffect } from "react";

/* ══════════════════════════════════════════════════════════════
   AÇIK HABERİN KİMLİĞİ

   ┌─ NEDEN SATIR İÇİ BETİK DEĞİL ⚠️ ───────────────────────────┐
   │ Önce haber sayfası `<script>` ile `document.body.dataset`  │
   │ yazıyordu. İki sorunu vardı:                                │
   │                                                              │
   │  1. Başka sayfaya geçilince TEMİZLENMİYORDU. Ana sayfada   │
   │     yapılan izleme kaydı son okunan haberin kimliğiyle     │
   │     gidiyor ve istatistikleri bozuyordu.                    │
   │  2. İstemci tarafı gezinmede betiğin yeniden çalışması     │
   │     garanti değil; kimlik hiç yazılmayabiliyordu.           │
   │                                                              │
   │ Bileşen olarak yazılınca ikisi de çözülüyor: React öğeyi   │
   │ takıyor, ayrılırken temizliyor.                             │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function HaberKimlik({ id }: { id: string }) {
  useEffect(() => {
    document.body.dataset.haberId = id;
    return () => { delete document.body.dataset.haberId; };
  }, [id]);

  return null;
}
