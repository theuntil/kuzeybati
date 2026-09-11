import type { Metadata } from "next";
import { defaultLocale, href, type Locale, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createPublicClient } from "@/lib/supabase/server";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * POLİTİKALAR LİSTESİ
 *
 * ⚠ AYRI TABLO — `pages` DEĞİL.
 * Politikaların sıradan sayfalarda olmayan üç ihtiyacı var:
 * sürüm, yürürlük tarihi ve kim hangi sürümü onayladı. KVKK
 * metin değiştiğinde eski onayı geçersiz sayıyor; bu takibi
 * genel içerik tablosunda tutmak hukuki sorumluluğu yanlış
 * yere yüklerdi.
 *
 * Yürürlüğe girmemiş metinler listelenmiyor (`effective_at`).
 */
export const revalidate = 3600;

type Params = Promise<{ locale: string }>;

interface Politika {
  slug: string;
  title: Record<string, string>;
  seo_description: Record<string, string> | null;
  version: number;
  effective_at: string;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);
  const dict = await getDictionary(locale);
  return {
    title: dict.footer?.policies ?? "Politikalar",
    description: "Gizlilik, kullanım şartları ve diğer yasal metinler.",
  };
}

export default async function PolitikalarPage({ params }: { params: Params }) {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);
  const dict = await getDictionary(locale);

  const sb = createPublicClient();
  const { data } = await sb.rpc("politikalar");
  const liste = (data ?? []) as Politika[];

  const baslik = dict.footer?.policies ?? "Politikalar";

  return (
    <div style={{ padding: "var(--g) var(--gut) 48px" }}>
      <h1 style={{
        fontSize: "var(--h1)", fontWeight: 800,
        margin: "12px 0 8px", letterSpacing: "-.01em",
      }}>
        {baslik}
      </h1>
      <p style={{
        fontSize: 15, lineHeight: 1.6, color: "var(--mu)",
        margin: "0 0 26px", maxWidth: 620,
      }}>
        Sitemizi kullanırken geçerli olan yasal metinler.
      </p>

      {liste.length === 0 ? (
        <p style={{ fontSize: 14.5, color: "var(--mu)" }}>
          Henüz yayımlanmış bir politika metni yok.
        </p>
      ) : (
        <div style={{
          display: "grid", gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}>
          {liste.map((p) => {
            const ad = p.title?.[locale] ?? p.title?.[defaultLocale] ?? p.slug;
            const aciklama = p.seo_description?.[locale]
              ?? p.seo_description?.[defaultLocale]
              ?? null;

            return (
              <Link
                key={p.slug}
                href={`${href(locale, "politikalar")}/${p.slug}`}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 13,
                  padding: 18, borderRadius: 16,
                  background: "var(--s1)", border: "1px solid var(--bd)",
                  color: "var(--tx)", textDecoration: "none",
                  /* Aynı satırdaki kartlar eşit yükseklikte */
                  height: "100%", boxSizing: "border-box",
                }}
              >
                <span style={{
                  display: "grid", placeItems: "center", flexShrink: 0,
                  width: 38, height: 38, borderRadius: 11,
                  background: "var(--s2)", color: "var(--mu)",
                }}>
                  <Icon name="news" size={17} />
                </span>

                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    display: "block", fontSize: 15.5, fontWeight: 700,
                    lineHeight: 1.35, overflowWrap: "anywhere",
                  }}>
                    {ad}
                  </span>
                  <span style={{
                    display: "block", fontSize: 12, color: "var(--mu)",
                    marginTop: 4, opacity: .8,
                  }}>
                    Sürüm {p.version} · {new Date(p.effective_at)
                      .toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  {aciklama && (
                    <span style={{
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                      fontSize: 13.5, lineHeight: 1.5,
                      color: "var(--mu)", marginTop: 5,
                    }}>
                      {aciklama}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
