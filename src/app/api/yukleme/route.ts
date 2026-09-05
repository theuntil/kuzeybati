import { NextResponse, type NextRequest } from "next/server";
import { createAuthedClient } from "@/lib/supabase/server";
import { imzaliYukleme, r2Sil, type Onek } from "@/lib/r2";

/**
 * POST /api/yukleme
 *
 * İmzalı bir R2 yükleme adresi döndürür. Dosyanın kendisi buradan
 * GEÇMEZ — tarayıcı doğrudan R2'ye PUT eder.
 *
 * ┌─ YETKİ BURADA KONTROL EDİLİR ⚠️ ───────────────────────────┐
 * │ İmzalı adres, alan kişiye bucket'a yazma hakkı verir. Bu     │
 * │ yüzden imza üretmeden ÖNCE oturum ve rol doğrulanır:         │
 * │   avatar  → giriş yapmış herkes (kendi klasörüne)            │
 * │   library → yalnızca editör/yönetici                          │
 * │   editor  → yazma yetkisi olanlar (kendi klasörüne)          │
 * │                                                                │
 * │ Kullanıcı klasörü sunucuda oturumdan alınır, istemciden      │
 * │ GELMEZ — yoksa herkes başkasının klasörüne yazabilirdi.       │
 * └────────────────────────────────────────────────────────────────┘
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROL_SIRASI: Record<string, number> = {
  reader: 0, author: 1, editor: 2, admin: 3,
};

export async function POST(req: NextRequest) {
  let govde: {
    onek?: string; contentType?: string; bytes?: number; fileName?: string;
  };
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const onek = govde.onek as Onek | undefined;
  if (!onek || !["avatar", "library", "editor", "mail"].includes(onek)) {
    return NextResponse.json({ error: "Geçersiz önek" }, { status: 400 });
  }

  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }

  // Rol, tabloda tutulan gerçek değerden okunur; JWT'ye güvenilmez
  const { data: profil } = await sb
    .from("my_profile").select("role").maybeSingle();
  const rol = (profil?.role as string) ?? "reader";
  const seviye = ROL_SIRASI[rol] ?? 0;

  if (onek === "library" && seviye < ROL_SIRASI.editor) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (onek === "editor" && seviye < ROL_SIRASI.author) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  // Mail eki: yalnızca personel (editör ve üstü) mail gönderebiliyor
  if (onek === "mail" && seviye < ROL_SIRASI.editor) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  try {
    const sonuc = await imzaliYukleme({
      onek,
      contentType: String(govde.contentType ?? ""),
      bytes: Number(govde.bytes ?? 0),
      fileName: govde.fileName ? String(govde.fileName) : undefined,
      userId: user.id,
    });
    return NextResponse.json(sonuc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Yükleme adresi alınamadı";
    // Yapılandırma hatası sunucu logunda kalsın, kullanıcıya sızmasın
    if (msg.includes("S3_")) {
      /*
       * ⚠ HANGİ DEĞİŞKENİN EKSİK OLDUĞU LOGA YAZILIYOR.
       *
       * "Depolama yapılandırılmamış" diyordu ve hangi ayarın
       * eksik olduğu hiçbir yerde görünmüyordu. Kullanıcı
       * "hata oluştu" görüyor, yönetici sebebi bulamıyordu.
       *
       * Web servisinde şunlar tanımlı olmalı:
       *   S3_ENDPOINT · S3_ACCESS_KEY_ID
       *   S3_SECRET_ACCESS_KEY · S3_BUCKET
       */
      console.error("[yukleme] R2 ayarı eksik:", msg);
      return NextResponse.json(
        {
          error: "Görsel yükleme şu an kullanılamıyor",
          detay: process.env.NODE_ENV === "production" ? undefined : msg,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * DELETE /api/yukleme?key=...
 *
 * Yükleme yarıda kalınca artık dosyayı temizler. Kalıcı silmeler
 * `storage_deletions` kuyruğundan gider; bu yalnızca kullanıcının
 * o an yüklediği ve vazgeçtiği dosya için.
 */
export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";

  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }

  /*
   * Kullanıcı YALNIZCA kendi klasöründeki dosyayı silebilir.
   * `library/` altındakiler ortak; onlar panelden RPC ile
   * silinir ve kuyruğa düşer.
   */
  const kendi =
    key.startsWith(`avatar/${user.id}/`) ||
    key.startsWith(`editor/${user.id}/`) ||
    key.startsWith(`mail/${user.id}/`);
  if (!kendi) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  try {
    await r2Sil(key);
    return NextResponse.json({ ok: true });
  } catch {
    // Silinemese de kullanıcıyı bekletme; yetim tarayıcı yakalar
    return NextResponse.json({ ok: false });
  }
}
