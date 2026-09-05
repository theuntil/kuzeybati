"use client";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/**
 * TOAST BİLDİRİMLERİ
 *
 * Tek bir sistem: hata, başarı ve bilgi mesajları hep aynı yerden
 * çıkar. Bazı yerlerde kutu içinde metin, bazı yerlerde alert()
 * kullanmak tutarsızdı.
 *
 * Alttan yukarı kayarak gelir — mobilde başparmağın yakınında,
 * masaüstünde de göz hizasını bozmuyor. `role="status"` ile ekran
 * okuyucular da duyuruyor.
 */
type Kind = "success" | "error" | "info";
interface Item { id: number; kind: Kind; text: string }

interface Ctx {
  toast: (text: string, kind?: Kind) => void;
  success: (t: string) => void;
  error: (t: string) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const c = useContext(ToastCtx);
  // Sağlayıcı yoksa sessizce yut: bileşen tek başına da çalışsın
  return c ?? { toast: () => {}, success: () => {}, error: () => {} };
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [mounted, setMounted] = useState(false);
  const seq = useRef(0);

  useEffect(() => setMounted(true), []);

  const toast = useCallback((text: string, kind: Kind = "info") => {
    const id = ++seq.current;
    setItems((p) => [...p.slice(-2), { id, kind, text }]);
    // Hata mesajı daha uzun kalsın: okunması gerekiyor
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)),
               kind === "error" ? 6000 : 3800);
  }, []);

  const value: Ctx = {
    toast,
    success: (t) => toast(t, "success"),
    error: (t) => toast(t, "error"),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {mounted && createPortal(
        <div
          style={{
            position: "fixed", insetInline: 0, bottom: 0, zIndex: 400,
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8, padding: "0 16px calc(16px + env(safe-area-inset-bottom))",
            pointerEvents: "none",
          }}
        >
          {items.map((t) => (
            <div
              key={t.id}
              role="status"
              className="kb-toast"
              style={{
                pointerEvents: "auto",
                display: "flex", alignItems: "center", gap: 10,
                maxWidth: 420, width: "100%",
                padding: "13px 16px", borderRadius: 14,
                background: "var(--s1)",
                /*
                 * ⚠ RENKLİ KENARLIK KALDIRILDI.
                 * Yeşil/kırmızı çerçeve toast'ı ağırlaştırıyor ve
                 * uyarı kutusu gibi gösteriyordu. Durum bilgisini
                 * zaten soldaki renkli ikon veriyor; kenarlık
                 * nötre indirildi.
                 */
                border: "1px solid var(--bd)",
                boxShadow: "0 12px 40px rgba(0,0,0,.45)",
                fontSize: 14, lineHeight: 1.45, fontWeight: 500,
              }}
            >
              <span style={{
                flexShrink: 0, display: "flex",
                color: t.kind === "error" ? "#E5484D"
                     : t.kind === "success" ? "#30D158" : "var(--mu)",
              }}>
                <Icon name={t.kind === "success" ? "check" : "warn"} size={17} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{t.text}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}

      <style>{`
        .kb-toast { animation: kbToastIn .28s cubic-bezier(.32,.72,0,1); }
        @keyframes kbToastIn {
          from { opacity: 0; transform: translateY(14px) scale(.97) }
          to   { opacity: 1; transform: none }
        }
        @media (prefers-reduced-motion: reduce) {
          .kb-toast { animation: none }
        }
      `}</style>
    </ToastCtx.Provider>
  );
}
