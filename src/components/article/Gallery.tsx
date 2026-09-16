"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { MediaRow } from "@/lib/types";
import { mediaUrl, posterFor, videoSrc, pickImage } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import VideoPlayer from "./VideoPlayer";
import { pauseOthers } from "@/lib/video-bus";

/**
 * GALERİ (tam ekran medya görüntüleyici)
 *
 * Prototipteki yapı: üstte sayaç + kapat, ortada medya, yanlarda
 * ok düğmeleri, altta küçük resim şeridi.
 *
 * MEDYA AÇIKLAMASI SADECE BURADA GÖRÜNÜR. Haber sayfasında kapak
 * fotoğrafının altında açıklama basılmaz; okurun akışını böler ve
 * çoğu zaman ajans künyesinden ibarettir. Galeriye geçildiğinde
 * ise bağlam gerekir, o yüzden burada gösterilir.
 */
export default function Gallery({
  media, open, index, onClose, onIndex,
}: {
  media: MediaRow[];
  open: boolean;
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const touchX = useRef<number | null>(null);
  useEffect(() => setMounted(true), []);

  const move = useCallback(
    (d: number) => onIndex((index + d + media.length) % media.length),
    [index, media.length, onIndex],
  );

  // Galeri açılınca sayfadaki videolar sussun: iki ses üst üste
  // binmesin. Galerinin kendi oynatıcısı sonra kaydolur.
  useEffect(() => {
    if (open) pauseOthers();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, move]);

  // Aktif küçük resim şeridin dışına kaydıysa görünür alana getir
  useEffect(() => {
    if (!open) return;
    const el = document.querySelector<HTMLElement>(`[data-thumb-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index, open]);

  if (!mounted || !open || media.length === 0) return null;

  const cur = media[Math.min(index, media.length - 1)];
  const isVideo = cur.type === "video";
  const round = (n: number) => ({
    width: n, height: n, borderRadius: 999,
    background: "rgba(255,255,255,.12)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  });

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, background: "#000", zIndex: 400,
        display: "flex", flexDirection: "column",
        animation: "galFade .2s ease",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Medya"
    >
      {/* üst çubuk */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", flexShrink: 0 }}>
        <span style={{ color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 700 }}>
          {index + 1} / {media.length}
        </span>
        <button onClick={onClose} aria-label="Kapat" style={{ ...round(36), marginInlineStart: "auto" }}>
          <Icon name="close" size={17} strokeWidth={1.8} color="#fff" />
        </button>
      </div>

      {/* medya */}
      <div
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
        style={{
          flex: 1, minHeight: 0, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", padding: "0 8px",
        }}
      >
        {media.length > 1 && (
          <button
            onClick={() => move(-1)}
            aria-label="Önceki"
            style={{ ...round(42), position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", zIndex: 2 }}
          >
            <Icon name="chevronLeft" size={18} strokeWidth={1.8} color="#fff" />
          </button>
        )}

        {isVideo ? (
          /**
           * Genişlik yüksekliğe göre sınırlanır: `min(100%, yükseklik×16/9)`.
           * Böylece kutu görünür alandan taşmaz ve alttaki kontroller
           * açıklama/küçük resimlerin altında kalmaz — önceki sürümdeki
           * hata buydu.
           */
          <div
            style={{
              /**
               * Genişlik, KALAN YÜKSEKLİĞE göre sınırlanır.
               * 240px = üst çubuk + açıklama + küçük resim şeridi.
               * Böylece 16:9 kutu görünür alana sığar ve alttaki
               * kontroller açıklamanın/şeridin altında kalmaz.
               */
              width: "min(100%, 1100px, calc((100dvh - 240px) * 16 / 9))",
              marginInline: "auto",
            }}
          >
            <VideoPlayer
              key={cur.id}
              src={videoSrc(cur) ?? ""}
              poster={posterFor(cur, "full")}
              rounded={16}
              contain
            />
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={cur.id}
            src={pickImage(cur, "full") ?? mediaUrl(cur.storage_key, "full") ?? ""}
            alt={cur.caption ?? ""}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              width: "auto", height: "auto", objectFit: "contain",
              // Köşeler yuvarlak: siyah zeminde keskin kenar sert duruyordu
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}
          />
        )}

        {media.length > 1 && (
          <button
            onClick={() => move(1)}
            aria-label="Sonraki"
            style={{ ...round(42), position: "absolute", insetInlineEnd: 14, top: "50%", transform: "translateY(-50%)", zIndex: 2 }}
          >
            <Icon name="chevronRight" size={18} strokeWidth={1.8} color="#fff" />
          </button>
        )}
      </div>

      {/* AÇIKLAMA — yalnızca burada, her zaman ORTALI */}
      {(cur.caption || cur.credit) && (
        <div
          style={{
            flexShrink: 0, width: "100%",
            padding: "14px 24px 0",
            display: "flex", justifyContent: "center",
          }}
        >
          <p
            style={{
              margin: 0, textAlign: "center", maxWidth: 760,
              color: "rgba(255,255,255,.82)", fontSize: 13.5, lineHeight: 1.5,
            }}
          >
            {cur.caption}
            {cur.credit && (
              <span style={{ fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
                {cur.caption ? " · " : ""}{cur.credit}
              </span>
            )}
          </p>
        </div>
      )}

      {/* küçük resim şeridi */}
      {media.length > 1 && (
        <div
          data-hide-sb
          style={{
            flexShrink: 0, width: "100%",
            overflowX: "auto", padding: "14px 18px calc(18px + env(safe-area-inset-bottom))",
            scrollSnapType: "x proximity",
          }}
        >
          <div
            style={{
              // `margin:auto` + `width:max-content`: az sayıda küçük
              // resim varsa ortalanır, çok olunca kaydırılır. Sadece
              // justify-content ile ortalamak, taşma olduğunda ilk
              // öğeleri erişilemez hâle getiriyordu.
              display: "flex", gap: 8, alignItems: "center",
              width: "max-content", marginInline: "auto",
            }}
          >
          {media.map((m, i) => {
            const t = m.type === "video" ? posterFor(m, "thumb") : pickImage(m, "thumb");
            return (
              <button
                key={m.id}
                onClick={() => onIndex(i)}
                data-thumb-idx={i}
                aria-label={`${i + 1}`}
                aria-current={i === index}
                style={{
                  width: 56, height: 56, borderRadius: 12, overflow: "hidden",
                  flex: "0 0 56px", opacity: i === index ? 1 : 0.45,
                  position: "relative", scrollSnapAlign: "center",
                  outline: i === index ? "2px solid #fff" : "2px solid transparent",
                  outlineOffset: 2,
                  transition: "opacity .18s ease, outline-color .18s ease",
                }}
              >
                {t && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={t} alt="" loading="lazy" />
                )}
                {m.type === "video" && (
                  <span
                    style={{
                      position: "absolute", inset: 0, background: "rgba(0,0,0,.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Icon name="play" size={14} color="#fff" strokeWidth={2.4} />
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>
      )}

      <style>{`@keyframes galFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>,
    document.body,
  );
}
