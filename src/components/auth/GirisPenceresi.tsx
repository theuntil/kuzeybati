"use client";
import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/* ══════════════════════════════════════════════════════════════
   GİRİŞ PENCERESİ

   ┌─ SAYFA DEĞİŞTİRMİYOR ⚠️ ──────────────────────────────────┐
   │ Beğenme, yorum, kaydetme… giriş isteyen her işlem okuru    │
   │ `/giris` sayfasına atıyordu. Okur haberi kaybediyor,       │
   │ girişten sonra geri dönmek zorunda kalıyordu.               │
   │                                                              │
   │ Artık bulunduğu sayfada pencere açılıyor: masaüstünde       │
   │ ortada, mobilde alttan yükselen sayfa. Giriş yapınca        │
   │ pencere kapanıyor ve okur kaldığı yerden devam ediyor.      │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TEK YERDEN AÇILIYOR ⚠️ ──────────────────────────────────┐
   │ Bağlam (context) üzerinden: hangi bileşen olursa olsun     │
   │ `girisIste()` çağırıyor. Her bileşen kendi penceresini      │
   │ taşısaydı sayfada onlarca kopya olurdu.                     │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Baglam {
  /** Giriş penceresini açar. Zaten girişliyse hiçbir şey yapmaz. */
  girisIste: () => void;
  /** Oturum var mı — bileşenler buna göre davranıyor */
  girisli: boolean;
  hazir: boolean;
}

/* ══════════════════════════════════════════════════════════════
   METİNLER

   ⚠ Sözlükten değil, buradan.
   Pencere sözlüğün yüklenmediği yerlerde de (istemci bileşeni)
   açılabiliyor. Beş kısa metin için sözlüğü prop olarak
   taşımaktansa burada tutmak daha basit — dil kodu zaten
   adresten okunabiliyor.
   ══════════════════════════════════════════════════════════════ */
