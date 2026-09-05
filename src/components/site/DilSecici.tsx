"use client";
import { useState } from "react";
import {
  locales, localeNames, localeFlags, defaultLocale, segments,
  href, type Locale,
} from "@/i18n/config";
import Sheet from "@/components/ui/Sheet";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   DİL SEÇİCİ

   ┌─ TEK BİLEŞEN ⚠️ ──────────────────────────────────────────┐
   │ Header'da ve haber sayfasında iki ayrı dil düğmesi vardı;  │
   │ farklı davranıyorlardı. Aynı bileşen ikisinde de           │
   │ kullanılıyor artık.                                          │
   └──────────────────────────────────────────────────────────────┘

   ┌─ AYNI SAYFADA KALIYOR ⚠️ ─────────────────────────────────┐
   │ Eski kod yalnızca `/kategori/...` gibi ÖNEKLİ adresleri    │
   │ tanıyordu. Temiz adrese geçtikten sonra (`/egitim/haber`)  │
   │ eşleşme bulamıyor ve ana sayfaya atıyordu.                 │
   │                                                              │
   │ Artık yolun kendisi korunuyor, yalnızca dil öneki          │
   │ değişiyor. Bir haberdeyken dil değiştirince aynı haberin   │
   │ o dildeki hâli açılıyor.                                    │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/**
 * Düğmede gösterilecek bayrak.
 *
 * ⚠ DÖNEN BAYRAK KALDIRILDI.
 * Bayraklar üç saniyede bir değişiyordu; hangi dilde olduğunu
 * anlamak zorlaşıyor ve göz sürekli oraya kayıyordu.
 *
 * Basit kural: Türkçedeyken İngiliz bayrağı ("çevir"), başka
 * dildeyken Türk bayrağı ("geri dön"). Düğme ne yapacağını
 * gösteriyor, nerede olduğunu değil.
 */
function karsiDil(locale: Locale): Locale {
  return locale === "tr" ? "en" : "tr";
}

/** Pencerede dilin kendi adı ve bölgesi */
const DIL_ETIKET: Record<string, { ad: string; bolge: string }> = {
  tr: { ad: "Türkçe",  bolge: "Türkiye" },
  en: { ad: "English", bolge: "Global" },
  ar: { ad: "العربية", bolge: "عالمي" },
  ru: { ad: "Русский", bolge: "Глобальный" },
};

export default function DilSecici({
  locale, etiket, boyut = 18,
}: {
  locale: Locale;
  etiket: string;
  boyut?: number;
}) {
  const [acik, setAcik] = useState(false);
  const gosterilen = karsiDil(locale);

  /**
   * Hedef dildeki aynı sayfanın adresi.
   *
   * Yolu olduğu gibi taşıyor; yalnızca dil öneki değişiyor.
   * Kategori ve haber adresleri artık öneksiz olduğu için
   * segment eşleştirmeye gerek kalmadı.
   */
  function hedefAdres(hedef: Locale): string {
    if (typeof window === "undefined") return href(hedef, "home");

    const parts = window.location.pathname.split("/").filter(Boolean);
    if (locales.includes(parts[0] as Locale)) parts.shift();
    if (parts.length === 0) return href(hedef, "home");

    /*
     * Dile göre değişen segmentler (arama, video, sayfa…)
     * çevriliyor. Kategori ve haber adresleri değişmiyor.
     */
    for (const key of Object.keys(segments) as (keyof typeof segments)[]) {
      if (segments[key][locale] === parts[0]) {
        return href(hedef, key, parts.slice(1).join("/") || undefined);
      }
    }

    const onek = hedef === defaultLocale ? "" : `/${hedef}`;
    return `${onek}/${parts.join("/")}`;
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setAcik(true)}
        title={etiket}
        aria-label={etiket}
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://flagcdn.com/w40/${localeFlags[gosterilen]}.png`}
          alt=""
          width={boyut + 4}
          height={boyut}
          /* Satır içi boyut: üst kaptaki `img` kuralları ezmesin */
          style={{
            width: boyut + 4, height: boyut,
            minWidth: boyut + 4, maxWidth: boyut + 4,
            borderRadius: 3, objectFit: "cover",
          }}
        />
      </button>

      <Sheet open={acik} onClose={() => setAcik(false)} title={etiket}>
        {/*
          ⚠ BAYRAK BOYUTU AÇIKÇA VERİLİYOR.
          `width`/`height` özniteliği yetmiyordu: bir üst kap
          `img { width: 100% }` gibi bir kural uygularsa bayrak
          100 piksele büyüyordu. Satır içi stil bunu keser.
        */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {locales.map((l) => {
            const e = DIL_ETIKET[l] ?? { ad: localeNames[l], bolge: "" };
            const secili = l === locale;
            return (
              <Link
                key={l}
                href={hedefAdres(l)}
                onClick={() => setAcik(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 12px", borderRadius: 12,
                  background: secili ? "var(--s2)" : "transparent",
                  color: "inherit", textDecoration: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://flagcdn.com/w40/${localeFlags[l]}.png`}
                  alt=""
                  style={{
                    width: 24, height: 18, minWidth: 24, maxWidth: 24,
                    borderRadius: 3, objectFit: "cover", flexShrink: 0,
                  }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block", fontSize: 14.5,
                      fontWeight: secili ? 700 : 500,
                    }}
                  >
                    {e.ad}
                  </span>
                  {e.bolge && (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--mu)" }}>
                      {e.bolge}
                    </span>
                  )}
                </span>
                {secili && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.6"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </Link>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
