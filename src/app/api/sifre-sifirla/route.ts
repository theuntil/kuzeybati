import { NextResponse, type NextRequest } from "next/server";
import {
  requestPasswordReset, verifyResetCode, confirmPasswordReset,
  isEmailRegistered, mailConfigured,
} from "@/lib/mail";
import { hizSiniri, istekKimligi, asiriIstekYaniti } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ŞİFRE SIFIRLAMA
 *
 * İki adım tek uçta: `step: "request"` kod ister,
 * `step: "confirm"` kodu doğrulayıp şifreyi değiştirir.
 *
 * Şifre değiştirme mail servisinde yapılır çünkü Supabase Admin
 * API'si `service_role` gerektiriyor ve o anahtar yalnızca orada.
 * Siteye koymak, site sızdığında tüm veritabanını açardı.
 *
 * KENDİ HIZ SINIRIMIZ: mail servisinin sınırı IP başına; bu uç
 * herkese açık olduğu için burada da sınırlıyoruz.
 */
const WINDOW = 60_000;
const MAX = 6;
const hits = new Map<string, { n: number; reset: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const r = hits.get(ip);
  if (!r || now > r.reset) {
    hits.set(ip, { n: 1, reset: now + WINDOW });
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    return false;
  }
  r.n += 1;
  return r.n > MAX;
}

export async function POST(req: NextRequest) {
  /*
   * ⚠ HIZ SINIRI.
   * Şifre sıfırlama maili: 10 dakikada 3. Aynı gerekçe.
   */
  const bekle = hizSiniri("sifre-sifirla", istekKimligi(req), 3, 600000);
  if (bekle !== null) return asiriIstekYaniti(bekle);

  if (!mailConfigured()) {
    return NextResponse.json({ error: "mail_not_configured" }, { status: 503 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ?? "unknown";

  if (limited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, {
      status: 429, headers: { "Retry-After": "60" },
    });
  }

  const body = await req.json().catch(() => null) as
    | { step?: string; email?: string; code?: string;
        ticket?: string; password?: string }
    | null;
  if (!body?.email) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (body.step === "request") {
    /**
     * KAYITSIZ ADRESLE DEVAM EDİLMEZ.
     *
     * Kullanıcı yanlış adres yazdığında sessizce ilerleyip
     * gelmeyen bir kodu beklemesi kötü bir deneyimdi.
     *
     * Bunun bedeli: adresin kayıtlı olup olmadığı öğrenilebilir.
     * Mail servisi bu sorguyu IP başına dakikada 5 ile
     * sınırlıyor ve yasaklı IP'den hiç yanıtlamıyor; sınırsız
     * tarama mümkün değil.
     */
    const registered = await isEmailRegistered(body.email);
    if (registered === false) {
      return NextResponse.json({ error: "not_registered" }, { status: 404 });
    }

    await requestPasswordReset(body.email);
    return NextResponse.json({ status: "ok" });
  }

  /**
   * KOD DOĞRULAMA — ayrı adım.
   *
   * Kod burada kontrol edilir; yanlışsa kullanıcı şifre ekranına
   * GEÇEMEZ. Doğruysa tek kullanımlık bilet döner.
   */
  if (body.step === "verify") {
    if (!body.code) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const res = await verifyResetCode(body.email, body.code);
    if (!res.ok) {
      return NextResponse.json(
        { error: String(res.body?.error ?? "invalid_code") },
        { status: res.status === 429 ? 429 : 400 },
      );
    }
    return NextResponse.json({ status: "ok", ticket: res.body?.ticket });
  }

  if (body.step === "confirm") {
    if (!body.ticket || !body.password) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    if (body.password.length < 8) {
      return NextResponse.json({ error: "weak_password" }, { status: 400 });
    }

    const res = await confirmPasswordReset(body.email, body.ticket, body.password);
    if (!res.ok) {
      const err = String(res.body?.error ?? "failed");
      return NextResponse.json({ error: err }, { status: err === "invalid_ticket" ? 400 : res.status });
    }
    return NextResponse.json({ status: "ok" });
  }

  return NextResponse.json({ error: "invalid_step" }, { status: 400 });
}
