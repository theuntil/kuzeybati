"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Sesli anlatım — tarayıcının kendi konuşma sentezini kullanır
 * (Web Speech API). Ek servis, ek maliyet ve ek istek yok.
 *
 * Desteklemeyen tarayıcıda kutu hiç görünmez; çalışmayan bir
 * düğme göstermek kullanıcıyı yanıltır.
 */
export default function ListenBar({
  text, dict, enabled,
}: {
  text: string;
  dict: Dictionary;
  enabled: boolean;
}) {
  // Sunucuda da basılır: kutu sonradan "belirip" düzeni kaydırmasın.
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const utter = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Desteklemeyen tarayıcıda kutuyu kaldır; çalışmayan düğme yanıltıcı olur.
    setSupported("speechSynthesis" in window);
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* yok sayılır */ } };
  }, []);

  if (!enabled || !supported || !text) return null;

  // Konuşma hızı ~150 kelime/dk
  const words = text.trim().split(/\s+/).length;
  const total = Math.max(1, Math.round((words / 150) * 60));
  const left = Math.max(0, Math.round(total * (1 - pct / 100)));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function toggle() {
    const synth = window.speechSynthesis;

    /*
     * ⚠ `cancel()` DEĞİL, `pause()`.
     *
     * `cancel()` okumayı silip kuyruğu boşaltıyor; tekrar
     * başlatınca haber BAŞTAN okunuyordu. `pause()` yerinde
     * bekletiyor, `resume()` kaldığı yerden sürdürüyor.
     */
    if (playing) {
      synth.pause();
      setPlaying(false);
      return;
    }

    /*
     * Duraklatılmış bir okuma varsa yenisini başlatma —
     * kaldığı yerden devam et.
     */
    if (synth.paused && utter.current) {
      synth.resume();
      setPlaying(true);
      return;
    }

    const u = new SpeechSynthesisUtterance(text.slice(0, 30000));
    u.lang = "tr-TR";
    u.rate = 1;
    u.onboundary = (e) => {
      if (e.charIndex) setPct(Math.min(100, (e.charIndex / text.length) * 100));
    };
    u.onend = () => {
      setPlaying(false);
      setPct(0);
      /* Bitti: sonraki basışta baştan başlasın */
      utter.current = null;
    };
    utter.current = u;
    synth.speak(u);
    setPlaying(true);
  }

  return (
    <div style={{ marginTop: 16, display: "flex", alignItems: "stretch", gap: 10 }}>
      <div
        style={{
          flex: 1, minWidth: 0, background: "var(--s1)",
          border: "1px solid var(--bd)", borderRadius: 16,
          padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <button
          onClick={toggle}
          aria-label={playing ? dict.article.stop : dict.article.listen}
          style={{
            width: 44, height: 44, borderRadius: 999,
            background: "var(--tx)", color: "var(--bg)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <Icon name={playing ? "close" : "play"} size={15} strokeWidth={2.2} />
        </button>

        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{dict.article.listen}</div>
          <div
            style={{
              height: 4, borderRadius: 99, background: "var(--s3)",
              marginTop: 10, overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 4, width: `${pct}%`, background: "var(--tx)",
                borderRadius: 99, transition: "width .3s linear",
              }}
            />
          </div>
          <div
            style={{
              display: "flex", justifyContent: "space-between", marginTop: 7,
              fontSize: 11.5, color: "var(--mu)", fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>{mmss(total - left)}</span>
            <span>−{mmss(left)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
