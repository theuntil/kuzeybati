"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export interface CityOption { slug: string; name: string; plate: number | null }

/**
 * GLOBAL ŞEHİR SEÇİCİ
 *
 * TEK BİLEŞEN, HER YERDE. Kayıt formu, hesap ayarları, hizmet
 * sayfaları ve header aynı bileşeni kullanır. Tasarımı
 * değiştirmek istediğinde yalnızca burayı değiştirirsin.
 *
 * Cihazın kendi `<select>` menüsü kullanılmıyordu çünkü her
 * platformda farklı görünüyor ve 81 il arasında arama yapılamıyor.
 *
 * Masaüstünde ORTADA pencere, mobilde ALTTAN kayan tabaka
 * (ekranın %65'i, kapanırken aşağı iner).
 */
export function CityPickerSheet({
  open, onClose, cities, current, onPick, title, searchPlaceholder, emptyText,
}: {
  open: boolean;
  onClose: () => void;
  cities: CityOption[];
  current: string | null;
  onPick: (slug: string) => void;
  title: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQ("");
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

  /** Kapanış animasyonu bitmeden kaldırma */
  function close() {
    setClosing(true);
    setTimeout(onClose, 220);
  }

  const list = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr");
    if (!term) return cities;
    return cities.filter(
      (c) =>
        c.name.toLocaleLowerCase("tr").includes(term) ||
        String(c.plate ?? "").startsWith(term),
    );
  }, [q, cities]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,.5)",
          animation: `${closing ? "kbFadeOut" : "kbFadeIn"} .22s ease forwards`,
        }}
      />

      <div
        className={`kb-citypick ${closing ? "kb-citypick-out" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px", flexShrink: 0 }}>
          <span className="kb-grab" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px 0", flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</h2>
          <button
            onClick={close}
            aria-label="Kapat"
            style={{
              marginInlineStart: "auto", width: 32, height: 32, borderRadius: 999,
              background: "var(--s2)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon name="close" size={15} strokeWidth={1.8} />
          </button>
        </div>

        <div style={{ padding: "12px 20px", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", insetInlineStart: 12, top: "50%",
              transform: "translateY(-50%)", color: "var(--mu)", display: "flex",
            }}>
              <Icon name="searchAlt" size={16} />
            </span>
            <input
              className="field"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              style={{ paddingInlineStart: 38, height: 46, fontSize: 16 }}
            />
          </div>
        </div>

        <div data-hide-sb style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 12px 16px" }}>
          {list.length === 0 ? (
            <p style={{ padding: 20, color: "var(--mu)", fontSize: 14, textAlign: "center" }}>
              {emptyText}
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {list.map((c) => {
                const on = c.slug === current;
                return (
                  <li key={c.slug}>
                    <button
                      onClick={() => { onPick(c.slug); close(); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "12px 14px", borderRadius: 12,
                        background: on ? "var(--s3)" : "transparent",
                        fontSize: 15, fontWeight: on ? 700 : 500, color: "var(--tx)",
                      }}
                    >
                      {c.plate !== null && (
                        <span style={{
                          minWidth: 30, textAlign: "center", fontSize: 11.5,
                          fontWeight: 800, color: "var(--mu)",
                          background: "var(--s2)", borderRadius: 7, padding: "3px 0",
                        }}>
                          {String(c.plate).padStart(2, "0")}
                        </span>
                      )}
                      <span style={{ flex: 1, textAlign: "start" }}>{c.name}</span>
                      {on && <Icon name="check" size={16} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <style>{`
        @keyframes kbFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kbFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes kbUp   { from { transform: translate(-50%, 100%) } to { transform: translate(-50%, 0) } }
        @keyframes kbDown { from { transform: translate(-50%, 0) } to { transform: translate(-50%, 100%) } }
        @keyframes kbPop  { from { transform: translate(-50%, -50%) scale(.97); opacity: 0 }
                            to   { transform: translate(-50%, -50%) scale(1);   opacity: 1 } }

        .kb-citypick {
          position: fixed; z-index: 301;
          background: var(--s1); border: 1px solid var(--bd);
          display: flex; flex-direction: column; overflow: hidden;
          left: 50%; bottom: 0; width: 100%; height: 65dvh;
          transform: translateX(-50%);
          border-radius: 22px 22px 0 0;
          padding-bottom: env(safe-area-inset-bottom);
          animation: kbUp .28s cubic-bezier(.32,.72,0,1);
        }
        .kb-citypick-out { animation: kbDown .22s cubic-bezier(.32,.72,0,1) forwards; }
        .kb-grab { width: 38px; height: 5px; border-radius: 99px; background: var(--s3); }

        @media (min-width: 861px) {
          .kb-citypick {
            left: 50%; top: 50%; bottom: auto;
            width: 440px; max-width: 92vw; height: min(540px, 76dvh);
            transform: translate(-50%, -50%);
            border-radius: 18px;
            animation: kbPop .2s cubic-bezier(.32,.72,0,1);
          }
          .kb-citypick-out { animation: kbFadeOut .16s ease forwards; }
          .kb-grab { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .kb-citypick, .kb-citypick-out { animation: none }
        }
      `}</style>
    </>,
    document.body,
  );
}

/**
 * ŞEHİR ALANI
 *
 * Form içinde kullanılan hazır alan: etiket + seçili şehri
 * gösteren düğme + seçici. Her formda ayrı ayrı state yönetmek
 * yerine bu kullanılır.
 */
export default function CityField({
  label, value, cities, onChange, hint,
  title = "Şehir seç", searchPlaceholder = "Şehir ara", emptyText = "Sonuç yok",
}: {
  label: string;
  value: string | null;
  cities: CityOption[];
  onChange: (slug: string) => void;
  hint?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = cities.find((c) => c.slug === value);

  return (
    <div>
      <span style={{
        display: "block", fontSize: 12.5, fontWeight: 600,
        color: "var(--mu)", marginBottom: 7,
      }}>{label}</span>

      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          height: 52, padding: "0 14px", borderRadius: 12,
          background: "var(--s1)", border: "1px solid var(--bd)",
          color: "var(--tx)", fontSize: 16, fontWeight: 500,
          textAlign: "start",
        }}
      >
        <Icon name="pin" size={16} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.name ?? title}
        </span>
        <Icon name="chevronRight" size={15} />
      </button>

      {hint && (
        <span style={{ display: "block", fontSize: 12, color: "var(--mu)", marginTop: 6 }}>
          {hint}
        </span>
      )}

      <CityPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        cities={cities}
        current={value}
        onPick={onChange}
        title={title}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
      />
    </div>
  );
}
