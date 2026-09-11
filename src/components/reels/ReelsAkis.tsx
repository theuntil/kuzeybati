"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useGiris } from "@/components/auth/GirisPenceresi";
import { useCity } from "@/components/site/CityProvider";
import { haberYolu, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { pickImage, assetUrl } from "@/lib/media";
import ReelKart from "./ReelKart";
import UstCubuk from "./UstCubuk";
import UygulamaKarti, { type UygulamaAyar } from "./UygulamaKarti";
import type { Reel } from "./tipler";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   REELS AKIŞI

   Videosu olan haberler, dikey kaydırmalı akış.

   ┌─ KARIŞIM SUNUCUDA ────────────────────────────────────────┐
   │  %50 şehir · %40 son ayın popüleri · %10 rastgele         │
   │                                                              │
   │ Oran istemcide hesaplansaydı her sayfa için üç ayrı sorgu │
   │ gerekirdi. `reels_akis` tek çağrıda karıştırılmış liste   │
   │ döndürüyor.                                                  │
   └──────────────────────────────────────────────────────────────┘

   ⚠ GÖRÜLENLER HARİÇ TUTULUYOR.
   Sonraki sayfa istenirken görülen kimlikler gönderiliyor;
   `offset` tek başına yetmiyor çünkü rastgele grup her
   çağrıda değişiyor ve aynı haber tekrar gelebiliyordu.
   ══════════════════════════════════════════════════════════════ */

const SAYFA = 10;

/*
 * ⚠ SINIR YOK — AKIŞ SONSUZ.
 *
 * Sayı sınırı yerine PENCERELEME kullanılıyor: liste büyüse de
 * yalnızca aktif kartın çevresindeki birkaç karta `<video>`
 * öğesi basılıyor (aşağıdaki `YAKIN`). Uzaktakiler yalnızca
 * kapak görseli. Böylece bellek sabit kalıyor.
 *
 * Havuz tükenirse görülenler sıfırlanıp baştan dönülüyor;
 * okur asla duvara çarpmıyor.
 */

/** Aktif kartın kaç komşusunda video öğesi tutulacak */
const YAKIN = 2;

export default function ReelsAkis({
  ilk, locale, dict, girisliBaslangic, sehirSecilmis, logoLight, logoDark, uygulama,
}: {
  ilk: Reel[];
  locale: Locale;
  dict: Dictionary;
  girisliBaslangic: boolean;
  /** Panelden seçilen site logoları — tema başına ayrı */
  logoLight: string | null;
  logoDark: string | null;
  /** Uygulama tanıtım kartı ayarları; kapalıysa null */
  uygulama: UygulamaAyar | null;
  /** Okur şehrini seçmiş mi — seçmemişse akış varsayılanla başlıyor */
  sehirSecilmis: boolean;
}) {
  const sb = supabaseBrowser();
  const { girisIste, girisli } = useGiris();
  const sehir = useCity();

  const [liste, setListe] = useState<Reel[]>(ilk);
  const [aktif, setAktif] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  /*
   * Havuzda hiç video kalmadı.
   *
   * ⚠ BAŞLANGIÇTA `ilk.length < SAYFA` YAZIYORDU.
   *
   * Sitede 10'dan az videolu haber varsa akış daha ilk anda
   * "bitti" sayılıyor ve kaydırma hiç çalışmıyordu. Oysa az
   * içerikte de akış sürmeli — havuz başa dönüyor.
   *
   * Artık yalnızca GERÇEKTEN hiç video yoksa true oluyor.
   */
  const [tukendi, setTukendi] = useState(ilk.length === 0);
  /** Son istek hata verdi — tekrar denenebilir */
  const [hata, setHata] = useState(false);
  /** Masaüstü ama yan sütunlar sığmıyor */
  const [dar, setDar] = useState(false);
  /*
   * ⚠ SES VARSAYILAN AÇIK.
   * Tarayıcı ilk oynatmada reddederse kart geçici olarak
   * sessize düşüyor; ilk dokunuşta kendiliğinden açılıyor.
   */
  const [sesli, setSesli] = useState(true);
  const [yorumAcik, setYorumAcik] = useState(true);
  const [mobil, setMobil] = useState<boolean | null>(null);

  const kapsayici = useRef<HTMLDivElement>(null);
  const gorulen = useRef<Set<string>>(new Set(ilk.map((r) => r.id)));
  /** Havuz kaç kez baştan döndü */
  const donguSayaci = useRef(0);

  /*
   * ŞEHİR ÇAĞRISI
   *
   * ⚠ AKIŞI KESMİYOR.
   *
   * Şehir seçtirmeden akışı kilitlemek düşünüldü ama boş bir
   * ekranla karşılanan okur çoğunlukla geri dönüyor. Akış
   * varsayılan şehirle hemen başlıyor; üstte kapatılabilir
   * ince bir çubuk şehir seçmeyi öneriyor.
   */
  const [sehirCubugu, setSehirCubugu] = useState(!sehirSecilmis);

  /*
   * SAYFA TAM EKRAN
   *
   * ┌─ BAŞLIK NEDEN GERİ GELDİ ⚠️ ─────────────────────────────┐
   * │ Başlık/alt bilgi, ortak yerleşimde `bare` bayrağıyla     │
   * │ gizleniyor ve o bayrak ara katmandan (middleware) gelen  │
   * │ bir başlıkla hesaplanıyor.                                │
   * │                                                            │
   * │ Menüyü `<Link>`e çevirince gezinme SAYFA İÇİ oldu ve      │
   * │ ortak yerleşim yeniden oluşturulmadı — `bare` bir önceki  │
   * │ sayfanın değerinde kaldı, başlık ekranda durdu.           │
   * │                                                            │
   * │ Ara katmana geri dönmek sesi bozardı (tam sayfa yenileme  │
   * │ tarayıcının ses iznini siliyor). Bu yüzden gizleme işini  │
   * │ sayfanın KENDİSİ yapıyor: gövdeye bir sınıf ekleniyor,    │
   * │ CSS başlığı, alt bilgiyi ve sekme çubuğunu kapatıyor.     │
   * │ Hangi gezinme türü olursa olsun çalışıyor.                │
   * └────────────────────────────────────────────────────────────┘
   */
  useEffect(() => {
    const kok = document.documentElement;
    kok.classList.add("kb-reels-modu");
    return () => kok.classList.remove("kb-reels-modu");
  }, []);

  useEffect(() => {
    /*
     * ⚠ İKİ EŞİK.
     *
     * 760px altı mobil düzen. 760–1100 arası masaüstü ama
     * üç sütun sığmıyor: yan sütunlar kalkıyor, video
     * ortalanıyor. Tek eşik varken pencere daraltılınca
     * metin ikiye bölünüp taşıyordu.
     */
    const mobilMq = window.matchMedia("(max-width: 760px)");
    const darMq = window.matchMedia("(max-width: 1100px)");
    const olc = () => {
      setMobil(mobilMq.matches);
      setDar(!mobilMq.matches && darMq.matches);
    };
    olc();
    mobilMq.addEventListener("change", olc);
    darMq.addEventListener("change", olc);
    return () => {
      mobilMq.removeEventListener("change", olc);
      darMq.removeEventListener("change", olc);
    };
  }, []);

  /* ---- sonraki sayfa ---- */
  const dahaGetir = useCallback(async () => {
    if (yukleniyor || tukendi) return;
    setYukleniyor(true);
    setHata(false);

    const { data, error } = await sb.rpc("reels_akis", {
      p_sehir: sehir.slug || null,
      p_limit: SAYFA,
      p_offset: 0,
      p_haric: Array.from(gorulen.current),
    });

    setYukleniyor(false);

    /*
     * ⚠ HATA `bitti` DEMEK DEĞİL.
     *
     * Önce her hatada `setBitti(true)` yapılıyordu: tek bir ağ
     * kesintisi akışı kalıcı olarak durduruyor, kullanıcı
     * "10'dan sonra hiçbir şey gelmiyor" görüyordu. Artık hata
     * ayrı tutuluyor ve tekrar denenebiliyor.
     */
    if (error) { setHata(true); return; }

    let yeni = ((data as { haberler?: Reel[] } | null)?.haberler ?? [])
      .filter((r) => !gorulen.current.has(r.id));

    /*
     * ⚠ HAVUZ BİTTİ — BAŞA DÖNÜLÜYOR.
     *
     * Sitede kaç videolu haber varsa o kadar; hepsi görülünce
     * akış duruyordu. Görülenler sıfırlanıp yeniden isteniyor,
     * içerik baştan dönüyor. Sonsuz akış bu şekilde sağlanıyor.
     */
    if (!yeni.length) {
      donguSayaci.current += 1;
      gorulen.current.clear();

      const { data: d2 } = await sb.rpc("reels_akis", {
        p_sehir: sehir.slug || null,
        p_limit: SAYFA,
        p_offset: 0,
        p_haric: [],
      });

      /*
       * ⚠ SIFIRLAMADAN SONRA DA BOŞSA GERÇEKTEN BİTMİŞTİR.
       * Hariç tutulan hiçbir şey yokken boş dönüyorsa sitede
       * yayında videolu haber kalmamış demektir.
       */
      yeni = ((d2 as { haberler?: Reel[] } | null)?.haberler ?? []);
      if (!yeni.length) { setTukendi(true); return; }
    }

    for (const r of yeni) gorulen.current.add(r.id);
    setListe((p) => [...p, ...yeni]);
  }, [sb, sehir.slug, yukleniyor, tukendi]);

  /* ---- hangi kart görünüyor ---- */
  useEffect(() => {
    const kok = kapsayici.current;
    if (!kok) return;

    /*
     * ┌─ ÖNCE IntersectionObserver KULLANILIYORDU ⚠️ ───────────┐
     * │ Eşik `threshold: [0.6]` ve koşul `ratio > 0.6` idi.      │
     * │                                                            │
     * │ Geri çağrı tam eşiğin ÜSTÜNDE tetikleniyor: gelen oran    │
     * │ 0.6000000001 de olabiliyor 0.5999999 da. İkincisinde       │
     * │ koşul tutmuyor ve aktif kart HİÇ güncellenmiyordu.        │
     * │ Ayrıca `scroll-snap` ile hızlı kaydırmada tarayıcı ara     │
     * │ durumları tamamen atlıyor, tek bir geri çağrı bile         │
     * │ gelmiyordu.                                                 │
     * │                                                            │
     * │ Sonuç iki katmanlıydı: `aktif` 0'da takılı kalıyordu, bu   │
     * │ yüzden (1) ses hep ilk videoya gidiyor, (2) sonraki sayfa  │
     * │ hiç istenmiyordu — "10 reels'ten sonrası gelmiyor".        │
     * └────────────────────────────────────────────────────────────┘
     *
     * Her kart tam olarak kapsayıcı yüksekliğinde ve snap
     * zorunlu; dolayısıyla aktif kart basit bir bölme işlemi:
     *     index = round(scrollTop / clientHeight)
     * Kaçırma ihtimali yok.
     */
    let bekleyen = 0;

    function olc() {
      bekleyen = 0;
      const k = kapsayici.current;
      if (!k) return;

      const yukseklik = k.clientHeight;
      if (yukseklik <= 0) return;

      const i = Math.round(k.scrollTop / yukseklik);
      setAktif((onceki) => (onceki === i ? onceki : i));
    }

    function kaydirma() {
      /* rAF ile sınırlanıyor: her kaydırma olayında hesap yok */
      if (bekleyen) return;
      bekleyen = requestAnimationFrame(olc);
    }

    olc();
    kok.addEventListener("scroll", kaydirma, { passive: true });
    window.addEventListener("resize", kaydirma);
    return () => {
      if (bekleyen) cancelAnimationFrame(bekleyen);
      kok.removeEventListener("scroll", kaydirma);
      window.removeEventListener("resize", kaydirma);
    };
    /*
     * ⚠ `mobil` BAĞIMLILIKTA OLMAK ZORUNDA.
     *
     * ┌─ ASIL HATA BURADAYDI ────────────────────────────────┐
     * │ `mobil` başlangıçta `null` ve bileşen o sırada        │
     * │ `return null` yapıyor — kapsayıcı DOM'da yok.         │
     * │                                                        │
     * │ Etki boş bağımlılıkla (`[]`) bir kez, tam da o anda   │
     * │ çalışıyor, `kapsayici.current` null olduğu için       │
     * │ erken çıkıyor ve BİR DAHA HİÇ ÇALIŞMIYORDU.          │
     * │                                                        │
     * │ Yani kaydırma dinleyicisi hiçbir zaman kurulmuyordu.  │
     * │ `aktif` sıfırda kalıyor, bu yüzden:                    │
     * │   • ses hep ilk videoya gidiyor                        │
     * │   • kaydırınca yeni video oynamıyor                    │
     * │   • sonraki sayfa hiç istenmiyor (10'da kalıyor)      │
     * │                                                        │
     * │ Önceki IntersectionObserver sürümü de aynı sebeple    │
     * │ ölüydü; eşik hesabını düzeltmek bu yüzden işe          │
     * │ yaramamıştı.                                            │
     * └────────────────────────────────────────────────────────┘
     */
  }, [mobil]);

  /* Sona yaklaşınca yeni sayfa */
  /*
   * ⚠ 4 KART KALA İSTENİYOR.
   *
   * Sona gelince istemek geç: video indirmesi bitmeden okur
   * boşluğa çarpıyordu. Dört kart önceden başlayınca sıradaki
   * sayfa çoğunlukla hazır oluyor.
   */
  useEffect(() => {
    if (hata) return;
    if (aktif >= liste.length - 4) void dahaGetir();
  }, [aktif, liste.length, dahaGetir, hata]);

  /* ---- klavye ---- */
  useEffect(() => {
    function tus(e: KeyboardEvent) {
      const kok = kapsayici.current;
      if (!kok) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const yon = e.key === "ArrowDown" ? 1 : -1;
        const hedef = Math.min(Math.max(aktif + yon, 0), liste.length - 1);
        kok.querySelector<HTMLElement>(`[data-sira="${hedef}"]`)
          ?.scrollIntoView({ behavior: "smooth" });
      }
      if (e.key === "m") setSesli((s) => !s);
    }
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [aktif, liste.length]);

  /*
   * Haberler + tanıtım kartları tek listede.
   *
   * ⚠ SON ÜÇLÜDEN SONRA REKLAM KOYULMUYOR.
   * Liste büyürken sona reklam eklenirse, yeni haberler
   * geldiğinde reklam ortada kalıyor ve sıra kayıyordu.
   */
  const ogeler = (() => {
    const o: { tur: "haber" | "reklam"; reel?: Reel; domSira: number }[] = [];
    let sira = 0;

    liste.forEach((r, i) => {
      o.push({ tur: "haber", reel: r, domSira: sira++ });

      /*
       * ⚠ ARALIK: İLK 3, SONRA 7'DE BİR.
       *
       * Yani 3 · 10 · 17 · 24 … kaçıncı haberden SONRA
       * geldiğini sayıyor.
       *
       * Önce "her üç haberde bir" yazılmıştı; akışın üçte biri
       * reklam oluyordu. İlk kart erken çıkıp uygulamayı
       * tanıtıyor, sonrası seyrekleşiyor.
       */
      const n = i + 1;
      const reklamSirasi = n === 3 || (n > 3 && (n - 3) % 7 === 0);
      const sonuncu = i === liste.length - 1;

      if (uygulama && reklamSirasi && !sonuncu) {
        o.push({ tur: "reklam", domSira: sira++ });
      }
    });
    return o;
  })();

  if (mobil === null) return null;

  /*
   * Ses ve şehir düğmeleri.
   *
   * ⚠ İKİ YERDE KULLANILIYOR: mobilde ekranın sağ üstünde,
   * masaüstünde videonun sağ üstünde. Tek yerde tanımlanıp
   * aşağı geçiriliyor ki iki kopya birbirinden ayrışmasın.
   */
  const sesDugmesi = (
    <button
      type="button"
      onClick={() => setSesli((s) => !s)}
      className={mobil ? "kb-cam" : "kb-cam"}
      aria-label={sesli ? "Sesi kapat" : "Sesi aç"}
      title={sesli ? "Sesi kapat" : "Sesi aç"}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        display: "grid", placeItems: "center",
        border: "none", cursor: "pointer", padding: 0,
        color: "#fff", pointerEvents: "auto", flexShrink: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {sesli
          ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>
          : <><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>}
      </svg>
    </button>
  );

  /*
   * ┌─ MASAÜSTÜNDE CAM EFEKTİ YANLIŞ ⚠️ ────────────────────────┐
   * │ `kb-cam` yarı saydam BEYAZ bir zemin + beyaz yazı.        │
   * │ Mobilde düğme videonun üstünde durduğu için bu doğru.     │
   * │                                                              │
   * │ Masaüstünde ise düğme üst şeritte, sayfa zemininin        │
   * │ üstünde. Orada beyaz üstüne beyaz yazı okunmuyordu.       │
   * │                                                              │
   * │ Masaüstünde tema değişkenleri kullanılıyor: zemin `--s2`, │
   * │ yazı `--tx`. Böylece hem koyu hem açık temada kontrast    │
   * │ doğru ve düğme yanındaki geri/tema düğmeleriyle aynı      │
   * │ görünüyor — onlar da `var(--tx)` kullanıyor.              │
   * └──────────────────────────────────────────────────────────────┘
   */
  const sehirDugmesi = (
    <button
      type="button"
      onClick={() => sehir.open()}
      className={mobil ? "kb-cam" : undefined}
      aria-label="Şehir seç"
      title="Şehri değiştir"
      style={{
        height: 36, borderRadius: 999,
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "0 13px", cursor: "pointer",
        fontSize: 12.5, fontWeight: 700,
        pointerEvents: "auto", flexShrink: 0, whiteSpace: "nowrap",
        maxWidth: 150, overflow: "hidden",
        ...(mobil
          ? { color: "#fff", border: "none" }
          : {
              color: "var(--tx)",
              background: "var(--s2)",
              border: "1px solid var(--bd)",
            }),
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.6" />
      </svg>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {/* Seçili şehrin adı — "Şehir seç" yerine */}
        {sehir.name || "Şehir seç"}
      </span>
    </button>
  );

  if (!liste.length) {
    return (
      <div style={{
        display: "grid", placeItems: "center",
        minHeight: "60vh", padding: 40, textAlign: "center",
      }}>
        <div>
          <p style={{ fontSize: 15, color: "var(--mu)", marginBottom: 6 }}>
            {"Henüz videolu haber yok."}
          </p>
          <p style={{ fontSize: 13.5, color: "var(--mu)", opacity: .8 }}>
            {"Yeni videolar eklendiğinde burada görünecek."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={kapsayici}
      className="kb-reels-kok"
      style={{
        /*
         * ⚠ SCROLL SNAP.
         * Her kart tam ekranda duruyor; Reels hissinin
         * temeli bu. `proximity` değil `mandatory` — yarım
         * kalmış kaydırma kartı ortada bırakıyordu.
         */
        /*
         * ⚠ TAM EKRAN.
         *
         * Başlık ve alt menü bu sayfada gizlendiği için
         * yükseklikten pay ayırmaya gerek yok. Önce
         * `calc(100dvh - var(--hh))` yazıyordu ve başlık
         * gizlenince kartlar alttan taşıyordu.
         */
        /*
         * ⚠ `fixed` — akışta değil.
         * Normal akışta kalsaydı başlığın altından başlıyor ve
         * alttan taşıyordu. Ekranı komple kaplıyor.
         */
        position: "fixed", inset: 0,
        zIndex: 70,
        height: "100dvh", width: "100%",
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        overscrollBehavior: "contain",
        background: mobil ? "#000" : "var(--bg)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <UstCubuk
        locale={locale}
        mobil={mobil}
        logoLight={logoLight}
        logoDark={logoDark}
        sehirDugmesi={sehirDugmesi}
      />

      {/*
        SAĞ ÜST: ses · şehir — YALNIZCA MOBİL.

        ⚠ Masaüstünde bu düğmeler sayfanın köşesinde duruyordu,
        videonun değil. Video ortada dar bir sütun olduğu için
        düğmeler ondan kopuk görünüyordu. Artık masaüstünde
        videonun kendi sağ üstüne basılıyor (ReelKart içinde).
      */}
      {mobil && (
        <div style={{
          position: "fixed",
          top: "calc(11px + env(safe-area-inset-top))",
          insetInlineEnd: 11, zIndex: 46,
          display: "flex", alignItems: "center", gap: 9,
          pointerEvents: "none",
        }}>
          {sesDugmesi}
          {sehirDugmesi}
        </div>
      )}

      {/*
        AKIŞ ÖRÜLÜYOR: her üç haberden sonra tanıtım kartı.

        ⚠ İNDİS KAYMASI.
        Aktif kart hesabı `round(scrollTop / yükseklik)` ile
        yapılıyor ve DOM'daki SIRAYA bakıyor. Tanıtım kartları
        da birer sıra kaplıyor; haberin DOM sırası artık dizi
        indisine eşit değil. `domSira` bunu taşıyor, yoksa
        yanlış video oynardı.
      */}
      {ogeler.map(({ tur, reel, domSira }) =>
        tur === "reklam" ? (
          <UygulamaKarti
            key={`reklam-${domSira}`}
            ayar={uygulama!}
            mobil={mobil}
            dar={dar}
          />
        ) : (
        <ReelKart
          /*
           * ⚠ ANAHTAR SIRAYLA BİRLİKTE.
           * Havuz baştan dönünce aynı haber listede iki kez
           * bulunabiliyor; yalnızca `id` anahtar olsaydı React
           * çakışma uyarısı verir ve kartları karıştırırdı.
           */
          key={`${reel!.id}-${domSira}`}
          yakin={Math.abs(domSira - aktif) <= YAKIN}
          reel={reel!}
          sira={domSira}
          aktif={domSira === aktif}
          mobil={mobil}
          dar={dar}
          sesli={sesli}
          yorumAcik={yorumAcik}
          onYorumAcik={() => setYorumAcik((y) => !y)}
          locale={locale}
          dict={dict}
          girisli={girisli || girisliBaslangic}
          girisIste={girisIste}
          /*
            Şehir düğmesi artık sol üstteki şeritte (UstCubuk).
            Videonun köşesinde yalnızca ses kalıyor — o gerçekten
            bir video denetimi.
          */
          ustDugmeler={!mobil ? sesDugmesi : null}
        />
        ),
      )}

      {/* Yükleniyor — iskelet kart */}
      {yukleniyor && (
        <div
          className="kb-reel-iskelet"
          style={{
            height: "100%", scrollSnapAlign: "start",
            display: "grid", placeItems: "center",
            background: mobil ? "#000" : "var(--bg)",
          }}
        >
          <div style={{
            width: mobil ? "100%" : "min(46vh, 88vw)",
            height: mobil ? "100%" : "84%",
            borderRadius: mobil ? 0 : 18,
            background: mobil ? "#0d0d0d" : "var(--s2)",
          }} />
        </div>
      )}

      {/* Hata — tekrar denenebilir */}
      {hata && !yukleniyor && (
        <div style={{
          height: "100%", scrollSnapAlign: "start",
          display: "grid", placeItems: "center",
          background: mobil ? "#000" : "var(--bg)", padding: 30,
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontSize: 14.5, marginBottom: 16,
              color: mobil ? "rgba(255,255,255,.8)" : "var(--tx)",
            }}>
              Daha fazla video yüklenemedi.
            </p>
            <button
              type="button"
              onClick={() => { setHata(false); void dahaGetir(); }}
              style={{
                padding: "11px 22px", borderRadius: 11, border: "none",
                background: "var(--ac)", color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Tekrar dene
            </button>
          </div>
        </div>
      )}

      {/* Havuz bitti */}
      {tukendi && !yukleniyor && liste.length > 0 && (
        <div style={{
          height: "100%", scrollSnapAlign: "start",
          display: "grid", placeItems: "center",
          background: mobil ? "#000" : "var(--bg)", padding: 30,
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontSize: 15, fontWeight: 700, marginBottom: 6,
              color: mobil ? "#fff" : "var(--tx)",
            }}>
              Hepsi bu kadar
            </p>
            <p style={{
              fontSize: 13.5, marginBottom: 18,
              color: mobil ? "rgba(255,255,255,.6)" : "var(--mu)",
            }}>
              {liste.length} video izledin.
            </p>
            <Link
              href={`/${locale}`}
              style={{
                display: "inline-block", padding: "11px 22px",
                borderRadius: 11, background: "var(--ac)", color: "#fff",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
              }}
            >
              Ana sayfaya dön
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export { pickImage, assetUrl, haberYolu };
