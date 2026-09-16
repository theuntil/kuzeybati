"use client";
import { useState, useEffect } from "react";
import type { MediaRow } from "@/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import { pickImage, srcSet, posterFor, videoSrc } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import VarsayilanGorsel from "@/components/site/VarsayilanGorsel";
import Gallery from "./Gallery";
import VideoPlayer from "./VideoPlayer";

/**
 * HABER MEDYA ALANI
 *
 * Kurallar (istenen davranış):
 *  1. Kapak fotoğrafına tıklayınca GALERİ açılır.
 *  2. Medya açıklaması kapağın altında GÖRÜNMEZ — sadece galeride.
 *  3. Haberde video varsa kartlar hâlinde dizilmez; TAM GENİŞLİK
 *     tek tek basılır.
 *  4. Videolar görünür olunca sessiz oynar; üstüne basınca sesi
 *     açılır ve kaldığı yerden devam eder.
 */
/*
 * Galeride gösterilen en fazla kare sayısı.
 * Fazlası son karenin üzerinde "+X" rozetiyle belirtiliyor.
 */
const GALERI_LIMIT = 8;

export default function ArticleMediaArea({
  cover, gallery, videos, dict, part,
}: {
  cover: MediaRow | null;
  /** Kapak dışındaki görseller */
  gallery: MediaRow[];
  /** Haberdeki videolar — tam genişlikte basılır */
  videos: MediaRow[];
  dict: Dictionary;
  /**
   * "cover" → yalnızca kapak (başlığın altında)
   * "rest"  → video ve diğer görseller (HABERİN EN ALTINDA)
   *
   * İkiye bölünmesinin sebebi: ek medyayı kapağın hemen altına
   * koymak metni geciktiriyordu. Okur önce haberi okur, medya
   * arşivine sonra bakar.
   */
  part: "cover" | "rest";
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Galeri sırası ekranda görülen sırayla aynı olmalı:
  // kapak (video ya da fotoğraf) → diğer videolar → görseller.
  const all: MediaRow[] = [
    ...(videos.length ? [videos[0]] : cover ? [cover] : []),
    ...videos.slice(1),
    ...(videos.length && cover ? [cover] : []),
    ...gallery,
  ].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);

  const coverImg = cover ? pickImage(cover, "full") : null;
  const openAt = (m: MediaRow) => {
    const i = all.findIndex((x) => x.id === m.id);
    setIndex(i < 0 ? 0 : i);
    setOpen(true);
  };

  const showCover = part === "cover";

  /*
   * Panelde varsayılan görsel ayarlı mı.
   *
   * ⚠ İSTEMCİDE OKUNUYOR. Ayar `<body data-ph>` üzerinde;
   * bu bileşen sunucuda çalıştığı için doğrudan erişemiyor.
   * Kap boş basılmasın diye önce varlığı kontrol ediliyor.
   */
  const [varsayilanVar, setVarsayilanVar] = useState(false);
  useEffect(() => {
    setVarsayilanVar(Boolean(document.body.dataset.ph || document.body.dataset.phDark));
  }, []);
  const showRest = part === "rest";



  /**
   * KAPAK VİDEOSU
   *
   * Haberde video varsa ilki kapak fotoğrafının YERİNE geçer ve
   * sessiz oynar. Aynı videoyu bir de aşağıda göstermek tekrar
   * olurdu; o yüzden alt bölümde ikinci videodan itibaren
   * listelenir. Video yoksa kapak normal fotoğraftır.
   */
  const coverVideo = videos.length > 0 ? videos[0] : null;
  const restVideos = coverVideo ? videos.slice(1) : videos;

  return (
    <>
      {/* ---- kapak videosu: fotoğrafın yerine geçer ---- */}
      {showCover && coverVideo && (
        <VideoPlayer
          src={videoSrc(coverVideo) ?? ""}
          poster={posterFor(coverVideo, "full")}
          autoPlayMuted
          allowMini
          rounded={16}
        />
      )}

      {/* ---- kapak fotoğrafı: video yoksa ---- */}
      {showCover && !coverVideo && cover && coverImg && (
        <button
          onClick={() => openAt(cover)}
          aria-label={dict.article.share}
          style={{
            /*
             * ⚠ 4:3 — 16:9 DEĞİL.
             * Geniş oran haber fotoğraflarının üstünü ve altını
             * kırpıyordu; haber görselleri genelde dikeye yakın
             * çekiliyor. 4:3 hem daha çok gösteriyor hem sayfada
             * daha büyük duruyor.
             */
            display: "block", width: "100%", aspectRatio: "4 / 3",
            borderRadius: 16, overflow: "hidden", position: "relative",
            background: cover.dominant_color ?? "var(--s2)", cursor: "zoom-in",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImg}
            srcSet={srcSet(cover)}
            sizes="(max-width: 860px) 100vw, 700px"
            alt=""
            width={cover.width ?? 1200}
            height={cover.height ?? 676}
            fetchPriority="high"
          />
          {all.length > 1 && (
            <span
              style={{
                position: "absolute", insetInlineEnd: 12, bottom: 12,
                background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)",
                color: "#fff", fontSize: 12, fontWeight: 700,
                padding: "6px 11px", borderRadius: 999,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Icon name="grid" size={13} strokeWidth={1.8} color="#fff" />
              1 / {all.length}
            </span>
          )}
        </button>
      )}

      {/*
        ---- HİÇ MEDYA YOKSA: VARSAYILAN GÖRSEL ----

        ⚠ ÖNCE HİÇBİR ŞEY BASILMIYORDU.
        Kapak videosu ve kapak fotoğrafı dallarının ikisi de
        `cover`/`coverVideo` istiyordu; medyası olmayan haberde
        başlığın altında doğrudan metin başlıyor, sayfa çıplak
        duruyordu. Listelerde varsayılan görsel çıkıyor ama
        habere girince kayboluyordu — tutarsızdı.

        Panelde varsayılan görsel ayarlanmamışsa `VarsayilanGorsel`
        zaten `null` dönüyor; o durumda kap da basılmıyor ve
        eskisi gibi boş kalıyor.
      */}
      {/*
        ⚠ KOŞUL `!cover` DEĞİL, `!coverImg`.

        Önce yalnızca "kapak satırı hiç yok" durumu
        yakalanıyordu. Ama satır VAR olup görseli üretilemeyen
        bir durum daha vardı: yazarın yüklediği medyada varyant
        yok, `pickImage` null dönüyor. O zaman ikinci dal
        (`cover && coverImg`) da çalışmıyordu ve sayfada HİÇBİR
        kapak basılmıyordu — listede varsayılan görsel çıkıyor
        ama habere girince kayboluyordu.
      */}
      {showCover && !coverVideo && !coverImg && varsayilanVar && (
        <div
          style={{
            display: "block", width: "100%", aspectRatio: "16 / 9",
            borderRadius: 16, overflow: "hidden", position: "relative",
            background: "var(--s2)",
          }}
        >
          <VarsayilanGorsel />
        </div>
      )}

      {/* ---- diğer videolar: TAM GENİŞLİK, haberin altında ----
           İlk video kapağa çıktı; burada 2. videodan itibaren. */}
      {showRest && restVideos.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>
            {dict.article.videos}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {restVideos.map((v) => (
              <VideoPlayer
                key={v.id}
                src={videoSrc(v) ?? ""}
                poster={posterFor(v, "full")}
                autoPlayMuted
                allowMini
                rounded={16}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- diğer görseller: haberin altında galeri ızgarası ---- */}
      {showRest && gallery.length > 0 && (
        /*
          HABER GALERİSİ

          ⚠ BAŞLIK KALDIRILDI.
          "Haberden kareler" başlığı bir şey anlatmıyordu;
          görsellerin kendisi zaten belli.

          ⚠ EN FAZLA 8 KARE GÖSTERİLİYOR.
          Uzun galeriler sayfayı gereksiz uzatıyordu. Fazlası
          varsa 8. karenin üzerine bulanık bir katman ve "+X"
          rozeti biniyor.
        */
        <section style={{ marginTop: 30 }}>
          <div
            style={{
              display: "grid", gap: 10,
              /* Hem mobilde hem masaüstünde iki kolon — kareler büyük */
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            {gallery.slice(0, GALERI_LIMIT).map((m, i) => {
              const kucuk = pickImage(m, "card") ?? pickImage(m, "thumb");
              if (!kucuk) return null;

              /*
               * ⚠ SON KUTUDA GİZLİ KARE SAYISI.
               * Yalnızca gerçekten fazlası varsa; tam 8 kare
               * varsa rozet çıkmıyor (+0 anlamsız olurdu).
               */
              const sonKutu = i === GALERI_LIMIT - 1;
              const gizli = gallery.length - GALERI_LIMIT;
              const rozet = sonKutu && gizli > 0 ? gizli : 0;

              return (
                <button
                  key={m.id}
                  onClick={() => openAt(m)}
                  aria-label={
                    rozet > 0
                      ? `${rozet} kare daha — galeriyi aç`
                      : (m.caption ?? "Kareyi büyüt")
                  }
                  style={{
                    position: "relative",
                    aspectRatio: "4 / 3", borderRadius: 14, overflow: "hidden",
                    background: m.dominant_color ?? "var(--s2)",
                    cursor: "zoom-in", padding: 0, border: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={kucuk}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      display: "block",
                      /*
                       * ⚠ BULANIKLIK YALNIZCA SON KUTUDA.
                       * Görselin kendisi bulanıklaşıyor, üstündeki
                       * yazı net kalıyor.
                       */
                      filter: rozet > 0 ? "blur(3px)" : undefined,
                      transform: rozet > 0 ? "scale(1.06)" : undefined,
                    }}
                  />

                  {rozet > 0 && (
                    <span
                      style={{
                        position: "absolute", inset: 0,
                        display: "grid", placeItems: "center",
                        background: "rgba(0,0,0,.5)",
                        color: "#fff",
                        fontSize: "clamp(22px, 5vw, 30px)",
                        fontWeight: 800,
                        letterSpacing: "-.02em",
                      }}
                    >
                      +{rozet}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Her iki parça da kendi galerisini taşır; aynı anda yalnızca
          tıklanan açılır, ikisinin durumu birbirinden bağımsızdır. */}
      <Gallery
        media={all}
        open={open}
        index={index}
        onClose={() => setOpen(false)}
        onIndex={setIndex}
      />
    </>
  );
}
