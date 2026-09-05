"use client";
import { useEffect, useRef } from "react";
import { HIZMET_GORUNUM, HIZMET_SIRA } from "./hizmetler";
import Icon, { type IconName } from "@/components/ui/Icon";
import { serviceHref, type Locale, type ServiceKey } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   HİZMETLER — MASAÜSTÜ AÇILIR KUTUSU

   ┌─ NEDEN AYRI BİLEŞEN ⚠️ ───────────────────────────────────┐
   │ Masaüstünde de mobildeki gibi ALTTAN kayan bir panel      │
   │ açılıyordu. Fare kullanıcısı düğmeye tıklıyor, ekranın    │
   │ öbür ucunda bir şey beliriyordu; bağlantı kopuk           │
   │ hissettiriyordu.                                            │
   │                                                              │
   │ Bu bileşen düğmenin HEMEN ALTINA açılıyor. Mobildeki      │
   │ `ServicesSheet` olduğu gibi duruyor — dar ekranda alttan  │
   │ açılan panel doğru davranış.                                │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/*
 * ⚠ LİSTE ARTIK ELLE YAZILMIYOR.
 * `hizmetler.ts` tek kaynak; yeni hizmet eklenince burada
 * unutulup menüden kaybolamıyor (deprem tam da bu yüzden
 * görünmüyordu).
 */
const SERVICES = HIZMET_SIRA.map((key) => ({ key, ...HIZMET_GORUNUM[key] }));

export default function ServicesDropdown({
  open, onClose, locale, dict, acikHizmetler,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  dict: Dictionary;
  /*
   * Panelden açık olan hizmetler. Verilmezse hepsi gösteriliyor
   * — bileşen ayarı bilmek zorunda kalmasın diye.
   */
  acikHizmetler?: Record<string, boolean>;
}) {
  const kutu = useRef<HTMLDivElement>(null);

  /*
   * Dışarı tıklama ve Esc kapatıyor.
   *
   * ⚠ `mousedown` KULLANILIYOR, `click` DEĞİL.
   * `click` ile dinlerken, düğmeye basıp menüyü açan aynı olay
   * kabararak buraya ulaşıyor ve menü açılır açılmaz kapanıyordu.
   */
  useEffect(() => {
    if (!open) return;

    function disari(e: MouseEvent) {
      const el = kutu.current;
      if (!el) return;
      const hedef = e.target as Node;
      /* Açma düğmesinin kendisi hariç */
      if (el.contains(hedef)) return;
      if ((hedef as HTMLElement).closest?.("[data-hizmet-dugme]")) return;
      onClose();
    }

    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", disari);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", disari);
      window.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={kutu}
      role="menu"
      aria-label={dict.nav.services}
      style={{
        /*
         * ⚠ Konum, düğmeyi saran `position: relative` kabına
         * göre veriliyor. `insetInlineEnd: 0` ile sağa
         * hizalanıyor; RTL dillerde de doğru tarafta kalıyor.
         */
        position: "absolute",
        top: "calc(100% + 10px)",
        insetInlineEnd: 0,
        zIndex: 80,
        width: 330,
        padding: 12,
        borderRadius: 18,
        background: "var(--s1)",
        border: "1px solid var(--bd)",
        boxShadow: "0 18px 50px rgba(0,0,0,.32)",
        animation: "kb-dropdown .16s cubic-bezier(.2,.9,.25,1.05)",
      }}
    >
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
      }}>
        {SERVICES.filter((s) => acikHizmetler?.[s.key] !== false).map((s) => (
          <Link
            key={s.key}
            href={serviceHref(locale, s.key)}
            onClick={onClose}
            role="menuitem"
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 9,
              padding: "14px 6px", borderRadius: 13,
              background: "var(--s2)", color: "var(--tx)",
              textDecoration: "none",
              transition: "background .14s ease",
            }}
          >
            <span style={{
              width: 40, height: 40, borderRadius: 12,
              background: s.tint, color: s.color,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name={s.icon} size={20} />
            </span>
            <span style={{
              fontSize: 12.5, fontWeight: 700, textAlign: "center",
              lineHeight: 1.25,
            }}>
              {dict.srv[s.key]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
