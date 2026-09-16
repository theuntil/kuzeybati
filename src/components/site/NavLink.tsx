import { href, defaultLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { NavItem } from "@/lib/types";

/** Menü öğesinin etiketini dile göre çözer; yoksa Türkçeye düşer. */
export function navLabel(
  item: NavItem,
  locale: Locale,
  dict: Dictionary,
  /**
   * Kategori adlarının çevirileri.
   *
   * ⚠ Menüde elle yazılmış bir etiket varsa O kazanıyor.
   * Yönetici "Spor" yerine "Futbol" yazdıysa dil değişince
   * "Sports" olmamalı — bilerek verilmiş bir ad ezilmez.
   */
  kategoriler?: Record<string, Record<string, string>>,
): string {
  /*
   * ⚠ SIRA ÖNEMLİ.
   *
   * Önce `label[locale] ?? label[tr]` bakılıyordu ve kategori
   * çevirisine hiç sıra gelmiyordu. Menü etiketlerinde Arapça
   * ve Rusça alanlara TÜRKÇE metin kaydedilmiş:
   *   {"tr":"Spor","en":"Sports","ar":"Spor","ru":"Spor"}
   * Bu değerler "dolu" olduğu için geçerli sayılıyor ve
   * kategori çevirisi devreye girmiyordu.
   *
   * Doğru sıra:
   *   1. Bu dil için ELLE yazılmış etiket (varsa)
   *   2. Kategori çevirisi
   *   3. Varsayılan dildeki etiket
   */

  /* 1 — bu dile özel etiket */
  const ozel = item.label?.[locale];

  /* 2 — kategori çevirisi */
  if (item.kind === "category" && item.target_slug && kategoriler) {
    const k = kategoriler[item.target_slug];
    const ceviri = k?.[locale];

    /*
     * Elle yazılmış etiket kategori çevirisiyle AYNIYSA ya da
     * Türkçe kopyasıysa, çeviri kazanıyor. Farklıysa yönetici
     * bilerek başka bir ad vermiş demektir — ona dokunulmuyor.
     */
    if (ceviri && (!ozel || ozel === k?.tr)) return ceviri;
    if (ozel) return ozel;
    if (k?.tr) return k.tr;
  }

  const l = ozel ?? item.label?.[defaultLocale];
  if (l) return l;

  if (item.kind === "home") return dict.nav.home;
  if (item.kind === "video") return dict.nav.video;
  if (item.kind === "search") return dict.nav.search;
  return item.target_slug ?? "";
}

/** Menü öğesinin hedef adresi */
export function navHref(item: NavItem, locale: Locale): string {
  switch (item.kind) {
    case "home": return href(locale, "home");
    case "video": return href(locale, "video");
    case "search": return href(locale, "search");
    case "category": return href(locale, "category", item.target_slug!);
    case "city": return href(locale, "city", item.target_slug!);
    case "page": return href(locale, "page", item.target_slug!);
    case "url": return item.url ?? "#";
  }
}

export default function NavLink({
  item, locale, dict,
}: {
  item: NavItem;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <a
      href={navHref(item, locale)}
      target={item.open_new_tab ? "_blank" : undefined}
      rel={item.open_new_tab ? "noopener noreferrer" : undefined}
      style={{
        padding: "7px 12px",
        borderRadius: 9,
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--mu)",
        whiteSpace: "nowrap",
      }}
    >
      {navLabel(item, locale, dict)}
    </a>
  );
}
