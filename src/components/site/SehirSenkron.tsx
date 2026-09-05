"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/* ══════════════════════════════════════════════════════════════
   ANAHTAR ŞEHİR — CİHAZLAR ARASI EŞİTLEME

   ┌─ NEDEN SUNUCUDA DEĞİL ⚠️ ──────────────────────────────────┐
   │ Profil şehrini sunucu tarafında okumayı denedim; layout    │
   │ her sayfada çalıştığı için `auth.getUser()` sürekli oturum │
   │ yenilemesi tetikledi ve site sonsuz döngüye girdi.         │
   │                                                              │
   │ Burada güvenli: tarayıcı istemcisi çerezleri kendi yazıyor,│
   │ jeton yenilemesi zaten onun işi. Sunucunun yazamadığı için │
   │ oluşan tutarsızlık burada yok.                              │
   └──────────────────────────────────────────────────────────────┘

   ┌─ DÖNGÜ KORUMASI ⚠️ ────────────────────────────────────────┐
   │ Üç katman:                                                  │
   │   1. Modül düzeyinde bayrak — sayfa başına tek çalışma     │
   │   2. Yalnızca değer GERÇEKTEN farklıysa yazıyor            │
   │   3. `router.refresh()` — tam yeniden yükleme değil, tema  │
   │      titremesi olmuyor ve çerez artık eşleştiği için       │
   │      ikinci kez tetiklenmiyor                               │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const COOKIE = "kb-city";

/* Sayfa ömrü boyunca tek çalışma */
let calisti = false;

function cerezOku(ad: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${ad}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function SehirSenkron() {
  const router = useRouter();

  useEffect(() => {
    if (calisti) return;
    calisti = true;

    let iptal = false;

    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: auth } = await sb.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid || iptal) return;

        const { data } = await sb
          .from("profiles")
          .select("city:cities!profiles_city_id_fkey(slug)")
          .eq("id", uid)
          .maybeSingle();

        const ham = data?.city as unknown;
        const slug = Array.isArray(ham)
          ? (ham[0] as { slug?: string } | undefined)?.slug
          : (ham as { slug?: string } | null)?.slug;

        if (!slug || iptal) return;

        /*
         * ⚠ AYNIYSA HİÇBİR ŞEY YAPILMIYOR.
         * Koşulsuz yazıp yenilemek her açılışta bir tur daha
         * doğururdu.
         */
        if (cerezOku(COOKIE) === slug) return;

        document.cookie =
          `${COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;

        /* Sunucuda üretilen hava/namaz/eczane yenilensin */
        router.refresh();
      } catch {
        /* Şehir eşitlenemedi — sayfa çalışmaya devam etsin */
      }
    })();

    return () => { iptal = true; };
  }, [router]);

  return null;
}
