"use client";
import { useState } from "react";
import { pickImage } from "@/lib/media";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, accountHref, type Locale, haberYolu} from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate } from "@/lib/format";
import Icon from "@/components/ui/Icon";
import Empty from "./Empty";
import OnayPenceresi from "@/components/ui/OnayPenceresi";
import Link from "next/link";

interface Row {
  /** Haber adresi kategori altında kurulur; yoksa eski biçim */
  category_slug?: string | null;
  id: string; slug: string; title: string; status: string;
  degisiklik_bekliyor?: boolean | null;
  cover?: unknown;
  created_at: string; category_name: string | null;
  view_count: number; like_count: number; comment_count: number;
}

/**
 * HABERLERİM (editör)
 *
 * Editör kendi haberlerini görür, düzenler ve siler. Yetki
 * kontrolü `editor_update_article` / `editor_delete_article`
 * içinde, veritabanı tarafında.
 *
 * Yayındaki bir haber düzenlenince yayından kalkar ve yeniden
 * onaya düşer — durum rozetinde bu görünür.
 */
export default function AccountArticles({
  items, locale, dict,
}: {
  items: Row[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [list, setList] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);
  /*
   * ⚠ TARAYICININ `confirm()` KUTUSU KULLANILMIYOR.
   * İşletim sisteminin kutusu koyu temayı bilmiyor, metni
   * biçimlendiremiyor ve markayla hiç uyuşmuyordu. Kendi
   * onay penceremiz açılıyor; kimliği burada tutuluyor,
   * null ise pencere kapalı.
   */
  const [silinecek, setSilinecek] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("editor_delete_article", { p_id: id });
    setBusy(null);
    if (!error) setList((prev) => prev.filter((a) => a.id !== id));
  }

  const badge = (s: string) => {
    if (s === "published") return { text: dict.auth.published, color: "#30D158" };
    if (s === "pending_review") return { text: dict.auth.pendingReview, color: "#FF9F0A" };
    if (s === "rejected") return { text: dict.auth.rejected, color: "var(--dn)" };
    if (s === "archived") return { text: dict.auth.archived, color: "var(--mu)" };
    return { text: dict.auth.draft, color: "var(--mu)" };
  };

  return (
    <>
      <OnayPenceresi
        acik={silinecek !== null}
        baslik="Haberi sil"
        aciklama="Bu haberi silmek istediğine emin misin? Bu işlem geri alınamaz."
        onayYazi="Sil"
        onIptal={() => setSilinecek(null)}
        onOnay={() => {
          const id = silinecek;
          setSilinecek(null);
          if (id) void remove(id);
        }}
      />
      <Link
        href={accountHref(locale, "new")}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          height: 48, borderRadius: 14, marginBottom: 14,
          /* ⚠ Nötr: koyu temada beyaz, açık temada siyah */
          background: "var(--tx)", color: "var(--bg)", fontSize: 15, fontWeight: 700,
        }}
      >
        <Icon name="news" size={17} color="#fff" />
        {dict.auth.newArticle}
      </Link>

      {list.length === 0 ? (
        <Empty text={dict.auth.noArticles} />
      ) : (
        <ul className="kb-acc-tekli" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {list.map((a) => {
            const b = badge(a.status);
            /*
             * Yayındaki habere yapılmış ama henüz onaylanmamış
             * bir değişiklik varsa yazar bunu görmeli — yoksa
             * "kaydettim ama sitede görünmüyor" sanıyor.
             */
            const bekleyen = a.degisiklik_bekliyor === true;
            return (
              <li
                key={a.id}
                style={{
                  background: "var(--s1)", border: "1px solid var(--bd)",
                  borderRadius: 16, padding: 16,
                  display: "flex", gap: 14, alignItems: "flex-start",
                }}
              >
                {/*
                  Kapak görseli.

                  ⚠ GÖRSEL YOKSA KUTU BASILMIYOR.
                  Boş gri dikdörtgen kartı çirkinleştiriyor;
                  yazı tam genişliğe yayılsın daha iyi.
                */}
                {(() => {
                  const img = pickImage(a.cover as never, "thumb");
                  if (!img) return null;
                  return (
                    <span style={{
                      width: 92, aspectRatio: "4 / 3", borderRadius: 11,
                      overflow: "hidden", flexShrink: 0, background: "var(--s2)",
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" loading="lazy"
                           style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </span>
                  );
                })()}

                <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em",
                      textTransform: "uppercase", color: b.color,
                    }}
                  >
                    {b.text}
                  </span>
                  {bekleyen && (
                    <span
                      title="Yaptığın değişiklik onay bekliyor; sitede eski sürüm görünüyor"
                      style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
                        marginInlineStart: 8,
                        fontSize: 11.5, fontWeight: 700,
                        padding: "3px 9px", borderRadius: 999,
                        background: "rgba(255,159,10,.16)", color: "#FF9F0A",
                      }}
                    >
                      Değişiklik onay bekliyor
                    </span>
                  )}
                  {a.category_name && (
                    <span style={{ fontSize: 12, color: "var(--mu)" }}>{a.category_name}</span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--mu)" }}>
                    {formatDate(a.created_at, locale)}
                  </span>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>
                  {a.title}
                </h3>

                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 14, marginTop: 12,
                    fontSize: 12.5, color: "var(--mu)", fontWeight: 600, flexWrap: "wrap",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="eye" size={14} />{a.view_count}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="heart" size={14} />{a.like_count}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="comment" size={14} />{a.comment_count}
                  </span>

                  {/*
                    EYLEMLER — İKONLU YUVARLAK DÜĞMELER

                    ⚠ ÖNCE YAZI BAĞLANTILARIYDI.
                    "Devamını oku · Görüntülenme · Düzenle · Sil"
                    yan yana dizilince kart taşıyor, dar ekranda
                    alt satıra kayıyordu. İkon hem yer kaplamıyor
                    hem de daha modern duruyor; ne olduğu
                    `title` ve `aria-label` ile okunuyor.
                  */}
                  <span style={{ display: "flex", gap: 7, marginInlineStart: "auto" }}>
                    {a.status === "published" && (
                      <Link
                        href={haberYolu(locale, a.slug, a.category_slug)}
                        className="kb-ikon-btn"
                        title="Habere git"
                        aria-label="Habere git"
                      >
                        <Icon name="eye" size={16} />
                      </Link>
                    )}
                    <Link
                      href={accountHref(locale, "stats", a.id)}
                      className="kb-ikon-btn"
                      title="İstatistikler"
                      aria-label="İstatistikler"
                    >
                      <Icon name="chart" size={16} />
                    </Link>
                    <Link
                      href={accountHref(locale, "edit", a.id)}
                      className="kb-ikon-btn"
                      title="Düzenle"
                      aria-label="Düzenle"
                    >
                      <Icon name="pencil" size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSilinecek(a.id)}
                      disabled={busy === a.id}
                      className="kb-ikon-btn kb-ikon-sil"
                      title="Sil"
                      aria-label="Sil"
                      style={{ opacity: busy === a.id ? 0.4 : 1 }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
