import { NextResponse, type NextRequest } from "next/server";
import { createAuthedClient } from "@/lib/supabase/server";
import { sendMail, mailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * E-POSTA DEĞİŞTİRME KODUNU GÖNDER
 *
 * Kod YENİ adrese gider; böylece adresin gerçekten kullanıcıya
 * ait olduğu doğrulanır.
 *
 * Oturum şart: başkası adına kod gönderilemez.
 */
export async function POST(req: NextRequest) {
  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!mailConfigured()) {
    return NextResponse.json({ error: "mail_not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as
    | { email?: string; code?: string; name?: string } | null;

  if (!body?.email || !body.code) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const sent = await sendMail({
    template: "verify_email",
    to: body.email,
    toName: body.name ?? null,
    payload: { code: body.code, name: body.name ?? "", token: "" },
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: String(sent.body?.error ?? "send_failed") },
      { status: 502 },
    );
  }
  return NextResponse.json({ status: "sent" });
}
