"use client";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CityOption } from "@/components/site/CitySheet";

/**
 * EKSİK BİLGİ TAMAMLAMA
 *
 * Google/Apple ile giren kullanıcıda şehir bilgisi gelmez, ad
 * bazen tek parça gelir. Bu ekran eksikleri toplar ve
 * `complete_profile` RPC'siyle kaydeder.
 *
 * Doğrulama sunucuda da yapılır (geçersiz şehir reddedilir);
 * buradaki kontroller sadece kullanıcıya hızlı geri bildirim için.
 */
export default function CompleteProfile({
  locale, dict, cities, initialFirst, initialLast, initialCity,
}: {
  locale: Locale;
  dict: Dictionary;
  cities: CityOption[];
  initialFirst: string;
  initialLast: string;
  initialCity: string;
}) {
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [city, setCity] = useState(initialCity || "istanbul");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!first.trim()) {
      setErr(dict.auth.needFirstName);
      return;
    }
    setBusy(true);
    setErr(null);

    const sb = supabaseBrowser();
    const { error } = await sb.rpc("complete_profile", {
      p_first_name: first.trim(),
      p_last_name: last.trim() || null,
      p_city_slug: city,
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    // Şehir seçimi site geneliyle de eşleşsin
    document.cookie = `kb-city=${encodeURIComponent(city)}; path=/; max-age=31536000; samesite=lax`;
    window.location.href = href(locale, "account");
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ flex: 1, minWidth: 0 }}>
          <span className="eyebrow muted" style={{ display: "block", marginBottom: 6 }}>
            {dict.auth.firstName}
          </span>
          <input
            className="field"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            required
            autoComplete="given-name"
            style={{ height: 52, fontSize: 16 }}
          />
        </label>
        <label style={{ flex: 1, minWidth: 0 }}>
          <span className="eyebrow muted" style={{ display: "block", marginBottom: 6 }}>
            {dict.auth.lastName}
          </span>
          <input
            className="field"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            autoComplete="family-name"
            style={{ height: 52, fontSize: 16 }}
          />
        </label>
      </div>

      <label style={{ display: "block" }}>
        <span className="eyebrow muted" style={{ display: "block", marginBottom: 6 }}>
          {dict.srv.province}
        </span>
        <select
          className="field"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{ height: 52, fontSize: 16 }}
        >
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </label>

      {err && (
        <p
          role="alert"
          style={{
            fontSize: 13.5, margin: 0, padding: "11px 14px", borderRadius: 12,
            background: "rgba(229,72,77,.12)", color: "#E5484D",
          }}
        >
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="kb-auth-btn"
        style={{
          height: 52, borderRadius: 14, marginTop: 4,
          background: "var(--btn)", color: "var(--btn-fg)",
          fontSize: 16, fontWeight: 700, opacity: busy ? 0.65 : 1,
        }}
      >
        {busy ? dict.common.loading : dict.auth.save}
      </button>

      <style>{`
        .kb-auth-btn { transition: transform .14s ease, opacity .14s ease; }
        .kb-auth-btn:active:not(:disabled) { transform: scale(.985); }
      `}</style>
    </form>
  );
}
