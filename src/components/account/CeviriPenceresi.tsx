"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   ÇEVİRİ PENCERESİ

   Yazar haberin başka dildeki sürümünü buradan yazıyor.

   ┌─ NEDEN AYRI PENCERE ⚠️ ───────────────────────────────────┐
   │ Çeviri alanları formun sağ sütununa sıkıştırılmıştı;      │
   │ başlık, özet ve içerik için dar bir şeritte yazmak zordu. │
   │ Ayrı bir pencere hem geniş alan veriyor hem de Türkçe     │
   │ alanlarla karışma riskini ortadan kaldırıyor.             │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export type CeviriDil = "en" | "ar" | "ru";

export interface Ceviri {
  dil: CeviriDil;
  baslik: string;
  ozet: string;
  icerik: string;
}

const DILLER: { kod: CeviriDil; ad: string; bayrak: string; yon: "ltr" | "rtl" }[] = [
  { kod: "en", ad: "İngilizce", bayrak: "🇬🇧", yon: "ltr" },
  { kod: "ar", ad: "Arapça", bayrak: "🇸🇦", yon: "rtl" },
  { kod: "ru", ad: "Rusça", bayrak: "🇷🇺", yon: "ltr" },
];

export default function CeviriPenceresi({
  acik, baslangic, onKapat, onKaydet,
}: {
  acik: boolean;
  /** Düzenlemede mevcut çeviri; yoksa boş form */
  baslangic: Ceviri | null;
  onKapat: () => void;
  onKaydet: (c: Ceviri) => void;
}) {
  const [mobil, setMobil] = useState<boolean | null>(null);
  const [dil, setDil] = useState<CeviriDil>("en");
  const [baslik, setBaslik] = useState("");
  const [ozet, setOzet] = useState("");
  const [icerik, setIcerik] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const olc = () => setMobil(!mq.matches);
    olc();
    mq.addEventListener("change", olc);
    return () => mq.removeEventListener("change", olc);
  }, []);

  /*
   * Pencere açılırken mevcut değerler yükleniyor.
   *
   * ⚠ `acik` BAĞIMLILIKTA. Kapanıp yeniden açıldığında eski
   * yazıların kalması gerekiyor; her render'da sıfırlamak
   * kullanıcının emeğini siler.
   */
  useEffect(() => {
    if (!acik) return;
    setDil(baslangic?.dil ?? "en");
    setBaslik(baslangic?.baslik ?? "");
    setOzet(baslangic?.ozet ?? "");
    setIcerik(baslangic?.icerik ?? "");
    setHata(null);
  }, [acik, baslangic]);

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

  if (mobil === null) return null;

  const secili = DILLER.find((d) => d.kod === dil) ?? DILLER[0];

  function kaydet() {
    if (!baslik.trim()) { setHata("Başlık zorunlu"); return; }
    if (!icerik.trim()) { setHata("İçerik zorunlu"); return; }

    onKaydet({
      dil,
      baslik: baslik.trim(),
      ozet: ozet.trim(),
      icerik: icerik.trim(),
    });
    onKapat();
  }

  const alan: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    border: "1px solid var(--bd)", borderRadius: 14,
    background: "var(--s2)", color: "var(--tx)",
    padding: "13px 14px", fontSize: 15, outline: "none",
    fontFamily: "inherit",
  };
  const etiket: React.CSSProperties = {
    display: "block", marginBottom: 7,
    fontSize: 12, fontWeight: 700, letterSpacing: ".04em",
    textTransform: "uppercase", color: "var(--mu)",
  };

  return (
    <>
      <div
        onClick={onKapat}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
          opacity: acik ? 1 : 0,
          pointerEvents: acik ? "auto" : "none",
          transition: "opacity .22s ease", zIndex: 260,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Çeviri ekle"
        aria-hidden={!acik}
        style={
          mobil
            ? {
                position: "fixed", insetInline: 0, bottom: 0,
                height: "92dvh", zIndex: 261,
                background: "var(--bg)",
                borderRadius: "22px 22px 0 0",
                display: "flex", flexDirection: "column",
                transform: acik ? "translateY(0)" : "translateY(100%)",
                transition: "transform .3s cubic-bezier(.32,.72,0,1)",
              }
            : {
                position: "fixed", top: "50%", left: "50%",
                width: "min(860px, 92vw)", maxHeight: "88vh",
                zIndex: 261, background: "var(--bg)",
                borderRadius: 20, overflow: "hidden",
                display: "flex", flexDirection: "column",
                opacity: acik ? 1 : 0,
                pointerEvents: acik ? "auto" : "none",
                transform: acik
                  ? "translate(-50%,-50%) scale(1)"
                  : "translate(-50%,-50%) scale(.95)",
                transition: "opacity .2s ease, transform .22s cubic-bezier(.2,.9,.25,1.1)",
                boxShadow: "0 24px 70px rgba(0,0,0,.4)",
              }
        }
      >
        {/* ---- başlık çubuğu ---- */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: mobil ? "16px 18px" : "20px 24px",
          borderBottom: "1px solid var(--bd)", flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              Başka dilde ekle
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--mu)", margin: "3px 0 0" }}>
              Türkçe haber aynen kalır; bu onun çevirisi olarak kaydedilir.
            </p>
          </div>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              border: "1px solid var(--bd)", background: "var(--s2)",
              color: "var(--tx)", cursor: "pointer",
            }}
          >
            <Icon name="close" size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* ---- gövde ---- */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: mobil ? "16px 18px" : "22px 24px",
          display: "grid", gap: 18,
        }}>
          {/* dil seçimi — bayraklı kartlar */}
          <div>
            <span style={etiket}>Dil</span>
            <div style={{
              display: "grid", gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}>
              {DILLER.map((d) => {
                const aktif = d.kod === dil;
                return (
                  <button
                    key={d.kod}
                    type="button"
                    onClick={() => setDil(d.kod)}
                    aria-pressed={aktif}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "13px 14px", borderRadius: 14,
                      border: `1.5px solid ${aktif ? "var(--tx)" : "var(--bd)"}`,
                      background: aktif ? "var(--s2)" : "transparent",
                      color: "var(--tx)", cursor: "pointer",
                      fontSize: 14.5, fontWeight: aktif ? 700 : 600,
                      transition: "border-color .15s ease, background .15s ease",
                    }}
                  >
                    <span style={{ fontSize: 21, lineHeight: 1 }} aria-hidden>
                      {d.bayrak}
                    </span>
                    <span style={{ flex: 1, textAlign: "start" }}>{d.ad}</span>
                    {aktif && <Icon name="check" size={16} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span style={etiket}>Başlık</span>
            <input
              value={baslik}
              onChange={(e) => { setBaslik(e.target.value); setHata(null); }}
              maxLength={300}
              /*
               * ⚠ ARAPÇA SAĞDAN SOLA.
               * `dir` verilmezse imleç ve noktalama yanlış tarafta
               * kalıyor, yazması neredeyse imkânsız oluyor.
               */
              dir={secili.yon}
              style={alan}
            />
          </div>

          <div>
            <span style={etiket}>Özet</span>
            <textarea
              value={ozet}
              onChange={(e) => setOzet(e.target.value)}
              maxLength={500}
              rows={2}
              dir={secili.yon}
              style={{ ...alan, resize: "vertical", minHeight: 68 }}
            />
          </div>

          <div>
            <span style={etiket}>İçerik</span>
            <textarea
              value={icerik}
              onChange={(e) => { setIcerik(e.target.value); setHata(null); }}
              rows={mobil ? 8 : 11}
              dir={secili.yon}
              placeholder="Paragrafları boş satırla ayır."
              style={{ ...alan, resize: "vertical", minHeight: mobil ? 170 : 230, lineHeight: 1.6 }}
            />
          </div>

          {hata && (
            <p role="alert" style={{
              margin: 0, padding: "11px 14px", borderRadius: 12,
              background: "rgba(229,72,77,.12)", color: "#E5484D", fontSize: 13.5,
            }}>
              {hata}
            </p>
          )}
        </div>

        {/* ---- alt çubuk ---- */}
        <div style={{
          display: "flex", gap: 10, flexShrink: 0,
          padding: mobil
            ? "14px 18px calc(16px + env(safe-area-inset-bottom))"
            : "16px 24px 20px",
          borderTop: "1px solid var(--bd)",
        }}>
          <button
            type="button"
            onClick={onKapat}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0 22px", height: 48, borderRadius: 14,
              border: "1px solid var(--bd)", background: "var(--s2)",
              color: "var(--tx)", fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={kaydet}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              gap: 8, flex: 1, height: 48, borderRadius: 14,
              border: "none", background: "var(--tx)", color: "var(--bg)",
              fontSize: 15.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }} aria-hidden>{secili.bayrak}</span>
            {secili.ad} çevirisini kaydet
          </button>
        </div>
      </div>
    </>
  );
}
