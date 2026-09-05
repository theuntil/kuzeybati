"use client";
import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/media";

/* ══════════════════════════════════════════════════════════════
   UYGULAMA TANITIM KARTI

   Akışta her üç haberde bir çıkıyor. Mobilde App Store
   sayfası düzeninde, masaüstünde geniş tanıtım.
   ══════════════════════════════════════════════════════════════ */

export interface UygulamaAyar {
  ad: string | null;
  slogan: string | null;
  simge: string | null;
  ekranlar: string[];
  appStore: string | null;
  playStore: string | null;
  appGallery: string | null;
  appStoreRozet: string | null;
  playStoreRozet: string | null;
  appGalleryRozet: string | null;
  /** App Store tarzı istatistik şeridi — en fazla 4 sütun */
  istatistik: { ust: string; orta: string; alt: string }[];
}

/**
 * Cihaza göre mağaza.
 *
 * ⚠ SUNUCUDA ÇALIŞMIYOR.
 * `navigator` yalnızca tarayıcıda var; sunucuda çağrılırsa
 * sayfa çöker. Bu yüzden etki içinde okunuyor.
 */
function magazaSec(a: UygulamaAyar): { url: string; ad: string } | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";

  if (/android/i.test(ua)) {
    if (a.playStore) return { url: a.playStore, ad: "Google Play" };
    if (a.appGallery) return { url: a.appGallery, ad: "AppGallery" };
  }
  if (/iphone|ipad|ipod/i.test(ua) && a.appStore) {
    return { url: a.appStore, ad: "App Store" };
  }
  /* Bilinmeyen cihaz: elde ne varsa */
  if (a.appStore) return { url: a.appStore, ad: "App Store" };
  if (a.playStore) return { url: a.playStore, ad: "Google Play" };
  if (a.appGallery) return { url: a.appGallery, ad: "AppGallery" };
  return null;
}

