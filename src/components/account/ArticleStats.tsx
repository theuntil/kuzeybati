"use client";
import { useState } from "react";
import OnayPenceresi from "@/components/ui/OnayPenceresi";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, accountHref, type Locale, haberYolu } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useToast } from "@/components/ui/Toast";
import Icon from "@/components/ui/Icon";
import { pickImage, videoSrc, posterFor, assetUrl } from "@/lib/media";
import type { MediaRow } from "@/lib/types";
import { formatDate } from "@/lib/format";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   HABER GÖRÜNTÜLEME SAYFASI

   Masaüstü:
     üstte sağda   → görüntüle · düzenle · sil (ikon)
     sol sütun     → yazar · başlık · özet · içerik · medya
     sağ sütun     → durum · istatistikler · grafik
     altta tam gen → yorumlar (kendi yorumunu silebilir)

   Mobil: tek sütun, uygulama sıralaması — başlık önce.
   ══════════════════════════════════════════════════════════════ */

interface MediaLite {
  id: string; type: "image" | "video";
  storage_key: string | null; poster_key: string | null;
  variants: Record<string, unknown>;
  width: number | null; height: number | null;
}

export interface Detail {
  category_slug?: string | null;
  id: string; slug: string; title: string; summary: string | null;
  body: { type: "paragraph" | "heading"; text: string }[];
  status: string; published_at: string | null; created_at: string;
  edited_at?: string | null;
  cover_url: string | null;
  cover_media: MediaLite | null;
  medya: MediaLite[];
  category_name: string | null; city_name: string | null;
  author_name: string | null; author_avatar: string | null;
  /** AI'nın ürettiği anahtar kelimeler */
  anahtar_kelimeler?: string[] | null;
  view_count: number; views_24h: number;
  like_count: number; comment_count: number; save_count: number;
  daily: { gun: string; sayi: number }[];
  comments: {
    id: string; body: string; status: string;
    created_at: string; author_name: string;
  }[];
}

const DURUM: Record<string, { ad: string; renk: string; aciklama: string }> = {
  published: {
    ad: "Yayında", renk: "#30D158",
    aciklama: "Bu haber yayında. Sitede herkes görebilir.",
  },
  pending_review: {
    ad: "Onay bekliyor", renk: "#FF9F0A",
    aciklama: "Bu haber onay bekliyor. Yönetici onayladığında yayına girecek.",
  },
  rejected: {
    ad: "Reddedildi", renk: "#dc2626",
    aciklama: "Bu haber reddedildi. Düzenleyip kaydedersen tekrar onaya gönderilir.",
  },
  draft: { ad: "Taslak", renk: "var(--mu)", aciklama: "Bu haber taslak durumunda." },
};

