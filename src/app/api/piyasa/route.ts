import { NextResponse } from "next/server";
import { piyasaHepsi, piyasaHazir } from "@/lib/piyasa/client";

export const revalidate = 60;

/**
 * Kur ve maden verisi — mobil uygulama için.
 *
 * ┌─ `/api/markets` FARKLI BİR ŞEY DÖNDÜRÜYOR ⚠️ ──────────────┐
 * │ O uç, sitenin üstündeki kayan şerit için sembol listesi    │
 * │ (`quotes`) veriyor. Mobil uygulama kur ve maden tablosu    │
 * │ istiyor — ikisi aynı veri değil.                            │
 * │                                                              │
 * │ Ayrı uç açıldı; mevcut şerit bozulmasın.                    │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ⚠ ANAHTAR SUNUCUDA KALIYOR.
 * `PIYASA_API_KEY` yalnızca burada okunuyor. Mobil doğrudan
 * `piyasa.rovandcloud.com` adresine gitseydi anahtarı
 * uygulamaya gömmek gerekirdi ve APK açıldığında okunurdu.
 */
export async function GET() {
  if (!piyasaHazir()) {
    return NextResponse.json(
      { currencies: [], metals: [], unavailable: true },
      { status: 200 },
    );
  }

  const d = await piyasaHepsi();

  if (!d) {
    /*
     * Kaynak ulaşılamazsa boş yapı — `null` dönseydi mobil
     * taraf alan okurken çökerdi.
     */
    return NextResponse.json(
      { currencies: [], metals: [], unavailable: true },
      { status: 200 },
    );
  }

  /*
   * ⚠ YAPI İÇ İÇE.
   * Kaynak `{ currencies: { data: [...] } }` biçiminde
   * döndürüyor. Doğrudan aktarılsaydı mobil taraf diziyi
   * bulamaz, tablo boş kalırdı.
   */
  return NextResponse.json(
    {
      currencies: d.currencies?.data ?? [],
      metals: d.metals?.data ?? [],
      updatedAt: d.date ?? new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
