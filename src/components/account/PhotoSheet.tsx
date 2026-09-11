"use client";
import { useCallback, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle, r2Vazgec } from "@/lib/upload";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useToast } from "@/components/ui/Toast";
import Sheet from "@/components/ui/Sheet";
import Icon from "@/components/ui/Icon";
import { PrimaryButton, SecondaryButton } from "@/components/auth/Steps";

/**
 * FOTOĞRAF DÜZENLEME TABAKASI
 *
 * Tek bileşen hem profil hem kapak fotoğrafı için kullanılıyor;
 * ikisi de aynı adımlardan geçiyor:
 *
 *   seç → kırp → kaydet
 *
 * Fotoğraf varsa "değiştir" ve "kaldır", yoksa yalnızca "ekle".
 *
 * KIRPMA TARAYICIDA. Ham dosya yüklenmiyor: 5 MB'lık telefon
 * fotoğrafı yerine ~60 KB gidiyor, sunucuda görüntü işleme
 * gerekmiyor ve EXIF (konum dahil) korunmuyor.
 */
type Kind = "avatar" | "cover";

const SPEC: Record<Kind, { w: number; h: number; round: boolean; box: number }> = {
  // Profil: kare, dairesel kırpma
  avatar: { w: 512, h: 512, round: true, box: 260 },
  // Kapak: geniş bant
  cover:  { w: 1600, h: 533, round: false, box: 300 },
};

const MAX_MB = 10;