export default function ArticleStats({
  detail, locale,
}: {
  detail: Detail;
  locale: Locale;
  dict: Dictionary;
}) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [comments, setComments] = useState(detail.comments);
  const [yorumSil, setYorumSil] = useState<string | null>(null);
  const [haberSil, setHaberSil] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);

  async function yorumuSil(id: string) {
    setBusy(id);
    const { error } = await sb.rpc("delete_own_comment", { p_comment_id: id });
    setBusy(null);
    if (error) { t.error("Yorum silinemedi"); return; }
    setComments((p) => p.filter((c) => c.id !== id));
    t.success("Yorum silindi");
  }

  /**
   * Yorumu onayla ya da reddet.
   *
   * ⚠ YETKİ VERİTABANINDA.
   * `yazar_yorum_karar` haberin sahibi olup olmadığını ve
   * yorumun hâlâ beklemede olup olmadığını kendisi kontrol
   * ediyor. Arayüzü atlatan biri de aynı duvara çarpıyor.
   */
  async function yorumKarar(id: string, onay: boolean) {
    setBusy(id);
    const { error } = await sb.rpc("yazar_yorum_karar", {
      p_comment_id: id,
      p_onay: onay,
    });
    setBusy(null);

    if (error) {
      t.error(
        error.message.includes("karara bağlanmış")
          ? "Bu yorum zaten karara bağlanmış"
          : "İşlem yapılamadı",
      );
      return;
    }

    /* Listede yerinde güncelleniyor — yeniden çekmeye gerek yok */
    setComments((p) =>
      p.map((c) => (c.id === id ? { ...c, status: onay ? "approved" : "rejected" } : c)),
    );
    t.success(onay ? "Yorum onaylandı" : "Yorum reddedildi");
  }

  async function haberiSil() {
    setSiliniyor(true);
    const { error } = await sb.rpc("editor_delete_article", { p_id: detail.id });
    setSiliniyor(false);
    if (error) { t.error("Haber silinemedi"); return; }
    window.location.href = `${href(locale, "account")}?tab=articles`;
  }

  const durum = DURUM[detail.status] ?? DURUM.draft;
  const yol = haberYolu(locale, detail.slug, detail.category_slug);

  /* Kapak: video ise oynatıcı, görselse resim, hiçbiri yoksa hiçbir şey */
  const kapakMedya = detail.cover_media as unknown as MediaRow | null;
  const kapakVideo = kapakMedya?.type === "video" ? videoSrc(kapakMedya) : null;
  const kapakGorsel = kapakMedya?.type === "image"
    ? pickImage(kapakMedya, "full")
    : (detail.cover_url || null);
  const kapakPoster = kapakMedya?.type === "video" ? posterFor(kapakMedya, "full") : null;

  const galeri = (detail.medya as unknown as MediaRow[]) ?? [];

  const maxGun = Math.max(1, ...detail.daily.map((d) => d.sayi));

  return (
    <>
      <OnayPenceresi
        acik={yorumSil !== null}
        baslik="Yorumu sil"
        aciklama="Bu yorumu silmek istediğine emin misin? Bu işlem geri alınamaz."
        onayYazi="Sil"
        onIptal={() => setYorumSil(null)}
        onOnay={() => { const id = yorumSil; setYorumSil(null); if (id) void yorumuSil(id); }}
      />
      <OnayPenceresi
        acik={haberSil}
        baslik="Haberi sil"
        aciklama="Bu haberi silmek istediğine emin misin? Bu işlem geri alınamaz."
        onayYazi={siliniyor ? "…" : "Sil"}
        onIptal={() => setHaberSil(false)}
        onOnay={() => { setHaberSil(false); void haberiSil(); }}
      />

      {/* ---- geri ---- */}
      <Link
        href={`${href(locale, "account")}?tab=articles`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13.5, fontWeight: 600, color: "var(--mu)",
          marginBottom: 14, textDecoration: "none",
        }}
      >
        <span style={{ display: "flex", transform: "rotate(180deg)" }}>
          <Icon name="chevronRight" size={15} />
        </span>
        Haberlerim
      </Link>

      {/* ---- üst eylem çubuğu ---- */}
      <div className="kb-detay-ust">
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: ".05em",
          textTransform: "uppercase", color: durum.renk,
          padding: "5px 11px", borderRadius: 999,
          background: `${durum.renk}1f`,
        }}>
          {durum.ad}
        </span>

        {/*
          ⚠ ÜÇ İKON, TEK SATIR, HER ZAMAN SAĞDA.
          Görüntüle (eye) yalnızca yayındaysa çıkıyor — onay
          bekleyen ya da reddedilen habere gidecek bir site
          adresi zaten yok.
        */}
        <div style={{ display: "flex", gap: 8 }}>
          {detail.status === "published" && (
            <Link href={yol} className="kb-ikon-btn" title="Habere git" aria-label="Habere git">
              <Icon name="eye" size={17} />
            </Link>
          )}
          <Link
            href={accountHref(locale, "edit", detail.id)}
            className="kb-ikon-btn" title="Düzenle" aria-label="Düzenle"
          >
            <Icon name="pencil" size={17} />
          </Link>
          <button
            type="button"
            onClick={() => setHaberSil(true)}
            className="kb-ikon-btn kb-ikon-sil"
            title="Haberi sil" aria-label="Haberi sil"
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
      </div>

      {/* ---- gövde: sol içerik · sağ istatistik ---- */}
      <div className="kb-detay-govde">
        {/* ============ SOL: haberin kendisi ============ */}
        <div className="kb-detay-sol">
          <div className="kb-detay-yazar">
            <span style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: "var(--s2)", overflow: "hidden",
              display: "grid", placeItems: "center",
              fontSize: 14, fontWeight: 700, color: "var(--tx)",
            }}>
              {detail.author_avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={assetUrl(detail.author_avatar) ?? ""} alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (detail.author_name ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                {detail.author_name ?? "Sen"}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--mu)" }}>
                {formatDate(detail.created_at, locale)}
                {detail.category_name ? ` · ${detail.category_name}` : ""}
                {detail.city_name ? ` · ${detail.city_name}` : ""}
              </span>
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(21px, 2.4vw, 28px)", fontWeight: 800,
            lineHeight: 1.28, letterSpacing: "-.01em", margin: 0,
            overflowWrap: "anywhere",
          }}>
            {detail.title}
          </h1>

          {detail.summary && (
            <p style={{
              fontSize: 16, lineHeight: 1.6, color: "var(--mu)",
              margin: 0, overflowWrap: "anywhere",
            }}>
              {detail.summary}
            </p>
          )}

          {/* ---- içerik ---- */}
          {detail.body.length > 0 && (
            <div className="kb-detay-icerik">
              {detail.body.map((b, i) =>
                b.type === "heading"
                  ? <h3 key={i}>{b.text}</h3>
                  : <p key={i}>{b.text}</p>,
              )}
            </div>
          )}

          {/* ---- medya: kapak + galeri, en altta ---- */}
          {(kapakGorsel || kapakVideo || galeri.length > 0) && (
            <div style={{ display: "grid", gap: 10 }}>
              {(kapakVideo || kapakGorsel) && (
                <div style={{
                  borderRadius: 16, overflow: "hidden", background: "#000",
                  aspectRatio: "16 / 9",
                }}>
                  {kapakVideo ? (
                    <video
                      src={kapakVideo} poster={kapakPoster ?? undefined}
                      controls playsInline
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={kapakGorsel!} alt="" style={{
                      width: "100%", height: "100%", objectFit: "cover",
                    }} />
                  )}
                </div>
              )}

              {galeri.length > 0 && (
                <div style={{
                  display: "grid", gap: 8,
                  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                }}>
                  {galeri.map((m) => {
                    const g = m.type === "image" ? pickImage(m, "thumb") : null;
                    const v = m.type === "video";
                    return (
                      <div key={m.id} style={{
                        position: "relative", aspectRatio: "1 / 1",
                        borderRadius: 11, overflow: "hidden", background: "var(--s2)",
                      }}>
                        {g && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={g} alt="" style={{
                            width: "100%", height: "100%", objectFit: "cover",
                          }} />
                        )}
                        {v && (
                          <span style={{
                            position: "absolute", inset: 0, display: "grid",
                            placeItems: "center", background: "rgba(0,0,0,.35)",
                          }}>
                            <Icon name="play" size={22} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============ SAĞ: istatistikler ============ */}
        <div className="kb-detay-sag">
          <div style={{
            background: "var(--s1)", border: "1px solid var(--bd)",
            borderRadius: 16, padding: 16,
          }}>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--mu)", margin: "0 0 14px" }}>
              {durum.aciklama}
            </p>

            <div className="kb-detay-sayac">
              {[
                { ad: "Görüntülenme", deger: detail.view_count, ikon: "eye" as const },
                { ad: "Beğeni", deger: detail.like_count, ikon: "heart" as const },
                { ad: "Kayıt", deger: detail.save_count, ikon: "bookmark" as const },
                { ad: "Yorum", deger: detail.comment_count, ikon: "comment" as const },
              ].map((s) => (
                <div key={s.ad} style={{
                  background: "var(--s2)", borderRadius: 13, padding: "12px 14px",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    color: "var(--mu)", fontSize: 11.5, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: ".03em",
                  }}>
                    <Icon name={s.ikon} size={13} />
                    {s.ad}
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>
                    {s.deger.toLocaleString(locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/*
            ANAHTAR KELİMELER

            AI analizi tamamlanmadıysa boş geliyor; kart o
            durumda hiç basılmıyor.
          */}
          {(detail.anahtar_kelimeler?.length ?? 0) > 0 && (
            <div style={{
              background: "var(--s1)", border: "1px solid var(--bd)",
              borderRadius: 16, padding: 16,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12.5, fontWeight: 700, color: "var(--mu)", marginBottom: 11,
              }}>
                <Icon name="sparkles" size={14} />
                Anahtar kelimeler
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {detail.anahtar_kelimeler!.map((k) => (
                  <span key={k} style={{
                    padding: "5px 11px", borderRadius: 999,
                    background: "var(--s2)", fontSize: 13, fontWeight: 600,
                  }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ---- 14 günlük grafik ---- */}
          {detail.daily.length > 0 && (
            <div style={{
              background: "var(--s1)", border: "1px solid var(--bd)",
              borderRadius: 16, padding: 16,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--mu)", marginBottom: 12 }}>
                Son 14 gün · görüntülenme
              </div>
              <div style={{
                display: "flex", alignItems: "flex-end", gap: 4, height: 72,
              }}>
                {detail.daily.map((d) => (
                  <div
                    key={d.gun}
                    title={`${d.gun}: ${d.sayi}`}
                    style={{
                      flex: 1, minWidth: 4, borderRadius: 3,
                      height: `${Math.max(6, (d.sayi / maxGun) * 100)}%`,
                      background: "var(--tx)", opacity: .8,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- yorumlar: tam genişlik ---- */}
      <div style={{
        marginTop: 28, background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 16, padding: 18,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
          Yorumlar {comments.length > 0 && `· ${comments.length}`}
        </h2>

        {comments.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--mu)", marginTop: 10 }}>
            Bu habere henüz yorum yapılmamış.
          </p>
        ) : (
          <div>
            {comments.map((c) => (
              <div key={c.id} className="kb-detay-yorum">
                <span style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: "var(--s2)", display: "grid", placeItems: "center",
                  fontSize: 12.5, fontWeight: 700,
                }}>
                  {(c.author_name ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{c.author_name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--mu)" }}>
                      {formatDate(c.created_at, locale)}
                    </span>
                    {/*
                      ⚠ DURUM DEĞERİ `pending`, `pending_review` DEĞİL.
                      `comment_status` enum'unda karşılığı `pending`;
                      haber durumundan farklı.
                    */}
                    {c.status === "pending" && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, color: "#FF9F0A",
                        padding: "2px 7px", borderRadius: 999,
                        background: "rgba(255,159,10,.15)",
                      }}>
                        Onay bekliyor
                      </span>
                    )}
                    {c.status === "rejected" && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, color: "#E5484D",
                        padding: "2px 7px", borderRadius: 999,
                        background: "rgba(229,72,77,.15)",
                      }}>
                        Reddedildi
                      </span>
                    )}

                    {/*
                      ONAY / RED — yalnızca bekleyen yorumda.

                      ⚠ YETKİ KONTROLÜ VERİTABANINDA.
                      `yazar_yorum_karar` yalnızca haberin sahibine
                      ve yalnızca `pending` durumundaki yoruma izin
                      veriyor. Buradaki koşul sadece arayüzü
                      sadeleştiriyor; güvenlik ona bağlı değil.
                    */}
                    <span style={{
                      display: "flex", gap: 6, marginInlineStart: "auto",
                      alignItems: "center",
                    }}>
                      {c.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void yorumKarar(c.id, true)}
                            disabled={busy === c.id}
                            className="kb-ikon-btn"
                            style={{
                              width: "auto", height: 28, borderRadius: 999,
                              padding: "0 11px", gap: 5, fontSize: 12, fontWeight: 700,
                              color: "#30D158", borderColor: "rgba(48,209,88,.35)",
                              opacity: busy === c.id ? .5 : 1,
                            }}
                            title="Yorumu onayla" aria-label="Yorumu onayla"
                          >
                            <Icon name="check" size={13} />
                            Onayla
                          </button>
                          <button
                            type="button"
                            onClick={() => void yorumKarar(c.id, false)}
                            disabled={busy === c.id}
                            className="kb-ikon-btn"
                            style={{
                              width: "auto", height: 28, borderRadius: 999,
                              padding: "0 11px", gap: 5, fontSize: 12, fontWeight: 700,
                              color: "#E5484D", borderColor: "rgba(229,72,77,.35)",
                              opacity: busy === c.id ? .5 : 1,
                            }}
                            title="Yorumu reddet" aria-label="Yorumu reddet"
                          >
                            <Icon name="close" size={13} strokeWidth={2.4} />
                            Reddet
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setYorumSil(c.id)}
                        disabled={busy === c.id}
                        className="kb-ikon-btn kb-ikon-sil"
                        style={{
                          width: 28, height: 28,
                          opacity: busy === c.id ? .5 : 1,
                        }}
                        title="Sil" aria-label="Yorumu sil"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, overflowWrap: "anywhere" }}>
                    {c.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
