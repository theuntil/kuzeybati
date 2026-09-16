import { NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabase/server";
import { sendMail, mailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * DOĞRULAMA KODU GÖNDER
 *
 * RPC kodu üretir ve bize döndürür; biz mail servisine iletiriz.
 * Kod kullanıcının KENDİ adresine gidiyor, dolayısıyla bunu
 * sunucuda görmemiz bir sızıntı değil.
 *
 * Kod istemciye ASLA dönmez — yanıtta yalnızca durum var.
 */
export async function POST() {
  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!mailConfigured()) {
    return NextResponse.json({ error: "mail_not_configured" }, { status: 503 });
  }

  const { data, error } = await sb.rpc("request_email_verification");
  if (error) {
    // Hız sınırı ve "zaten doğrulanmış" mesajları kullanıcıya gösterilir
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code) {
    return NextResponse.json({ error: "no_code" }, { status: 500 });
  }

  const sent = await sendMail({
    template: "verify_email",
    to: row.email,
    toName: row.name,
    locale: row.locale,
    payload: { code: row.code, token: row.token, name: row.name },
  });

  if (!sent.ok) {
    /**
     * Kod üretildi ama mail çıkmadı. Kullanıcıya "gönderildi"
     * demek yerine gerçek sebebi söylüyoruz; aksi hâlde boş
     * gelen kutusuna bakıp bekliyor.
     */
    /**
     * Gerçek sebebi geçir. "unreachable" mail servisine hiç
     * ulaşılamadığı anlamına gelir — MAIL_API_URL yanlış ya da
     * servis kapalı. Bunu gizlemek hata ayıklamayı imkânsız
     * kılıyordu.
     */
    const reason = String(sent.body?.error ?? "send_failed");
    console.error("[dogrulama] mail gönderilemedi:", reason,
                  sent.status, sent.body?.detail ?? "");

    return NextResponse.json({
      error: reason,
      status: sent.status,
      detail: sent.body?.hint ?? sent.body?.detail ?? null,
    }, { status: reason === "mail_disabled" ? 503 : 502 });
  }

  // Kod yanıtta YOK; yalnızca hangi adrese gittiği
  return NextResponse.json({ status: "sent", email: maskEmail(row.email) });
}

/** a****t@ornek.com — kullanıcı hangi adrese gittiğini görsün */
function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  if (user.length <= 2) return `${user[0] ?? ""}***@${domain}`;
  return `${user[0]}${"*".repeat(Math.min(user.length - 2, 6))}${user.at(-1)}@${domain}`;
}
