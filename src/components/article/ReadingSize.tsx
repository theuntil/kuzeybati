"use client";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * YAZI BOYUTU AYARI
 *
 * Dört kademe. Seçim `localStorage`'a yazılır ve <html> üzerinde
 * `data-read` özniteliği olarak taşınır; CSS `--read-scale`
 * değişkenini oradan okur. Böylece TÜM haberlerde aynı boyut
 * geçerli olur — okur her sayfada yeniden ayarlamak zorunda kalmaz.
 *
 * Neden CSS değişkeni: yazı boyutunu React state'iyle taşımak
 * her haber sayfasında sıfırlanırdı ve ilk boyamada zıplama
 * olurdu. Öznitelik <html>'de olduğu için tema gibi davranır ve
 * ThemeScript ile ilk boyamadan ÖNCE uygulanır.
 */
const STEPS = ["s", "m", "l", "xl"] as const;
type Step = (typeof STEPS)[number];

export default function ReadingSize({ dict }: { dict: Dictionary }) {
  const [step, setStep] = useState<Step>("m");

  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-read") as Step | null;
    if (cur && STEPS.includes(cur)) setStep(cur);
  }, []);

  function apply(next: Step) {
    setStep(next);
    document.documentElement.setAttribute("data-read", next);
    try {
      localStorage.setItem("kb-read", next);
    } catch {
      /* gizli sekmede localStorage kapalı olabilir; boyut yine değişir */
    }
  }

  const idx = STEPS.indexOf(step);
  const btn = (on: boolean): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--s2)", color: on ? "var(--tx)" : "var(--mu)",
    flexShrink: 0,
  });

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6,
        marginInlineStart: "auto", flexShrink: 0,
      }}
      role="group"
      aria-label={dict.article.textSize}
    >
      <button
        onClick={() => apply(STEPS[Math.max(0, idx - 1)])}
        disabled={idx === 0}
        aria-label={dict.article.textSmaller}
        title={dict.article.textSmaller}
        style={{ ...btn(idx > 0), opacity: idx === 0 ? 0.45 : 1 }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>A−</span>
      </button>

      <button
        onClick={() => apply(STEPS[Math.min(STEPS.length - 1, idx + 1)])}
        disabled={idx === STEPS.length - 1}
        aria-label={dict.article.textBigger}
        title={dict.article.textBigger}
        style={{ ...btn(idx < STEPS.length - 1), opacity: idx === STEPS.length - 1 ? 0.45 : 1 }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>A+</span>
      </button>
    </div>
  );
}
