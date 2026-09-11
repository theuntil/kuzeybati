import { NextResponse, type NextRequest } from "next/server";
import { autoConfirm, mailConfigured } from "@/lib/mail";
import { hizSiniri, istekKimligi, asiriIstekYaniti } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * KAYIT SONRASI OTOMATİK ONAY
 *
 * Supabase "Confirm email" açıkken `signUp` oturum döndürmüyor
 * ve kullanıcı giriş ekranına atılıyordu. Bizim kendi doğrulama
 * sistemimiz var; Supabase'inki gereksiz.
 *
 * Onay mail servisinde yapılıyor çünkü Admin API `service_role`
 * gerektiriyor ve o anahtar yalnızca orada.
 *
 * Servis tarafında yalnızca SON 2 DAKİKADA açılmış hesaplar
 * onaylanıyor; bu uç ele geçirilse bile eski hesaplar
 * etkilenmiyor.
 */
export async function POST(req: NextRequest) {
  /*
   * ⚠ HIZ SINIRI.
   * Kayıt onay maili: 10 dakikada 3. Mail bombardımanını durduruyor.
   */
  const bekle = hizSiniri("kayit-onay", istekKimligi(req), 3, 600000);
  if (bekle !== null) return asiriIstekYaniti(bekle);

  if (!mailConfigured()) {
    return NextResponse.json({ status: "skipped" });
  }

  const body = await req.json().catch(() => null) as { email?: string } | null;
  if (!body?.email) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const res = await autoConfirm(body.email);
  // Başarısızlık kullanıcıyı durdurmaz; giriş yine denenir
  return NextResponse.json({ status: res.ok ? "ok" : "skipped" });
}
