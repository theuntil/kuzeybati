"use client";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

/**
 * Bülten kaydı. Yazma `subscribe_newsletter()` RPC'si üzerinden:
 * e-posta biçimi, tekrar kayıt ve saatlik sınır veritabanında
 * denetleniyor, istemciye güvenilmiyor.
 */
export default function Newsletter({
  locale, dict, source = "footer",
}: {
  locale: Locale;
  dict: Dictionary;
  source?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("busy");

    const { data, error } = await supabaseBrowser().rpc("subscribe_newsletter", {
      p_email: email,
      p_locale: locale,
      p_source: source,
    });

    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row?.ok) {
      setState("err");
      setMsg(
        row?.message === "gecersiz_eposta"
          ? dict.auth.invalid
          : row?.message === "cok_fazla_deneme"
            ? dict.comments.rateLimit
            : dict.common.error,
      );
    } else {
      setState("ok");
      setEmail("");
      setMsg(row.already ? dict.footer.newsletter : dict.auth.checkEmail);
    }
  }

  return (
    <aside
      style={{
        border: "1px solid var(--bd)", borderRadius: 18,
        background: "var(--s1)", padding: 18,
      }}
    >
      <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 2 }}>
        {dict.footer.newsletter}
      </h3>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 12px", lineHeight: 1.5 }}>
        {dict.footer.newsletterHint}
      </p>

      <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
        <input
          className="field"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ad@ornek.com"
          aria-label={dict.auth.email}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn-pill" disabled={state === "busy"} style={{ flex: "0 0 auto" }}>
          {dict.footer.subscribe}
        </button>
      </form>

      {msg && (
        <p
          role="status"
          style={{
            fontSize: 12.5, marginTop: 9, marginBottom: 0,
            color: state === "ok" ? "var(--ac2)" : "var(--dn)",
          }}
        >
          {msg}
        </p>
      )}
    </aside>
  );
}
