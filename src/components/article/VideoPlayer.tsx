"use client";
import { useEffect, useId, useRef, useState, useCallback } from "react";
import OzelIkon from "@/components/ui/OzelIkon";
import Icon from "@/components/ui/Icon";
import { registerPlayer, pauseOthers } from "@/lib/video-bus";

/**
 * ÖZEL VİDEO OYNATICI
 *
 * YERLEŞİM KURALI (önceki sürümdeki hataların kaynağı buydu)
 *  - Kutunun yüksekliği HER ZAMAN bellidir (`aspect-ratio`).
 *    Eskiden `height:100%` yüksekliği olmayan bir kabın içindeydi;
 *    kutu çöküyor, kontroller birbirine giriyor ve alttaki
 *    açıklama/küçük resimler videonun üstüne biniyordu.
 *  - Mini moda geçince kutuya HİÇBİR inline ölçü verilmez; tüm
 *    ölçü `.kb-mini` sınıfından gelir. Eskiden inline `width:100%`
 *    sınıftaki genişliği eziyordu ve mini oynatıcı TÜM EKRANI
 *    kaplıyordu.
 *
 * DAVRANIŞ
 *  - Görünürken sessiz oynar, ekrandan tamamen çıkınca sağ altta
 *    küçük oynatıcıya geçer. Bir pikseli görünüyorsa geçmez.
 *  - Tıklayınca ses açılır, kaldığı yerden devam eder.
 *  - Tam ekranda ses otomatik açılır.
 *  - Biri oynayınca diğer oynatıcılar susar.
 */
