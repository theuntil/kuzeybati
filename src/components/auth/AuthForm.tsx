"use client";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import CityField, { type CityOption } from "@/components/ui/CityPicker";
import { authError } from "@/lib/auth-errors";
import { useToast } from "@/components/ui/Toast";
import Icon from "@/components/ui/Icon";
import { StepDots, BackButton, PrimaryButton, TextField, Done } from "./Steps";
import Link from "next/link";

/**
 * GİRİŞ / KAYIT
 *
 * Kayıt ÜÇ ADIM:
 *   1. Ad, soyad, şehir
 *   2. E-posta, şifre
 *   3. Başarılı → hesaba yönlendir
 *
 * Tek uzun form mobilde bunaltıcıydı; her adımda tek konu
 * soruluyor. Adım 1 hiçbir ağ isteği yapmıyor, sadece toplama.
 *
 * Hatalar TOAST ile gösteriliyor ve TÜRKÇE — Supabase İngilizce
 * döndürüyor, ham metin kullanıcıya gösterilmiyor.
 */
export default function AuthForm({
  mode, locale, dict, cities, registrationEnabled, registrationMessage,
}: {
  mode: "login" | "signup";
  locale: Locale;
  dict: Dictionary;
  cities: CityOption[];
  registrationEnabled: boolean;
  registrationMessage?: string | null;
}) {
  const t = useToast();
  const [step, setStep] = useState(0);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  /*
   * ⚠ VARSAYILAN YOK — SEÇİM ZORUNLU.
   *
   * Önce "istanbul" ile başlıyordu. Kullanıcı şehir alanına hiç
   * dokunmasa bile İstanbul kaydediliyor, sonra hava durumu,
   * namaz vakitleri ve nöbetçi eczane yanlış şehri gösteriyordu
   * — okur bunu fark etmiyordu bile.
   */
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<null | "email" | "google" | "apple">(null);

  const closed = mode === "signup" && !registrationEnabled;

  async function oauth(provider: "google" | "apple") {
    setBusy(provider);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { t.error(authError(error)); setBusy(null); }
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy("email");
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(), password,
    });
    if (error) { t.error(authError(error)); setBusy(null); return; }
    window.location.href = href(locale, "account");
  }

  async function signup(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { t.error(dict.auth.weakPassword); return; }

    /*
     * Şehir "anahtar şehir": hava durumu, namaz vakitleri ve
     * nöbetçi eczane buna bağlı. Kayıt anında alınıyor.
     */
    if (!city) { t.error(dict.auth.cityRequired); return; }

    setBusy("email");
    const sb = supabaseBrowser();
    /*
     * Kayıt başarılı olursa seçilen şehir hemen geçerli olsun
     * diye çerez de yazılıyor (aşağıda). Sunucu tarafı zaten
     * profilden okuyor; bu yalnızca ilk sayfa için.
     */
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: first.trim(),
          last_name: last.trim() || null,
          city_slug: city,
          locale,
        },
      },
    });

    if (error) { t.error(authError(error)); setBusy(null); return; }

    /*
     * ⚠ SEÇİLEN ŞEHİR HEMEN GEÇERLİ.
     * Şehir profile yazılıyor ama site ilk istekte çerezden
     * okuduğu için yeni üye varsayılan şehri görüyordu.
     */
    document.cookie =
      `kb-city=${encodeURIComponent(city)}; path=/; max-age=31536000; samesite=lax`;

    /**
     * OTOMATİK GİRİŞ.
     *
     * Supabase `signUp` yalnızca "Confirm email" KAPALIYSA oturum
     * döndürür. Açıksa oturum gelmez ve kullanıcı giriş ekranına
     * atılıyordu — istenmeyen davranış buydu.
     *
     * Oturum gelmediyse aynı bilgilerle hemen giriş deneniyor.
     * Bu da başarısız olursa doğrulama gerçekten zorunlu demektir;
     * ancak o zaman kullanıcı bilgilendiriliyor.
     */
    let session = data.session;

    if (!session) {
      /**
       * Supabase "Confirm email" açıkken oturum vermez. Bizim
       * kendi doğrulama sistemimiz olduğu için hesabı onaylatıp
       * hemen giriş yapıyoruz — kullanıcı login ekranına
       * atılmıyor.
       */
      /*
       * ⚠ İKİ YOL DENENIYOR.
       *
       * Önce veritabanı fonksiyonu: hiçbir dış servise bağlı
       * değil, her zaman çalışıyor. Eski uç mail servisine
       * bağlıydı ve mail yapılandırılmamışsa hiç çalışmıyordu —
       * kullanıcı yine giriş ekranına atılıyordu.
       */
      await sb.rpc("kayit_onayla", { p_email: email.trim() }).then(
        undefined,
        () => null,
      );

      /* Mail servisi varsa o da denensin — zararı yok */
      await fetch("/api/kayit-onay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => null);

      const signed = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      session = signed.data.session ?? null;

      /*
       * Onay hatası alındıysa onayı geç ve tekrar dene.
       * "Email not confirmed" yüzünden kullanıcı kaydolduğu
       * hâlde giremiyordu.
       */
      if (!session && signed.error && /confirm/i.test(signed.error.message)) {
        await sb.rpc("kayit_onayla", { p_email: email.trim() })
          .then(undefined, () => null);
        const y = await sb.auth.signInWithPassword({
          email: email.trim(), password,
        });
        session = y.data.session ?? null;
      }

      /*
       * Onay hemen yansımayabiliyor; bir kez daha deneniyor.
       * Tek denemede başarısız olunca kullanıcı sebepsiz yere
       * giriş ekranına düşüyordu.
       */
      if (!session) {
        await new Promise((r) => setTimeout(r, 700));
        const { data: tekrar } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        session = tekrar.session ?? null;
      }
    }

    setStep(2);
    setBusy(null);

    setTimeout(() => {
      window.location.href = session
        ? href(locale, "account")
        : href(locale, "login");
    }, 1600);
  }

  /* ---- kayıt kapalı ---- */
  if (closed) {
    return (
      <div style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: "28px 22px", textAlign: "center",
      }}>
        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55, marginBottom: 18 }}>
          {registrationMessage?.trim() || dict.auth.registrationClosed}
        </p>
        <Link href={href(locale, "login")} style={{ display: "block" }}>
          <PrimaryButton>{dict.auth.login}</PrimaryButton>
        </Link>
      </div>
    );
  }

  /* ---- kayıt tamamlandı ---- */
  if (mode === "signup" && step === 2) {
    return (
      <div style={{ textAlign: "center" }}>
        <Done />
        <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 18 }}>
          {dict.auth.signupDone}
        </h2>
        <p style={{ fontSize: 14.5, color: "var(--mu)", marginTop: 8, lineHeight: 1.55 }}>
          {dict.auth.signupDoneSub}
        </p>
      </div>
    );
  }

  const social = (
    <>
      <div style={{ display: "grid", gap: 10 }}>
        <button
          type="button"
          onClick={() => oauth("google")}
          disabled={busy !== null}
          className="kb-primary"
          style={{
            height: 52, borderRadius: 14, background: "var(--s1)",
            color: "var(--tx)", fontSize: 15.5, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            border: "1px solid var(--bd)",
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-7.9Z" />
            <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.2 1.1-3.6 1.1-2.8 0-5.2-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M6 14.4a6.6 6.6 0 0 1 0-4.2V7.4H2.3a11 11 0 0 0 0 9.8L6 14.4Z" />
            <path fill="#EA4335" d="M12 5.6c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.4L6 10.2c.8-2.5 3.2-4.6 6-4.6Z" />
          </svg>
          {busy === "google" ? dict.common.loading : dict.auth.withGoogle}
        </button>

        <button
          type="button"
          onClick={() => oauth("apple")}
          disabled={busy !== null}
          className="kb-primary"
          style={{
            height: 52, borderRadius: 14, background: "var(--s1)",
            color: "var(--tx)", fontSize: 15.5, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            border: "1px solid var(--bd)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M16.7 12.8c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.5 1.3 10 .8 1.2 1.8 2.5 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-3.6ZM14.3 5.1c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
          </svg>
          {busy === "apple" ? dict.common.loading : dict.auth.withApple}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
        <span style={{ flex: 1, height: 1, background: "var(--bd)" }} />
        <span style={{ fontSize: 12.5, color: "var(--mu)", fontWeight: 600 }}>
          {dict.auth.orEmail}
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--bd)" }} />
      </div>
    </>
  );

  /* ---- giriş ---- */
  if (mode === "login") {
    return (
      <>
        {social}
        <form onSubmit={login} style={{ display: "grid", gap: 14 }}>
          <TextField
            label={dict.auth.email} value={email} onChange={setEmail}
            type="email" autoComplete="email" inputMode="email" required
          />
          <PasswordField
            label={dict.auth.password} value={password} onChange={setPassword}
            show={showPw} toggle={() => setShowPw((v) => !v)}
            autoComplete="current-password" dict={dict}
          />
          <Link
            href={href(locale, "reset-password")}
            style={{
              fontSize: 12.5, color: "var(--mu)", textAlign: "end",
              fontWeight: 600, marginTop: -4,
            }}
          >
            {dict.profile.forgotPassword}
          </Link>
          <PrimaryButton type="submit" disabled={busy !== null}>
            {busy === "email" ? dict.common.loading : dict.auth.login}
          </PrimaryButton>
        </form>
      </>
    );
  }

  /* ---- kayıt: adım 1 ---- */
  if (step === 0) {
    return (
      <>
        {social}
        <StepDots total={2} current={0} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!first.trim()) { t.error(dict.auth.needFirstName); return; }
            setStep(1);
          }}
          style={{ display: "grid", gap: 14 }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <TextField label={dict.auth.firstName} value={first} onChange={setFirst}
                         autoComplete="given-name" required autoFocus />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <TextField label={dict.auth.lastName} value={last} onChange={setLast}
                         autoComplete="family-name" />
            </span>
          </div>

          {/* Cihazın kendi menüsü yerine global şehir seçici */}
          <CityField
            label={dict.srv.province}
            value={city}
            cities={cities}
            onChange={setCity}
            title={dict.srv.province}
            searchPlaceholder={dict.search.placeholder}
            emptyText={dict.search.noResults}
          />

          <PrimaryButton type="submit" disabled={!first.trim() || !city}>
            {dict.common.next}
          </PrimaryButton>
        </form>
      </>
    );
  }

  /* ---- kayıt: adım 2 ---- */
  return (
    <>
      <StepDots total={2} current={1} />
      <form onSubmit={signup} style={{ display: "grid", gap: 14 }}>
        <TextField
          label={dict.auth.email} value={email} onChange={setEmail}
          type="email" autoComplete="email" inputMode="email" required autoFocus
        />
        <PasswordField
          label={dict.auth.password} value={password} onChange={setPassword}
          show={showPw} toggle={() => setShowPw((v) => !v)}
          autoComplete="new-password" hint={dict.auth.passwordHint} dict={dict}
        />
        <PrimaryButton type="submit" disabled={busy !== null || password.length < 8}>
          {busy === "email" ? dict.common.loading : dict.auth.signup}
        </PrimaryButton>
        <BackButton onClick={() => setStep(0)} label={dict.common.back} />
      </form>
    </>
  );
}

function PasswordField({
  label, value, onChange, show, toggle, autoComplete, hint, dict,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; toggle: () => void; autoComplete: string;
  hint?: string; dict: Dictionary;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{
        display: "block", fontSize: 12.5, fontWeight: 600,
        color: "var(--mu)", marginBottom: 7,
      }}>{label}</span>
      <span style={{ position: "relative", display: "block" }}>
        <input
          className="field"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          style={{ height: 52, fontSize: 16, paddingInlineEnd: 46 }}
        />
        <button
          type="button" onClick={toggle} aria-label={dict.auth.password}
          style={{
            position: "absolute", insetInlineEnd: 8, top: "50%",
            transform: "translateY(-50%)", width: 34, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--mu)", borderRadius: 9,
          }}
        >
          <Icon name="eye" size={17} />
        </button>
      </span>
      {hint && (
        <span style={{ display: "block", fontSize: 12, color: "var(--mu)", marginTop: 6 }}>
          {hint}
        </span>
      )}
    </label>
  );
}
