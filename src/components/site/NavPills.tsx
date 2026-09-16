"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import type { NavItem } from "@/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import { navLabel, navHref } from "./NavLink";

/* ══════════════════════════════════════════════════════════════
   ÜST MENÜ BAĞLANTILARI

   ┌─ AKTİF SEKME NEDEN HEP "ANA SAYFA"YDI ⚠️ ──────────────────┐
   │ Header bir `active` özelliği bekliyordu ve her sayfanın onu │
   │ göndermesi gerekiyordu. Sayfaların çoğu göndermiyordu, o    │
   │ yüzden koşul:                                                │
   │     item.kind === "home" && !active                          │
   │ her yerde doğru çıkıyor ve Ana sayfa seçili kalıyordu.       │
   │                                                              │
   │ Artık aktif sekme ADRES ÇUBUĞUNDAN okunuyor. Sayfaların     │
   │ hiçbir şey göndermesi gerekmiyor — yeni bir sayfa eklendiği │
   │ gün de doğru çalışıyor.                                      │
   └──────────────────────────────────────────────────────────────┘

   ┌─ HİÇBİRİ SEÇİLİ OLMAYABİLİR ⚠️ ───────────────────────────┐
   │ Kullanıcı arama, iletişim ya da bir yazar sayfasındaysa     │
   │ menüde karşılığı yok — o zaman HİÇBİRİ vurgulanmıyor.       │
   │ Eskiden bu durumda Ana sayfa yanıyordu ve okur nerede       │
   │ olduğunu şaşırıyordu.                                        │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/** Yoldan dil önekini atar: "/tr/kategori/spor" → "/kategori/spor" */
function dilsiz(yol: string): string {
  return yol.replace(/^\/(tr|en|ar|ru)(?=\/|$)/, "") || "/";
}

/**
 * Bu menü öğesi şu anki sayfaya karşılık geliyor mu?
 *
 * Karşılaştırma ADRES üzerinden: menü öğesinin gideceği yer ile
 * bulunduğumuz yer. Böylece kategori, şehir, kurumsal sayfa —
 * hepsi tek kuralla çözülüyor.
 */
function aktifMi(item: NavItem, locale: Locale, yol: string): boolean {
  const simdi = dilsiz(yol);
  const hedef = dilsiz(navHref(item, locale));

  if (item.kind === "home") return simdi === "/";
  // Dış bağlantı hiçbir zaman aktif olmaz
  if (item.kind === "url") return false;
  if (hedef === "/") return simdi === "/";

  /*
   * Alt sayfalar da sayılıyor: "/kategori/spor/2" (sayfalama)
   * ya da "/kategori/spor?siralama=..." Spor sekmesini yakıyor.
   */
  return simdi === hedef || simdi.startsWith(hedef + "/");
}

export default function NavPills({
  items, locale, dict, kategoriAdlari,
}: {
  items: NavItem[];
  locale: Locale;
  dict: Dictionary;
  kategoriAdlari?: Record<string, Record<string, string>>;
}) {
  const yol = usePathname() ?? "/";

  return (
    <nav
      data-only="desktop"
      data-hide-sb
      style={{
        /* Tek satırlık header'da taşmasın: fazlası gizleniyor,
           mobilde zaten alttaki şeritte tekrar var. */
        minWidth: 0, overflow: "hidden", display: "flex", gap: 2, flex: "1 0 auto", order: 2, overflowX: "auto" }}
    >
      {items.map((item) => {
        const aktif = aktifMi(item, locale, yol);
        return (
          /*
           * ⚠ `<Link>` — sayfa içi gezinme.
           *
           * Reels sayfasının sesli açılabilmesi buna bağlı:
           * tam sayfa yenilemede tarayıcının tıklamayla verdiği
           * ses izni kayboluyor, yeni belgede video sessiz
           * başlamak zorunda kalıyordu.
           *
           * Yan fayda: bütün menü gezinmesi hızlandı.
           */
          <Link
            key={item.id}
            href={navHref(item, locale)}
            className="nav-pill"
            data-active={aktif ? "true" : "false"}
            aria-current={aktif ? "page" : undefined}
          >
            {navLabel(item, locale, dict, kategoriAdlari)}
          </Link>
        );
      })}

      {/*
        Yazarlarımız — kategorilerin sonunda sabit.
        Panelden yönetilen menüye bırakılsaydı eklenmesi
        unutulduğunda sayfa menüden erişilemez kalırdı.
      */}
      <Link
        href={href(locale, "yazarlar")}
        className="nav-pill"
        data-active={yol.includes("/yazarlar") ? "true" : "false"}
      >
        {dict.footer?.authors ?? "Yazarlarımız"}
      </Link>
    </nav>
  );
}
