"use client";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Link from "next/link";

/**
 * Giriş / kayıt. Profil satırını burada AÇMIYORUZ — veritabanında
 * `on_auth_user_created` trigger'ı auth.users'a eklenen her kullanıcı
 * için profiles satırını kendisi açıyor. İstemciden açmaya çalışmak
 * hem gereksiz hem de RLS'e takılırdı.
 */
export default function AuthForm({
  mode, locale, dict,
}: {
  mode: "login" | "signup";
  locale: Locale;
  dict: Dictionary;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();

    if (mode === "signup") {
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(href(locale, "account"))}`,
        },
      });
      setMsg(
        error
          ? { kind: "err", text: error.message }
          : { kind: "ok", text: dict.auth.checkEmail },
      );
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ kind: "err", text: dict.auth.invalid });
      } else {
        window.location.href = href(locale, "account");
        return;
      }
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 11, maxWidth: 380 }}>
      {mode === "signup" && (
        <label style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow muted">{dict.auth.name}</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
      )}

      <label style={{ display: "grid", gap: 6 }}>
        <span className="eyebrow muted">{dict.auth.email}</span>
        <input
          className="field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span className="eyebrow muted">{dict.auth.password}</span>
        <input
          className="field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </label>

      <button className="btn btn-primary" disabled={busy} style={{ marginTop: 4 }}>
        {busy ? dict.common.loading : mode === "signup" ? dict.auth.signup : dict.auth.login}
      </button>

      {msg && (
        <p
          role="status"
          style={{ fontSize: 13.5, color: msg.kind === "ok" ? "var(--ac2)" : "var(--dn)", margin: 0 }}
        >
          {msg.text}
        </p>
      )}

      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {mode === "signup" ? dict.auth.haveAccount : dict.auth.noAccount}{" "}
        <Link
          href={href(locale, mode === "signup" ? "login" : "signup")}
          style={{ color: "var(--ac)", fontWeight: 700 }}
        >
          {mode === "signup" ? dict.auth.login : dict.auth.signup}
        </Link>
      </p>
    </form>
  );
}
