import { NextResponse, type NextRequest } from "next/server";
import {
  mailConfigured, isEmailRegistered, requestPasswordReset,
  verifyResetCode,
} from "@/lib/mail";

export const dynamic = "force-dynamic";

/* ══════════════════════════════════════════════════════════════
   E-POSTA DOĞRULAMA — MOBİL İÇİN

   ┌─ MEVCUT `/api/dogrulama` FARKLI BİR ŞEY YAPIYOR ⚠️ ────────┐
   │ O uç oturum açmış kullanıcının adresini doğruluyor.        │
   │ Mobil ise oturum AÇMADAN önce adres denetimi ve kod        │
   │ istiyor. İkisi tek uçta birleştirilseydi yetki kuralı      │
   │ karışırdı.                                                   │
   └──────────────────────────────────────────────────────────────┘

   ⚠ ANAHTAR BURADA KALIYOR.
   Mail servisi `x-api-key` istiyor. Mobil doğrudan gitseydi
   anahtar APK içine gömülürdü.
   ══════════════════════════════════════════════════════════════ */

const PENCERE_MS = 60_000;
const EN_FAZLA = 6;
const sayac = new Map<string, { adet: number; sifirla: number }>();

function sinirAsildi(ip: string): boolean {
  const simdi = Date.now();
  const k = sayac.get(ip);

  if (!k || simdi > k.sifirla) {
    sayac.set(ip, { adet: 1, sifirla: simdi + PENCERE_MS });
    return false;
  }

  k.adet += 1;
  return k.adet > EN_FAZLA;
}

export async function POST(req: NextRequest) {
  if (!mailConfigured()) {
    return NextResponse.json({ error: "disabled" }, { status: 503 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "bilinmiyor";

  if (sinirAsildi(ip)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const govde = await req.json().catch(() => null) as
    | { step?: string; email?: string; code?: string }
    | null;

  const eposta = govde?.email?.trim().toLowerCase() ?? "";

  /*
   * ⚠ BİÇİM SUNUCUDA DA DENETLENİYOR.
   * İstemci denetimi atlanabiliyor; geçersiz adres mail
   * servisine hiç gitmemeli.
   */
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    if (govde?.step === "check-email") {
      return NextResponse.json({ registered: await isEmailRegistered(eposta) });
    }

    if (govde?.step === "request") {
      await requestPasswordReset(eposta);
      /*
       * ⚠ HER ZAMAN AYNI YANIT.
       * Adres kayıtlı değilse de "gönderildi" dönüyor. Aksi
       * hâlde adres listesi taranarak hangi e-postaların
       * kayıtlı olduğu öğrenilebilirdi.
       */
      return NextResponse.json({ ok: true });
    }

    if (govde?.step === "verify") {
      if (!govde.code) {
        return NextResponse.json({ error: "invalid_code" }, { status: 400 });
      }

      const bilet = await verifyResetCode(eposta, govde.code.trim());
      if (!bilet) {
        return NextResponse.json({ error: "invalid_code" }, { status: 400 });
      }

      return NextResponse.json({ ticket: bilet });
    }

    return NextResponse.json({ error: "invalid_step" }, { status: 400 });
  } catch {
    /* Ayrıntı dışarı verilmiyor: hangi adımda takıldığını ele verir */
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
