"use client";
import { useState } from "react";
import SifreDegistir from "./SifreDegistir";

/**
 * ŞİFRE KARTI
 *
 * Ayarlar sayfasındaki "Şifremi değiştir" bölümü.
 * Asıl iş `SifreDegistir` penceresinde.
 */
export default function SifreKarti() {
  const [acik, setAcik] = useState(false);

  return (
    <>
      <section style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 16, padding: 20,
      }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 800, margin: 0 }}>
          Şifre
        </h3>
        <p style={{
          fontSize: 13.5, lineHeight: 1.6,
          color: "var(--mu)", margin: "8px 0 16px",
        }}>
          Şifreni değiştirmek için e-postana bir doğrulama kodu göndereceğiz.
        </p>
        <button
          type="button"
          onClick={() => setAcik(true)}
          style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
            padding: "11px 20px", borderRadius: 14,
            background: "var(--s2)", border: "1px solid var(--bd)",
            color: "var(--tx)", fontSize: 14, fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Şifremi değiştir
        </button>
      </section>

      <SifreDegistir acik={acik} onKapat={() => setAcik(false)} />
    </>
  );
}
