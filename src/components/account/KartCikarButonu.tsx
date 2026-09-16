"use client";
import { useState } from "react";
import OzelIkon from "@/components/ui/OzelIkon";
import { supabaseBrowser } from "@/lib/supabase/client";

/* ══════════════════════════════════════════════════════════════
   KAYIT / BEĞENİ DÜĞMESİ

   Kaydedilenler ve beğenilenler listesindeki yuvarlak düğme.

   ┌─ FONKSİYON ADLARI YANLIŞTI ⚠️ ────────────────────────────┐
   │ `toggle_save` ve `toggle_like` diye bir şey yok. Doğrusu: │
   │     toggle_saved_article / toggle_article_like            │
   │                                                              │
   │ PostgREST bulamayınca sessizce hata dönüyordu; kart        │
   │ ekrandan kalkıyor ama veritabanında hiçbir şey            │
   │ değişmiyordu. Sayfa yenilenince haber geri geliyordu.     │
   └──────────────────────────────────────────────────────────────┘

   ⚠ KART LİSTEDEN ÇIKMIYOR.
   Sadece ikon doluyor/boşalıyor. Yanlışlıkla basan biri
   kartı kaybetmesin; geri almak tek dokunuş.

   ⚠ KART BİR BAĞLANTININ İÇİNDE.
   `preventDefault` + `stopPropagation` ikisi de gerekli,
   yoksa tıklama haber sayfasını açıyor.
   ══════════════════════════════════════════════════════════════ */

export default function KartCikarButonu({
  articleId, tur,
}: {
  articleId: string;
  tur: "saved" | "likes";
}) {
  /* Başlangıçta dolu: zaten bu listede olduğu için */
  const [dolu, setDolu] = useState(true);
  const [bekliyor, setBekliyor] = useState(false);

  async function degistir(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (bekliyor) return;

    setBekliyor(true);
    const yeni = !dolu;
    setDolu(yeni);           // iyimser: ikon anında dönüyor

    const sb = supabaseBrowser();
    const { error } = await sb.rpc(
      tur === "saved" ? "toggle_saved_article" : "toggle_article_like",
      { p_article_id: articleId },
    );

    /* Sunucu reddederse ikon eski hâline dönüyor */
    if (error) setDolu(!yeni);
    setBekliyor(false);
  }

  const etiket = tur === "saved"
    ? (dolu ? "Kaydedilenlerden çıkar" : "Tekrar kaydet")
    : (dolu ? "Beğeniyi geri al" : "Tekrar beğen");

  return (
    <button
      type="button"
      onClick={(e) => void degistir(e)}
      aria-label={etiket}
      aria-pressed={dolu}
      title={etiket}
      className="kb-kart-dugme"
      style={{
        width: 38, height: 38, borderRadius: "50%",
        display: "grid", placeItems: "center", flexShrink: 0,
        background: "var(--s2)", border: "1px solid var(--bd)",
        cursor: "pointer", alignSelf: "center",
        opacity: bekliyor ? 0.55 : 1,
        transition: "opacity .15s ease, transform .15s ease",
      }}
    >
      <OzelIkon
        ad={
          tur === "saved"
            ? (dolu ? "bookmark-solid" : "bookmark")
            : (dolu ? "heart-solid" : "heart")
        }
        size={17}
      />
    </button>
  );
}
