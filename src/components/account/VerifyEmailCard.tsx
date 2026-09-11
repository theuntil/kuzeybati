"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon from "@/components/ui/Icon";
import CodeInput from "./CodeInput";
import EmailChange from "./EmailChange";
import Sheet from "@/components/ui/Sheet";
import { PrimaryButton } from "@/components/auth/Steps";

/**
 * E-POSTA DOĞRULAMA
 *
 * Kod gönder → maildeki 6 haneyi gir → doğrulandı.
 * Doğrulama ZORUNLU DEĞİL; kullanıcı hiç yapmadan da her şeyi
 * kullanabilir.
 */
export default function VerifyEmailCard({
  email, verified, dict, onVerified,
}: {
  email: string | null;
  verified: boolean;
  dict: Dictionary;
  onVerified?: () => void;
}) {
  const [address, setAddress] = useState(email);
  /** Doğrulama da ayrı tabakada — satır içi form sıkışık duruyordu */
  const [sheet, setSheet] = useState(false);
  const [state, setState] = useState<"idle" | "sent" | "done">(verified ? "done" : "idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** Yeniden gönderme sayacı — sunucudaki iki dakika kuralıyla aynı */
  const [wait, setWait] = useState(0);

  // İki dakikalık geri sayım — sunucudaki kuralla aynı
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/dogrulama", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        // Sebebi kullanıcı diliyle göster; ham hata kodu değil
        // Ham hata kodunu da göster: sebebini bilmeden çözülemez
        const known: Record<string, string> = {
          mail_disabled: dict.profile.mailDisabled,
          unreachable: dict.profile.mailUnreachable,
          timeout: dict.profile.mailTimeout,
          mail_not_configured: dict.profile.mailNotConfigured,
          send_failed: dict.profile.sendFailed,
        };
        const text = known[j.error as string] ?? dict.common.error;
        throw new Error(j.detail ? `${text} (${j.detail})` : text);
      }
      setMasked(j.email ?? null);
      setState("sent");
      setCode("");
      setWait(120);
    } catch (e) {
      setErr(e instanceof Error ? e.message : dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function verify(c: string) {
    setBusy(true); setErr(null);
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("verify_email_code", { p_code: c });
    setBusy(false);

    if (error) { setErr(error.message); setCode(""); return; }
    if (data !== true) { setErr(dict.profile.codeWrong); setCode(""); return; }

    setState("done");
    onVerified?.();
  }

  if (state === "done") {
    return (
      <Box>
        <Head dict={dict} verified />
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          flexWrap: "wrap", marginTop: 4,
        }}>
          <span style={{ fontSize: 14.5, overflowWrap: "anywhere", flex: 1, minWidth: 0 }}>
            {address}
          </span>
          <EmailChange current={address} dict={dict} onChanged={setAddress} />
        </div>
      </Box>
    );
  }

  return (
    <Box>
      <Head dict={dict} verified={false} />
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        flexWrap: "wrap", marginBottom: 12,
      }}>
        <span style={{ fontSize: 14.5, overflowWrap: "anywhere", flex: 1, minWidth: 0 }}>
          {address}
        </span>
        <EmailChange current={address} dict={dict} onChanged={setAddress} />
      </div>

      <p style={{ fontSize: 12.5, color: "var(--mu)", marginBottom: 14, lineHeight: 1.55 }}>
        {dict.profile.verifyOptional}
      </p>
      <button
        onClick={() => { setSheet(true); if (state === "idle") void send(); }}
        style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
          height: 42, padding: "0 18px", borderRadius: 14,
          background: "var(--tx)", color: "var(--bg)",
          fontSize: 13.5, fontWeight: 700,
        }}
      >
        {dict.profile.verifyNow}
      </button>

      {/* Doğrulama ayrı tabakada: mobilde alttan, masaüstünde ortada */}
      <Sheet open={sheet} onClose={() => setSheet(false)} title={dict.profile.verifyEmail}>
        <div style={{ display: "grid", gap: 20 }}>
          <p style={{ fontSize: 13.5, color: "var(--mu)", textAlign: "center", lineHeight: 1.55, margin: 0 }}>
            {dict.profile.codeSentTo}<br />
            <b style={{ color: "var(--tx)" }}>{masked ?? address}</b>
          </p>

          <CodeInput value={code} onChange={setCode} disabled={busy} onComplete={verify} />

          <PrimaryButton onClick={() => verify(code)} disabled={busy || code.length !== 6}>
            {busy ? dict.common.loading : dict.auth.save}
          </PrimaryButton>

          <button
            onClick={send}
            disabled={busy || wait > 0}
            style={{
              fontSize: 13, fontWeight: 600,
              color: wait > 0 ? "var(--s3)" : "var(--mu)",
            }}
          >
            {wait > 0 ? `${dict.profile.resend} (${wait})` : dict.profile.resend}
          </button>

          {err && (
            <p role="alert" style={{
              margin: 0, padding: "11px 14px", borderRadius: 12,
              background: "rgba(229,72,77,.12)", color: "#E5484D", fontSize: 13,
            }}>{err}</p>
          )}
        </div>
      </Sheet>
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <section style={{
      background: "var(--s1)", border: "1px solid var(--bd)",
      borderRadius: 16, padding: 18,
    }}>{children}</section>
  );
}

function Head({ dict, verified }: { dict: Dictionary; verified: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800 }}>{dict.auth.email}</h2>
      <span style={{
        display: "flex", alignItems: "center", gap: 5,
        fontSize: 11.5, fontWeight: 700,
        color: verified ? "#30D158" : "#FF9F0A",
        background: verified ? "rgba(48,209,88,.12)" : "rgba(255,159,10,.12)",
        padding: "3px 9px", borderRadius: 999,
      }}>
        <Icon name={verified ? "verified" : "warn"} size={12} />
        {verified ? dict.profile.verified : dict.profile.notVerified}
      </span>
    </div>
  );
}
