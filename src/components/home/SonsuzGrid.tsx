"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import FeatureGrid from "./FeatureGrid";
import type { Article } from "@/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

/* ══════════════════════════════════════════════════════════════
   SONSUZ AKIŞLI IZGARA

   ┌─ TASARIM DEĞİŞMİYOR ⚠️ ───────────────────────────────────┐
   │ Bir denemede kategori ve şehir sayfaları `ForYou`'ya      │
   │ çevrilmişti; sonsuz akış geldi ama KART TASARIMI da       │
   │ değişti — istenmeyen bir yan etki.                         │
   │                                                              │
   │ Bu bileşen `FeatureGrid`'i olduğu gibi kullanıyor, sadece  │
   │ altına yükleme tetikleyicisi ve iskelet ekliyor. Görünüm   │
   │ birebir aynı.                                                │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function SonsuzGrid({
  ilk, locale, dict, kategori, sehir,
}: {
  /** Sunucudan gelen ilk sayfa */
  ilk: Article[];
  locale: Locale;
  dict: Dictionary;
  kategori?: string;
  sehir?: string;
}) {
  const [items, setItems] = useState<Article[]>(ilk);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinel = useRef<HTMLDivElement>(null);

  /* Sunucudan yeni ilk sayfa gelirse (dil/şehir değişimi) sıfırla */
  useEffect(() => {
    setItems(ilk);
    setHasMore(true);
  }, [ilk]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const ek = kategori ? `&category=${encodeURIComponent(kategori)}`
               : sehir ? `&city=${encodeURIComponent(sehir)}` : "";

      /*
       * ⚠ OFFSET TOPLAM SAYIDAN HESAPLANIYOR.
       * Sunucudan gelen ilk sayfa da listede; offset olarak
       * `items.length` kullanmak doğru — API bu sayıdan
       * sonrasını döndürüyor.
       */
      const res = await fetch(
        `/api/feed?locale=${locale}&offset=${items.length}${ek}`,
        { cache: "no-store" },
      );
      if (!res.ok) { setHasMore(false); return; }

      const j = (await res.json()) as { items?: Article[]; hasMore?: boolean };
      const yeni = j.items ?? [];

      if (yeni.length === 0) {
        setHasMore(false);
        return;
      }

      /*
       * ⚠ TEKRAR EDEN HABER SÜZÜLÜYOR.
       * Yeni bir haber yayımlanınca sayfalama kayıyor ve aynı
       * kayıt iki kez gelebiliyor; React aynı `key` ile iki
       * öğe görünce uyarı veriyor ve liste bozuluyordu.
       */
      setItems((p) => {
        const varolan = new Set(p.map((a) => a.id));
        return [...p, ...yeni.filter((a) => !varolan.has(a.id))];
      });
      setHasMore(j.hasMore !== false);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, items.length, locale, kategori, sehir]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;

    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) void loadMore(); },
      /* Ekranın altına gelmeden önce yüklemeye başla */
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  return (
    <>
      <FeatureGrid articles={items} locale={locale} dict={dict} wrap />

      {loading && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "var(--g)", marginTop: "var(--g)",
        }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: "1 1 var(--card)", minWidth: 0,
                borderRadius: 14, overflow: "hidden",
              }}
            >
              <div style={{
                width: "100%", aspectRatio: "16 / 9",
                background: "var(--s2)", borderRadius: 14,
                animation: "shimmer 1.4s ease-in-out infinite",
              }} />
              <div style={{
                height: 14, marginTop: 10, borderRadius: 6,
                background: "var(--s2)",
                animation: "shimmer 1.4s ease-in-out infinite",
              }} />
              <div style={{
                height: 14, marginTop: 7, width: "70%", borderRadius: 6,
                background: "var(--s2)",
                animation: "shimmer 1.4s ease-in-out infinite",
              }} />
            </div>
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinel} style={{ height: 1 }} aria-hidden />}
    </>
  );
}
