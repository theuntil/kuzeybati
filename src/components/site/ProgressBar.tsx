"use client";
import { useEffect, useRef } from "react";

/**
 * Okuma ilerleme çubuğu. State yerine doğrudan DOM'a yazıyoruz:
 * scroll her pikselde tetiklenir, setState her seferinde yeniden
 * render ettirir ve uzun haber sayfalarında kayma hissedilir olur.
 */
export default function ProgressBar() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div style={{ height: 2 }} aria-hidden>
      <div
        ref={ref}
        style={{ height: 2, width: 0, background: "var(--ac)", transition: "width .12s linear" }}
      />
    </div>
  );
}