export default function UygulamaKarti({
  ayar, mobil, dar,
}: {
  ayar: UygulamaAyar;
  mobil: boolean;
  dar: boolean;
}) {
  const [magaza, setMagaza] = useState<{ url: string; ad: string } | null>(null);

  useEffect(() => { setMagaza(magazaSec(ayar)); }, [ayar]);

  const simge = assetUrl(ayar.simge);
  const ekranlar = ayar.ekranlar.map((k) => assetUrl(k)).filter(Boolean) as string[];
  const ad = ayar.ad ?? "Kuzeybatı Haber";

  const indirDugmesi = (genis: boolean) => (
    <a
      href={magaza?.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { if (!magaza) e.preventDefault(); }}
      className="kb-indir"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 7, width: genis ? "100%" : undefined,
        padding: genis ? "15px 26px" : "12px 24px",
        borderRadius: 999, background: "#0a84ff", color: "#fff",
        fontSize: genis ? 15.5 : 14.5, fontWeight: 700,
        textDecoration: "none", border: "none",
        opacity: magaza ? 1 : .5, cursor: magaza ? "pointer" : "default",
      }}
    >
      Şimdi indir
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden>
        <path d="M12 4v12M6 12l6 6 6-6" />
      </svg>
    </a>
  );

  /* Masaüstünde üç mağaza rozeti birden */
  const rozetler = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {([
        { url: ayar.appStore,   rozet: ayar.appStoreRozet,   ad: "App Store" },
        { url: ayar.playStore,  rozet: ayar.playStoreRozet,  ad: "Google Play" },
        { url: ayar.appGallery, rozet: ayar.appGalleryRozet, ad: "AppGallery" },
      ].filter((m) => m.url)).map((m) => {
        const r = assetUrl(m.rozet);
        return (
          <a key={m.ad} href={m.url!} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", textDecoration: "none" }}>
            {r ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={r} alt={m.ad} style={{ height: 42, width: "auto", display: "block" }} />
            ) : (
              <span style={{
                display: "inline-flex", alignItems: "center", height: 42,
                padding: "0 18px", borderRadius: 10,
                background: "var(--s2)", border: "1px solid var(--bd)",
                color: "var(--tx)", fontSize: 13, fontWeight: 700,
              }}>
                {m.ad}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );

  const ekranSeridi = (yukseklik: number) => (
    ekranlar.length > 0 ? (
      <div style={{
        display: "flex", gap: 10, overflowX: "auto",
        paddingBottom: 4, scrollSnapType: "x proximity",
        /* Kaydırma çubuğu gizleniyor — akış içinde çirkin duruyor */
        scrollbarWidth: "none",
      }}>
        {ekranlar.map((s, i) => (
          <span key={i} style={{
            flexShrink: 0, height: yukseklik, aspectRatio: "9 / 19.5",
            borderRadius: 14, overflow: "hidden",
            background: "var(--s2)", scrollSnapAlign: "start",
            border: "1px solid rgba(255,255,255,.12)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s} alt="" loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </span>
        ))}
      </div>
    ) : null
  );

  /*
   * İSTATİSTİK ŞERİDİ
   *
   * App Store'daki düzenin aynısı: üstte küçük büyük harf
   * etiket, ortada büyük değer, altta küçük açıklama.
   * Sütunlar arasında ince ayraç var.
   */
  const istatistikSeridi = (koyu: boolean) => {
    const s = ayar.istatistik.slice(0, 4);
    if (!s.length) return null;

    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${s.length}, minmax(0, 1fr))`,
        borderTop: `1px solid ${koyu ? "rgba(255,255,255,.12)" : "var(--bd)"}`,
        borderBottom: `1px solid ${koyu ? "rgba(255,255,255,.12)" : "var(--bd)"}`,
        paddingBlock: 14,
      }}>
        {s.map((x, i) => (
          <div key={i} style={{
            textAlign: "center", minWidth: 0, paddingInline: 6,
            borderInlineStart: i === 0
              ? "none"
              : `1px solid ${koyu ? "rgba(255,255,255,.12)" : "var(--bd)"}`,
          }}>
            <div style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em",
              textTransform: "uppercase",
              color: koyu ? "rgba(255,255,255,.5)" : "var(--mu)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {x.ust}
            </div>
            <div style={{
              fontSize: 19, fontWeight: 700, marginTop: 5,
              color: koyu ? "rgba(255,255,255,.82)" : "var(--tx)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {x.orta}
            </div>
            <div style={{
              fontSize: 11, marginTop: 3,
              color: koyu ? "rgba(255,255,255,.5)" : "var(--mu)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {x.alt}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const baslik = (koyu: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
      <span style={{
        width: 68, height: 68, borderRadius: 16, flexShrink: 0,
        overflow: "hidden", background: koyu ? "rgba(255,255,255,.1)" : "var(--s2)",
        display: "grid", placeItems: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,.22)",
      }}>
        {simge ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={simge} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 26, fontWeight: 800, color: koyu ? "#fff" : "var(--tx)" }}>
            {ad.slice(0, 1)}
          </span>
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: "block", fontSize: 19, fontWeight: 800,
          color: koyu ? "#fff" : "var(--tx)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {ad}
        </span>
        <span style={{
          display: "block", fontSize: 13.5, marginTop: 3,
          color: koyu ? "rgba(255,255,255,.65)" : "var(--mu)",
        }}>
          {ayar.slogan ?? "Haberler cebinde"}
        </span>
      </span>
    </div>
  );

  /* ══════════════ MOBİL ══════════════ */
  if (mobil || dar) {
    return (
      <section
        data-sira="reklam"
        style={{
          height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always",
          background: "#0b0c0e", overflow: "hidden",
          display: "flex", flexDirection: "column",
          padding: "calc(72px + env(safe-area-inset-top)) 22px calc(30px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
        }}
      >
        {baslik(true)}

        {/* App Store tarzı istatistik şeridi — başlığın hemen altında */}
        <div style={{ marginTop: 18 }}>{istatistikSeridi(true)}</div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", marginBlock: 16 }}>
          {ekranSeridi(Math.min(360, Math.round(window.innerHeight * 0.42)))}
        </div>

        <div>
          {indirDugmesi(true)}
          <p style={{
            fontSize: 11.5, textAlign: "center", marginTop: 10,
            color: "rgba(255,255,255,.45)",
          }}>
            {magaza ? `${magaza.ad} üzerinden ücretsiz` : "Yakında"}
          </p>
        </div>
      </section>
    );
  }

  /* ══════════════ MASAÜSTÜ ══════════════ */
  return (
    <section
      data-sira="reklam"
      style={{
        height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always",
        display: "grid", gridTemplateColumns: "minmax(300px, 44%) minmax(0, 1fr)",
        background: "var(--bg)", overflow: "hidden",
      }}
    >
      {/* sol: tanıtım metni */}
      <div style={{
        padding: "74px 34px 34px 44px", overflowY: "auto",
        borderInlineEnd: "1px solid var(--bd)", minWidth: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        {baslik(false)}

        <div style={{ marginTop: 22 }}>{istatistikSeridi(false)}</div>

        <p style={{
          fontSize: 14.5, lineHeight: 1.65, color: "var(--tx)",
          opacity: .82, marginBlock: 22,
        }}>
          Son dakika bildirimleri, şehrinin haberleri ve video akışı —
          hepsi tek uygulamada. Reklamsız, hızlı ve ücretsiz.
        </p>

        {/*
          MAĞAZA SATIRLARI

          ⚠ ÖNCE YALNIZCA ROZET GÖRSELLERİ VARDI.
          Küçük rozetler yan yana dizilince ne olduğu
          anlaşılmıyordu. Artık her mağaza kendi yatay
          kutusunda: solda simge, sağda "Şimdi indir".
          Çerçeve yok, dolgu bol — kart hissi vermiyor.
        */}
        <div style={{ display: "grid", gap: 10 }}>
          {([
            { url: ayar.appStore,   rozet: ayar.appStoreRozet,   ad: "App Store" },
            { url: ayar.playStore,  rozet: ayar.playStoreRozet,  ad: "Google Play" },
            { url: ayar.appGallery, rozet: ayar.appGalleryRozet, ad: "AppGallery" },
          ].filter((m2) => m2.url)).map((m2) => {
            const r = assetUrl(m2.rozet);
            return (
              <a
                key={m2.ad}
                href={m2.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="kb-magaza"
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "18px 22px", borderRadius: 16,
                  background: "var(--s2)", border: "none",
                  textDecoration: "none", color: "var(--tx)",
                }}
              >
                <span style={{
                  display: "grid", placeItems: "center",
                  height: 34, minWidth: 34, flexShrink: 0,
                }}>
                  {r ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={r} alt="" style={{ height: 34, width: "auto", display: "block" }} />
                  ) : (
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m2.ad}</span>
                  )}
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block", fontSize: 14, fontWeight: 700,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {m2.ad}
                  </span>
                </span>

                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 18px", borderRadius: 999,
                  background: "#0a84ff", color: "#fff",
                  fontSize: 13.5, fontWeight: 700, flexShrink: 0,
                }}>
                  Şimdi indir
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden>
                    <path d="M12 4v12M6 12l6 6 6-6" />
                  </svg>
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {/* sağ: ekran görüntüleri */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 30, minWidth: 0, background: "var(--s1)",
      }}>
        {ekranlar.length > 0
          ? ekranSeridi(Math.min(520, 460))
          : (
            <span style={{ fontSize: 13.5, color: "var(--mu)" }}>
              Ekran görüntüsü eklenmemiş
            </span>
          )}
      </div>
    </section>
  );
}
