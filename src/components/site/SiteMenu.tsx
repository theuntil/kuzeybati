"use client";
import { useEffect, useState } from "react";
import { temaDegistir } from "@/lib/tema";
import { createPortal } from "react-dom";
import TemaSwitch from "./TemaSwitch";
import CocukSwitch from "./CocukSwitch";
import MenuHesap from "./MenuHesap";
import Icon from "@/components/ui/Icon";
import { href, localeFlags, localeNames, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { NavItem, SiteSettings, CityRow } from "@/lib/types";
import { navLabel, navHref } from "./NavLink";
import { assetUrl } from "@/lib/media";
import Link from "next/link";

/**
 * Mobil site menüsü — prototipteki tam ekran çekmece.
 * Sağdan kayarak gelir; içinde giriş/kayıt, kategoriler,
 * şehirler, hizmetler ve tema anahtarı var.
 *
 * Portal ile <body> altına basılıyor: kapsayıcıdaki
 * `overflow-x: clip` yüzünden panel görünmüyordu.
 */
export default function SiteMenu({
  open, onClose, locale, dict, settings, nav, cities, onServices, cdnBase,
  kategoriAdlari,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  nav: NavItem[];
  cities: CityRow[];
  onServices: () => void;
  cdnBase: string;
  kategoriAdlari?: Record<string, Record<string, string>>;
}) {
  const [mounted, setMounted] = useState(false);
  const [showCities, setShowCities] = useState(false);
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

  /*
   * ⚠ LOGO TEMAYA GÖRE SEÇİLİYOR.
   *
   * Önce her zaman `logo_light_key` okunuyordu; koyu temada
   * açık tema logosu görünüyor ve zeminle kayboluyordu.
   *
   * Tema DOM'dan okunuyor: sunucudan gelen bir değer önbelleğe
   * alınıp yanlış temayı taşırdı.
   *
   * ⚠⚠ BU HOOK'LAR ERKEN ÇIKIŞIN ÜSTÜNDE OLMAK ZORUNDA.
   *
   * Önce aşağıya, `if (!mounted || !open) return null;`
   * satırından SONRA yazılmışlardı. Menü kapalıyken bileşen
   * erken dönüyor ve bu iki hook hiç çalışmıyordu; menü
   * açılınca aniden beliriyorlardı. React her render'da aynı
   * sayıda hook bekliyor — sayı değişince uygulama çöküyor:
   *   "Application error: a client-side exception has occurred"
   *
   * Hook'lar koşulsuz olarak, her zaman aynı sırayla
   * çalışmalı. Bu yüzden erken çıkıştan önce duruyorlar.
   */
  const [koyu, setKoyu] = useState(true);
  useEffect(() => {
    const kok = document.documentElement;
    const olc = () => setKoyu(kok.dataset.theme !== "light");
    olc();
    const g = new MutationObserver(olc);
    g.observe(kok, { attributes: true, attributeFilter: ["data-theme"] });
    return () => g.disconnect();
  }, []);

  if (!mounted || !open) return null;

  const items = nav.filter((n) => ["header", "drawer"].includes(n.location));
  const logo = assetUrl(
    koyu
      ? (settings.logo_dark_key ?? settings.logo_light_key)
      : (settings.logo_light_key ?? settings.logo_dark_key),
  );

  /* Tema değişimi tek yerden: hem localStorage hem çerez yazılıyor */
  function toggleTheme() { temaDegistir(); }

  const row: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "13px 18px", fontSize: 14.5, fontWeight: 600,
    color: "var(--tx)", borderBottom: "1px solid var(--bd)",
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 211,
        background: "var(--s1)", display: "flex", flexDirection: "column",
        animation: "menuIn .3s cubic-bezier(.32,.72,0,1)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={dict.nav.menu}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "18px 18px 14px", borderBottom: "1px solid var(--bd)", flexShrink: 0,
        }}
      >
        {logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logo} alt={settings.site_name} style={{ height: 22, width: "auto" }} />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 800 }}>{settings.site_name}</span>
        )}
        <button
          onClick={onClose}
          aria-label={dict.common.close}
          style={{
            marginInlineStart: "auto", width: 32, height: 32, borderRadius: 999,
            background: "var(--s2)", display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
          }}
        >
          <Icon name="close" size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div data-hide-sb style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {showCities ? (
          <>
            <button
              onClick={() => setShowCities(false)}
              style={{ ...row, width: "100%", background: "var(--s2)" }}
            >
              <Icon name="chevronLeft" size={17} />
              {dict.common.back}
            </button>
            {cities.map((c) => (
              <Link key={c.id} href={href(locale, "city", c.slug)} style={row} onClick={onClose}>
                <Icon name="pin" size={17} />
                {c.name}
              </Link>
            ))}
            <Link href={href(locale, "city")} style={{ ...row, color: "var(--ac)" }} onClick={onClose}>
              {dict.nav.allCities} →
            </Link>
          </>
        ) : (
          <>
            <MenuHesap locale={locale} dict={dict} cdn={cdnBase} onClose={onClose} />

            {items.map((item) => (
              <Link key={item.id} href={navHref(item, locale)} style={row} onClick={onClose}>
                {navLabel(item, locale, dict, kategoriAdlari)}
                <span style={{ marginInlineStart: "auto", color: "var(--mu)" }}>
                  <Icon name="chevronRight" size={16} />
                </span>
              </Link>
            ))}

            <button onClick={() => setShowCities(true)} style={{ ...row, width: "100%" }}>
              <Icon name="pin" size={17} />
              {dict.nav.allCities}
              <span style={{ marginInlineStart: "auto", color: "var(--mu)" }}>
                <Icon name="chevronRight" size={16} />
              </span>
            </button>

            <button
              onClick={() => { onClose(); setTimeout(onServices, 240); }}
              style={{ ...row, width: "100%" }}
            >
              <Icon name="grid" size={17} />
              {dict.nav.services}
              <span style={{ marginInlineStart: "auto", color: "var(--mu)" }}>
                <Icon name="chevronRight" size={16} />
              </span>
            </button>

            {/*
              Yazarlarımız — hizmetlerin hemen altında.
              `nav` listesine bırakılsaydı eklenmesi unutulduğunda
              sayfaya menüden hiç erişilemezdi.
            */}
            <Link
              href={href(locale, "yazarlar")}
              onClick={onClose}
              style={{ ...row, width: "100%", textDecoration: "none" }}
            >
              <Icon name="user" size={17} />
              {dict.footer?.authors ?? "Yazarlarımız"}
              <span style={{ marginInlineStart: "auto", color: "var(--mu)" }}>
                <Icon name="chevronRight" size={16} />
              </span>
            </Link>

            {/*
              ⚠ ARAMA MENÜDEN KALDIRILDI.
              Artık mobilde de header'da duruyor — en çok
              kullanılan işlev iki dokunuş uzakta olmamalı.
            */}

            {/*
              Tema ve çocuk modu ayrı satırlar.
              Önce kategori bağlantılarıyla aynı biçimdeydiler ve
              bağlantı sanılıyorlardı; artık anahtar görünümünde.
            */}
            {/*
              ⚠ YAN YANA VE ETİKETSİZ.

              Önce iki ayrı tam genişlik satırdı ve her birinin
              solunda "Tema" / "Çocuk modu" yazıyordu. Ama
              anahtarların kendisi zaten ne olduklarını
              söylüyor; iki satır menüyü gereksiz uzatıyordu.
            */}
            <div style={{
              ...row, gap: 10, cursor: "default", borderBottom: "none",
              display: "grid", gridTemplateColumns: "1fr 1fr",
              alignItems: "stretch",
            }}>
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "10px 12px", borderRadius: 13,
                background: "var(--s2)", border: "1px solid var(--bd)",
                fontSize: 13, fontWeight: 700,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Icon name={koyu ? "moon" : "sun"} size={16} />
                  {koyu ? "Koyu" : "Açık"}
                </span>
                <TemaSwitch />
              </span>

              <span style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "10px 12px", borderRadius: 13,
                background: "var(--s2)", border: "1px solid var(--bd)",
                fontSize: 13, fontWeight: 700,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Icon name="heart" size={16} />
                  Çocuk
                </span>
                <CocukSwitch />
              </span>
            </div>

            <div style={{ ...row, gap: 10, flexWrap: "wrap", borderBottom: "none" }}>
              <Icon name="globe" size={17} />
              {settings.enabled_locales.map((l) => (
                <Link
                  key={l}
                  href={href(l, "home")}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 10px", borderRadius: 999,
                    background: l === locale ? "var(--s3)" : "var(--s2)",
                    fontSize: 12.5, fontWeight: 700, color: "var(--tx)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://flagcdn.com/w40/${localeFlags[l]}.png`}
                    alt=""
                    style={{ width: 18, height: 13, objectFit: "cover", borderRadius: 2 }}
                  />
                  {localeNames[l]}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes menuIn { from { transform: translateX(101%) } to { transform: translateX(0) } }`}</style>
    </div>,
    document.body,
  );
}