const METIN: Record<string, Record<string, string>> = {
  tr: {
    sifre2: "Şifre tekrar",
    h_eposta_bos: "E-posta adresini yaz", h_sifre_bos: "Şifre yaz",
    h_eposta_at: "E-postada @ işareti olmalı",
    h_eposta_turkce: "E-postada Türkçe karakter kullanılamaz",
    h_eposta_bosluk: "E-postada boşluk olamaz",
    h_uyusmuyor: "Şifreler aynı değil",
    h_cok_deneme: "Çok fazla deneme, biraz bekle",
    devam: "Devam", geri: "Geri", adim2_alt: "Son birkaç bilgi",
    h_eposta: "Geçerli bir e-posta yaz", h_kisa: "Şifre en az 6 karakter olmalı",
    kayit_baslik: "Hesap oluştur", giris_baslik: "Giriş yap",
    kayit_alt: "Birkaç saniye sürer", giris_alt: "Tekrar hoş geldin",
    eposta_ile: "veya e-posta ile",
    ad: "Ad", soyad: "Soyad", sehir: "Şehir", sec: "Seç",
    h_sehir: "Şehir seçmelisin — hava durumu ve namaz vakitleri buna göre gösteriliyor.",
    eposta: "E-posta", sifre: "Şifre",
    kayit_btn: "Hesap Oluştur", giris_btn: "Giriş Yap",
    var_mi: "Zaten hesabın var mı?", yok_mu: "Hesabın yok mu?",
    giris_link: "Giriş yap", kayit_link: "Kayıt ol",
    kapat: "Kapat",
    h_bos: "E-posta ve şifre gerekli",
    h_yanlis: "E-posta ya da şifre hatalı",
    h_kayitli: "Bu e-posta zaten kayıtlı",
    h_kayit: "Kayıt yapılamadı",
    h_sosyal: "Bu giriş yöntemi şu an kullanılamıyor",
    h_acildi: "Hesap açıldı, şimdi giriş yapabilirsin",
  },
  en: {
    sifre2: "Confirm password",
    h_eposta_bos: "Enter your email", h_sifre_bos: "Enter a password",
    h_eposta_at: "Email must contain @",
    h_eposta_turkce: "Email cannot contain special letters",
    h_eposta_bosluk: "Email cannot contain spaces",
    h_uyusmuyor: "Passwords do not match",
    h_cok_deneme: "Too many attempts, please wait",
    devam: "Continue", geri: "Back", adim2_alt: "A few last details",
    h_eposta: "Enter a valid email", h_kisa: "Password must be at least 6 characters",
    kayit_baslik: "Create account", giris_baslik: "Sign in",
    kayit_alt: "Takes a few seconds", giris_alt: "Welcome back",
    eposta_ile: "or with email",
    ad: "First name", soyad: "Last name", sehir: "City", sec: "Select",
    h_sehir: "Please select a city — weather and prayer times depend on it.",
    eposta: "Email", sifre: "Password",
    kayit_btn: "Create Account", giris_btn: "Sign In",
    var_mi: "Already have an account?", yok_mu: "Don't have an account?",
    giris_link: "Sign in", kayit_link: "Sign up",
    kapat: "Close",
    h_bos: "Email and password are required",
    h_yanlis: "Wrong email or password",
    h_kayitli: "This email is already registered",
    h_kayit: "Could not create account",
    h_sosyal: "This sign-in method is unavailable",
    h_acildi: "Account created, you can sign in now",
  },
  ar: {
    sifre2: "تأكيد كلمة المرور",
    h_eposta_bos: "أدخل بريدك الإلكتروني", h_sifre_bos: "أدخل كلمة المرور",
    h_eposta_at: "يجب أن يحتوي البريد على @",
    h_eposta_turkce: "لا يمكن استخدام حروف خاصة في البريد",
    h_eposta_bosluk: "لا يمكن أن يحتوي البريد على مسافات",
    h_uyusmuyor: "كلمتا المرور غير متطابقتين",
    h_cok_deneme: "محاولات كثيرة، انتظر قليلاً",
    devam: "متابعة", geri: "رجوع", adim2_alt: "بعض التفاصيل الأخيرة",
    h_eposta: "أدخل بريدًا إلكترونيًا صالحًا", h_kisa: "كلمة المرور 6 أحرف على الأقل",
    kayit_baslik: "إنشاء حساب", giris_baslik: "تسجيل الدخول",
    kayit_alt: "يستغرق بضع ثوان", giris_alt: "مرحبًا بعودتك",
    eposta_ile: "أو بالبريد الإلكتروني",
    ad: "الاسم", soyad: "اللقب", sehir: "المدينة", sec: "اختر",
    h_sehir: "يرجى اختيار مدينة — تعتمد عليها حالة الطقس ومواقيت الصلاة.",
    eposta: "البريد الإلكتروني", sifre: "كلمة المرور",
    kayit_btn: "إنشاء حساب", giris_btn: "تسجيل الدخول",
    var_mi: "لديك حساب بالفعل؟", yok_mu: "ليس لديك حساب؟",
    giris_link: "تسجيل الدخول", kayit_link: "إنشاء حساب",
    kapat: "إغلاق",
    h_bos: "البريد الإلكتروني وكلمة المرور مطلوبان",
    h_yanlis: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    h_kayitli: "هذا البريد مسجل بالفعل",
    h_kayit: "تعذر إنشاء الحساب",
    h_sosyal: "طريقة الدخول هذه غير متاحة",
    h_acildi: "تم إنشاء الحساب، يمكنك تسجيل الدخول الآن",
  },
  ru: {
    sifre2: "Повторите пароль",
    h_eposta_bos: "Введите почту", h_sifre_bos: "Введите пароль",
    h_eposta_at: "В почте должен быть символ @",
    h_eposta_turkce: "В почте нельзя использовать особые буквы",
    h_eposta_bosluk: "В почте не может быть пробелов",
    h_uyusmuyor: "Пароли не совпадают",
    h_cok_deneme: "Слишком много попыток, подождите",
    devam: "Далее", geri: "Назад", adim2_alt: "Ещё пара деталей",
    h_eposta: "Введите корректную почту", h_kisa: "Пароль минимум 6 символов",
    kayit_baslik: "Создать аккаунт", giris_baslik: "Вход",
    kayit_alt: "Займёт пару секунд", giris_alt: "С возвращением",
    eposta_ile: "или по эл. почте",
    ad: "Имя", soyad: "Фамилия", sehir: "Город", sec: "Выберите",
    h_sehir: "Выберите город — от него зависят погода и время намаза.",
    eposta: "Эл. почта", sifre: "Пароль",
    kayit_btn: "Создать аккаунт", giris_btn: "Войти",
    var_mi: "Уже есть аккаунт?", yok_mu: "Нет аккаунта?",
    giris_link: "Войти", kayit_link: "Регистрация",
    kapat: "Закрыть",
    h_bos: "Нужны эл. почта и пароль",
    h_yanlis: "Неверная почта или пароль",
    h_kayitli: "Эта почта уже зарегистрирована",
    h_kayit: "Не удалось создать аккаунт",
    h_sosyal: "Этот способ входа недоступен",
    h_acildi: "Аккаунт создан, теперь войдите",
  },
};

