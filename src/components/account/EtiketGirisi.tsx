"use client";
import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   ETİKET GİRİŞİ

   Yazıp Enter'a basınca etiket rozete dönüşüyor.

   ┌─ ÖNCE VİRGÜLLE AYRILAN DÜZ METİNDİ ⚠️ ────────────────────┐
   │ Kullanıcı "spor, karabük, futbol" diye yazıyordu. Nerede   │
   │ bir etiketin bitip ötekinin başladığı görünmüyor, boşluk   │
   │ hataları sessizce etikete karışıyor, silmek için metnin    │
   │ ortasını düzeltmek gerekiyordu.                             │
   │                                                              │
   │ Artık her etiket ayrı bir rozet: Enter ekliyor, çarpı       │
   │ siliyor. Mobil uygulamalardaki alışılmış davranış.          │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const MAX_ETIKET = 12;
const MAX_UZUNLUK = 40;

export default function EtiketGirisi({
  value, onChange, placeholder,
}: {
  /** Etiket dizisi — dışarıda dizi olarak tutuluyor */
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [taslak, setTaslak] = useState("");
  const [uyari, setUyari] = useState<string | null>(null);
  const girdiRef = useRef<HTMLInputElement>(null);

  function ekle(ham: string): boolean {
    const temiz = ham.trim().replace(/\s+/g, " ").slice(0, MAX_UZUNLUK);
    if (!temiz) return false;

    if (value.length >= MAX_ETIKET) {
      setUyari(`En fazla ${MAX_ETIKET} etiket ekleyebilirsin`);
      return false;
    }

    /*
     * ⚠ BÜYÜK/KÜÇÜK HARF DUYARSIZ TEKRAR KONTROLÜ.
     * "Spor" ve "spor" ayrı etiket sayılırsa listeler ikiye
     * bölünüyor ve arama iki ayrı sonuç veriyor.
     */
    const varMi = value.some(
      (t) => t.toLocaleLowerCase("tr") === temiz.toLocaleLowerCase("tr"),
    );
    if (varMi) {
      setUyari("Bu etiket zaten var");
      return false;
    }

    setUyari(null);
    onChange([...value, temiz]);
    return true;
  }

  function tus(e: KeyboardEvent<HTMLInputElement>) {
    /*
     * Enter ve virgül aynı işi yapıyor: virgüle basmayı
     * alışkanlık edinmiş kullanıcı da doğru sonucu alsın.
     */
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (ekle(taslak)) setTaslak("");
      return;
    }

    /*
     * ⚠ BOŞ ALANDA BACKSPACE SON ETİKETİ SİLİYOR.
     * Yanlışlıkla eklenen etiketi silmek için fareye uzanmak
     * gerekmiyor — standart etiket girişi davranışı.
     */
    if (e.key === "Backspace" && taslak === "" && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
      setUyari(null);
    }
  }

  /*
   * Yapıştırılan metin virgülle ayrılmışsa hepsi ayrı etiket
   * oluyor — eski veriyi taşımayı kolaylaştırıyor.
   */
  function yapistir(e: ClipboardEvent<HTMLInputElement>) {
    const metin = e.clipboardData.getData("text");
    if (!metin.includes(",")) return;

    e.preventDefault();
    let sonuc = [...value];
    for (const parca of metin.split(",")) {
      const temiz = parca.trim().replace(/\s+/g, " ").slice(0, MAX_UZUNLUK);
      if (!temiz) continue;
      if (sonuc.length >= MAX_ETIKET) break;
      const varMi = sonuc.some(
        (t) => t.toLocaleLowerCase("tr") === temiz.toLocaleLowerCase("tr"),
      );
      if (!varMi) sonuc = [...sonuc, temiz];
    }
    onChange(sonuc);
    setTaslak("");
  }

  function sil(i: number) {
    onChange(value.filter((_, j) => j !== i));
    setUyari(null);
  }

  return (
    <div>
      <div
        onClick={() => girdiRef.current?.focus()}
        style={{
          display: "flex", flexWrap: "wrap", gap: 7,
          alignItems: "center", minHeight: 52,
          padding: value.length ? "9px 10px" : "0 12px",
          borderRadius: 14, border: "1px solid var(--bd)",
          background: "var(--s2)", cursor: "text",
        }}
      >
        {value.map((etiket, i) => (
          <span
            key={`${etiket}-${i}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "6px 8px 6px 11px", borderRadius: 999,
              background: "var(--s3)", fontSize: 13.5, fontWeight: 600,
              maxWidth: "100%",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {etiket}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); sil(i); }}
              aria-label={`${etiket} etiketini kaldır`}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                border: "none", background: "transparent",
                color: "var(--mu)", cursor: "pointer", padding: 0,
              }}
            >
              <Icon name="close" size={12} strokeWidth={2.4} />
            </button>
          </span>
        ))}

        <input
          ref={girdiRef}
          value={taslak}
          onChange={(e) => { setTaslak(e.target.value); setUyari(null); }}
          onKeyDown={tus}
          onPaste={yapistir}
          /* Odak kaybında yarım kalan etiket kaybolmasın */
          onBlur={() => { if (ekle(taslak)) setTaslak(""); }}
          placeholder={value.length ? "" : (placeholder ?? "Etiket yaz, Enter'a bas")}
          maxLength={MAX_UZUNLUK}
          style={{
            flex: "1 1 120px", minWidth: 100,
            border: "none", outline: "none", background: "transparent",
            color: "var(--tx)", fontSize: 15, height: 34, padding: 0,
          }}
        />
      </div>

      <span style={{
        display: "block", marginTop: 6, fontSize: 12.5, lineHeight: 1.5,
        color: uyari ? "#E5484D" : "var(--mu)",
      }}>
        {uyari ?? `Enter'a basınca etiket eklenir · ${value.length}/${MAX_ETIKET}`}
      </span>
    </div>
  );
}
