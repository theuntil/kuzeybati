"use client";
import { useRef, useState } from "react";
import { r2Yukle } from "@/lib/upload";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useToast } from "@/components/ui/Toast";
import Icon from "@/components/ui/Icon";

export interface MediaItem {
  url: string;
  /*
   * ⚠ DEPOLAMA ANAHTARI DA TAŞINIYOR.
   *
   * Sunucu bu medyayı `media` tablosuna yazarken `storage_key`
   * alanına ihtiyaç duyuyor. Önce yalnızca `url` gönderiliyordu
   * ve anahtar adresten geri çıkarılmak zorunda kalıyordu —
   * CDN alan adı değişirse kırılacak bir varsayım.
   *
   * Eski kayıtlarda bu alan yok; sunucu o durumda adresten
   * çıkarmaya devam ediyor.
   */
  key?: string;
  type: "image" | "video";
  caption?: string;
  bytes: number;
}

const MAX_ITEMS = 10;
const MAX_TOTAL = 100 * 1024 * 1024;   // toplam 100 MB

/**
 * HABER MEDYASI
 *
 * Kapak ve galeri için ortak yükleyici. Dosyalar Supabase
 * Storage'daki `articles` kovasına gidiyor; bot medyası
 * (R2 + `media` tablosu) ayrı kalıyor ki iki hat karışmasın.
 *
 * SINIRLAR KULLANICIYA GÖSTERİLMEZ, aşılınca söylenir:
 * kural listesi okumak yerine denemek daha doğal.
 *   • en fazla 10 öğe
 *   • toplam 100 MB
 *
 * Görseller yüklemeden önce 1600px'e küçültülüyor; telefon
 * fotoğrafı 5 MB yerine ~200 KB gidiyor. Videoya dokunulmuyor.
 */
export default function MediaUploader({
  items, onChange, dict, cover, onCoverChange,
}: {
  items: MediaItem[];
  onChange: (v: MediaItem[]) => void;
  dict: Dictionary;
  /** Kapak ayrı tutuluyor: galeriden bağımsız */
  cover: string | null;
  onCoverChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const t = useToast();
  /* Yükleme yüzdesi — büyük videoda kullanıcı donmuş sanmasın */
  const [yuzde, setYuzde] = useState<number | null>(null);

  const totalBytes = items.reduce((n, m) => n + m.bytes, 0);

  async function upload(file: File): Promise<MediaItem | null> {
    const isVideo = file.type.startsWith("video/");
    const blob = isVideo ? file : await shrink(file).catch(() => file);

    /*
     * R2'ye doğrudan. Yazar dosyaları `editor/{userId}/` altına
     * gider; sunucu klasörü oturumdan belirler.
     */
    try {
      const { url, key } = await r2Yukle(blob, "editor", file.name, setYuzde);
      return { url, key, type: isVideo ? "video" : "image", bytes: blob.size };
    } catch (err) {
      t.error(`${file.name}: ${err instanceof Error ? err.message : "yüklenemedi"}`);
      return null;
    } finally {
      setYuzde(null);
    }
  }

  async function addGallery(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);

    let next = [...items];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_ITEMS) {
        t.error(dict.editor.maxItems);
        break;
      }
      const size = next.reduce((n, m) => n + m.bytes, 0);
      if (size + file.size > MAX_TOTAL) {
        t.error(dict.editor.maxSize);
        break;
      }
      const item = await upload(file);
      if (item) next = [...next, item];
    }

    onChange(next);
    setBusy(false);
  }

  async function addCover(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { t.error(dict.profile.onlyImage); return; }

    setBusy(true);
    const item = await upload(f);
    setBusy(false);
    if (item) onCoverChange(item.url);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* ---- kapak ---- */}
      <div>
        <span className="eyebrow muted" style={{ display: "block", marginBottom: 8 }}>
          {dict.editor.cover}
        </span>

        <button
          type="button"
          onClick={() => coverRef.current?.click()}
          disabled={busy}
          style={{
            position: "relative", width: "100%", aspectRatio: "16 / 9",
            borderRadius: 14, overflow: "hidden",
            background: "var(--s2)",
            border: cover ? "1px solid var(--bd)" : "1.5px dashed var(--bd)",
            display: "grid", placeItems: "center", color: "var(--mu)",
          }}
        >
          {cover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{
                position: "absolute", insetInlineEnd: 10, top: 10,
                width: 32, height: 32, borderRadius: 999,
                background: "rgba(0,0,0,.55)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="camera" size={14} color="#fff" />
              </span>
            </>
          ) : (
            <span style={{ display: "grid", gap: 8, placeItems: "center" }}>
              <Icon name="camera" size={24} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{dict.editor.addCover}</span>
            </span>
          )}
        </button>

        {cover && (
          <button
            type="button"
            onClick={() => onCoverChange(null)}
            style={{
              fontSize: 12.5, fontWeight: 600, color: "var(--dn)", marginTop: 8,
            }}
          >
            {dict.profile.removePhoto}
          </button>
        )}

        <input ref={coverRef} type="file" accept="image/*"
               onChange={(e) => { void addCover(e.target.files); e.target.value = ""; }}
               style={{ display: "none" }} />
      </div>

      {/* ---- galeri ---- */}
      <div>
        <span className="eyebrow muted" style={{ display: "block", marginBottom: 8 }}>
          {dict.editor.media} {items.length > 0 && `(${items.length}/${MAX_ITEMS})`}
        </span>

        {items.length > 0 && (
          <div style={{
            display: "grid", gap: 8, marginBottom: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(min(96px,100%),1fr))",
          }}>
            {items.map((m, i) => (
              <div key={m.url} style={{ position: "relative", aspectRatio: "1 / 1" }}>
                {m.type === "video" ? (
                  <span style={{
                    width: "100%", height: "100%", borderRadius: 11,
                    background: "var(--s3)", display: "grid", placeItems: "center",
                    color: "var(--mu)",
                  }}>
                    <Icon name="video" size={22} />
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.url} alt="" style={{
                    width: "100%", height: "100%", objectFit: "cover", borderRadius: 11,
                  }} />
                )}
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  aria-label={dict.common.delete}
                  style={{
                    position: "absolute", insetInlineEnd: 4, top: 4,
                    width: 24, height: 24, borderRadius: 999,
                    background: "rgba(0,0,0,.6)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icon name="close" size={11} strokeWidth={2.4} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy || items.length >= MAX_ITEMS}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", height: 48, borderRadius: 12,
            background: "var(--s2)", color: "var(--tx)",
            fontSize: 14, fontWeight: 700,
            opacity: busy || items.length >= MAX_ITEMS ? 0.5 : 1,
          }}
        >
          <Icon name="plus" size={16} />
          {busy ? dict.common.loading : dict.editor.addMedia}
        </button>

        <input ref={galleryRef} type="file" accept="image/*,video/*" multiple
               onChange={(e) => { void addGallery(e.target.files); e.target.value = ""; }}
               style={{ display: "none" }} />

        {totalBytes > 0 && (
          <p style={{ fontSize: 11.5, color: "var(--mu)", marginTop: 8 }}>
            {(totalBytes / 1048576).toFixed(1)} MB
          </p>
        )}
      </div>
    </div>
  );
}

/** Görseli 1600px'e küçült — telefon fotoğrafı olduğu gibi gitmesin */
function shrink(file: File): Promise<Blob> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { rej(new Error("canvas yok")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("boş"))), "image/jpeg", 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("okunamadı")); };
    img.src = url;
  });
}
