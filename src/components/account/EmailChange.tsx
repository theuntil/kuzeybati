"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useToast } from "@/components/ui/Toast";
import Sheet from "@/components/ui/Sheet";
import CodeInput from "./CodeInput";
import { PrimaryButton, TextField } from "@/components/auth/Steps";

/**
 * E-POSTA DEĞİŞTİRME
 *
 * Ayrı bir pencerede: masaüstünde ortada, mobilde alttan kayan
 * tabaka. İşlem bitince aşağı doğru kapanır.
 *
 * İki adım: yeni adres → o adrese gelen 6 haneli kod.
 * Kod YENİ adrese gidiyor; böylece adresin gerçekten kullanıcıya
 * ait olduğu doğrulanmış oluyor.
 */
export default function EmailChange({
  current, dict, onChanged,
}: {
  current: string | null;
  dict: Dictionary;
  onChanged: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const t = useToast();

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function close() {
    setOpen(false);
    setStep(0); setCode(""); setEmail("");
  }

  async function requestCode() {
    if (!email.includes("@")) { t.error(dict.profile.emailInvalid); return; }
    setBusy(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("request_email_change", { p_new_email: email.trim() });
    setBusy(false);

    if (error) { t.error(error.message); return; }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.code) { t.error(dict.common.error); return; }

    // Kodu yeni adrese gönder
    const res = await fetch("/api/eposta-degistir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: row.email, code: row.code, name: row.name }),
    });
    if (!res.ok) { t.error(dict.profile.sendFailed); return; }

    setStep(1);
    setWait(120);
  }

  async function verify(c: string) {
    setBusy(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("verify_email_change", { p_code: c });
    setBusy(false);

    if (error) { t.error(error.message); setCode(""); return; }
    if (!data) { t.error(dict.profile.codeWrong); setCode(""); return; }

    t.success(dict.profile.emailChanged);
    onChanged(String(data));
    close();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
          height: 40, padding: "0 16px", borderRadius: 14,
          background: "var(--s2)", color: "var(--tx)",
          fontSize: 13.5, fontWeight: 700,
        }}
      >
        {dict.profile.changeEmail}
      </button>

      <Sheet open={open} onClose={close} title={dict.profile.changeEmail}>
        <div style={{ display: "grid", gap: 18 }}>
          {step === 0 ? (
            <>
              <p style={{ fontSize: 13.5, color: "var(--mu)", lineHeight: 1.55, margin: 0 }}>
                {dict.profile.currentEmail}: <b style={{ color: "var(--tx)" }}>{current}</b>
              </p>
              <TextField
                label={dict.profile.newEmail}
                value={email}
                onChange={setEmail}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
              />
              <PrimaryButton onClick={requestCode} disabled={busy || !email.includes("@")}>
                {busy ? dict.common.loading : dict.profile.sendCode}
              </PrimaryButton>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: "var(--mu)", textAlign: "center", lineHeight: 1.55, margin: 0 }}>
                {dict.profile.codeSentTo}<br />
                <b style={{ color: "var(--tx)" }}>{email}</b>
              </p>
              <CodeInput value={code} onChange={setCode} disabled={busy} onComplete={verify} />
              <PrimaryButton onClick={() => verify(code)} disabled={busy || code.length !== 6}>
                {busy ? dict.common.loading : dict.auth.save}
              </PrimaryButton>
              <button
                onClick={requestCode}
                disabled={busy || wait > 0}
                style={{
                  fontSize: 13, fontWeight: 600,
                  color: wait > 0 ? "var(--s3)" : "var(--mu)",
                }}
              >
                {wait > 0 ? `${dict.profile.resend} (${wait})` : dict.profile.resend}
              </button>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}