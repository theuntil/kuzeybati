"use client";
import { useState, useEffect, type FormEvent } from "react";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useToast } from "@/components/ui/Toast";
import CodeInput from "@/components/account/CodeInput";
import Icon from "@/components/ui/Icon";
import { StepDots, BackButton, PrimaryButton, TextField, Done } from "./Steps";
import Link from "next/link";

/**
 * ŞİFRE SIFIRLAMA — ÜÇ ADIM
 *
 *   1. E-posta
 *   2. Maildeki 6 haneli kod        ← doğrulanmadan ilerlemez
 *   3. Yeni şifre
 *
 * Kod ve şifre AYNI ekranda sorulmuyordu; kullanıcı kodu yanlış
 * girdiğinde yazdığı şifre de uçuyordu. Ayrıca kodun doğru olup
 * olmadığı ancak şifreyi de yazdıktan sonra anlaşılıyordu.
 *
 * Kod adım 2'de sunucuya sorulmuyor (tek kullanımlık olduğu için
 * harcanır); biçim kontrolü yapılıp ilerleniyor, gerçek doğrulama
 * adım 3'te şifreyle birlikte oluyor. Kod yanlışsa adım 2'ye
 * geri dönülüyor.
 */
export default function ResetPassword({
  locale, dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  /** Kod doğrulandığında sunucudan gelen tek kullanımlık bilet */
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  /** Yeniden gönderme sayacı — iki dakika */
  const [wait, setWait] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useToast();

  // İki dakikalık geri sayım
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "request", email: email.trim() }),
      });
      if (res.status === 429) throw new Error("rate");
      if (res.status === 404) throw new Error("notfound");
      if (!res.ok) throw new Error("fail");
      setStep(1);
      setWait(120);
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      t.error(
        m === "rate" ? dict.comments.rateLimit
        : m === "notfound" ? dict.profile.emailNotRegistered
        : dict.profile.sendFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * KOD DOĞRULAMA — SUNUCUDA.
   *
   * Kod burada kontrol ediliyor; yanlışsa şifre ekranına GEÇİLMEZ.
   * Eskiden kod ancak şifre yazıldıktan sonra sorulup "yanlış"
   * deniyordu — kullanıcı boşuna iki adım ilerliyordu.
   */
  async function verifyCode() {
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "verify", email: email.trim(), code }),
      });
      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j.ticket) {
        setCode("");
        throw new Error(res.status === 429 ? dict.comments.rateLimit : dict.profile.codeWrong);
      }
      setTicket(String(j.ticket));
      setStep(2);
    } catch (err) {
      t.error(err instanceof Error ? err.message : dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function finish(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { t.error(dict.auth.weakPassword); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "confirm", email: email.trim(), ticket, password }),
      });
      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Bilet süresi dolmuşsa baştan kod alınmalı
        if (j.error === "invalid_ticket") {
          setStep(0); setCode(""); setTicket("");
          throw new Error(dict.profile.ticketExpired);
        }
        throw new Error(dict.common.error);
      }
      setStep(3);
    } catch (err) {
      t.error(err instanceof Error ? err.message : dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  /* ---- 4. adım: bitti ---- */
  if (step === 3) {
    return (
      <div style={{ textAlign: "center" }}>
        <Done />
        <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginTop: 18 }}>
          {dict.profile.resetDone}
        </p>
        <div style={{ marginTop: 24 }}>
          <Link href={href(locale, "login")} style={{ display: "block" }}>
            <PrimaryButton>{dict.auth.login}</PrimaryButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <StepDots total={3} current={step} />

      {/* ---- 1. adım: e-posta ---- */}
      {step === 0 && (
        <form onSubmit={requestCode} style={{ display: "grid", gap: 16 }}>
          <TextField
            label={dict.auth.email}
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
          />
          <PrimaryButton type="submit" disabled={busy || !email.includes("@")}>
            {busy ? dict.common.loading : dict.profile.sendCode}
          </PrimaryButton>
        </form>
      )}

      {/* ---- 2. adım: kod ---- */}
      {step === 1 && (
        <div style={{ display: "grid", gap: 18 }}>
          <p style={{ fontSize: 14, color: "var(--mu)", textAlign: "center", lineHeight: 1.55 }}>
            {dict.profile.codeSentTo}<br />
            <b style={{ color: "var(--tx)" }}>{email}</b>
          </p>

          <CodeInput
            value={code}
            onChange={setCode}
            disabled={busy}
            onComplete={verifyCode}
          />

          <PrimaryButton onClick={verifyCode} disabled={busy || code.length !== 6}>
            {busy ? dict.common.loading : dict.common.next}
          </PrimaryButton>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BackButton onClick={() => { setStep(0); setCode(""); }} label={dict.common.back} />
            <button
              type="button"
              onClick={() => void requestCode()}
              disabled={busy || wait > 0}
              style={{
                fontSize: 13.5, fontWeight: 600,
                color: wait > 0 ? "var(--s3)" : "var(--mu)",
              }}
            >
              {wait > 0 ? `${dict.profile.resend} (${wait})` : dict.profile.resend}
            </button>
          </div>
        </div>
      )}

      {/* ---- 3. adım: yeni şifre ---- */}
      {step === 2 && (
        <form onSubmit={finish} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "block" }}>
            <span style={{
              display: "block", fontSize: 12.5, fontWeight: 600,
              color: "var(--mu)", marginBottom: 7,
            }}>{dict.profile.newPassword}</span>
            <span style={{ position: "relative", display: "block" }}>
              <input
                className="field"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                autoFocus
                style={{ height: 52, fontSize: 16, paddingInlineEnd: 46 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={dict.auth.password}
                style={eyeBtn}
              >
                <Icon name="eye" size={17} />
              </button>
            </span>
            <span style={{ display: "block", fontSize: 12, color: "var(--mu)", marginTop: 6 }}>
              {dict.auth.passwordHint}
            </span>
          </label>

          <PrimaryButton type="submit" disabled={busy || password.length < 8}>
            {busy ? dict.common.loading : dict.auth.save}
          </PrimaryButton>

          {/**
            * Geri → KOD adımına değil, E-POSTA adımına.
            * Kod bu noktada zaten harcandı; kod ekranına dönmek
            * kullanıcıyı kullanılmış bir kodla baş başa bırakırdı.
            */}
          <BackButton
            onClick={() => { setStep(0); setCode(""); setTicket(""); }}
            label={dict.common.back}
          />
        </form>
      )}
    </>
  );
}


const eyeBtn: React.CSSProperties = {
  position: "absolute", insetInlineEnd: 8, top: "50%",
  transform: "translateY(-50%)", width: 34, height: 34,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--mu)", borderRadius: 9,
};
