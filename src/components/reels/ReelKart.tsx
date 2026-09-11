"use client";
import { useEffect, useRef, useState } from "react";
import { haberYolu, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { pickImage, videoSrc, posterFor, assetUrl } from "@/lib/media";
import type { MediaRow } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import OzelIkon from "@/components/ui/OzelIkon";
import ShareSheet from "@/components/article/ShareSheet";
import VideoCerceve from "./VideoCerceve";
import ReelYorumlar from "./ReelYorumlar";
import type { Reel } from "./tipler";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   TEK REEL

   Masaüstü:  sol haber · orta video · sağ yorumlar
   Mobil:     tam ekran video + eylem rayı
   ══════════════════════════════════════════════════════════════ */

function yerelOku(anahtar: string): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(anahtar) === "1"; } catch { return false; }
}
function yerelYaz(anahtar: string, deger: boolean) {
  try { localStorage.setItem(anahtar, deger ? "1" : "0"); } catch { /* kota */ }
}

export default function ReelKart({
  reel, sira, aktif, yakin, mobil, dar, sesli, ustDugmeler,
  yorumAcik, onYorumAcik, locale, dict, girisli, girisIste,
}: {
  reel: Reel;
  sira: number;
  aktif: boolean;
  /** Aktif kartın yakınında mı — uzaktaysa video öğesi basılmıyor */
  yakin: boolean;
  mobil: boolean;
  /** Masaüstü ama dar pencere — yan sütunlar sığmıyor */
  dar: boolean;
  sesli: boolean;
  /** Masaüstünde videonun sağ üstüne basılan ses/şehir düğmeleri */
  ustDugmeler?: React.ReactNode;
  yorumAcik: boolean;
  onYorumAcik: () => void;
  locale: Locale;
  dict: Dictionary;
  girisli: boolean;
  girisIste: () => void;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const video = useRef<HTMLVideoElement>(null);

  const [oynuyor, setOynuyor] = useState(false);
  const [hazir, setHazir] = useState(false);
  const [videoHata, setVideoHata] = useState(false);

  /*
   * Aktif tema.
   *
   * ⚠ SUNUCUDA BİLİNMİYOR — `data-theme` istemcide yazılıyor.
   * İlk boyamada `false`, sonra düzeltiliyor; logo bir kare
   * yanlış görünebilir ama sunucu-istemci uyuşmazlığı olmuyor.
   */
  const [koyuTema, setKoyuTema] = useState(false);
  /*
   * ⚠ GERÇEK SESSİZLİK DURUMU.
   *
   * `sesli` kullanıcının İSTEĞİ; `gercektenSessiz` videonun
   * o anki hâli. Tarayıcı sesli oynatmayı reddettiğinde ikisi
   * ayrışıyordu: simge "sesli" gösteriyor ama ses çıkmıyordu.
   * Simge artık bu değere bakıyor.
   */
  const [gercektenSessiz, setGercektenSessiz] = useState(true);

  useEffect(() => {
    function oku() {
      setKoyuTema(document.documentElement.dataset.theme === "dark");
    }
    oku();
    const g = new MutationObserver(oku);
    g.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
    return () => g.disconnect();
  }, []);

  /*
   * ⚠ BAŞLANGIÇ DEĞERİ localStorage'DAN.
   *
   * Haber sayfasındaki mantığın aynısı: liste önbelleklenebiliyor,
   * "bu kullanıcı beğenmiş mi" bilgisi orada doğru olamaz. Yerel
   * değer anında gösteriliyor, gerçeği arka planda doğrulanıyor.
   */
  const [begendi, setBegendi] = useState(() => yerelOku(`kb_like_${reel.id}`));
  const [kaydetti, setKaydetti] = useState(() => yerelOku(`kb_save_${reel.id}`));
  const [begeniSayi, setBegeniSayi] = useState(reel.like_count ?? 0);
  const [yorumSayi, setYorumSayi] = useState(reel.comment_count ?? 0);

  /* Uçan kalpler için sayaç */
  /** Uçan kalpler — her biri kendi başlangıç noktasından */
  const [kalpler, setKalpler] = useState<{
    id: number; x: number; y: number; hx: number; hy: number;
  }[]>([]);
  /** Beğeni düğmesinin konumu — kalpler oraya uçuyor */
  const begeniDugmesi = useRef<HTMLButtonElement>(null);

  const [altYorum, setAltYorum] = useState(false);
  const [paylasAcik, setPaylasAcik] = useState(false);

  /*
   * ⚠ VİDEO ADRESİ `videoSrc` İLE KURULUYOR.
   *
   * Önce `assetUrl(storage_key)` kullanılmıştı ve ekran simsiyah
   * kalıyordu: gerçek dosya `{key}/video.mp4` altında duruyor,
   * anahtarın kendisi bir klasör. Poster de `{key}-{boyut}.avif`.
   * Bu iki biçim `lib/media` içinde zaten çözülmüş.
   */
  const medya = reel.video as unknown as MediaRow | null;
  const kaynak = medya ? videoSrc(medya) : null;
  const poster = medya ? posterFor(medya, "full") : null;

  const yol = haberYolu(locale, reel.slug, reel.category_slug);
  const kapak = pickImage((reel.gorseller?.[0] ?? null) as never, "card");

  /*
   * SES İSTEĞİ REF'TE.
   *
   * ⚠ `sesli` bağımlılık listesinde olamaz.
   *
   * Ses açma/kapama TÜM kartlarda ortak bir durum. Oynatma
   * etkisi `sesli`ye bağlıyken her ses değişiminde bütün
   * kartların etkisi yeniden çalışıyordu — bakılmayan videolar
   * da tepki veriyor ve ses yanlış videoya gidiyordu.
   *
   * Ref okunuyor, bağımlılık yok: etki yalnızca `aktif`
   * değişince çalışıyor.
   */
  const sesliRef = useRef(sesli);
  useEffect(() => { sesliRef.current = sesli; }, [sesli]);

  /* ---- yalnızca bakılan kart oynuyor ---- */
  useEffect(() => {
    const v = video.current;
    if (!v) return;

    if (!aktif) {
      /*
       * ⚠ DURDUR, SESSİZE AL, BAŞA SAR.
       * Yalnızca `pause()` yetmiyordu: kaydırma sırasında eski
       * video bir an daha ses veriyor, iki ses üst üste biniyordu.
       */
      v.pause();
      v.muted = true;
      if (v.currentTime > 0) v.currentTime = 0;
      setOynuyor(false);
      return;
    }

    /*
     * ⚠ SESLİ OTOMATİK OYNATMA TARAYICI TARAFINDAN ENGELLİ.
     *
     * Chrome, Safari ve Firefox, kullanıcı sayfayla etkileşime
     * girmeden sesli oynatmayı reddediyor. Kasıtlı bir kural,
     * kodla aşılamıyor.
     *
     * Önce sesli deneniyor; reddedilirse sessize alınıp yeniden
     * deneniyor ki video en azından oynasın.
     */
    v.muted = !sesliRef.current;
    v.play()
      .then(() => { setOynuyor(true); setGercektenSessiz(v.muted); })
      .catch(() => {
        v.muted = true;
        v.play()
          .then(() => { setOynuyor(true); setGercektenSessiz(true); })
          .catch(() => setOynuyor(false));
      });
  }, [aktif]);

  /* Ses isteği değişti — yalnızca AKTİF kart tepki veriyor */
  useEffect(() => {
    const v = video.current;
    if (!v || !aktif) return;
    v.muted = !sesli;
    setGercektenSessiz(v.muted);
  }, [sesli, aktif]);

  /*
   * ⚠ SESSİZ KALDIYSA HER ETKİLEŞİMDE TEKRAR DENE.
   *
   * Tek seferlik dinleyici yetmiyordu: ilk dokunuş kaydırma
   * olabiliyor, o zaman şans harcanıp ses hiç açılmıyordu.
   */
  useEffect(() => {
    if (!aktif || !sesli || !gercektenSessiz) return;

    /*
     * ┌─ ASIL SES HATASI BURADAYDI ⚠️ ───────────────────────────┐
     * │ Eski kod şöyleydi:                                        │
     * │     v.muted = false;                                       │
     * │     setGercektenSessiz(false);   ← doğrulamadan!          │
     * │                                                            │
     * │ Dokunmatikte `pointerdown` ses izni VERMİYOR — izin       │
     * │ yalnızca `touchend`, `click` ve `keydown` ile geliyor.    │
     * │ İzin yokken `muted = false` yapılınca Chrome videoyu      │
     * │ DURDURUYOR.                                                │
     * │                                                            │
     * │ Kod bunu kontrol etmediği için: video duruyor, durum      │
     * │ "sesli" oluyor, dinleyici kapanıyor ve bir daha hiç       │
     * │ denenmiyordu. Kullanıcı mecburen videoya dokunuyordu —    │
     * │ çünkü oradaki `click` gerçekten izin veriyor.             │
     * │                                                            │
     * │ Artık sonuç DOĞRULANIYOR: sesli oynatma reddedilirse      │
     * │ sessize geri dönülüp video devam ettiriliyor ve dinleyici │
     * │ AÇIK kalıyor. Bir sonraki etkileşimde tekrar deneniyor.   │
     * └────────────────────────────────────────────────────────────┘
     */
    async function dene() {
      const v = video.current;
      if (!v) return;

      v.muted = false;
      try {
        await v.play();
        /* Gerçekten sesli oynuyor */
        setGercektenSessiz(false);
      } catch {
        /* İzin yokmuş — sessize dön, video durmasın */
        v.muted = true;
        setGercektenSessiz(true);
        v.play().catch(() => null);
      }
    }
    /*
     * ⚠ HANGİ OLAYLAR "KULLANICI ETKİLEŞİMİ" SAYILIYOR.
     *
     * Tarayıcı yalnızca şunları kabul ediyor: pointerdown,
     * touchend, keydown, click. KAYDIRMA SAYILMIYOR — bu
     * yüzden yalnızca scroll dinlemek işe yaramazdı.
     *
     * Parmakla kaydırma da bir `pointerdown` üretiyor, o
     * yüzden ilk kaydırmada ses açılıyor.
     */
    /*
     * ⚠ `capture: true` — alt öğeler olayı durdursa bile yakala.
     * Yorum kutusu, düğmeler vb. `stopPropagation` çağırıyor;
     * yakalama aşamasında dinlemek bunları da kapsıyor.
     */
    const secenek = { capture: true } as const;
    const olaylar = ["pointerdown", "pointerup", "touchend",
                     "keydown", "click"] as const;

    for (const o of olaylar) {
      document.addEventListener(o, dene, secenek);
    }
    return () => {
      for (const o of olaylar) {
        document.removeEventListener(o, dene, secenek);
      }
    };
  }, [aktif, sesli, gercektenSessiz]);

  /* ---- görüntülenme: 2 saniye sonra ---- */
  useEffect(() => {
    if (!aktif) return;
    const z = setTimeout(() => {
      void sb.rpc("track_article_view", { p_article_id: reel.id })
        .then(undefined, () => null);
    }, 2000);
    return () => clearTimeout(z);
  }, [aktif, reel.id, sb]);

  /* ---- gerçek durum arka planda ---- */
  useEffect(() => {
    if (!girisli || !aktif) return;
    let iptal = false;

    void (async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user || iptal) return;

      const [begeni, kayit] = await Promise.all([
        sb.from("article_likes").select("article_id")
          .eq("article_id", reel.id).eq("user_id", u.user.id).maybeSingle(),
        sb.from("saved_articles").select("article_id")
          .eq("article_id", reel.id).eq("user_id", u.user.id).maybeSingle(),
      ]);
      if (iptal) return;

      const b = Boolean(begeni.data);
      const k = Boolean(kayit.data);
      setBegendi(b); setKaydetti(k);
      yerelYaz(`kb_like_${reel.id}`, b);
      yerelYaz(`kb_save_${reel.id}`, k);
    })();

    return () => { iptal = true; };
  }, [girisli, aktif, reel.id, sb]);

  /* ---- beğeni: beklemeden, hata olursa geri ---- */
  async function begen() {
    if (!girisli) { girisIste(); return; }

    const onceki = { begendi, begeniSayi };
    const yeni = !begendi;

    setBegendi(yeni);
    setBegeniSayi((n) => Math.max(0, n + (yeni ? 1 : -1)));
    yerelYaz(`kb_like_${reel.id}`, yeni);

    const { error } = await sb.rpc("toggle_article_like", { p_article_id: reel.id });
    if (error) {
      setBegendi(onceki.begendi);
      setBegeniSayi(onceki.begeniSayi);
      yerelYaz(`kb_like_${reel.id}`, onceki.begendi);
      t.error("Beğeni kaydedilemedi");
    }
  }

  async function kaydet() {
    if (!girisli) { girisIste(); return; }

    const onceki = kaydetti;
    const yeni = !kaydetti;

    setKaydetti(yeni);
    yerelYaz(`kb_save_${reel.id}`, yeni);

    const { error } = await sb.rpc("toggle_saved_article", { p_article_id: reel.id });
    if (error) {
      setKaydetti(onceki);
      yerelYaz(`kb_save_${reel.id}`, onceki);
      t.error("Kaydedilemedi");
      return;
    }
    /* Mevcut toast sistemine bağlı — ayrı bildirim yok */
    t.success(yeni ? "Haber kaydedildi" : "Kaydedilenlerden çıkarıldı");
  }

  /*
   * Videoya dokunmak duraklatıyor, tekrar dokunmak devam
   * ettiriyor.
   *
   * ⚠ İLK DOKUNUŞ SESİ AÇIYOR, DURDURMUYOR.
   * Tarayıcı sesli oynatmayı reddettiyse kullanıcının ilk
   * dokunuşu izin anlamına geliyor; o dokunuşta video
   * duraklarsa ses hiç açılmıyordu.
   */
  /*
   * DURAKLATMA AÇIK DURUMLA YÖNETİLİYOR
   *
   * ┌─ TOGGLE YAKLAŞIMI ÇÖKÜYORDU ⚠️ ──────────────────────────┐
   * │ Önce "birinci dokunuş duraklat, ikinci dokunuş geri al"  │
   * │ deniyordu. Ama duraklatma fonksiyonunun içinde sessizlik │
   * │ kurtarma dalı vardı ve o dal ERKEN ÇIKIYORDU:            │
   * │                                                            │
   * │   1. dokunuş → sesi açtı, `return` (duraklatma YOK)      │
   * │   2. dokunuş → artık sessiz değil → DURAKLATTI           │
   * │                                                            │
   * │ Net sonuç: çift dokunuşta video duruyordu.               │
   * │                                                            │
   * │ Toggle, "kaç kez çağrıldı" sayısına bağlı olduğu için     │
   * │ araya giren her dal onu bozuyor. Açık durum tutmak        │
   * │ çağrı sayısından bağımsız: hangi sırayla gelirse gelsin   │
   * │ sonuç aynı.                                                │
   * └────────────────────────────────────────────────────────────┘
   */
  const [durdurdu, setDurdurdu] = useState(false);

  /* Durum videoya uygulanıyor */
  useEffect(() => {
    const v = video.current;
    if (!v || !aktif) return;

    if (durdurdu) {
      if (!v.paused) { v.pause(); setOynuyor(false); }
    } else if (v.paused) {
      v.play().then(() => setOynuyor(true)).catch(() => null);
    }
  }, [durdurdu, aktif]);

  /* Kart aktifken duraklatma sıfırlanıyor */
  useEffect(() => { if (aktif) setDurdurdu(false); }, [aktif]);

  /**
   * Sesi açmayı dene.
   *
   * ⚠ DURAKLATMADAN TAMAMEN AYRI.
   * Aynı fonksiyonun içindeyken dokunuşun anlamını
   * değiştiriyordu.
   */
  function sesiAcmayiDene() {
    const v = video.current;
    if (!v || !sesli || !v.muted) return;

    /* Sonuç doğrulanıyor — yukarıdaki `dene` ile aynı sebep */
    v.muted = false;
    v.play()
      .then(() => setGercektenSessiz(false))
      .catch(() => {
        v.muted = true;
        setGercektenSessiz(true);
        v.play().catch(() => null);
      });
  }

  /** Bekleyen tek dokunuş zamanlayıcısı */
  const dokunusZaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (dokunusZaman.current) clearTimeout(dokunusZaman.current);
  }, []);

  /**
   * Videoya dokunma.
   *
   * ┌─ ÇİFT DOKUNUŞ ARTIK HİÇ DURAKLATMIYOR ⚠️ ────────────────┐
   * │ Önce "duraklat, sonra geri al" deniyordu. Mantık doğruydu │
   * │ ama iki dokunuş arasındaki ~150 ms boyunca video          │
   * │ GERÇEKTEN duruyordu ve bu göze çarpıyordu.                │
   * │                                                            │
   * │ Artık duraklatma 260 ms geciktiriliyor. İkinci dokunuş    │
   * │ gelirse zamanlayıcı iptal ediliyor: video hiç durmuyor,   │
   * │ yalnızca beğeni uygulanıyor.                               │
   * │                                                            │
   * │ Bedeli tek dokunuşta 260 ms gecikme — fark edilmiyor,     │
   * │ çünkü duraklatma zaten anlık bir eylem değil.             │
   * └────────────────────────────────────────────────────────────┘
   */
  function videoyaDokun(e: React.MouseEvent | React.PointerEvent) {
    sesiAcmayiDene();

    if (dokunusZaman.current) {
      /* İkinci dokunuş: duraklatma hiç uygulanmıyor */
      clearTimeout(dokunusZaman.current);
      dokunusZaman.current = null;
      void ciftDokunusBegeni(e.clientX, e.clientY);
      return;
    }

    dokunusZaman.current = setTimeout(() => {
      dokunusZaman.current = null;
      setDurdurdu((d) => !d);
    }, 260);
  }

  /** Çift dokunuşla beğen; zaten beğenilmişse geri al */
  async function ciftDokunusBegeni(x: number, y: number) {
    if (!girisli) { girisIste(); return; }

    /*
     * ⚠ ANİMASYON YALNIZCA BEĞENİRKEN.
     * Geri alırken kalp uçurmak yanlış geri bildirim olurdu.
     */
    if (!begendi) {
      const hedef = begeniDugmesi.current?.getBoundingClientRect();
      const kimlik = Date.now() + Math.random();

      setKalpler((p) => [...p, {
        id: kimlik,
        x, y,
        hx: hedef ? hedef.left + hedef.width / 2 : x,
        hy: hedef ? hedef.top + hedef.height / 2 : y - 200,
      }]);

      /* Animasyon bitince temizleniyor */
      setTimeout(() => {
        setKalpler((p) => p.filter((k) => k.id !== kimlik));
      }, 900);
    }

    await begen();
  }

  const tarih = reel.published_at
    ? new Date(reel.published_at).toLocaleDateString(locale, {
        day: "numeric", month: "long",
      })
    : "";

  const paylasAdresi = typeof window !== "undefined"
    ? `${window.location.origin}${yol}` : yol;

  /*
   * KİMLİK: yazar varsa yazarın avatarı ve adı, yoksa haber
   * kaynağının logosu ve adı — haber sayfasındaki mantığın aynısı.
   *
   * ⚠ KOYU TEMADA KAYNAK LOGOSUNUN KOYU SÜRÜMÜ.
   * Logolar genellikle koyu çizim; koyu zeminde kayboluyordu.
   */
  const kimlikAdi = reel.author_name ?? reel.byline ?? reel.kaynak ?? "Kuzeybatı";
  /*
   * ⚠ KAYNAK LOGOSU HER ZAMAN AÇIK TEMA SÜRÜMÜ.
   *
   * Önce temaya göre seçiliyordu. Ama logo yuvarlak ve BEYAZ
   * bir kutunun içinde duruyor (aşağıda `background: #fff`);
   * koyu tema logosu — açık renkli çizim — beyaz üstünde
   * kayboluyordu. Zemin sabit olduğu için logo da sabit.
   */
  const kimlikAvatar = reel.author_avatar
    ? assetUrl(reel.author_avatar)
    : assetUrl(reel.kaynak_logo ?? reel.kaynak_logo_dark);

  function kimlikGorsel(boyut: number, koyuZemin = false) {
    return (
      <span style={{
        width: boyut, height: boyut, borderRadius: "50%",
        background: koyuZemin ? "rgba(255,255,255,.16)" : "var(--s2)",
        display: "grid", placeItems: "center", overflow: "hidden",
        flexShrink: 0, fontSize: boyut * 0.42, fontWeight: 700,
        color: koyuZemin ? "#fff" : "var(--tx)",
      }}>
        {kimlikAvatar
          ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={kimlikAvatar} alt="" style={{
              width: "100%", height: "100%",
              /* Logo kırpılmasın, avatar kutuyu doldursun */
              objectFit: reel.author_avatar ? "cover" : "contain",
              background: reel.author_avatar ? "transparent" : "#fff",
            }} />
          )
          : kimlikAdi.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  const railBoyut = mobil ? 42 : 36;
  const ikonBoyut = mobil ? 25 : 21;

  /* ---------------- oynatıcı ---------------- */
  const oynatici = (yuvarlak: boolean) => (
    <div
      onClick={videoyaDokun}
      onDoubleClick={(e) => e.preventDefault()}
      style={{
        position: "relative", width: "100%", height: "100%",
        background: "#000", cursor: "pointer",
        borderRadius: yuvarlak ? 18 : 0, overflow: "hidden",
        /*
         * ⚠ `touch-action: manipulation` ŞART.
         *
         * Bu olmadan tarayıcı çift dokunuşu "yakınlaştır" diye
         * yorumluyor: beğeni yerine sayfa zoom oluyordu.
         * Ayrıca 300 ms'lik tıklama gecikmesini de kaldırıyor.
         */
        touchAction: "manipulation",
        WebkitUserSelect: "none", userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {kaynak && !videoHata && yakin ? (
        <video
          ref={video}
          src={kaynak}
          poster={poster ?? undefined}
          loop
          muted={!sesli}
          playsInline
          /*
           * ⚠ `preload` GÖRÜNÜRLÜĞE BAĞLI.
           * Hepsi "auto" olsaydı on video aynı anda inerdi;
           * mobil veride dakikalar sürerdi.
           */
          preload={aktif ? "auto" : "none"}
          onCanPlay={() => setHazir(true)}
          onError={() => setVideoHata(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        /*
         * İki durum aynı görünümü paylaşıyor:
         *   • Kart uzakta — video öğesi bilerek basılmıyor
         *   • Video açılamadı — uyarı gösteriliyor
         *
         * ⚠ PENCERELEME BELLEK İÇİN ŞART.
         * Akış sonsuz; her karta `<video>` basılsaydı yüzlerce
         * oynatıcı bellekte kalır, telefon donardı.
         */
        <div style={{ width: "100%", height: "100%", position: "relative", background: "#0a0a0a" }}>
          {(poster ?? kapak) && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={(poster ?? kapak)!} alt="" loading="lazy"
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                opacity: yakin ? .5 : 1,
              }} />
          )}
          {!yakin && !(poster ?? kapak) && (
            <span style={{
              position: "absolute", inset: 0,
              background: "#111",
            }} />
          )}
          {yakin && (
            <span style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              color: "rgba(255,255,255,.7)", fontSize: 13, padding: 20, textAlign: "center",
            }}>
              Video açılamadı
            </span>
          )}
        </div>
      )}

      {!oynuyor && kaynak && !videoHata && yakin && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <span style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)",
            display: "grid", placeItems: "center",
          }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
      )}

      {aktif && kaynak && !hazir && !videoHata && yakin && (
        <span
          aria-label="Yükleniyor"
          style={{
            position: "absolute", insetInlineStart: 14, top: 14,
            width: 18, height: 18, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,.28)",
            borderTopColor: "rgba(255,255,255,.9)",
            animation: "kb-doner .7s linear infinite",
            pointerEvents: "none",
          }}
        />
      )}

    </div>
  );

  /* ---------------- eylem rayı ---------------- */
  const ray = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: mobil ? 13 : 11 }}>
      {[
        { ad: "begeni",
          govde: <OzelIkon ad={begendi ? "heart-solid" : "heart"} size={ikonBoyut} renk="beyaz" />,
          sayi: begeniSayi, tik: begen,
          etiket: begendi ? "Beğeniyi geri al" : "Beğen" },
        { ad: "yorum",
          govde: (
            <svg width={ikonBoyut} height={ikonBoyut} viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
            </svg>
          ),
          sayi: yorumSayi,
          tik: () => { if (mobil || dar) setAltYorum(true); else onYorumAcik(); },
          etiket: "Yorumlar" },
        { ad: "kaydet",
          govde: <OzelIkon ad={kaydetti ? "bookmark-solid" : "bookmark"} size={ikonBoyut - 1} renk="beyaz" />,
          sayi: null, tik: kaydet,
          etiket: kaydetti ? "Kaydedilenlerden çıkar" : "Kaydet" },
        { ad: "paylas",
          govde: (
            <svg width={ikonBoyut - 1} height={ikonBoyut - 1} viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M16 6l-4-4-4 4" /><path d="M12 2v14" />
            </svg>
          ),
          sayi: null, tik: () => setPaylasAcik(true), etiket: "Paylaş" },
      ].map((e) => (
        <button
          key={e.ad}
          type="button"
          onClick={(ev) => { ev.stopPropagation(); void e.tik(); }}
          ref={e.ad === "begeni" ? begeniDugmesi : undefined}
          aria-label={e.etiket}
          title={e.etiket}
          className="kb-reel-btn"
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 3, background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <span style={{ width: railBoyut, height: railBoyut, display: "grid", placeItems: "center" }}>
            {e.govde}
          </span>
          {e.sayi !== null && (
            <span style={{
              fontSize: 11.5, fontWeight: 600, color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,.5)",
            }}>
              {e.sayi > 999 ? `${(e.sayi / 1000).toFixed(1)}b` : e.sayi}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  /** Cam efektli "Habere git" */
  const habereGit = (
    <Link
      href={yol}
      className="kb-cam"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: mobil ? "8px 14px" : "10px 17px",
        borderRadius: 999, textDecoration: "none",
        fontSize: mobil ? 12.5 : 13, fontWeight: 700,
        color: "#fff", whiteSpace: "nowrap",
      }}
    >
      Habere git
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );

  /*
   * UÇAN KALPLER
   *
   * ⚠ `position: fixed` VE EN ÜST KATMAN.
   * Kart içine konsaydı `overflow: hidden` yüzünden kalp
   * videonun kenarında kesilirdi.
   *
   * Hareket CSS değişkenleriyle veriliyor: başlangıç dokunulan
   * nokta, bitiş beğeni düğmesinin merkezi. Böylece kalp
   * gerçekten parmağın bastığı yerden düğmeye uçuyor.
   */
  const ucanKalpler = kalpler.length > 0 ? (
    <div style={{
      position: "fixed", inset: 0, zIndex: 90,
      pointerEvents: "none", overflow: "hidden",
    }}>
      {kalpler.map((k) => (
        <span
          key={k.id}
          className="kb-ucan-kalp"
          style={{
            position: "absolute",
            left: k.x, top: k.y,
            ["--kb-dx" as string]: `${k.hx - k.x}px`,
            ["--kb-dy" as string]: `${k.hy - k.y}px`,
          }}
        >
          {/*
            ⚠ KENDİ KALP İKONUMUZ.
            Elle çizilen SVG yolu orantısız duruyordu; sitenin
            geri kalanında kullanılan ikonla da aynı değildi.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon/heart.png"
            alt=""
            width={96}
            height={96}
            style={{ width: 96, height: 96, display: "block", objectFit: "contain" }}
          />
        </span>
      ))}
    </div>
  ) : null;

  const paylasim = (
    <ShareSheet
      open={paylasAcik}
      onClose={() => setPaylasAcik(false)}
      url={paylasAdresi}
      title={reel.title}
      dict={dict}
      onCopied={() => t.success("Bağlantı kopyalandı")}
    />
  );

  /* ══════════════ MOBİL ══════════════ */
  if (mobil) {
    return (
      <section
        data-sira={sira}
        style={{
          position: "relative",
          /*
           * ⚠ `100dvh` DEĞİL `100%`.
           * `dvh` adres çubuğu gizlenirken değişiyor ve kartlar
           * kaydırırken zıplıyordu. Kapsayıcı tam yükseklikte;
           * yüzde ondan devralınıyor.
           */
          height: "100%",
          scrollSnapAlign: "start", scrollSnapStop: "always",
          background: "#000", overflow: "hidden",
        }}
      >
        {oynatici(false)}

        <div style={{
          position: "absolute", insetInline: 0, bottom: 0, height: "54%",
          background: "linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.5) 42%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* Bilgi — ray genişliği kadar boşluk bırakıyor */}
        <div style={{
          position: "absolute",
          insetInlineStart: 14,
          insetInlineEnd: railBoyut + 24,
          /*
           * ⚠ MOBİLDE ALTTAN DAHA UZAK.
           * Telefon kenarına çok yakındı; parmak kaydırırken
           * yanlışlıkla basılıyordu.
           */
          bottom: "calc(30px + env(safe-area-inset-bottom))",
          zIndex: 2, color: "#fff",
          display: "flex", flexDirection: "column",
          alignItems: "flex-start", gap: 8, minWidth: 0,
        }}>
          <span style={{ marginBottom: 4 }}>{habereGit}</span>

          {reel.category_name && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em",
              textTransform: "uppercase", opacity: .85,
              overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap", maxWidth: "100%",
            }}>
              {reel.category_name}{reel.city_name ? ` · ${reel.city_name}` : ""}
            </span>
          )}

          <Link href={yol} style={{ color: "#fff", textDecoration: "none", maxWidth: "100%" }}>
            <h2 style={{
              fontSize: "clamp(14px, 4vw, 16px)", lineHeight: 1.3, fontWeight: 600,
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden",
              margin: 0, overflowWrap: "anywhere",
            }}>
              {reel.title}
            </h2>
          </Link>

          {/* Instagram tarzı: yuvarlak avatar + ad */}
          <span style={{
            display: "flex", alignItems: "center", gap: 7,
            maxWidth: "100%", minWidth: 0,
          }}>
            {kimlikGorsel(26, true)}
            <span style={{
              fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.92)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {kimlikAdi}
              {tarih ? <span style={{ opacity: .7, fontWeight: 400 }}>{` · ${tarih}`}</span> : null}
            </span>
          </span>
        </div>

        <div style={{
          position: "absolute", insetInlineEnd: 8,
          bottom: "calc(18px + env(safe-area-inset-bottom))", zIndex: 2,
        }}>
          {ray}
        </div>

        <ReelYorumlar
          articleId={reel.id} acik={altYorum}
          onKapat={() => setAltYorum(false)} mobil
          locale={locale} dict={dict} girisli={girisli}
          girisIste={girisIste} onSayi={setYorumSayi}
        />
        {paylasim}
        {ucanKalpler}
      </section>
    );
  }

  /* ══════════════ MASAÜSTÜ ══════════════ */
  const govdeMetni = Array.isArray(reel.body)
    ? reel.body
        .filter((b): b is { type: string; text?: string } => Boolean(b) && typeof b === "object")
        .map((b) => (typeof b.text === "string" ? b.text : ""))
        .filter(Boolean)
        .join("\n\n")
    : "";

  /*
   * ⚠ SÜTUN SAYISI PENCERE GENİŞLİĞİNE GÖRE.
   *
   * Üç sütun sabitken pencere daraltılınca metin ikiye bölünüp
   * taşıyordu. Dar pencerede yan sütunlar kalkıyor, düzen
   * mobildeki gibi tek sütuna dönüyor.
   */
  const sutunlar = dar
    ? "minmax(0, 1fr)"
    : yorumAcik
      ? "minmax(260px, 32%) minmax(0, 1fr) minmax(270px, 320px)"
      : "minmax(300px, 44%) minmax(0, 1fr)";

  return (
    <section
      data-sira={sira}
      style={{
        height: "100%",
        scrollSnapAlign: "start", scrollSnapStop: "always",
        display: "grid", gridTemplateColumns: sutunlar,
        background: "var(--bg)", overflow: "hidden",
      }}
    >
      {!dar && (
        <div style={{
          /*
           * ⚠ ÜSTTE 74px BOŞLUK.
           * Sol üstteki geri düğmesi ve logo sabit konumda
           * duruyor ve haber başlığının üstüne biniyordu.
           */
          padding: "74px 28px 28px 36px", overflowY: "auto",
          borderInlineEnd: "1px solid var(--bd)", minWidth: 0,
        }}>
          {reel.category_name && (
            <span style={{
              display: "inline-block", fontSize: 11.5, fontWeight: 700,
              letterSpacing: ".05em", textTransform: "uppercase",
              color: "var(--ac)", marginBottom: 11,
            }}>
              {reel.category_name}
            </span>
          )}

          <h1 style={{
            fontSize: "clamp(18px, 1.6vw, 25px)", lineHeight: 1.24,
            fontWeight: 700, color: "var(--tx)", marginBottom: 15,
            letterSpacing: "-.01em", overflowWrap: "anywhere",
          }}>
            <Link href={yol} style={{ color: "inherit", textDecoration: "none" }}>
              {reel.title}
            </Link>
          </h1>

          {/* Kapak — başlığın altında, haber sayfasındaki yerin aynısı */}
          {(kapak ?? poster) && (
            <Link href={yol} style={{ display: "block", marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={(kapak ?? poster)!} alt="" loading="lazy"
                style={{
                  width: "100%", aspectRatio: "16 / 9", objectFit: "cover",
                  borderRadius: 12, background: "var(--s2)", display: "block",
                }} />
            </Link>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, minWidth: 0 }}>
            {kimlikGorsel(33)}
            <span style={{ minWidth: 0 }}>
              <span style={{
                display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--tx)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {kimlikAdi}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--mu)", marginTop: 1 }}>
                {tarih}{reel.city_name ? ` · ${reel.city_name}` : ""}
              </span>
            </span>
          </div>

          {reel.summary && (
            <p style={{
              fontSize: 14.5, lineHeight: 1.62, color: "var(--tx)",
              opacity: .88, marginBottom: 15, overflowWrap: "anywhere",
            }}>
              {reel.summary}
            </p>
          )}

          {govdeMetni && (
            <p style={{
              fontSize: 14, lineHeight: 1.7, color: "var(--tx)", opacity: .78,
              marginBottom: 20, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
            }}>
              {govdeMetni.slice(0, 420)}{govdeMetni.length > 420 ? "…" : ""}
            </p>
          )}

          <Link href={yol} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "11px 20px", borderRadius: 11, background: "var(--ac)",
            color: "#fff", fontSize: 13.5, fontWeight: 700, textDecoration: "none",
          }}>
            Habere git
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      )}

      {/* ---- ORTA: video ---- */}
      <div style={{
        minWidth: 0, minHeight: 0, position: "relative", overflow: "hidden",
      }}>
        <VideoCerceve dolgu={dar ? 14 : 24}>
          {oynatici(true)}

          {/*
            Ses ve şehir düğmeleri videonun İÇİNDE.
            Sayfanın köşesinde dururken videodan kopuk
            görünüyorlardı.
          */}
          {ustDugmeler && (
            <div style={{
              position: "absolute", insetInlineEnd: 10, top: 10, zIndex: 4,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {ustDugmeler}
            </div>
          )}

          <div style={{ position: "absolute", insetInlineEnd: 10, bottom: 14, zIndex: 2 }}>
            {ray}
          </div>

          {dar && (
            <>
              <div style={{
                position: "absolute", insetInline: 0, bottom: 0, height: "48%",
                background: "linear-gradient(to top, rgba(0,0,0,.86) 0%, transparent 100%)",
                pointerEvents: "none",
              }} />
              <div style={{
                position: "absolute", insetInlineStart: 14,
                insetInlineEnd: railBoyut + 22, bottom: 16, zIndex: 2,
                color: "#fff", display: "flex", flexDirection: "column",
                alignItems: "flex-start", gap: 8, minWidth: 0,
              }}>
                {habereGit}
                <h2 style={{
                  fontSize: 15, lineHeight: 1.3, fontWeight: 600,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                  margin: 0, overflowWrap: "anywhere",
                }}>
                  {reel.title}
                </h2>
              </div>
            </>
          )}
        </VideoCerceve>
      </div>

      {!dar && yorumAcik && (
        <ReelYorumlar
          articleId={reel.id} acik onKapat={onYorumAcik} mobil={false}
          locale={locale} dict={dict} girisli={girisli}
          girisIste={girisIste} onSayi={setYorumSayi}
        />
      )}

      {dar && (
        <ReelYorumlar
          articleId={reel.id} acik={altYorum}
          onKapat={() => setAltYorum(false)} mobil
          locale={locale} dict={dict} girisli={girisli}
          girisIste={girisIste} onSayi={setYorumSayi}
        />
      )}

      {paylasim}
      {ucanKalpler}
    </section>
  );
}
