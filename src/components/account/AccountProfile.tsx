"use client";
import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import CityField, { type CityOption } from "@/components/ui/CityPicker";
import Icon from "@/components/ui/Icon";
import VerifyEmailCard from "./VerifyEmailCard";
import DeleteAccount from "./DeleteAccount";
import SifreKarti from "./SifreKarti";
import type { Locale } from "@/i18n/config";

/**
 * HESAP AYARLARI
 *
 * Dört bölüm: kimlik (ad/soyad), kullanıcı adı, şehir, e-posta.
 *
 * Her bölüm KENDİ İÇİNDE kaydedilir. Tek büyük "kaydet" düğmesi
 * yerine bu tercih edildi çünkü kullanıcı genelde tek bir şeyi
 * değiştirmek için giriyor; hepsini birden göndermek gereksiz
 * doğrulama ve gereksiz risk.
 */
export default function AccountProfile({
  firstName, lastName, username, email, citySlug, verifiedAt,
  usernameChangedAt, cities, dict, locale,
}: {
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  citySlug: string | null;
  verifiedAt: string | null;
  usernameChangedAt: string | null;
  cities: CityOption[];
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <NameCard first={firstName} last={lastName} dict={dict} />
      <UsernameCard
        current={username}
        changedAt={usernameChangedAt}
        dict={dict}
      />
      <CityCard current={citySlug} cities={cities} dict={dict} />
      <VerifyEmailCard
        email={email}
        verified={Boolean(verifiedAt)}
        dict={dict}
      />
      <SifreKarti />
      <DeleteAccount username={username} locale={locale} dict={dict} />
    </div>
  );
}

/* ---------------- ad soyad ---------------- */
function NameCard({ first, last, dict }: {
  first: string; last: string; dict: Dictionary;
}) {
  const [f, setF] = useState(first);
  const [l, setL] = useState(last);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const dirty = f.trim() !== first || l.trim() !== last;

  async function save() {
    if (!f.trim()) { setMsg({ ok: false, text: dict.auth.needFirstName }); return; }
    setBusy(true); setMsg(null);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("update_my_profile", {
      p_first_name: f.trim(), p_last_name: l.trim(),
      p_city_slug: null, p_bio: null,
    });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message }
                 : { ok: true, text: dict.profile.profileSaved });
  }

  return (
    <Card title={dict.profile.name}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Field label={dict.auth.firstName} value={f} onChange={setF} />
        <Field label={dict.auth.lastName} value={l} onChange={setL} />
      </div>
      <SaveRow show={dirty} busy={busy} onSave={save} dict={dict} msg={msg} />
    </Card>
  );
}

/* ---------------- kullanıcı adı ---------------- */
function UsernameCard({ current, changedAt, dict }: {
  current: string; changedAt: string | null; dict: Dictionary;
}) {
  const locked = Boolean(changedAt) &&
    Date.now() - new Date(changedAt!).getTime() < 30 * 864e5;

  const [value, setValue] = useState(current);
  const [check, setCheck] = useState<"idle" | "checking" | "ok" | "taken" | "bad">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (v === current) { setCheck("idle"); return; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) || v.length < 3 || v.length > 24) {
      setCheck("bad"); return;
    }
    setCheck("checking");
    const id = setTimeout(async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb.rpc("username_available", { p_username: v });
      setCheck(error ? "bad" : data ? "ok" : "taken");
    }, 450);
    return () => clearTimeout(id);
  }, [value, current]);

  async function save() {
    setBusy(true); setMsg(null);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("change_username", { p_username: value.trim() });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message }
                 : { ok: true, text: dict.profile.usernameSaved });
  }

  const hint =
    check === "checking" ? { t: dict.common.loading, c: "var(--mu)" }
    : check === "ok" ? { t: dict.profile.usernameFree, c: "#30D158" }
    : check === "taken" ? { t: dict.profile.usernameTaken, c: "#E5484D" }
    : check === "bad" ? { t: dict.profile.usernameRules, c: "#E5484D" }
    : null;

  return (
    <Card title={dict.profile.username}>
      <p style={{ fontSize: 12.5, color: "var(--mu)", marginBottom: 12, lineHeight: 1.5 }}>
        {locked ? dict.profile.usernameLocked : dict.profile.usernameNote}
      </p>

      <span style={{ position: "relative", display: "block" }}>
        <span style={{
          position: "absolute", insetInlineStart: 14, top: "50%",
          transform: "translateY(-50%)", color: "var(--mu)", fontSize: 15,
        }}>@</span>
        <input
          className="field"
          value={value}
          disabled={locked}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          maxLength={24}
          style={{ height: 48, fontSize: 15.5, paddingInlineStart: 32 }}
        />
      </span>

      {hint && (
        <p style={{ fontSize: 12.5, color: hint.c, marginTop: 8, fontWeight: 600 }}>
          {hint.t}
        </p>
      )}

      <SaveRow show={!locked && check === "ok"} busy={busy} onSave={save} dict={dict} msg={msg} />
    </Card>
  );
}