export default function VideoPlayer({
  src, poster, autoPlayMuted = false, rounded = 16,
  allowMini = false, contain = false, maxHeight,
}: {
  src: string;
  poster?: string | null;
  autoPlayMuted?: boolean;
  rounded?: number;
  /** Ekrandan çıkınca sağ altta küçük oynatıcıya geçsin mi */
  allowMini?: boolean;
  /** Galeri: videoyu kırpmadan sığdır */
  contain?: boolean;
  maxHeight?: string;
}) {
  const uid = useId();
  const holder = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showUi, setShowUi] = useState(true);
  const [full, setFull] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [mini, setMini] = useState(false);
  const [miniClosed, setMiniClosed] = useState(false);


  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const armHide = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUi(false), 2600);
  }, []);

  // ---- Diğer oynatıcılarla koordinasyon ----------------------
  useEffect(() => registerPlayer(uid, () => {
    video.current?.pause();
    setMini(false);
  }), [uid]);

  // ---- Görünürlük: oynat / durdur / mini ---------------------
  useEffect(() => {
    const el = video.current;
    const spot = holder.current;
    if (!el || !spot) return;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio === 0) {
          if (allowMini && !el.paused && !miniClosed) setMini(true);
          else if (autoPlayMuted) el.pause();
          return;
        }
        setMini(false);
        if (autoPlayMuted && e.intersectionRatio >= 0.5 && el.paused && !pausedByUser) {
          void el.play().catch(() => undefined);
        }
      },
      { threshold: [0, 0.01, 0.5] },
    );
    io.observe(spot);

    /*
     * ⚠ HAZIR OLMADAN `play()` SESSİZCE REDDEDİLİYOR.
     *
     * `preload="metadata"` ile video ilk anda oynatılabilir
     * durumda değil. Gözlemci görünürlüğü yakalayıp `play()`
     * çağırıyor, tarayıcı reddediyor ve `.catch()` hatayı
     * yutuyor — video hiç başlamıyordu.
     *
     * Posteri olan videolarda sorun görünmüyordu çünkü poster
     * karesi ekranda duruyor ve "başlamış" gibi algılanıyordu.
     * Posteri olmayan (yazarın yüklediği) videolarda siyah kutu
     * kalıyordu — bu yüzden yalnızca videosu olan haberlerde
     * fark ediliyordu.
     *
     * Video oynatılabilir hâle geldiğinde, hâlâ görünürse ve
     * kullanıcı elle durdurmadıysa tekrar deneniyor.
     */
    const hazirOlunca = () => {
      if (!autoPlayMuted || pausedByUser || !el.paused) return;

      const r = spot.getBoundingClientRect();
      const gorunur =
        r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.25;
      if (gorunur) void el.play().catch(() => undefined);
    };

    el.addEventListener("canplay", hazirOlunca);
    el.addEventListener("loadeddata", hazirOlunca);

    return () => {
      io.disconnect();
      el.removeEventListener("canplay", hazirOlunca);
      el.removeEventListener("loadeddata", hazirOlunca);
    };
  }, [autoPlayMuted, allowMini, pausedByUser, miniClosed]);

  // ---- Video olayları ----------------------------------------
  useEffect(() => {
    const el = video.current;
    if (!el) return;

    const onTime = () => {
      if (!scrubbing) setTime(el.currentTime);
      if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1));
    };
    const onMeta = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
      setReady(true);
    };
    const onPlay = () => { setPlaying(true); setWaiting(false); pauseOthers(uid); };
    const onPause = () => setPlaying(false);
    const onVol = () => { setMuted(el.muted); setVolume(el.volume); };
    const onEnd = () => { setPlaying(false); setMini(false); };
    const onWait = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("progress", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("canplay", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("volumechange", onVol);
    el.addEventListener("ended", onEnd);
    el.addEventListener("waiting", onWait);
    el.addEventListener("playing", onPlaying);

    // Kaynak önbellekten anında hazır geldiyse olay kaçmasın
    if (el.readyState >= 1) onMeta();

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("progress", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("canplay", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("volumechange", onVol);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("waiting", onWait);
      el.removeEventListener("playing", onPlaying);
    };
  }, [scrubbing, uid]);

  // ---- Tam ekran: sesi otomatik aç ----------------------------
  useEffect(() => {
    const onFs = () => {
      const on = document.fullscreenElement === box.current;
      setFull(on);
      const el = video.current;
      if (on && el?.muted) {
        el.muted = false;
        if (el.volume === 0) el.volume = 1;
        setMuted(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function playPause(unmute = false) {
    const el = video.current;
    if (!el) return;
    armHide();
    if (unmute && !el.paused && el.muted) {
      el.muted = false;
      if (el.volume === 0) el.volume = 1;
      setMuted(false);
      return;
    }
    if (el.paused) {
      setPausedByUser(false);
      pauseOthers(uid);
      void el.play().catch(() => undefined);
    } else {
      setPausedByUser(true);
      el.pause();
    }
  }

  // ---- İlerleme çubuğu ---------------------------------------
  const seekTo = (clientX: number) => {
    const el = video.current;
    const r = bar.current?.getBoundingClientRect();
    if (!el || !r || r.width === 0) return;
    const d = Number.isFinite(el.duration) ? el.duration : duration;
    if (!d) return;
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * d;
    setTime(t);
    el.currentTime = t;
  };

  function onBarDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    // İşaretçiyi yakala: parmak çubuğun dışına taşsa da olaylar gelsin.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* yok say */ }
    setScrubbing(true);
    seekTo(e.clientX);
    armHide();
  }
  function onBarMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    e.preventDefault();
    seekTo(e.clientX);
  }
  function onBarUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* yok say */ }
    setScrubbing(false);
  }

  function toggleMute() {
    const el = video.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted && el.volume === 0) el.volume = 1;
    setMuted(el.muted);
    armHide();
  }

  async function toggleFull() {
    const t = box.current;
    if (!t) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await t.requestFullscreen().catch(() => undefined);
  }

  function onKey(e: React.KeyboardEvent) {
    const el = video.current;
    if (!el) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); playPause(); }
    else if (e.key === "ArrowRight") el.currentTime = Math.min(duration, el.currentTime + 5);
    else if (e.key === "ArrowLeft") el.currentTime = Math.max(0, el.currentTime - 5);
    else if (e.key === "m") toggleMute();
    else if (e.key === "f") void toggleFull();
    else return;
    armHide();
  }

  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  const bufPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;
  const volIcon = muted || volume === 0 ? "volumeMute" : volume < 0.5 ? "volumeLow" : "volumeHigh";
  const uiOn = showUi || !playing || scrubbing;

  const ctrl: React.CSSProperties = {
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, width: 32, height: 32, borderRadius: 8,
  };

  /**
   * Mini moddayken kutuya ölçü VERİLMEZ — hepsi `.kb-mini`
   * sınıfından gelir. Inline ölçü sınıfı ezer ve oynatıcı
   * tüm ekranı kaplar.
   */
  const boxStyle: React.CSSProperties = mini
    ? { background: "#000", overflow: "hidden", outline: "none" }
    : {
        position: "relative", width: "100%", height: "100%",
        background: "#000", borderRadius: full ? 0 : rounded,
        overflow: "hidden", outline: "none",
      };

  return (
    <>
      <div
        ref={holder}
        style={{
          position: "relative",
          width: "100%",
          // Yükseklik HER ZAMAN belli: kontroller asla çökmez.
          aspectRatio: "16 / 9",
          maxHeight,
          borderRadius: rounded,
          background: mini ? "var(--s2)" : "transparent",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {mini && (
          <span
            style={{
              color: "var(--mu)", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8, padding: 12, textAlign: "center",
            }}
          >
            <Icon name="pip" size={16} />
            Video küçük oynatıcıda
          </span>
        )}

        <div
          ref={box}
          className={mini ? "kb-mini" : undefined}
          onMouseMove={armHide}
          onMouseLeave={() => playing && setShowUi(false)}
          onTouchStart={armHide}
          onKeyDown={onKey}
          tabIndex={0}
          style={boxStyle}
        >
          <video
            ref={video}
            src={src}
            poster={poster ?? undefined}
            muted={muted}
            playsInline
            /*
              ⚠ OTOMATİK OYNAYACAKSA `auto`.
              `metadata` yalnızca süre/boyut indiriyor; `play()`
              çağrıldığında yeterli veri olmadığı için reddediliyordu.
            */
            preload={autoPlayMuted ? "auto" : "metadata"}
            onClick={() => playPause(true)}
            style={{
              width: "100%", height: "100%",
              objectFit: contain && !mini ? "contain" : "cover",
              cursor: "pointer", display: "block", background: "#000",
            }}
          />

          {/* yükleniyor */}
          {(waiting || !ready) && (
            <span
              aria-hidden
              style={{
                position: "absolute", inset: 0, margin: "auto",
                width: 34, height: 34, borderRadius: 999,
                border: "2.5px solid rgba(255,255,255,.25)",
                borderTopColor: "#fff",
                animation: "kbSpin .8s linear infinite",
              }}
            />
          )}

          {mini && (
            <>
            <button
              data-mini-kapat
              onClick={() => { setMini(false); setMiniClosed(true); video.current?.pause(); }}
              aria-label="Küçük oynatıcıyı kapat"
              style={{
                position: "absolute", top: 6, insetInlineEnd: 6,
                width: 26, height: 26, borderRadius: 999,
                background: "rgba(0,0,0,.7)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4,
                border: "none", cursor: "pointer",
                /* Oynat düğmesiyle birlikte beliriyor */
                opacity: uiOn ? 1 : 0,
                transition: "opacity .2s ease",
                pointerEvents: uiOn ? "auto" : "none",
              }}
            >
              {/* Kendi kapatma ikonumuz — beyaza çevriliyor */}
              <OzelIkon ad="close" size={14} renk="beyaz" />
            </button>

            {/*
              ⚠ MİNİ MODDA TEK DÜĞME: OYNAT / DURAKLAT.
              Ses, süre ve tam ekran düğmeleri 200 piksellik
              kutuda üst üste biniyordu. Ortada tek düğme kalıyor.
            */}
            {/*
              ⚠ ÜZERİNE GELİNCE BELİRİYOR.
              Sürekli görünürken videonun ortasını kapatıyordu.
              Oynatılmıyorken her zaman açık — okur neye
              basacağını görmeli.
            */}
            <button
              onClick={(e) => { e.stopPropagation(); playPause(); }}
              aria-label={playing ? "Duraklat" : "Oynat"}
              style={{
                position: "absolute", inset: 0, margin: "auto",
                width: 46, height: 46, borderRadius: 999,
                background: "rgba(0,0,0,.55)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: "pointer", zIndex: 3,
                backdropFilter: "blur(4px)",
                opacity: uiOn ? 1 : 0,
                transform: uiOn ? "scale(1)" : "scale(.9)",
                transition: "opacity .2s ease, transform .2s ease",
                pointerEvents: uiOn ? "auto" : "none",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                {playing
                  ? <path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z" />
                  : <path d="M8 5.1v13.8c0 .8.9 1.3 1.5.8l10-6.9c.6-.4.6-1.2 0-1.6l-10-6.9c-.6-.5-1.5 0-1.5.8Z" />}
              </svg>
            </button>
            </>
          )}

          {!playing && ready && !mini && (
            <button
              onClick={() => playPause()}
              aria-label="Oynat"
              style={{
                position: "absolute", inset: 0, margin: "auto",
                width: 72, height: 72, borderRadius: 999,
                background: "rgba(255,255,255,.16)",
                border: "1.5px solid rgba(255,255,255,.5)",
                backdropFilter: "blur(6px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
              }}
            >
              <Icon name="play" size={26} strokeWidth={2.4} color="#fff" />
            </button>
          )}

          {playing && muted && autoPlayMuted && !mini && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              style={{
                position: "absolute", insetInlineEnd: 12, top: 12,
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 13px", borderRadius: 999,
                background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
                color: "#fff", fontSize: 12.5, fontWeight: 700, zIndex: 2,
              }}
            >
              <Icon name="volumeMute" size={15} color="#fff" />
              Sesi aç
            </button>
          )}

          {/*
            Kontroller — kutunun İÇİNDE, sabit yükseklikte.

            ⚠ MİNİ MODDA HİÇ ÇİZİLMİYOR.
            Süre çubuğu, ses ve tam ekran düğmeleri 280
            piksellik kutuda üst üste biniyordu. Mini modda
            yalnızca ortadaki oynat/duraklat ve kapatma var.
          */}
          {!mini && (
          <div
            className="kb-ctl"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", insetInline: 0, bottom: 0, zIndex: 4,
              padding: mini ? "20px 8px 6px" : "30px 12px 8px",
              background: "linear-gradient(transparent, rgba(0,0,0,.85))",
              opacity: uiOn ? 1 : 0,
              transform: uiOn ? "translateY(0)" : "translateY(10px)",
              transition: "opacity .22s ease, transform .22s ease",
              pointerEvents: uiOn ? "auto" : "none",
            }}
          >
            <div
              ref={bar}
              onPointerDown={onBarDown}
              onPointerMove={onBarMove}
              onPointerUp={onBarUp}
              onPointerCancel={onBarUp}
              role="slider"
              aria-label="İlerleme"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration) || 0}
              aria-valuenow={Math.round(time)}
              tabIndex={0}
              style={{
                position: "relative", height: 20, display: "flex", alignItems: "center",
                cursor: "pointer", touchAction: "none", userSelect: "none",
              }}
            >
              <div
                style={{
                  position: "relative", width: "100%",
                  height: scrubbing ? 6 : 4, borderRadius: 99,
                  background: "rgba(255,255,255,.28)", transition: "height .12s ease",
                }}
              >
                <div style={{ position: "absolute", insetBlock: 0, insetInlineStart: 0, width: `${bufPct}%`, background: "rgba(255,255,255,.38)", borderRadius: 99 }} />
                <div style={{ position: "absolute", insetBlock: 0, insetInlineStart: 0, width: `${pct}%`, background: "#fff", borderRadius: 99 }} />
                <div
                  style={{
                    position: "absolute", top: "50%", insetInlineStart: `${pct}%`,
                    width: scrubbing ? 15 : 11, height: scrubbing ? 15 : 11,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 999, background: "#fff",
                    boxShadow: "0 1px 6px rgba(0,0,0,.55)",
                    transition: "width .12s ease, height .12s ease",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex", alignItems: "center", gap: mini ? 2 : 6,
                minHeight: 32,
              }}
            >
              <button onClick={() => playPause()} aria-label={playing ? "Duraklat" : "Oynat"} style={ctrl}>
                <Icon name={playing ? "pause" : "play"} size={17} strokeWidth={2} color="#fff" />
              </button>

              <button onClick={toggleMute} aria-label={muted ? "Sesi aç" : "Sesi kapat"} style={ctrl}>
                <Icon name={volIcon} size={17} strokeWidth={1.8} color="#fff" />
              </button>

              {!mini && (
                <input
                  type="range"
                  min={0} max={1} step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const el = video.current;
                    if (!el) return;
                    const v = Number(e.target.value);
                    el.volume = v;
                    el.muted = v === 0;
                    setVolume(v);
                    setMuted(v === 0);
                  }}
                  aria-label="Ses düzeyi"
                  className="kb-vol"
                  style={{ accentColor: "#fff", flexShrink: 0 }}
                />
              )}

              <span
                className="kb-time"
                style={{
                  color: "rgba(255,255,255,.88)", fontSize: mini ? 10.5 : 12,
                  fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  marginInlineStart: "auto", flexShrink: 0, whiteSpace: "nowrap",
                }}
              >
                {fmt(time)} / {fmt(duration)}
              </span>

              <button onClick={() => void toggleFull()} aria-label={full ? "Tam ekrandan çık" : "Tam ekran"} style={ctrl}>
                <Icon name={full ? "fullscreenExit" : "fullscreen"} size={16} strokeWidth={1.8} color="#fff" />
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes kbSpin { to { transform: rotate(360deg) } }
        @keyframes kbMiniIn {
          from { transform: translateY(14px) scale(.94); opacity: 0 }
          to   { transform: translateY(0) scale(1); opacity: 1 }
        }

        /* KÜÇÜK OYNATICI
           Tüm ölçüler burada. Bileşen mini moddayken inline ölçü
           vermiyor; verse sınıfı ezer ve ekranı kaplardı. */
        .kb-mini {
          position: fixed !important;
          inset-inline-end: 16px;
          bottom: 16px;
          top: auto !important;
          inset-inline-start: auto !important;
          width: 300px !important;
          height: auto !important;
          aspect-ratio: 16 / 9;
          border-radius: 14px;
          z-index: 190;
          box-shadow: 0 18px 50px rgba(0,0,0,.6);
          animation: kbMiniIn .26s cubic-bezier(.32,.72,0,1);
        }
        @media (max-width: 640px) {
          .kb-mini {
            width: 190px !important;
            inset-inline-end: 10px;
            bottom: calc(70px + env(safe-area-inset-bottom));
            border-radius: 12px;
          }
        }

        /* Ses kaydırıcısı dar kutuda yer kaplamasın */
        .kb-vol { width: 70px; height: 4px; }
        .kb-vol::-webkit-slider-thumb {
          appearance: none; width: 11px; height: 11px;
          border-radius: 999px; background: #fff;
        }
        @media (max-width: 520px) { .kb-vol { display: none; } }
      `}</style>
    </>
  );
}