/*
 * ⚠ `as const` YOK.
 * Onunla her metin kendi sabit tipine kilitleniyor ve
 * İngilizce set Türkçe sete atanamıyor:
 *   Type '"Create account"' is not assignable to type 'Hesap oluştur'
 */
type MetinSeti = Record<keyof typeof METIN.tr, string>;

/** Adresten dil kodu — sözlük prop'u taşımaya gerek kalmıyor */
function dilOku(): MetinSeti {
  if (typeof window === "undefined") return METIN.tr as MetinSeti;
  const ilk = window.location.pathname.split("/").filter(Boolean)[0];
  if (ilk === "en") return METIN.en as MetinSeti;
  if (ilk === "ar") return METIN.ar as MetinSeti;
  if (ilk === "ru") return METIN.ru as MetinSeti;
  return METIN.tr as MetinSeti;
}

const Ctx = createContext<Baglam>({
  girisIste: () => {},
  girisli: false,
  hazir: false,
});

export function useGiris() {
  return useContext(Ctx);
}

export function GirisSaglayici({ children }: { children: React.ReactNode }) {
  const sb = supabaseBrowser();
  const [acik, setAcik] = useState(false);
  const [girisli, setGirisli] = useState(false);
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      const { data } = await sb.auth.getUser();
      if (iptal) return;
      setGirisli(Boolean(data.user));
      setHazir(true);
    })();

    /* Başka sekmede giriş yapılırsa burada da yansısın */
    const { data: sub } = sb.auth.onAuthStateChange((_e: string, session: { user?: unknown } | null) => {
      setGirisli(Boolean(session?.user));
      if (session?.user) setAcik(false);
    });
    return () => { iptal = true; sub.subscription.unsubscribe(); };
  }, [sb]);

  const girisIste = useCallback(() => {
    if (girisli) return;
    setAcik(true);
  }, [girisli]);

  return (
    <Ctx.Provider value={{ girisIste, girisli, hazir }}>
      {children}
      <GirisModal acik={acik} onKapat={() => setAcik(false)} />
    </Ctx.Provider>
  );
}

/* ══════════════════════════════════════════════════════════════ */

