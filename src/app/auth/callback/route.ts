import { NextResponse, type NextRequest } from "next/server";
import { createAuthedClient } from "@/lib/supabase/server";

/**
 * E-posta doğrulama / magic link dönüşü.
 * Supabase kodu çerez oturumuna çevirir, sonra kullanıcıyı
 * geldiği yere geri gönderir.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/";

  if (code) {
    const sb = await createAuthedClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }
  return NextResponse.redirect(new URL("/?auth=error", req.url));
}
