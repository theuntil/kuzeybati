"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/* ══════════════════════════════════════════════════════════════
   ŞİFRE DEĞİŞTİRME — ÜÇ ADIM

   1. Doğrulama kodu gönder
   2. Kodu gir  (10 yanlış deneme / gün)
   3. Yeni şifreyi iki kez yaz

   ┌─ NEDEN KOD ⚠️ ────────────────────────────────────────────┐
   │ Oturum açık bir cihaz başkasının eline geçerse şifre      │
   │ anında değiştirilebilirdi. E-postaya giden kod, cihazı    │
   │ ele geçirenin hesabı da kaçırmasını engelliyor.           │
   └──────────────────────────────────────────────────────────────┘

   ┌─ `/api/sifre-sifirla` KULLANILIYOR — KENDİ SİSTEMİM DEĞİL ⚠️ ┐
   │ Önce burada kendi Supabase RPC'lerim vardı (sifre_kod_iste  │
   │ vb.) ve mail için AYRI, yanlış isimli env değişkenleri      │
   │ (`MAIL_SERVICE_URL/KEY`) kullanan bir uç.                    │
   │                                                                │
   │ Oysa `/api/sifre-sifirla` zaten hazır ve doğru duruyordu:    │
   │ hız sınırı, kayıtlı adres kontrolü, üç adımlı akış, doğru    │
   │ env değişkenleri (`MAIL_API_URL/KEY`, `lib/mail.ts` ile      │
   │ paylaşımlı). Şifre değişimi de mail servisinde yapılıyor —   │
   │ `service_role` anahtarı yalnızca orada, siteye hiç girmiyor.│
   │                                                                │
   │ Kendi paralel sistemim silinip bu kullanılmaya başlandı.     │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function SifreDegistir({
  acik, onKapat,
}: {
  acik: boolean;
  onKapat: () => void;
}) {
  const sb = supabaseBrowser();
  const [mobil, setMobil] = useState<boolean | null>(null);
  const [adim, setAdim] = useState<1 | 2 | 3 | 4>(1);
  const [kod, setKod] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  /* Adım 1'de kendi adresimiz alınıyor, adım 3'te ticket kullanılıyor */
  const [eposta, setEposta] = useState<string | null>(null);
  const [bilet, setBilet] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const olc = () => setMobil(!mq.matches);
    olc();
    mq.addEventListener("change", olc);
    return () => mq.removeEventListener("change", olc);
  }, []);

  /* Pencere kapanınca her şey sıfırlanıyor */
  useEffect(() => {
    if (acik) return;
    const z = setTimeout(() => {
      setAdim(1); setKod(""); setSifre(""); setSifre2("");
      setHata(null); setBilgi(null); setBilet(null);
    }, 300);
    return () => clearTimeout(z);
  }, [acik]);

  /* Arka plan kaymasın, Esc kapatsın */
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

  /* Başarı ekranı 3 saniye sonra kendiliğinden kapanıyor */
  useEffect(() => {
    if (adim !== 4) return;
    const z = setTimeout(onKapat, 3000);
    return () => clearTimeout(z);
  }, [adim, onKapat]);

  /** Hata kodunu okunur Türkçeye çevirir */
  function hataMetni(kodStr: string, status: number): string {
    const bilinen: Record<string, string> = {
      mail_not_configured: "Mail servisi şu an kapalı, biraz sonra dene",
      mail_disabled: "Mail servisi şu an kapalı, biraz sonra dene",
      unreachable: "Mail servisine ulaşılamadı, biraz sonra dene",
      timeout: "Mail servisi yanıt vermedi, biraz sonra dene",
      send_failed: "Kod gönderilemedi, biraz sonra dene",
      not_registered: "Bu adres kayıtlı değil",
      rate_limited: "Çok fazla deneme yapıldı, biraz sonra dene",
      invalid_code: "Kod yanlış",
      expired: "Kodun süresi doldu, yeni kod iste",
      invalid_ticket: "Oturum süresi doldu, baştan başla",
      weak_password: "Şifre en az 8 karakter, harf ve rakam içermeli",
    };
    return bilinen[kodStr] ?? (status >= 500 ? "Sunucuya ulaşılamadı" : "Bir şeyler ters gitti");
  }

  async function kodGonder() {
    setHata(null); setBekliyor(true);

    /* Kendi adresimiz — kullanıcıya sormaya gerek yok */
    let adres = eposta;
    if (!adres) {
      const { data: u } = await sb.auth.getUser();
      adres = u.user?.email ?? null;
      setEposta(adres);
    }
    if (!adres) {
      setBekliyor(false);
      setHata("E-posta adresin bulunamadı");
      return;
    }

    try {
      const yanit = await fetch("/api/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "request", email: adres }),
      });
      setBekliyor(false);

      if (!yanit.ok) {
        const j = (await yanit.json().catch(() => ({}))) as { error?: string };
        setHata(hataMetni(j.error ?? "", yanit.status));
        return;
      }

      setBilgi(`Kod ${adres} adresine gönderildi`);
      setAdim(2);
    } catch {
      setBekliyor(false);
      setHata("Bağlantı kurulamadı");
    }
  }

  async function kodDogrula() {
    setHata(null);
    if (kod.trim().length !== 6) { setHata("Kod 6 haneli olmalı"); return; }
    if (!eposta) { setHata("Önce kod iste"); return; }
    setBekliyor(true);

    try {
      const yanit = await fetch("/api/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "verify", email: eposta, code: kod.trim() }),
      });
      setBekliyor(false);

      const j = (await yanit.json().catch(() => ({}))) as { error?: string; ticket?: string };
      if (!yanit.ok || !j.ticket) {
        setHata(hataMetni(j.error ?? "", yanit.status));
        return;
      }

      setBilet(j.ticket);
      setAdim(3);
    } catch {
      setBekliyor(false);
      setHata("Bağlantı kurulamadı");
    }
  }

  async function sifreKaydet() {
    setHata(null);

    if (sifre.length < 8) { setHata("Şifre en az 8 karakter olmalı"); return; }
    if (!/[a-zA-Z]/.test(sifre) || !/[0-9]/.test(sifre)) {
      setHata("Şifre harf ve rakam içermeli"); return;
    }
    if (sifre !== sifre2) { setHata("Şifreler aynı değil"); return; }
    if (!eposta || !bilet) { setHata("Oturum süresi doldu, baştan başla"); return; }

    setBekliyor(true);

    try {
      const yanit = await fetch("/api/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "confirm", email: eposta, ticket: bilet, password: sifre,
        }),
      });
      setBekliyor(false);

      if (!yanit.ok) {
        const j = (await yanit.json().catch(() => ({}))) as { error?: string };
        setHata(hataMetni(j.error ?? "", yanit.status));
        return;
      }

      setAdim(4);
    } catch {
      setBekliyor(false);
      setHata("Bağlantı kurulamadı");
    }
  }

  if (mobil === null) return null;

  const c = {
    bg: "var(--s1)", text: "var(--tx)", mu: "var(--mu)",
    line: "var(--bd)", inputBg: "var(--s2)",
  };

  const girdi: React.CSSProperties = {
    width: "100%", border: `1px solid ${c.line}`, outline: "none",
    background: c.inputBg, borderRadius: 12, padding: "16px 14px",
    fontSize: 15, color: c.text, boxSizing: "border-box",
  };
  const etiket: React.CSSProperties = {
    display: "block", fontSize: 12.5, fontWeight: 600,
    color: c.mu, marginBottom: 6,
  };
  const dugme: React.CSSProperties = {
    width: "100%", padding: 16, borderRadius: 12, border: "none",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    background: "var(--tx)", color: "var(--bg)",
    marginTop: 22,
  };

  return (
    <>
      <div
        onClick={onKapat}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
          opacity: acik ? 1 : 0,
          pointerEvents: acik ? "auto" : "none",
          transition: "opacity .25s ease", zIndex: 245,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!acik}
        style={
          mobil
            ? {
                position: "fixed", left: 0, right: 0, bottom: 0,
                /* Ekranın %86'sı — istenen ölçü */
                height: "86vh",
                background: c.bg, borderRadius: "24px 24px 0 0",
                display: "flex", flexDirection: "column",
                padding: "30px 28px calc(30px + env(safe-area-inset-bottom))",
                boxSizing: "border-box",
                transform: acik ? "translateY(0)" : "translateY(100%)",
                transition: "transform .34s cubic-bezier(.22,.8,.2,1)",
                zIndex: 246, boxShadow: "0 -8px 30px rgba(0,0,0,.3)",
              }
            : {
                position: "fixed", top: "50%", left: "50%",
                width: 430, maxHeight: "90vh",
                background: c.bg, borderRadius: 22,
                padding: "34px 40px", boxSizing: "border-box",
                display: "flex", flexDirection: "column",
                opacity: acik ? 1 : 0,
                pointerEvents: acik ? "auto" : "none",
                transform: acik
                  ? "translate(-50%,-50%) scale(1)"
                  : "translate(-50%,-50%) scale(.93)",
                transition: "opacity .22s ease, transform .24s cubic-bezier(.2,.9,.25,1.1)",
                zIndex: 246, boxShadow: "0 20px 60px rgba(0,0,0,.35)",
              }
        }
      >
        {mobil && (
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: c.line, margin: "0 auto 14px",
          }} />
        )}

        {/* Adım noktaları — başarı ekranında gizli */}
        {adim < 4 && (
          <div style={{
            display: "flex", justifyContent: "center",
            gap: 6, marginBottom: 20,
          }}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                style={{
                  width: n === adim ? 20 : 6, height: 6, borderRadius: 999,
                  background: n === adim ? c.text : c.line,
                  transition: "width .25s ease, background .25s ease",
                }}
              />
            ))}
          </div>
        )}

        {/*
          ⚠ ADIM GEÇİŞİ.

          Önce adım anında değişiyordu ama sunucu yanıtı
          beklendiği için düğmeye basınca 1-2 saniye hiçbir şey
          olmuyordu. Şimdi düğme basılır basılmaz "bekliyor"
          durumuna geçiyor ve içerik yatay kayarak geliyor —
          iOS'taki gibi.
        */}
        <div
          key={adim}
          style={{
            flex: 1, overflowY: "auto",
            animation: "kb-adim .28s cubic-bezier(.32,.72,0,1)",
          }}
        >
          {adim === 1 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                Şifreni değiştir
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: c.mu, margin: 0 }}>
                Güvenlik için e-posta adresine 6 haneli bir doğrulama kodu
                göndereceğiz. Kod 10 dakika geçerli olacak.
              </p>
              <button type="button" style={dugme} disabled={bekliyor}
                onClick={() => void kodGonder()}>
                {bekliyor ? "…" : "Doğrulama kodu gönder"}
              </button>
            </>
          )}

          {adim === 2 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                Kodu gir
              </h2>
              {bilgi && (
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: c.mu, margin: "0 0 18px" }}>
                  {bilgi}
                </p>
              )}
              <label style={etiket}>6 haneli kod</label>
              <input
                style={{
                  ...girdi,
                  textAlign: "center", fontSize: 26, fontWeight: 700,
                  letterSpacing: "0.4em", paddingInlineStart: "0.4em",
                }}
                value={kod}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") void kodDogrula(); }}
                autoFocus
              />
              <button type="button" style={dugme} disabled={bekliyor}
                onClick={() => void kodDogrula()}>
                {bekliyor ? "…" : "Doğrula"}
              </button>
              <button
                type="button"
                onClick={() => void kodGonder()}
                style={{
                  display: "block", margin: "14px auto 0",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, color: c.mu,
                }}
              >
                Kodu tekrar gönder
              </button>
            </>
          )}

          {adim === 3 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
                Yeni şifren
              </h2>
              <div style={{ marginBottom: 14 }}>
                <label style={etiket}>Yeni şifre</label>
                <input style={girdi} type="password" value={sifre}
                  autoComplete="new-password" autoFocus
                  onChange={(e) => setSifre(e.target.value)} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label style={etiket}>Yeni şifre tekrar</label>
                <input
                  style={{
                    ...girdi,
                    borderColor: sifre2 && sifre2 !== sifre ? "#c0392b" : c.line,
                  }}
                  type="password" value={sifre2} autoComplete="new-password"
                  onChange={(e) => setSifre2(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sifreKaydet(); }} />
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: c.mu, margin: "10px 0 0" }}>
                En az 8 karakter, harf ve rakam içermeli.
              </p>
              <button type="button" style={dugme} disabled={bekliyor}
                onClick={() => void sifreKaydet()}>
                {bekliyor ? "…" : "Şifreyi değiştir"}
              </button>
            </>
          )}

          {adim === 4 && (
            <div style={{ textAlign: "center", paddingBlock: 30 }}>
              <div
                style={{
                  width: 62, height: 62, borderRadius: "50%",
                  background: "#16a34a", color: "#fff",
                  display: "grid", placeItems: "center",
                  margin: "0 auto 18px",
                  animation: "kb-toast .35s cubic-bezier(.2,.9,.25,1.1)",
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.6"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>
                Şifren değiştirildi
              </h2>
              <p style={{ fontSize: 13.5, color: c.mu, margin: 0 }}>
                Bu pencere birazdan kapanacak.
              </p>
            </div>
          )}

          {hata && (
            <p style={{
              fontSize: 13, color: "#c0392b",
              textAlign: "center", marginTop: 14,
            }}>
              {hata}
            </p>
          )}
        </div>

        {adim < 4 && (
          <button
            type="button"
            onClick={onKapat}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13.5, color: c.mu, paddingTop: 14,
            }}
          >
            Vazgeç
          </button>
        )}
      </div>
    </>
  );
}
