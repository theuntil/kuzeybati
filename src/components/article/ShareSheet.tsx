"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * PAYLAŞ PENCERESİ
 *
 * Masaüstünde ORTADA açılır, mobilde ALTTAN kayar — prototipteki
 * davranışın aynısı. Tek bileşen; konum CSS medya sorgusuyla
 * değişiyor, iki ayrı kod yolu yok.
 *
 * Marka SVG'leri elle yazıldı: WhatsApp, X ve Telegram'ın resmî
 * logoları HugeIcons'ta yok ve marka logosunu yaklaşık bir ikonla
 * değiştirmek yanlış olur.
 */
const BRANDS = {
  whatsapp: (
    <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm5.6 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4.3-.3.6-.3.8-.3h.6c.2 0 .5 0 .7.6.3.6.9 2.1 1 2.3.1.2.1.4 0 .6-.2.3-.3.5-.5.7-.2.2-.4.4-.2.8.3.5 1 1.4 1.9 2.1 1 .9 1.8 1.2 2.1 1.3.3.1.5.1.7-.1.2-.3.9-1 1.1-1.4.2-.3.5-.3.8-.2.3.1 1.8.9 2.1 1 .3.2.5.2.6.4.1.2.1.7-.1 1.3Z" />
  ),
  x: (
    <path d="M18.9 2h3.3l-7.3 8.3L23.6 22h-6.8l-5.3-6.9L5.2 22H1.9l7.8-8.9L1 2h6.9l4.8 6.3L18.9 2Zm-2.3 18h1.8L7.5 3.9H5.6L16.6 20Z" />
  ),
  telegram: (
    <path d="M21.5 3.5 2.6 11c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.7 5.5c.3.9 1.4 1.1 2 .4l2.6-2.9 4.8 3.5c.8.6 1.9.1 2.1-.9l3-14.9c.2-1-.9-1.7-1.9-1.5ZM8.6 14.8l9-6.7c.3-.2.6.1.3.4l-7.3 7-1.1 3.7-.9-4.4Z" />
  ),
  facebook: (
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
  ),
} as const;

type Item = {
  key: string;
  label: string;
  bg: string;
  fg: string;
  brand?: keyof typeof BRANDS;
  icon?: "mail" | "copy";
  url?: (u: string, t: string) => string;
};

export default function ShareSheet({
  open, onClose, url, title, dict, onCopied,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  dict: Dictionary;
  onCopied: () => void;
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

  const items: Item[] = [
    {
      key: "wa", label: "WhatsApp", bg: "#25D366", fg: "#fff", brand: "whatsapp",
      url: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
    },
    {
      key: "x", label: "X", bg: "var(--s2)", fg: "var(--tx)", brand: "x",
      url: (u, t) => `https://x.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    },
    {
      key: "tg", label: "Telegram", bg: "#29A9EA", fg: "#fff", brand: "telegram",
      url: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    },
    {
      key: "fb", label: "Facebook", bg: "#1877F2", fg: "#fff", brand: "facebook",
      url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    },
    {
      key: "mail", label: "E-posta", bg: "var(--s2)", fg: "var(--tx)", icon: "mail",
      url: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}`,
    },
    { key: "copy", label: dict.article.copyLink, bg: "var(--s2)", fg: "var(--tx)", icon: "copy" },
  ];

  async function pick(it: Item) {
    if (it.key === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        onCopied();
      } catch {
        /* pano izni yoksa sessiz geç */
      }
      onClose();
      return;
    }
    window.open(it.url!(url, title), "_blank", "noopener,noreferrer");
    onClose();
  }

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, animation: "shFade .2s ease" }}
      />
      <div
        className="share-panel"
        role="dialog"
        aria-modal="true"
        aria-label={dict.article.share}
        style={{
          position: "fixed", zIndex: 301,
          background: "var(--s1)", border: "1px solid var(--bd)",
          boxShadow: "0 -20px 60px rgba(0,0,0,.5)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 4px", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.02em" }}>
            {dict.article.share}
          </div>
          <button
            onClick={onClose}
            aria-label={dict.common.close}
            style={{
              marginInlineStart: "auto", width: 30, height: 30, borderRadius: 999,
              background: "var(--s2)", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon name="close" size={14} strokeWidth={1.8} />
          </button>
        </div>

        <div
          data-hide-sb
          style={{ display: "flex", gap: 10, padding: "12px 20px 22px", overflowX: "auto", alignItems: "center" }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => pick(it)}
              style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 8, minWidth: 64,
              }}
            >
              <span
                style={{
                  width: 52, height: 52, borderRadius: 999, background: it.bg, color: it.fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "transform .15s ease",
                }}
              >
                {it.brand ? (
                  <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    {BRANDS[it.brand]}
                  </svg>
                ) : it.icon === "mail" ? (
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="M4 7l8 6 8-6" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="8" y="8" width="12" height="12" rx="3" />
                    <path d="M5 16H4a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h9a1 1 0 0 1 1 1v1" />
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--mu)", whiteSpace: "nowrap" }}>
                {it.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes shUp   { from { transform: translate(-50%, 101%) } to { transform: translate(-50%, 0) } }
        @keyframes shPop  { from { transform: translate(-50%, -46%); opacity: 0 } to { transform: translate(-50%, -50%); opacity: 1 } }

        /* Mobil: alttan kayan tabaka */
        .share-panel {
          left: 50%; bottom: 0; width: 100%; max-width: 520px;
          transform: translateX(-50%);
          border-radius: 22px 22px 0 0;
          padding-bottom: env(safe-area-inset-bottom);
          animation: shUp .28s cubic-bezier(.32,.72,0,1);
        }

        /* Masaüstü: ortada açılan pencere */
        @media (min-width: 861px) {
          .share-panel {
            left: 50%; top: 50%; bottom: auto;
            width: 440px; max-width: 92vw;
            transform: translate(-50%, -50%);
            border-radius: 20px;
            box-shadow: 0 30px 80px rgba(0,0,0,.55);
            animation: shPop .2s cubic-bezier(.32,.72,0,1);
          }
        }

        .share-panel button > span:first-child:hover { transform: scale(1.06); }
      `}</style>
    </>,
    document.body,
  );
}
