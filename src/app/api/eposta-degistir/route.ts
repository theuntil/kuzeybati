import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mailConfigured, isEmailRegistered } from "@/lib/mail";

export const dynamic = "force-dynamic";

/* ══════════════════════════════════════════════════════════════
   E-POSTA DEĞİŞTİRME

   ┌─ KOD AKIŞIYLA AYNI BİLET ⚠️ ───────────────────────────────┐
   │ Kullanıcı önce MEVCUT adresine gelen kodu doğruluyor ve   │
   │ bir bilet alıyor. Bu uç o bileti tüketip adresi           │
   │ değiştiriyor.                                                │
   │                                                              │
   │ Böylece e-postası ele geçirilmemiş biri adresi             │
   │ değiştiremiyor — mevcut adrese erişim şart.                 │
   └──────────────────────────────────────────────────────────────┘

   ⚠ SERVİS ANAHTARI YALNIZCA BURADA.
   Adres değişimi `auth.users` üzerinde; istemci bunu yapamaz.
   Anahtar sunucu ortamında kalıyor.
   ══════════════════════════════════════════════════════════════ */

function yonetici() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: NextRequest) {
  if (!mailConfigured()) {
    return NextResponse.json({ error: "disabled" }, { status: 503 });
  }

  const govde = await req.json().catch(() => null) as
    | { email?: string; ticket?: string; newEmail?: string }
    | null;

  const eski = govde?.email?.trim().toLowerCase() ?? "";
  const yeni = govde?.newEmail?.trim().toLowerCase() ?? "";
  const bilet = govde?.ticket?.trim() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(yeni)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  if (!bilet || !eski) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (yeni === eski) {
    return NextResponse.json({ error: "same_email" }, { status: 400 });
  }

  const sb = yonetici();

  /*
   * ⚠ BİLET ÖNCE TÜKETİLİYOR.
   * `finish_password_reset` bileti geçersiz kılıp kullanıcı
   * kimliğini döndürüyor. Önce adresi değiştirip sonra bileti
   * tüketseydik, hata durumunda bilet tekrar kullanılabilirdi.
   */
  const { data: kimlik, error: biletHata } = await sb.rpc(
    "finish_password_reset", { p_email: eski, p_ticket: bilet });

  if (biletHata || !kimlik) {
    return NextResponse.json({ error: "invalid_ticket" }, { status: 400 });
  }

  /* Yeni adres başkasında olmamalı */
  if (await isEmailRegistered(yeni)) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const { error } = await sb.auth.admin.updateUserById(String(kimlik), {
    email: yeni,
    /*
     * ⚠ DOĞRULANMIŞ SAYILIYOR.
     * Kullanıcı mevcut adresine gelen kodu zaten doğruladı;
     * yeni adrese ikinci bir doğrulama istemek akışı
     * gereksiz uzatıyordu.
     */
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
