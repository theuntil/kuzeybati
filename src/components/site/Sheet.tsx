"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";

/**
 * Alttan açılan panel.
 *
 * PORTAL ŞART: sayfa gövdesi `overflow-x: clip` olan bir kapsayıcı
 * içinde. `overflow: clip` position:fixed alt elemanları da kırpar —
 * panel açılıyor ama görünmüyordu ("bir şeyin altında kalıyor").
 * Portal ile doğrudan <body> altına taşınıyor, kırpma etkilemiyor.
 */
export default function Sheet({
  open, onClose, title, children, height,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Panel yüksekliği; hizmetler paneli için %56 (prototipteki değer) */
  height?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
          zIndex: 210, animation: "sheetFade .22s ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed", left: "50%", bottom: 0,
          width: "100%", maxWidth: 520,
          height: height ?? "auto", maxHeight: "78dvh",
          transform: "translateX(-50%)",
          background: "var(--s1)", borderTop: "1px solid var(--bd)",
          borderRadius: "22px 22px 0 0",
          boxShadow: "0 -20px 60px rgba(0,0,0,.5)",
          zIndex: 211, display: "flex", flexDirection: "column",
          animation: "sheetUp .28s cubic-bezier(.32,.72,0,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px", flexShrink: 0 }}>
          <span style={{ width: 38, height: 5, borderRadius: 99, background: "var(--s3)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            style={{
              marginInlineStart: "auto", width: 34, height: 34, borderRadius: 999,
              background: "var(--s2)", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon name="close" size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div
          data-hide-sb
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 24px" }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes sheetUp { from { transform: translate(-50%, 101%) } to { transform: translate(-50%, 0) } }
        @keyframes sheetFade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>,
    document.body,
  );
}