/* ---------------- şehir ---------------- */
function CityCard({ current, cities, dict }: {
  current: string | null; cities: CityOption[]; dict: Dictionary;
}) {
  const [value, setValue] = useState(current ?? "istanbul");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("update_my_profile", {
      p_first_name: null, p_last_name: null,
      p_city_slug: value, p_bio: null,
    });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }

    /*
     * Çerez de güncelleniyor: sunucu bir sonraki istekte
     * profili okuyana kadar arada eski şehir görünmesin.
     *
     * ⚠ ASIL KAYNAK PROFİL. Bu çerez yalnızca hızlı yansıma
     * için; `getSelectedCitySlug` giriş yapılmışsa profili
     * okuyor. Böylece mobil uygulamadan ya da başka bir
     * cihazdan yapılan değişiklik de burada görünüyor.
     */
    document.cookie = `kb-city=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
    setMsg({ ok: true, text: dict.profile.profileSaved });

    /*
     * Sayfa yenileniyor: hava durumu, namaz vakitleri ve eczane
     * sunucuda üretiliyor, yalnızca çerezi yazmak onları
     * güncellemiyordu.
     */
    setTimeout(() => window.location.reload(), 350);
  }

  return (
    <Card title={dict.profile.city}>
      <p style={{ fontSize: 12.5, color: "var(--mu)", marginBottom: 12, lineHeight: 1.5 }}>
        {dict.profile.cityNote}
      </p>
      {/* Global şehir seçici — site genelinde aynı bileşen */}
      <CityField
        label=""
        value={value}
        cities={cities}
        onChange={setValue}
      />
      <SaveRow show={value !== current} busy={busy} onSave={save} dict={dict} msg={msg} />
    </Card>
  );
}

/* ---------------- ortak parçalar ---------------- */
type Msg = { ok: boolean; text: string } | null;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "var(--s1)", border: "1px solid var(--bd)",
      borderRadius: 16, padding: 18,
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label style={{ flex: "1 1 150px", minWidth: 0 }}>
      <span className="eyebrow muted" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </span>
      <input
        className="field" value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ height: 48, fontSize: 15.5 }}
      />
    </label>
  );
}

/**
 * Kaydet satırı — yalnızca DEĞİŞİKLİK VARSA görünür.
 *
 * Her zaman görünen bir düğme kullanıcıya "bir şey değiştirdim mi"
 * sorusunu sordurur; değişiklik yokken göstermemek daha net.
 */
function SaveRow({ show, busy, onSave, dict, msg }: {
  show: boolean; busy: boolean; onSave: () => void;
  dict: Dictionary; msg: Msg;
}) {
  if (!show && !msg) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
      {show && (
        <button
          onClick={onSave}
          disabled={busy}
          style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
            height: 42, padding: "0 20px", borderRadius: 14,
            background: "var(--btn)", color: "var(--btn-fg)",
            fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? dict.common.loading : dict.auth.save}
        </button>
      )}
      {msg && (
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600,
          color: msg.ok ? "#30D158" : "#E5484D",
        }}>
          <Icon name={msg.ok ? "check" : "warn"} size={14} />
          {msg.text}
        </span>
      )}
    </div>
  );
}
