import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { defaultLocale, href, type Locale, assertLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createPublicClient } from "@/lib/supabase/server";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * POLİTİKA DETAYI
 *
 * ⚠ SÜRÜM VE YÜRÜRLÜK TARİHİ GÖSTERİLİYOR.
 * Yasal bir metinde "hangi sürümü okuyorum, ne zamandır
 * geçerli" bilgisi metnin kendisi kadar önemli. Uyuşmazlıkta
 * kullanıcının hangi metne tabi olduğu buradan anlaşılıyor.
 */
export const revalidate = 3600;

type Params = Promise<{ locale: string; slug: string }>;

interface Politika {
  slug: string;
  title: Record<string, string>;
  body: Record<string, string>;
  seo_description: Record<string, string> | null;
  version: number;
  effective_at: string;
  updated_at: string;
  requires_consent: boolean;
}

async function getir(slug: string): Promise<Politika | null> {
  const sb = createPublicClient();
  const { data } = await sb.rpc("politika", { p_slug: slug });
  return (data as Politika | null) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = assertLocale(raw);
  const p = await getir(slug);
  if (!p) return { title: "404" };

  return {
    title: p.title?.[locale] ?? p.title?.[defaultLocale] ?? slug,
    description: p.seo_description?.[locale] ?? undefined,
  };
}

export default async function PolitikaSayfasi({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const locale = assertLocale(raw);
  const dict = await getDictionary(locale);

  const p = await getir(slug);
  if (!p) notFound();

  const baslik = p.title?.[locale] ?? p.title?.[defaultLocale] ?? slug;
  const metin = p.body?.[locale] ?? p.body?.[defaultLocale] ?? "";

  const tarih = new Date(p.effective_at).toLocaleDateString(locale, {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div style={{ padding: "var(--g) var(--gut) 48px", maxWidth: 760 }}>
      <Link
        href={href(locale, "politikalar")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13.5, fontWeight: 600, color: "var(--mu)",
          marginBottom: 14, textDecoration: "none",
        }}
      >
        <span style={{ display: "flex", transform: "rotate(180deg)" }}>
          <Icon name="chevronRight" size={15} />
        </span>
        {dict.footer?.policies ?? "Politikalar"}
      </Link>

      <h1 style={{
        fontSize: "var(--h1)", fontWeight: 800,
        margin: "6px 0 10px", letterSpacing: "-.01em",
      }}>
        {baslik}
      </h1>

      {/*
        Sürüm şeridi — metnin hangi hâlini okuduğun belli olsun.
      */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
        padding: "11px 14px", borderRadius: 12,
        background: "var(--s2)", marginBottom: 24,
        fontSize: 13, color: "var(--mu)",
      }}>
        <span style={{ fontWeight: 700, color: "var(--tx)" }}>
          Sürüm {p.version}
        </span>
        <span>·</span>
        <span>{tarih} tarihinden itibaren geçerli</span>
      </div>

      <div className="prose">
        {metin
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para, i) => (
            <p key={i}>{para}</p>
          ))}
      </div>
    </div>
  );
}
