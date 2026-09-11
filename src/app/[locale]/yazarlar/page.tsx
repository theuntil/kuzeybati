import type { Metadata } from "next";
import { profilYolu, type Locale, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createPublicClient } from "@/lib/supabase/server";
import { assetUrl } from "@/lib/media";
import Link from "next/link";

/**
 * YAZARLARIMIZ
 *
 * ⚠ HERKES LİSTELENMİYOR.
 * `profiles.yazarlar_sayfasinda` bayrağı varsayılan olarak
 * kapalı; yönetici panelden tek tek açıyor. Tek haber yazıp
 * bırakmış biri bu sayfaya düşmesin diye.
 *
 * ⚠ E-POSTA YOK.
 * `yazarlar_listesi()` yalnızca herkese açık alanları
 * döndürüyor. `profiles.email` anon'a kapatılmıştı (yama-85);
 * buradan sızmasın diye fonksiyon tarafında da seçilmiyor.
 */
export const revalidate = 1800;

type Params = Promise<{ locale: string }>;

interface Yazar {
  username: string;
  display_name: string;
  avatar_key: string | null;
  title: string | null;
  bio: string | null;
  haber_sayisi: number;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);
  const dict = await getDictionary(locale);
  return {
    title: dict.footer?.authors ?? "Yazarlarımız",
    description: "Haberlerimizi hazırlayan yazar kadromuz.",
  };
}

export default async function YazarlarPage({ params }: { params: Params }) {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);
  const dict = await getDictionary(locale);

  const sb = createPublicClient();
  const { data } = await sb.rpc("yazarlar_listesi");
  const liste = (data ?? []) as Yazar[];

  return (
    <div style={{ padding: "var(--g) var(--gut) 48px" }}>
      <h1 style={{
        fontSize: "var(--h1)", fontWeight: 800,
        margin: "12px 0 8px", letterSpacing: "-.01em",
      }}>
        {dict.footer?.authors ?? "Yazarlarımız"}
      </h1>
      <p style={{
        fontSize: 15, lineHeight: 1.6, color: "var(--mu)",
        margin: "0 0 26px", maxWidth: 620,
      }}>
        Haberlerimizi hazırlayan kadro.
      </p>

      {liste.length === 0 ? (
        <p style={{ fontSize: 14.5, color: "var(--mu)" }}>
          Henüz listelenen yazar yok.
        </p>
      ) : (
        <div style={{
          display: "grid", gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}>
          {liste.map((y) => {
            const avatar = assetUrl(y.avatar_key);
            return (
              <Link
                key={y.username}
                href={profilYolu(locale, "yazar", y.username)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: 18, borderRadius: 16,
                  background: "var(--s1)", border: "1px solid var(--bd)",
                  color: "var(--tx)", textDecoration: "none",
                  height: "100%", boxSizing: "border-box",
                }}
              >
                <span style={{
                  width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                  overflow: "hidden", background: "var(--s2)",
                  display: "grid", placeItems: "center",
                  fontSize: 21, fontWeight: 800, color: "var(--mu)",
                }}>
                  {avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatar} alt="" loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    y.display_name.slice(0, 1).toUpperCase()
                  )}
                </span>

                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    display: "block", fontSize: 15.5, fontWeight: 700,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {y.display_name}
                  </span>
                  {y.title && (
                    <span style={{
                      display: "block", fontSize: 13, color: "var(--mu)", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {y.title}
                    </span>
                  )}
                  <span style={{
                    display: "block", fontSize: 12.5, color: "var(--mu)",
                    marginTop: 5, opacity: .85,
                  }}>
                    {y.haber_sayisi} haber
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
