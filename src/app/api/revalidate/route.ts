import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { locales, href, type Locale } from "@/i18n/config";

/**
 * Bot bir haberi yazdıktan sonra burayı çağırır; ISR önbelleği
 * 60 saniyeyi beklemeden tazelenir.
 *
 *   POST /api/revalidate
 *   { "secret": "...", "slug": "deprem-haberi" }
 *
 * Sır SABİT ZAMANLI karşılaştırılıyor: normal !== karşılaştırması
 * ilk farklı karakterde döner ve zamanlama ölçülerek sır karakter
 * karakter tahmin edilebilir.
 */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "REVALIDATE_SECRET tanımlı değil" }, { status: 500 });
  }

  let body: { secret?: string; slug?: string; paths?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz gövde" }, { status: 400 });
  }

  const given = body.secret ?? req.headers.get("x-revalidate-secret") ?? "";
  if (!safeEqual(given, expected)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const done: string[] = [];
  for (const locale of locales as readonly Locale[]) {
    revalidatePath(href(locale, "home"));
    done.push(href(locale, "home"));
    if (body.slug) {
      const p = href(locale, "news", body.slug);
      revalidatePath(p);
      done.push(p);
    }
  }
  for (const p of body.paths ?? []) {
    revalidatePath(p);
    done.push(p);
  }

  return NextResponse.json({ revalidated: done, at: new Date().toISOString() });
}
