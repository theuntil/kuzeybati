"use client";
import { r2Vazgec } from "@/lib/upload";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { href, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon from "@/components/ui/Icon";

/**
 * HESAP SİLME
 *
 * İki kademeli: önce "sil" düğmesi, sonra kullanıcı adını yazma.
 * Tek tıkla silinen hesap kazayla kaybedilir; kullanıcı adını
 * yazmak niyetin bilinçli olduğunu gösterir.
 *
 * Yorumlar SİLİNMEZ, anonimleşir — 5651 sayılı kanun IP ve
 * zaman kaydının saklanmasını istiyor. Bu kullanıcıya açıkça
 * yazılıyor; sürpriz olmasın.
 */
export default function DeleteAccount({
  username, locale, dict,
}: {
  username: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setBusy(true); setErr(null);
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("delete_my_account", { p_confirm: text.trim() });

    /*
     * ⚠ PROFİL FOTOĞRAFI R2'DEN DE SİLİNİYOR.
     * Fonksiyon `avatar_key`'i temizliyordu ama dosya duruyordu;
     * adresi bilen biri silinmiş hesabın fotoğrafına erişmeye
     * devam ediyordu.
     */
    if (!error) {
      const dosyalar = (data as { dosyalar?: string[] } | null)?.dosyalar ?? [];
      await Promise.all(dosyalar.map((k) => r2Vazgec(k)));
    }
    if (error) { setErr(error.message); setBusy(false); return; }
    await sb.auth.signOut();
    window.location.href = href(locale, "home");
  }

  return (
    <section style={{
      background: "var(--s1)",
      border: "1px solid rgba(229,72,77,.35)",
      borderRadius: 16, padding: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <Icon name="warn" size={16} color="#E5484D" />
        <h2 style={{ fontSize: 15, fontWeight: 800, color: "#E5484D" }}>
          {dict.profile.deleteAccount}
        </h2>
      </div>

      <p style={{ fontSize: 13, color: "var(--mu)", lineHeight: 1.6, marginBottom: 14 }}>
        {dict.profile.deleteNote}
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
            height: 42, padding: "0 18px", borderRadius: 14,
            background: "rgba(229,72,77,.12)", color: "#E5484D",
            fontSize: 14, fontWeight: 700,
          }}
        >
          {dict.profile.deleteAccount}
        </button>
      ) : (
        <>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--mu)", marginBottom: 6 }}>
              {dict.profile.typeUsername} <b style={{ color: "var(--tx)" }}>{username}</b>
            </span>
            <input
              className="field"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              style={{ height: 46, fontSize: 15 }}
            />
          </label>

          {err && (
            <p role="alert" style={{
              margin: "0 0 12px", padding: "10px 13px", borderRadius: 14,
              background: "rgba(229,72,77,.12)", color: "#E5484D", fontSize: 13,
            }}>{err}</p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={remove}
              disabled={busy || text.trim().toLowerCase() !== username.toLowerCase()}
              style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
                height: 44, padding: "0 20px", borderRadius: 14,
                background: text.trim().toLowerCase() === username.toLowerCase()
                  ? "#E5484D" : "var(--s2)",
                color: text.trim().toLowerCase() === username.toLowerCase()
                  ? "#fff" : "var(--mu)",
                fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? dict.common.loading : dict.profile.deleteForever}
            </button>
            <button
              onClick={() => { setOpen(false); setText(""); setErr(null); }}
              style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
                height: 44, padding: "0 20px", borderRadius: 14,
                background: "var(--s2)", color: "var(--tx)",
                fontSize: 14, fontWeight: 700,
              }}
            >
              {dict.common.close}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