export default function PhotoSheet({
  open, onClose, kind, userId, current, dict, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  kind: Kind;
  userId: string;
  current: string | null;
  dict: Dictionary;
  onSaved: (url: string | null) => void;
}) {
  const spec = SPEC[kind];
  const t = useToast();

  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (!f.type.startsWith("image/")) { t.error(dict.profile.onlyImage); return; }
    if (f.size > MAX_MB * 1024 * 1024) { t.error(dict.profile.tooLarge); return; }

    setZoom(1);
    setPos({ x: 0, y: 0 });
    setSrc(URL.createObjectURL(f));
  }

  const onMove = useCallback((x: number, y: number) => {
    if (!drag.current) return;
    setPos({ x: x - drag.current.x, y: y - drag.current.y });
  }, []);

  /** Görünen yerleşimi hedef ölçüye taşı */
  async function makeBlob(): Promise<Blob | null> {
    const img = imgRef.current;
    if (!img) return null;

    const canvas = document.createElement("canvas");
    canvas.width = spec.w;
    canvas.height = spec.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, spec.w, spec.h);

    const boxW = spec.box;
    const boxH = spec.round ? spec.box : spec.box * (spec.h / spec.w);
    const scaleX = spec.w / boxW;
    const scaleY = spec.h / boxH;

    const base = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const dw = img.naturalWidth * base * zoom * scaleX;
    const dh = img.naturalHeight * base * zoom * scaleY;
    const dx = (spec.w - dw) / 2 + pos.x * scaleX;
    const dy = (spec.h - dh) / 2 + pos.y * scaleY;

    ctx.drawImage(img, dx, dy, dw, dh);
    return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.88));
  }

  async function save() {
    setBusy(true);
    try {
      const blob = await makeBlob();
      if (!blob) throw new Error(dict.common.error);

      // R2'ye doğrudan; klasör sunucuda oturumdan belirlenir
      const { key, url } = await r2Yukle(blob, "avatar", `${kind}.jpg`);

      const sb = supabaseBrowser();
      const { data, error } = await sb.rpc(
        kind === "avatar" ? "set_avatar" : "set_cover",
        { p_key: key },
      );
      if (error) {
        await r2Vazgec(key);   // kayıt olmadıysa dosya yetim kalmasın
        throw error;
      }

      /*
       * ⚠ ESKİ DOSYA ANINDA SİLİNİYOR.
       *
       * Önce yalnızca silme kuyruğuna giriyordu ve bot'un
       * temizleyicisini bekliyordu; bot durmuşsa eski profil
       * fotoğrafı saatlerce adresinden erişilebilir kalıyordu.
       *
       * RPC değişen eski anahtarı döndürüyor; hemen siliniyor.
       * Kuyruk yedek olarak yine dolduruluyor — bu istek
       * başarısız olursa bot yakalıyor.
       */
      const eski = (data as { eski?: string | null } | null)?.eski;
      if (eski) await r2Vazgec(eski);

      onSaved(url);
      setSrc(null);
      onClose();
      t.success(dict.profile.photoSaved);
    } catch (e) {
      t.error(e instanceof Error ? e.message : dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc(
      kind === "avatar" ? "set_avatar" : "set_cover",
      { p_key: null },
    );
    setBusy(false);
    if (error) { t.error(error.message); return; }

    /* Kaldırılan fotoğraf da hemen siliniyor */
    const eski = (data as { eski?: string | null } | null)?.eski;
    if (eski) await r2Vazgec(eski);
    onSaved(null);
    onClose();
  }

  const title = kind === "avatar" ? dict.profile.profilePhoto : dict.profile.coverPhoto;

  return (
    <Sheet
      open={open}
      onClose={() => { setSrc(null); onClose(); }}
      title={title}
      maxWidth={kind === "cover" ? 520 : 440}
    >
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />

      {/* ---- seçim yapılmadıysa: mevcut fotoğraf + eylemler ---- */}
      {!src ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{
            display: "grid", placeItems: "center",
            background: "var(--s2)", borderRadius: 16, padding: 22,
          }}>
            {current ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={current}
                alt=""
                style={{
                  width: kind === "avatar" ? 120 : "100%",
                  aspectRatio: kind === "avatar" ? "1 / 1" : "3 / 1",
                  borderRadius: kind === "avatar" ? 999 : 12,
                  objectFit: "cover",
                }}
              />
            ) : (
              <span style={{
                display: "grid", placeItems: "center",
                width: kind === "avatar" ? 120 : "100%",
                aspectRatio: kind === "avatar" ? "1 / 1" : "3 / 1",
                borderRadius: kind === "avatar" ? 999 : 12,
                background: "var(--s3)", color: "var(--mu)",
              }}>
                <Icon name="camera" size={26} />
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <PrimaryButton onClick={() => fileRef.current?.click()}>
              {current ? dict.profile.changePhoto : dict.profile.addPhoto}
            </PrimaryButton>

            {current && (
              <button
                onClick={remove}
                disabled={busy}
                className="kb-primary"
                style={{
                  height: 52, borderRadius: 14,
                  background: "rgba(229,72,77,.12)", color: "#E5484D",
                  fontSize: 15.5, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {dict.profile.removePhoto}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ---- kırpma ---- */
        <div style={{ display: "grid", gap: 20 }}>
          <div
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            }}
            onPointerMove={(e) => onMove(e.clientX, e.clientY)}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            style={{
              width: spec.box,
              height: spec.round ? spec.box : spec.box * (spec.h / spec.w),
              maxWidth: "100%",
              margin: "0 auto",
              position: "relative", overflow: "hidden",
              borderRadius: spec.round ? 999 : 14,
              background: "#111", cursor: "grab", touchAction: "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              style={{
                position: "absolute", left: "50%", top: "50%",
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
                minWidth: "100%", minHeight: "100%",
                objectFit: "cover", userSelect: "none",
              }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="searchAlt" size={16} />
            <input
              type="range" min={1} max={3} step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--tx)" }}
              aria-label={dict.profile.zoom}
            />
          </label>

          <div style={{ display: "grid", gap: 10 }}>
            <PrimaryButton onClick={save} disabled={busy}>
              {busy ? dict.common.loading : dict.auth.save}
            </PrimaryButton>
            <SecondaryButton onClick={() => setSrc(null)} full>
              {dict.common.back}
            </SecondaryButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}
