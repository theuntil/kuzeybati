import "server-only";

/**
 * MAİL SERVİSİ İSTEMCİSİ
 *
 * Servis doğrudan gönderiyor; kullanıcı ekranda bekliyorsa
 * yanıtı da bekliyoruz. Başarısızlık kullanıcıya bildirilir —
 * "gönderildi" deyip göndermemek daha kötü.
 */
const URL_ = process.env.MAIL_API_URL?.replace(/\/+$/, "");
const KEY = process.env.MAIL_API_KEY;

export function mailConfigured(): boolean {
  return Boolean(URL_ && KEY);
}

async function post(path: string, body: unknown, timeoutMs = 12000) {
  if (!URL_ || !KEY) {
    return { ok: false, status: 503, body: { error: "mail_not_configured" } };
  }
  try {
    const res = await fetch(`${URL_}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": KEY },
      body: JSON.stringify(body),
      // SMTP el sıkışması birkaç saniye sürebilir
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    /**
     * `res.ok` YETMEZ.
     *
     * Servis mail kapalıyken ya da şablon işlenemediğinde de
     * 2xx dönebiliyordu; yalnızca HTTP koduna bakmak "gönderildi"
     * yalanına yol açıyordu. Gövdedeki `status` alanı da
     * kontrol ediliyor.
     */
    /**
     * `/api/send` için `status === "sent"` şart; diğer uçlar
     * (şifre sıfırlama) kendi biçimlerinde `status: "ok"` döner.
     */
    const ok = res.ok && (json.status === "sent" || json.status === "ok");
    return { ok, status: res.status, body: json };
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      status: timeout ? 504 : 502,
      body: { error: timeout ? "timeout" : "unreachable" },
    };
  }
}

export type Template =
  | "verify_email" | "welcome" | "newsletter_confirm" | "article_status";

export function sendMail(input: {
  template: Template;
  to: string;
  toName?: string | null;
  payload?: Record<string, unknown>;
  locale?: string;
}) {
  return post("/api/send", {
    template: input.template,
    to: input.to,
    to_name: input.toName ?? null,
    payload: input.payload ?? {},
    locale: input.locale ?? "tr",
  });
}

/** Şifre sıfırlama kodu iste — kodu site HİÇ görmez */
export function requestPasswordReset(email: string) {
  return post("/api/password-reset/request", { email });
}

/**
 * Kayıt sonrası hesabı onayla.
 *
 * Supabase "Confirm email" açıksa oturum vermiyor; bizim kendi
 * doğrulama sistemimiz olduğu için hesabı onaylayıp kullanıcıyı
 * hemen içeri alıyoruz.
 */
export function autoConfirm(email: string) {
  return post("/api/auth/autoconfirm", { email }, 8000);
}

/** Adres sistemde kayıtlı mı — kayıtsızsa sıfırlama başlamaz */
export async function isEmailRegistered(email: string): Promise<boolean | null> {
  const r = await post("/api/password-reset/check-email", { email }, 8000);
  if (!r.ok) return null;              // kontrol edilemedi
  return r.body?.registered === true;
}

/** Kodu doğrula → tek kullanımlık bilet döner */
export function verifyResetCode(email: string, code: string) {
  return post("/api/password-reset/verify", { email, code });
}

/** Biletle şifreyi değiştir */
export function confirmPasswordReset(email: string, ticket: string, password: string) {
  return post("/api/password-reset/confirm", { email, ticket, password });
}
