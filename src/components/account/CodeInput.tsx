"use client";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

/**
 * 6 HANELİ KOD GİRİŞİ
 *
 * Altı ayrı kutu: tek kutuda 6 hane girmek telefonda hataya açık,
 * kaçıncı hanede olduğun görünmüyor.
 *
 * Yapıştırma desteklenir — kullanıcı maildeki kodu kopyalayıp
 * ilk kutuya yapıştırınca altısı da dolar. Bu olmadan kullanıcı
 * altı kez yapıştırmak zorunda kalırdı.
 *
 * `inputMode="numeric"` telefonda rakam klavyesi açar,
 * `autocomplete="one-time-code"` iOS'ta gelen SMS/mail kodunu
 * klavye üstünde önerir.
 */
export default function CodeInput({
  value, onChange, disabled, onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onComplete?: (code: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focus, setFocus] = useState(-1);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function set(i: number, ch: string) {
    const clean = ch.replace(/\D/g, "").slice(-1);
    const next = value.padEnd(6, " ").split("");
    next[i] = clean || " ";
    const joined = next.join("").trimEnd();
    onChange(joined);

    if (clean && i < 5) refs.current[i + 1]?.focus();
    const full = joined.replace(/\s/g, "");
    if (full.length === 6) onComplete?.(full);
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i]?.trim() && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) onComplete?.(text);
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d.trim()}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={() => setFocus(i)}
          onBlur={() => setFocus(-1)}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`${i + 1}. hane`}
          style={{
            width: 48, height: 58, borderRadius: 13,
            border: `1.5px solid ${focus === i ? "var(--ac)" : "var(--bd)"}`,
            background: "var(--s1)", color: "var(--tx)",
            fontSize: 24, fontWeight: 800, textAlign: "center",
            fontVariantNumeric: "tabular-nums",
            transition: "border-color .15s ease",
            opacity: disabled ? 0.6 : 1,
          }}
        />
      ))}
    </div>
  );
}