function GirisModal({ acik, onKapat }: { acik: boolean; onKapat: () => void }) {
  const sb = supabaseBrowser();
  /*
   * ⚠ EKRAN GENİŞLİĞİ BİLİNENE KADAR PENCERE ÇİZİLMİYOR.
   *
   * `mobil` başlangıçta `false` idi: ilk çizimde MASAÜSTÜ
   * stili uygulanıyordu (`translate(-50%,-50%) scale(.92)`).
   * Efekt çalışıp `mobil = true` yapınca stil mobil bloğa
   * geçiyor (`translateY(100%)`) ve `transition` tanımlı
   * olduğu için tarayıcı ikisi arasında ANİMASYON yapıyordu.
   *
   * Sonuç: her sayfa açılışında pencere bir an görünüp
   * aşağı kayarak kayboluyordu.
   */
  const [mobil, setMobil] = useState<boolean | null>(null);

  /*
   * Pencere ilk kez açılana kadar DOM'a hiç basılmıyor.
   * Böylece açılış animasyonu da doğru başlıyor: kapalı
   * konumdan açık konuma, aradaki stil sıçraması olmadan.
   */
  const [monte, setMonte] = useState(false);
  useEffect(() => { if (acik) setMonte(true); }, [acik]);
  const [mod, setMod] = useState<"kayit" | "giris">("kayit");
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [sehir, setSehir] = useState("");
  /*
   * ⚠ ŞEHİR LİSTESİ VERİTABANINDAN.
   *
   * Sekiz ili elle yazmıştım ve `city` anahtarıyla ADINI
   * gönderiyordum. Profil tetikleyicisi ise `city_slug`
   * bekliyor ve şehri `cities.slug` ile eşleştiriyor —
   * gönderdiğim ad hiçbir şeyle eşleşmiyor, şehir boş
   * kalıyordu. Panel de "eksik bilgi" diyordu.
   */
  const [sehirler, setSehirler] = useState<{ slug: string; name: string }[]>([]);
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [s, setS] = useState<MetinSeti>(METIN.tr as MetinSeti);
  const [rtl, setRtl] = useState(false);
  /*
   * ⚠ KAYIT İKİ ADIMDA.
   * Beş alan birden görünce form uzun ve caydırıcı duruyordu.
   * 1. adım: e-posta + şifre (asıl gerekli olanlar)
   * 2. adım: ad, soyad, şehir (profil bilgileri)
   */
  const [adim, setAdim] = useState<1 | 2>(1);

  /* Dil istemcide okunuyor: sunucu render'ında adres bilinmiyor */
  /* İl listesi pencere ilk açıldığında çekiliyor */
  useEffect(() => {
    if (!acik || sehirler.length > 0) return;
    void (async () => {
      /*
       * ⚠ TABLO ADI DOĞRULANDI.
       * `public_cities` yazmıştım, öyle bir görünüm yok.
       * Site zaten `cities` tablosunu okuyor (anon'a açık).
       */
      const { data } = await sb
        .from("cities")
        .select("slug, name")
        .eq("is_active", true)
        .eq("is_domestic", true)
        .order("plate_code");
      setSehirler((data ?? []) as { slug: string; name: string }[]);
    })();
  }, [acik, sehirler.length, sb]);

  useEffect(() => {
    setS(dilOku());
    if (!acik) setAdim(1);
    /* Arapça sağdan sola — etiketler ve girdiler ters hizalanmalı */
    const ilk = window.location.pathname.split("/").filter(Boolean)[0];
    setRtl(ilk === "ar");
  }, [acik]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const olc = () => setMobil(!mq.matches);
    olc();
    mq.addEventListener("change", olc);
    return () => mq.removeEventListener("change", olc);
  }, []);

  /* Pencere açıkken arka plan kaymasın */
  useEffect(() => {
    if (!acik) return;
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = eski;
      window.removeEventListener("keydown", esc);
    };
  }, [acik, onKapat]);

  /** Google / Apple ile giriş */
  async function sosyal(saglayici: "google" | "apple") {
    setHata(null);
    const { error } = await sb.auth.signInWithOAuth({
      provider: saglayici,
      options: { redirectTo: window.location.href },
    });
    if (error) {
      /*
       * Sağlayıcı Supabase panelinde açık değilse buraya
       * düşüyor. Sessiz kalmak yerine sebebi söyleniyor.
       */
      setHata(s.h_sosyal);
    }
  }

  /**
   * Düğmenin davranışı adıma göre değişiyor.
   *
   * Kayıtta 1. adım: alanları doğrulayıp 2. adıma geçiyor —
   * sunucuya gitmiyor. 2. adım ve giriş: gerçekten gönderiyor.
   */
  async function ileri() {
    setHata(null);

    if (mod === "kayit" && adim === 1) {
      const e = eposta.trim();

      if (!e) { setHata(s.h_eposta_bos); return; }
      if (!sifre) { setHata(s.h_sifre_bos); return; }

      /*
       * ⚠ HER HATA KENDİ MESAJINI VERİYOR.
       *
       * Önce her şeye "Kayıt yapılamadı" diyordum. Kullanıcı
       * neyi düzeltmesi gerektiğini bilmiyordu — özellikle
       * e-postaya Türkçe karakter yazınca.
       */
      if (!e.includes("@")) { setHata(s.h_eposta_at); return; }
      if (/[çğıöşüÇĞİÖŞÜ]/.test(e)) { setHata(s.h_eposta_turkce); return; }
      if (/\s/.test(e)) { setHata(s.h_eposta_bosluk); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e)) {
        setHata(s.h_eposta); return;
      }

      /*
       * Parola kontrolü BURADA. İkinci adımı doldurup en sonda
       * "şifre çok kısa" demek kullanıcıyı boşuna uğraştırıyordu.
       */
      if (sifre.length < 6) { setHata(s.h_kisa); return; }
      if (sifre !== sifre2) { setHata(s.h_uyusmuyor); return; }

      setAdim(2);
      return;
    }

    if (mod === "giris") {
      if (!eposta.trim()) { setHata(s.h_eposta_bos); return; }
      if (!sifre) { setHata(s.h_sifre_bos); return; }
    }

    await gonder();
  }

  async function gonder() {
    setHata(null);
    if (!eposta.trim() || !sifre) {
      setHata(s.h_bos);
      return;
    }
    setBekliyor(true);

    if (mod === "giris") {
      const { error } = await sb.auth.signInWithPassword({
        email: eposta.trim(), password: sifre,
      });

      if (!error) { window.location.reload(); return; }

      /*
       * ⚠ "Email not confirmed" AYRI ELE ALINIYOR.
       *
       * Parola doğru ama e-posta onaylanmamışsa kullanıcıya
       * "şifre hatalı" demek yanlış — ve zaten onay istemiyoruz.
       * Onay geçiliyor ve bir kez daha deneniyor.
       */
      if (/confirm/i.test(error.message)) {
        await sb.rpc("kayit_onayla", { p_email: eposta.trim() })
          .then(undefined, () => null);
        const { error: e2 } = await sb.auth.signInWithPassword({
          email: eposta.trim(), password: sifre,
        });
        setBekliyor(false);
        /*
         * ⚠ GİRİŞTE ANAHTAR ŞEHİR PROFİLDEN ALINIYOR.
         *
         * Okur başka bir cihazdan ya da mobil uygulamadan
         * şehrini değiştirmiş olabilir. Çerez bu tarayıcıya
         * özel olduğu için eski şehri taşıyordu; giriş anında
         * profildeki değerle eşitleniyor.
         *
         * Hata durumunda sessiz geçiliyor: şehir yüzünden giriş
         * engellenmemeli.
         */
        try {
          const { data: pr } = await sb
            .from("profiles")
            .select("city:cities!profiles_city_id_fkey(slug)")
            .eq("id", (await sb.auth.getUser()).data.user?.id ?? "")
            .maybeSingle();
          const ham = pr?.city as unknown;
          const slug = Array.isArray(ham)
            ? (ham[0] as { slug?: string } | undefined)?.slug
            : (ham as { slug?: string } | null)?.slug;
          if (slug) {
            document.cookie =
              `kb-city=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
          }
        } catch { /* şehir eşitlenemedi — giriş yine de geçerli */ }

        if (!e2) { window.location.reload(); return; }
        setHata(s.h_yanlis);
        return;
      }

      setBekliyor(false);
      setHata(s.h_yanlis);
      return;
    }

    /*
     * ⚠ ŞEHİR ZORUNLU.
     *
     * Şehir "anahtar şehir" olarak hava durumu, namaz vakitleri
     * ve nöbetçi eczaneyi belirliyor. Boş bırakılınca okur
     * İstanbul verisi görüyor ve bunu fark etmiyordu.
     *
     * Kayıt anında alınıyor: sonradan ayarlardan doldurulmasını
     * beklemek, ilk deneyimi yanlış şehirle geçirmek demek.
     */
    if (!sehir) { setHata(s.h_sehir); setBekliyor(false); return; }

    const { error } = await sb.auth.signUp({
      email: eposta.trim(),
      password: sifre,
      options: {
        /*
         * ⚠ ANAHTAR ADLARI TETİKLEYİCİYLE AYNI.
         * `handle_new_user` şunları okuyor: `first_name`,
         * `last_name`, `city_slug`. Farklı bir ad göndermek
         * veriyi sessizce çöpe atıyor.
         */
        data: {
          first_name: ad.trim() || null,
          last_name: soyad.trim() || null,
          city_slug: sehir || null,
        },
      },
    });

    /*
     * ⚠ KAYITTA SEÇİLEN ŞEHİR HEMEN GEÇERLİ OLUYOR.
     *
     * Şehir profile yazılıyor ama site çerezden okuduğu için
     * yeni üye ilk oturumunda varsayılan (İstanbul) verisi
     * görüyordu. Kayıt başarılıysa çerez de yazılıyor.
     *
     * Hata varsa dokunulmuyor: kayıt olmamışken şehir
     * değiştirmek yanlış olurdu.
     */
    if (!error && sehir) {
      document.cookie =
        `kb-city=${encodeURIComponent(sehir)}; path=/; max-age=31536000; samesite=lax`;
    }
    if (error) {
      setBekliyor(false);
      /*
       * Supabase'in İngilizce mesajı okura gösterilmiyor ama
       * içeriğine göre doğru Türkçe karşılık seçiliyor.
       */
      const m = error.message.toLowerCase();
      setHata(
        m.includes("already") || m.includes("registered") ? s.h_kayitli
        : m.includes("invalid") && m.includes("email") ? s.h_eposta
        : m.includes("password") ? s.h_kisa
        : m.includes("rate") || m.includes("many") ? s.h_cok_deneme
        : s.h_kayit,
      );
      return;
    }

    /*
     * Kayıttan sonra doğrudan giriş. E-posta onayı açıksa
     * `signUp` oturum döndürmüyor; veritabanı fonksiyonu onayı
     * geçiyor ve tekrar deneniyor.
     */
    /*
     * Onay: tetikleyici zaten yapıyor ama kurulamadığı
     * ortamlar için fonksiyon da çağrılıyor.
     */
    await sb.rpc("kayit_onayla", { p_email: eposta.trim() })
      .then(undefined, () => null);

    let { error: gErr } = await sb.auth.signInWithPassword({
      email: eposta.trim(), password: sifre,
    });

    /*
     * Onay birkaç yüz milisaniye gecikebiliyor; tek denemede
     * vazgeçmek kullanıcıyı sebepsiz giriş ekranına atıyordu.
     */
    if (gErr) {
      await new Promise((r) => setTimeout(r, 800));
      const tekrar = await sb.auth.signInWithPassword({
        email: eposta.trim(), password: sifre,
      });
      gErr = tekrar.error;
    }

    /*
     * ⚠ PROFİL AÇIKÇA TAMAMLANIYOR.
     *
     * `handle_new_user` tetikleyicisi `onboarded_at` alanını
     * yalnızca ad VE şehir birlikte gelirse dolduruyor. Bir
     * şey eşleşmezse kullanıcı bilgileri girdiği hâlde panelde
     * "eksik bilgi" uyarısı alıyordu.
     */
    if (!gErr) {
      await sb.rpc("profil_tamamla", {
        p: {
          first_name: ad.trim() || null,
          last_name: soyad.trim() || null,
          city_slug: sehir || null,
        },
      }).then(undefined, () => null);
    }

    setBekliyor(false);
    if (gErr) { setHata(s.h_acildi); setMod("giris"); return; }
    window.location.reload();
  }

  /* Genişlik bilinmiyor ya da hiç açılmadıysa hiçbir şey çizme */
  if (mobil === null || !monte) return null;

  const kayit = mod === "kayit";

  /* Tasarımın kendi renkleri: pencere her temada açık kalıyor */
  const c = {
    bg: "#ffffff", text: "#0f0f10", subtext: "#65676b",
    border: "#e6e6e8", accent: "#0a84ff", inputBg: "#f0f0f1",
  };

  const alanEtiket: React.CSSProperties = {
    fontSize: 12.5, fontWeight: 600, color: c.subtext,
    marginBottom: 6, display: "block",
  };
  const girdi: React.CSSProperties = {
    width: "100%", border: `1px solid ${c.border}`, outline: "none",
    background: c.inputBg, borderRadius: 12, padding: "19px 14px",
    fontSize: 14, color: c.text, boxSizing: "border-box",
  };

  return (
    <>
      {/* Arka perde */}
      <div
        onClick={onKapat}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
          opacity: acik ? 1 : 0,
          pointerEvents: acik ? "auto" : "none",
          transition: "opacity .25s ease", zIndex: 235,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!acik}
        dir={rtl ? "rtl" : "ltr"}
        style={
          mobil
            ? {
                position: "fixed", left: 0, right: 0, bottom: 0,
                height: "80vh", maxHeight: "90vh",
                background: c.bg, borderRadius: "24px 24px 0 0",
                display: "flex", flexDirection: "column",
                /*
                 * ⚠ MOBİLDE YATAY DOLGU GENİŞ.
                 * Girdiler ve yazılar ekranın kenarına yapışık
                 * duruyordu; nefes alacak boşluk gerekiyor.
                 */
                padding: "34px 40px calc(36px + env(safe-area-inset-bottom))",
                boxSizing: "border-box",
                transform: acik ? "translateY(0)" : "translateY(100%)",
                transition: "transform .34s cubic-bezier(.22,.8,.2,1)",
                zIndex: 236, boxShadow: "0 -8px 30px rgba(0,0,0,.3)",
              }
            : {
                position: "fixed", top: "50%", left: "50%",
                width: 440, maxHeight: "90vh",
                background: c.bg, borderRadius: 24,
                padding: "40px 52px", boxSizing: "border-box",
                display: "flex", flexDirection: "column",
                opacity: acik ? 1 : 0,
                pointerEvents: acik ? "auto" : "none",
                transform: acik
                  ? "translate(-50%,-50%) scale(1)"
                  : "translate(-50%,-50%) scale(0.92)",
                transition:
                  "opacity .22s ease, transform .24s cubic-bezier(.2,.9,.25,1.1)",
                zIndex: 236, boxShadow: "0 20px 60px rgba(0,0,0,.35)",
              }
        }
      >
        {mobil && (
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: c.border, margin: "0 auto 8px",
          }} />
        )}

        <button
          type="button"
          onClick={onKapat}
          aria-label={s.kapat}
          style={{
            position: "absolute", top: 16, right: 16,
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(0,0,0,.06)", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: c.subtext,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: c.text,
            textAlign: "center", marginBottom: 6,
            marginTop: mobil ? 6 : 0,
          }}>
            {kayit ? s.kayit_baslik : s.giris_baslik}
          </div>
          <div style={{
            fontSize: 13.5, color: c.subtext,
            textAlign: "center", marginBottom: kayit ? 16 : 26,
          }}>
            {kayit && adim === 2 ? s.adim2_alt : kayit ? s.kayit_alt : s.giris_alt}
          </div>

          {/*
            ⚠ ADIM NOKTALARI YALNIZCA KAYITTA.
            Girişte tek ekran var; nokta göstermek "daha var mı"
            sorusunu doğuruyordu.
          */}
          {kayit && (
            <div style={{
              display: "flex", justifyContent: "center",
              gap: 6, marginBottom: 22,
            }}>
              {[1, 2].map((n) => (
                <span
                  key={n}
                  style={{
                    width: n === adim ? 18 : 6, height: 6,
                    borderRadius: 999,
                    background: n === adim ? c.text : c.border,
                    transition: "width .25s ease, background .25s ease",
                  }}
                />
              ))}
            </div>
          )}

          {/*
            Sosyal giriş yalnızca İLK adımda: ikinci adım profil
            bilgisi topluyor, orada Google'a basmak anlamsız.

            Sağlayıcı Supabase'te tanımlı değilse hata mesajı
            gösteriliyor — düğme kaybolmuyor ki kullanıcı
            "neden yok" diye sormasın.
          */}
          {adim === 1 && (
          <>
          <div style={{ display: "flex", flexDirection: "row", gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => void sosyal("google")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 9, flex: 1, padding: 16, borderRadius: 12,
                fontSize: 14.5, fontWeight: 600, cursor: "pointer",
                background: "#fff", color: c.text,
                border: `1px solid ${c.border}`,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.86c2.26-2.08 3.57-5.15 3.57-8.66z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.86-3.01c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11C3.24 21.3 7.28 24 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.28A7.14 7.14 0 0 1 4.9 12c0-.79.14-1.55.37-2.28V6.6H1.27A11.93 11.93 0 0 0 0 12c0 1.93.46 3.76 1.27 5.4l4-3.12z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.27 6.6l4 3.12C6.22 6.86 8.87 4.75 12 4.75z" />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => void sosyal("apple")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 9, flex: 1, padding: 16, borderRadius: 12,
                fontSize: 14.5, fontWeight: 600, cursor: "pointer",
                background: "#0f0f10", color: "#fff", border: "none",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16.7 1.4c.1 1.1-.3 2.2-1 3-.7.8-1.9 1.5-3 1.4-.1-1.1.4-2.2 1-3 .8-.8 2-1.4 3-1.4zM20 17.2c-.5 1.1-.8 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9-1.9 0-2.4.9-3.7.9-1.6 0-2.8-1.6-3.7-3-2.5-3.9-2.8-8.5-1.2-10.9 1.1-1.7 2.8-2.7 4.4-2.7 1.6 0 2.6 1 3.9 1 1.3 0 2-1 3.8-1 1.4 0 2.9.7 4 2-3.5 1.9-2.9 6.9.4 8.9z" />
              </svg>
              <span>Apple</span>
            </button>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            margin: "0 0 20px", color: c.subtext, fontSize: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: c.border }} />
            <span>{s.eposta_ile}</span>
            <div style={{ flex: 1, height: 1, background: c.border }} />
          </div>
          </>
          )}

          {/* ---- 2. ADIM: profil bilgileri ---- */}
          {kayit && adim === 2 && (
            <>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ marginBottom: 14, flex: 1, minWidth: 0 }}>
                  <label style={alanEtiket}>{s.ad}</label>
                  <input style={girdi} type="text" value={ad}
                    onChange={(e) => setAd(e.target.value)} />
                </div>
                <div style={{ marginBottom: 14, flex: 1, minWidth: 0 }}>
                  <label style={alanEtiket}>{s.soyad}</label>
                  <input style={girdi} type="text" value={soyad}
                    onChange={(e) => setSoyad(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={alanEtiket}>{s.sehir}</label>
                <select
                  style={{ ...girdi, appearance: "none" }}
                  value={sehir}
                  onChange={(e) => setSehir(e.target.value)}
                >
                  <option value="">{s.sec}</option>
                  {["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya",
                    "Adana", "Konya", "Gaziantep"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {adim === 1 && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={alanEtiket}>{s.eposta}</label>
                <input style={girdi} type="email" value={eposta} autoComplete="email"
                  onChange={(e) => setEposta(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={alanEtiket}>{s.sifre}</label>
                <input style={girdi} type="password" value={sifre}
                  autoComplete={kayit ? "new-password" : "current-password"}
                  onChange={(e) => setSifre(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void ileri(); }} />
              </div>

              {/*
                Şifre tekrarı yalnızca KAYITTA. Girişte ikinci
                kutu istemek gereksiz bir engel.
              */}
              {kayit && (
                <div style={{ marginBottom: 14 }}>
                  <label style={alanEtiket}>{s.sifre2}</label>
                  <input
                    style={{
                      ...girdi,
                      /* Uyuşmuyorsa kenarlık uyarıyor — hata
                         mesajını beklemeye gerek kalmıyor */
                      borderColor: sifre2 && sifre2 !== sifre ? "#c0392b" : c.border,
                    }}
                    type="password" value={sifre2} autoComplete="new-password"
                    onChange={(e) => setSifre2(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void ileri(); }} />
                </div>
              )}
            </>
          )}

          {hata && (
            <div style={{
              fontSize: 13, color: "#c0392b", textAlign: "center",
              marginTop: 4,
            }}>
              {hata}
            </div>
          )}

          <button
            type="button"
            onClick={() => void ileri()}
            disabled={bekliyor}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%", padding: 16, borderRadius: 12,
              fontSize: 14.5, fontWeight: 700, cursor: "pointer",
              marginTop: 26, marginBottom: 20,
              background: "#1c1c1e", color: "#fff", border: "none",
              whiteSpace: "nowrap", boxSizing: "border-box",
              opacity: bekliyor ? 0.6 : 1,
            }}
          >
            {bekliyor ? "…" : kayit && adim === 1 ? s.devam : kayit ? s.kayit_btn : s.giris_btn}
          </button>

          {kayit && adim === 2 && (
            <button
              type="button"
              onClick={() => { setAdim(1); setHata(null); }}
              style={{
                display: "block", margin: "-8px auto 16px",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, color: c.subtext,
              }}
            >
              ← {s.geri}
            </button>
          )}

          <div style={{ fontSize: 13, color: c.subtext, textAlign: "center" }}>
            {kayit ? s.var_mi : s.yok_mu}{" "}
            <span
              role="button"
              tabIndex={0}
              onClick={() => { setMod(kayit ? "giris" : "kayit"); setAdim(1); setHata(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setMod(kayit ? "giris" : "kayit"); setAdim(1); setHata(null); }
              }}
              style={{ color: c.accent, fontWeight: 600, cursor: "pointer" }}
            >
              {kayit ? s.giris_link : s.kayit_link}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
