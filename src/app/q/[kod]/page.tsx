import { redirect, notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/server";

/*
 * ══════════════════════════════════════════════════════════════
 *  QR YÖNLENDİRME  ·  /q/<kısa-kod>
 *
 *  Basılmış QR kodları bu adresi taşıyor. Hedef veritabanından
 *  okunuyor; panelden değiştirilince basılı kodlar yeni adrese
 *  gitmeye başlıyor.
 *
 *  ⚠ ÖNBELLEKLENMİYOR.
 *  Hedef her an değişebilir ve okunma sayacı her ziyarette
 *  artmalı. Önbelleklenmiş bir yanıt ikisini de bozardı.
 * ══════════════════════════════════════════════════════════════
 */

export const dynamic = "force-dynamic";

export default async function QrYonlendir({
  params,
}: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;

  /*
   * ⚠ BİÇİM ÖNCE DENETLENİYOR.
   * Veritabanına gitmeden eleniyor: uzun ya da tuhaf karakterli
   * istekler boşuna sorgu açmasın.
   */
  if (!/^[a-z0-9]{4,20}$/i.test(kod)) notFound();

  const sb = createPublicClient();
  const { data, error } = await sb.rpc("qr_git", { p_kod: kod.toLowerCase() });

  if (error) {
    console.error("[QR] yönlendirme okunamadı:", error.message);
    notFound();
  }

  const hedef = typeof data === "string" ? data : null;

  /* Kod yoksa, silinmişse ya da kapalıysa 404 */
  if (!hedef) notFound();

  /*
   * ⚠ YALNIZCA http/https.
   * Veritabanı da denetliyor ama burada bir kez daha bakılıyor:
   * eski bir kayıt ya da elle yapılmış bir değişiklik zararlı
   * bir adres taşıyorsa okuyan kişiye gitmesin.
   */
  if (!/^https?:\/\//i.test(hedef)) {
    console.error(`[QR] güvensiz hedef engellendi: ${hedef}`);
    notFound();
  }

  redirect(hedef);
}
