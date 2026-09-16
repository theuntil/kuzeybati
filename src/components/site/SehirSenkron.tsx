"use client";
import { useEffect } from "react";
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
   │   3. Yenileme YOK — çerez düzeltiliyor, sonraki sayfa      │
   │      titremesi olmuyor ve çerez artık eşleştiği için       │
   │      ikinci kez tetiklenmiyor                               │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const COOKIE = "kb-city";


/*
 * ┌─ HER TAM YÜKLEMEDE ÇALIŞIYOR ⚠️ ──────────────────────────┐
 * │ Önce sayfa ömrü boyunca tek kez çalışıyordu. Ama anahtar  │
 * │ şehrin kuralı şu: GİRİŞ YAPILMIŞSA HESAPTAKİ ŞEHİR       │
 * │ geçerli.                                                     │
 * │                                                              │
 * │ Okur hava durumu kutusundan başka bir şehre bakabiliyor —  │
 * │ ama bu GEÇİCİ. Sayfa yenilendiğinde hesabındaki şehre      │
 * │ dönmesi gerekiyor. Kalıcı değişiklik yalnızca ayarlardan.  │
 * │                                                              │
 * │ Bu yüzden bayrak modül düzeyinde değil, çalışma başına     │
 * │ tutuluyor: her tam yüklemede profil yeniden okunuyor,      │
 * │ istemci tarafı gezinmede tekrar çalışmıyor.                 │
 * └──────────────────────────────────────────────────────────────┘
 */
let calisti = false;

function cerezOku(ad: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${ad}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function SehirSenkron() {

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

        /*
         * ┌─ YENİLEME TAMAMEN KALDIRILDI ⚠️ ────────────────────┐
         * │ Burada `router.refresh()` çağrılıyordu; sunucu      │
         * │ tarafı yeniden üretiliyor ve okur "yüklendi, sonra  │
         * │ baştan yüklendi" görüyordu.                          │
         * │                                                        │
         * │ Oturum başına tek sefere indirmek yetmedi — o tek   │
         * │ sefer bile göze çarpıyor ve sayfayı yavaşlatıyor.   │
         * │                                                        │
         * │ Zaten gereksiz: şehir çerezi giriş anında           │
         * │ (`GirisPenceresi`), kayıt anında ve ayarlardan       │
         * │ değiştirildiğinde zaten yazılıyor. Burası yalnızca  │
         * │ son bir güvence — çerezi düzeltiyor, bir sonraki    │
         * │ sayfa doğru veriyle geliyor.                          │
         * └────────────────────────────────────────────────────────┘
         */
      } catch {
        /* Şehir eşitlenemedi — sayfa çalışmaya devam etsin */
      }
    })();

    return () => { iptal = true; };
  }, []);

  return null;
}
