"use client";
import Empty from "@/components/account/Empty";
import KartCikarButonu from "@/components/account/KartCikarButonu";
import { pickImage } from "@/lib/media";
import { haberYolu, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   KAYDEDİLENLER / BEĞENİLENLER LİSTESİ

   ⚠ İSTEMCİ BİLEŞENİ.
   Kart çıkarıldığında listeden anında kaybolması gerekiyor;
   sunucu bileşeninde durum tutulamaz.
   ══════════════════════════════════════════════════════════════ */

export type SavedRow = {
  id: string; slug: string; title: string;
  summary: string | null; category_slug?: string | null;
  cover?: unknown;
};

export default function SavedList({
  items, locale, dict, empty, tur,
}: {
  items: SavedRow[];
  locale: Locale;
  dict: Dictionary;
  empty: string;
  tur: "saved" | "likes";
}) {
  const liste = items;

  if (!liste.length) return <Empty text={empty} />;

  return (
    <ul className="kb-acc-izgara" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {liste.map((a) => (
        <li key={a.id}>
          {/*
            ⚠ `height: 100%` OLMADAN KART EŞİTLENMİYORDU.
            `<li>` grid stretch ile satır yüksekliğini alıyordu
            ama içindeki `<a>` yalnızca kendi metnine göre
            uzuyordu — özeti olmayan kart daha kısa görünüyordu.
            Şimdi `<a>` her zaman `<li>`nin tamamını dolduruyor.
          */}
          <Link
            href={haberYolu(locale, a.slug, a.category_slug)}
            style={{
              display: "flex", gap: 14, background: "var(--s1)",
              border: "1px solid var(--bd)", borderRadius: 16,
              padding: 14, color: "var(--tx)", alignItems: "center",
              height: "100%", boxSizing: "border-box",
            }}
          >
            {(() => {
              const img = pickImage(a.cover as never, "thumb");
              if (!img) return null;
              return (
                <span style={{
                  width: 96, aspectRatio: "4 / 3", borderRadius: 11,
                  overflow: "hidden", flexShrink: 0, background: "var(--s2)",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" loading="lazy"
                       style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </span>
              );
            })()}

            <span style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: 15.5, fontWeight: 700,
                lineHeight: 1.32, overflowWrap: "anywhere",
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {a.title}
              </h3>
              {a.summary && (
                <p style={{
                  fontSize: 13.5, color: "var(--mu)", marginTop: 6, lineHeight: 1.5,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {a.summary}
                </p>
              )}
            </span>

            {/*
              Kayıt/beğeni düğmesi.
              Kart listeden ÇIKMIYOR; sadece ikon değişiyor.
            */}
            <KartCikarButonu articleId={a.id} tur={tur} />
          </Link>
        </li>
      ))}
    </ul>
  );
}


/**
 * Liste yükleme iskeleti.
 *
 * ⚠ GERÇEK KARTLA AYNI ÖLÇÜDE.
 * Farklı yükseklikte olsaydı veri gelince liste zıplar, okur
 * yerini kaybederdi.
 */
export function SavedIskelet({ adet = 6 }: { adet?: number }) {
  return (
    <ul className="kb-acc-iskelet" aria-hidden>
      {Array.from({ length: adet }).map((_, i) => (
        <li key={i}>
          <span className="kb-isk-gorsel" />
          <span className="kb-isk-metin">
            <span className="kb-isk-satir" style={{ height: 14 }} />
            <span className="kb-isk-satir" style={{ height: 14, width: "72%" }} />
            <span className="kb-isk-satir" style={{ height: 11, width: "38%" }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
