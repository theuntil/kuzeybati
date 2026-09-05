"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/**
 * TABAKA (SHEET)
 *
 * Masaüstünde ortada pencere, mobilde alttan kayan tabaka.
 * Kapanırken aşağı iner.
 *
 * Sitedeki tüm açılır ekranlar bunu kullanır: e-posta
 * doğrulama, e-posta değiştirme, profil fotoğrafı, kapak.
 * Tek yerde tanımlı olduğu için hepsi aynı davranıyor ve
 * tasarım değişikliği tek dosyadan yapılıyor.
 *
 * İç boşluk bilinçli olarak GENİŞ: dar tabakalarda alanlar
 * kenara yapışık duruyor ve sıkışık görünüyordu.
 */
export default function Sheet({
  open, onClose, title, children, footer, maxWidth = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setClosing(true);
    setTimeout(onClose, 220);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,.5)",
          animation: `${closing ? "kbSheetFadeOut" : "kbSheetFadeIn"} .22s ease forwards`,
        }}
      />

      <div
        className={`kb-sheet ${closing ? "kb-sheet-out" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ ["--sheet-w" as string]: `${maxWidth}px` }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
          <span className="kb-sheet-grab" />
        </div>

        <header style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 26px 0",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em" }}>
            {title}
          </h2>
          <button
            onClick={close}
            aria-label="Kapat"
            style={{
              marginInlineStart: "auto", width: 34, height: 34, borderRadius: 999,
              background: "var(--s2)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon name="close" size={15} strokeWidth={1.8} />
          </button>
        </header>

        <div className="kb-sheet-body">{children}</div>

        {footer && <div className="kb-sheet-foot">{footer}</div>}
      </div>

      <style>{`
        @keyframes kbSheetFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kbSheetFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes kbSheetUp   { from { transform: translate(-50%, 100%) } to { transform: translate(-50%, 0) } }
        @keyframes kbSheetDown { from { transform: translate(-50%, 0) } to { transform: translate(-50%, 100%) } }
        @keyframes kbSheetPop  { from { transform: translate(-50%,-50%) scale(.97); opacity: 0 }
                                 to   { transform: translate(-50%,-50%) scale(1); opacity: 1 } }

        .kb-sheet {
          position: fixed; z-index: 301;
          left: 50%; bottom: 0; width: 100%;
          transform: translateX(-50%);
          background: var(--s1); border: 1px solid var(--bd);
          border-radius: 24px 24px 0 0;
          max-height: 88dvh; display: flex; flex-direction: column;
          animation: kbSheetUp .3s cubic-bezier(.32,.72,0,1);
        }
        .kb-sheet-out { animation: kbSheetDown .22s cubic-bezier(.32,.72,0,1) forwards; }
        .kb-sheet-grab { width: 38px; height: 5px; border-radius: 99px; background: var(--s3); }

        /* Geniş iç boşluk: alanlar kenara yapışmasın */
        .kb-sheet-body {
          padding: 22px 26px 26px;
          overflow-y: auto; flex: 1; min-height: 0;
          padding-bottom: calc(26px + env(safe-area-inset-bottom));
        }
        .kb-sheet-foot {
          padding: 0 26px calc(26px + env(safe-area-inset-bottom));
          flex-shrink: 0;
        }

        @media (min-width: 861px) {
          .kb-sheet {
            top: 50%; bottom: auto;
            width: var(--sheet-w); max-width: 92vw;
            transform: translate(-50%, -50%);
            border-radius: 20px; max-height: 84dvh;
            animation: kbSheetPop .2s cubic-bezier(.32,.72,0,1);
          }
          .kb-sheet-out { animation: kbSheetFadeOut .16s ease forwards; }
          .kb-sheet-grab { display: none; }
          .kb-sheet-body { padding: 22px 30px 30px; }
          .kb-sheet-foot { padding: 0 30px 30px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .kb-sheet, .kb-sheet-out { animation: none }
        }
      `}</style>
    </>,
    document.body,
  );
}
