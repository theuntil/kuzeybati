"use client";
import { useState } from "react";
import { temaDegistir } from "@/lib/tema";
import { publicConfig } from "@/lib/config";
import {
  href, locales, localeNames, localeFlags, defaultLocale, segments, type Locale,
} from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { SiteSettings, NavItem, CityRow } from "@/lib/types";
import TemaSwitch from "./TemaSwitch";
import CocukSwitch from "./CocukSwitch";
import DilSecici from "./DilSecici";
import Icon from "@/components/ui/Icon";
import Sheet from "./Sheet";
import { CityButton } from "./CityProvider";
import AuthState from "./AuthState";
import ServicesSheet from "./ServicesSheet";
import ServicesDropdown from "./ServicesDropdown";
import SiteMenu from "./SiteMenu";
import Link from "next/link";

/**
 * Header'ın sağ tarafı: arama · dil · hizmetler · tema ·
 * "Giriş yap" · mobil menü. Sıra prototipteki ile aynı.
 *
 * Hizmetler düğmesi SAYFAYA GİTMEZ — panel açar (tasarımdaki gibi).
 */
export default function HeaderTools({
  locale, dict, settings, nav, cities, kategoriAdlari,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  nav: NavItem[];
  cities: CityRow[];
  kategoriAdlari?: Record<string, Record<string, string>>;
}) {
  /*
   * İKİ AYRI DURUM.
   *
   * ⚠ Mobil panel ve masaüstü açılır kutusu aynı anda
   * görünmemeli. Tek durum paylaşsalardı ekran döndürüldüğünde
   * ikisi birden açık kalabilirdi.
   */
  /*
   * ⚠ AYAR ZATEN `settings` İÇİNDE.
   * Ayrı bir prop eklemeye gerek yok; header bileşeni site
   * ayarlarını zaten alıyor. Fazladan prop iki kaynak
   * oluşturur ve biri güncellenmeyi unutulabilirdi.
   */
  const acikHizmetler: Record<string, boolean> = {
    weather: settings.weather_enabled,
    prayer: settings.prayer_enabled,
    markets: settings.markets_enabled,
    pharmacy: settings.pharmacy_enabled,
    scores: settings.scores_enabled,
    traffic: settings.traffic_enabled,
    earthquake: settings.earthquake_enabled,
    onthisday: settings.onthisday_enabled,
  };

  const [svcOpen, setSvcOpen] = useState(false);
  const [svcMasaustu, setSvcMasaustu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const enabled = locales.filter((l) => settings.enabled_locales.includes(l));

  /* Tema değişimi tek yerden: hem localStorage hem çerez yazılıyor */
  function toggleTheme() { temaDegistir(); }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        marginInlineStart: "auto", flexShrink: 0, order: 4,
      }}
    >
      {/*
        Şehir seçimi header'dan KALDIRILDI.
        Hava/namaz/eczane hizmetleri kendi panellerinde zaten
        şehir soruyor; header'da ikinci bir seçici hem yer
        kaplıyor hem kafa karıştırıyordu.
      */}

      {/*
        Arama MOBİLDE DE header'da.
        Önce yalnızca masaüstünde vardı, mobilde menünün içine
        gömülüydü — en çok kullanılan işlev iki dokunuş
        uzaktaydı.
      */}
      <Link
        href={href(locale, "search")}
        className="icon-btn"
        title={dict.nav.search}
        aria-label={dict.nav.search}
      >
        <Icon name="search" size={16} strokeWidth={1.7} />
      </Link>

      {/* Dil seçimi yalnızca masaüstünde: mobilde header
          kalabalıklaşıyordu, menüde zaten var */}
      <span data-only="desktop">
        <DilSecici locale={locale} etiket={dict.nav.language} />
      </span>

      {/*
        HİZMETLER — MASAÜSTÜ

        ⚠ `position: relative` KAP GEREKLİ.
        Açılır kutu `position: absolute` ile bu kaba göre
        konumlanıyor; kap olmazsa sayfanın köşesine kaçıyor.
      */}
      <span data-only="desktop" style={{ position: "relative", display: "inline-flex" }}>
        <button
          data-hizmet-dugme
          className="icon-btn"
          onClick={() => setSvcMasaustu((v) => !v)}
          title={dict.nav.services}
          aria-label={dict.nav.services}
          aria-expanded={svcMasaustu}
          aria-haspopup="menu"
        >
          <Icon name="grid" size={17} />
        </button>

        <ServicesDropdown
          open={svcMasaustu}
          onClose={() => setSvcMasaustu(false)}
          locale={locale}
          dict={dict}
          acikHizmetler={acikHizmetler}
        />
      </span>

      {/* Güneş/ay geçişli düğme — hangi modda olduğu görünüyor */}
      <span data-only="desktop" className="icon-btn" style={{ padding: 0 }}>
        <TemaSwitch />
      </span>

      {/* Çocuk modu — sakıncalı haberleri örter */}
      <span data-only="desktop">
        <CocukSwitch />
      </span>

      <button
        data-only="mobile"
        className="icon-btn"
        onClick={() => setSvcOpen(true)}
        title={dict.nav.services}
        aria-label={dict.nav.services}
      >
        <Icon name="grid" size={17} />
      </button>

      {/* Oturum durumuna göre "Giriş yap" ya da profil avatarı */}
      <AuthState locale={locale} dict={dict} />

      <button
        data-only="mobile"
        className="icon-btn"
        onClick={() => setMenuOpen(true)}
        title={dict.nav.menu}
        aria-label={dict.nav.menu}
      >
        <Icon name="menu" size={17} strokeWidth={1.8} />
      </button>

      {/* ---- paneller ---- */}

      <ServicesSheet
        open={svcOpen}
        onClose={() => setSvcOpen(false)}
        locale={locale}
        dict={dict}
        acikHizmetler={acikHizmetler}
      />

      <SiteMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        locale={locale}
        dict={dict}
        settings={settings}
        nav={nav}
        cities={cities}
        cdnBase={publicConfig().cdnBase}
        kategoriAdlari={kategoriAdlari}
        onServices={() => setSvcOpen(true)}
      />
    </div>
  );
}
