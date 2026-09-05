"use client";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { CityPickerSheet, type CityOption } from "@/components/ui/CityPicker";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * SEÇİLİ ŞEHİR — SİTE GENELİ
 *
 * Hava durumu, namaz vakitleri ve nöbetçi eczane tek bir seçime
 * bağlıdır. Seçim iki yere yazılır:
 *
 *   • çerez        → sunucu bileşenleri okuyabilsin (hizmet sayfaları)
 *   • localStorage → çerez temizlenirse seçim kaybolmasın
 *
 * Seçim değişince sayfa yenilenir; sunucu tarafı yeni şehre göre
 * render eder. İstemcide durum tutup her bileşeni tek tek
 * güncellemek yerine bu daha basit ve tutarlı.
 */
interface Ctx {
  slug: string;
  name: string;
  open: () => void;
}

const CityCtx = createContext<Ctx | null>(null);

export function useCity(): Ctx {
  const c = useContext(CityCtx);
  if (!c) throw new Error("useCity, CityProvider içinde kullanılmalı");
  return c;
}

const COOKIE = "kb-city";

export default function CityProvider({
  cities, initial, dict, children,
}: {
  cities: CityOption[];
  initial: string;
  dict: Dictionary;
  children: ReactNode;
}) {
  const [slug, setSlug] = useState(initial);
  const [sheet, setSheet] = useState(false);

  // Çerez yokken localStorage'daki seçimi geri yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COOKIE);
      if (saved && saved !== initial && cities.some((c) => c.slug === saved)) {
        writeCookie(saved);
        window.location.reload();
      }
    } catch {
      /* gizli sekmede localStorage kapalı; çerez yeter */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function writeCookie(v: string) {
    // 1 yıl, tüm site, SameSite=Lax — kişisel veri değil, tercih.
    document.cookie = `${COOKIE}=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`;
  }

  const pick = useCallback((next: string) => {
    if (next === slug) return;
    setSlug(next);
    writeCookie(next);
    try { localStorage.setItem(COOKIE, next); } catch { /* yok sayılır */ }
    // Sunucu tarafı yeni şehre göre yeniden render etsin
    window.location.reload();
  }, [slug]);

  const value = useMemo<Ctx>(() => ({
    slug,
    name: cities.find((c) => c.slug === slug)?.name ?? slug,
    open: () => setSheet(true),
  }), [slug, cities]);

  return (
    <CityCtx.Provider value={value}>
      {children}
      {/* Global şehir seçici — tüm site aynı bileşeni kullanır */}
      <CityPickerSheet
        open={sheet}
        onClose={() => setSheet(false)}
        cities={cities}
        current={slug}
        onPick={pick}
        title={dict.srv.province}
        searchPlaceholder={dict.search.placeholder}
        emptyText={dict.search.noResults}
      />
    </CityCtx.Provider>
  );
}

/** Header ve hizmet sayfalarındaki "şehir değiştir" düğmesi */
export function CityButton({
  compact = false, label,
}: {
  compact?: boolean;
  label?: string;
}) {
  const { name, open } = useCity();
  return (
    <button
      onClick={open}
      title={label}
      aria-label={label}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: compact ? "7px 12px" : "9px 16px",
        borderRadius: 999, background: "var(--s2)", color: "var(--tx)",
        fontSize: compact ? 12.5 : 14, fontWeight: 700,
        flexShrink: 0, whiteSpace: "nowrap",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.6" />
      </svg>
      {name}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: .55 }}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}
