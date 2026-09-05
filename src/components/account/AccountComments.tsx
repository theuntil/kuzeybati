"use client";
import { useState } from "react";
import { pickImage } from "@/lib/media";
import OnayPenceresi from "@/components/ui/OnayPenceresi";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate } from "@/lib/format";
import Icon from "@/components/ui/Icon";
import Empty from "./Empty";
import Link from "next/link";

interface Row {
  id: string;
  article_cover?: unknown; body: string; status: string; created_at: string;
  article_slug: string; article_title: string;
}

/**
 * YORUMLARIM
 *
 * Kullanıcı yalnızca KENDİ yorumunu silebilir; yetki kontrolü
 * `delete_own_comment` içinde, veritabanı tarafında yapılır.
 * Buradaki filtre sadece arayüzü sadeleştirir.
 *
 * Silinen yorum listeden kaybolur ama veritabanında kalır:
 * 5651 sayılı kanun IP ve zaman kaydının saklanmasını istiyor.
 */
export default function AccountComments({
  items, locale, dict,
}: {
  items: Row[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [list, setList] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);

  /*
   * Silinmesi onaylanacak yorumun kimliği.
   * null ise pencere kapalı.
   */
  const [silinecek, setSilinecek] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("delete_own_comment", { p_comment_id: id });
    setBusy(null);
    if (!error) setList((prev) => prev.filter((c) => c.id !== id));
  }

  if (!list.length) return <Empty text={dict.auth.noComments} />;

  const badge = (s: string) =>
    s === "approved" ? { text: dict.auth.published, color: "#30D158" }
    : s === "rejected" ? { text: dict.auth.rejected, color: "var(--dn)" }
    : { text: dict.auth.pendingReview, color: "#FF9F0A" };

  return (
    <>
      <OnayPenceresi
        acik={silinecek !== null}
        baslik="Yorumu sil"
        aciklama="Bu yorumu silmek istediğine emin misin? Bu işlem geri alınamaz."
        onayYazi="Sil"
        onIptal={() => setSilinecek(null)}
        onOnay={() => {
          const id = silinecek;
          setSilinecek(null);
          if (id) void remove(id);
        }}
      />
    <ul className="kb-acc-izgara" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {list.map((c) => {
        const b = badge(c.status);
        return (
          <li
            key={c.id}
            style={{
              background: "var(--s1)", border: "1px solid var(--bd)",
              borderRadius: 16, padding: 16,
              display: "flex", gap: 13, alignItems: "flex-start",
            }}
          >
            {/*
              Yorum yapılan haberin kapağı.

              ⚠ GÖRSEL YOKSA KUTU BASILMIYOR.
              Boş gri dikdörtgen kartı çirkinleştiriyor.
            */}
            {(() => {
              const img = pickImage(c.article_cover as never, "thumb");
              if (!img) return null;
              return (
                <span style={{
                  width: 74, aspectRatio: "4 / 3", borderRadius: 11,
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
              <span style={{ fontSize: 12, color: "var(--mu)" }}>
                {formatDate(c.created_at, locale)}
              </span>
              <button
                onClick={() => setSilinecek(c.id)}
                disabled={busy === c.id}
                aria-label={dict.common.close}
                style={{
                  marginInlineStart: "auto", width: 30, height: 30, borderRadius: 9,
                  background: "var(--s2)", color: "var(--mu)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: busy === c.id ? 0.5 : 1,
                }}
              >
                <Icon name="trash" size={15} strokeWidth={1.9} />
              </button>
            </div>

            <p style={{ fontSize: 14.5, lineHeight: 1.55, overflowWrap: "anywhere" }}>
              {c.body}
            </p>

            <Link
              href={href(locale, "news", c.article_slug)}
              style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 10,
                fontSize: 12.5, fontWeight: 600, color: "var(--mu)",
              }}
            >
              {c.article_title}
              <Icon name="chevronRight" size={13} />
            </Link>
            </div>
          </li>
        );
      })}
    </ul>
    </>
  );
}
