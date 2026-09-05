"use client";
import Icon from "@/components/ui/Icon";

/** Başarı işareti — kayıt ve sıfırlama bitiş ekranlarında */
export function Done() {
  return (
    <span
      className="kb-done"
      style={{
        width: 66, height: 66, borderRadius: 999, margin: "0 auto",
        display: "grid", placeItems: "center",
        background: "rgba(48,209,88,.14)", color: "#30D158",
      }}
    >
      <Icon name="check" size={32} strokeWidth={2.2} />
      <style>{`
        .kb-done { animation: kbDone .45s cubic-bezier(.32,.72,0,1); }
        @keyframes kbDone {
          from { transform: scale(.55); opacity: 0 }
          to   { transform: scale(1); opacity: 1 }
        }
      `}</style>
    </span>
  );
}

/**
 * ADIM GÖSTERGESİ
 *
 * Kullanıcı kaç adım kaldığını görsün. Uzun tek formda insanlar
 * yarıda bırakıyor; bölünmüş adımlar hem kısa görünüyor hem de
 * her adımda tek şey soruluyor.
 */
export function StepDots({ total, current }: { total: number; current: number }) {
  /**
   * İlk adımda gösterge GİZLİ.
   *
   * Kullanıcı henüz bir şey yapmadan "1/3" görmesi gereksiz
   * bilgi; ilerlemeye başlayınca anlamlı oluyor.
   */
  if (current === 0) return null;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            height: 4, borderRadius: 99,
            width: i === current ? 26 : 16,
            background: i <= current ? "var(--tx)" : "var(--s3)",
            transition: "width .25s ease, background .25s ease",
          }}
        />
      ))}
    </div>
  );
}

/** Geri düğmesi — adımlar arasında */
export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 13.5, fontWeight: 600, color: "var(--mu)",
        marginTop: 4,
      }}
    >
      <span style={{ display: "flex", transform: "rotate(180deg)" }}>
        <Icon name="chevronRight" size={15} />
      </span>
      {label}
    </button>
  );
}

/**
 * BİRİNCİL DÜĞME
 *
 * Tek yerde tanımlı: her ekranda aynı yükseklik, aynı hizalama.
 * Metin `flex` ile ortalanıyor — eskiden satır yüksekliği
 * yüzünden bir piksel kayıyordu.
 */
export function PrimaryButton({
  children, onClick, disabled, type = "button", full = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  full?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="kb-primary"
      style={{
        width: full ? "100%" : undefined,
        height: 52,
        borderRadius: 14,
        background: "var(--btn)",
        color: "var(--btn-fg)",
        fontSize: 16,
        fontWeight: 700,
        // Dikey hizalama: line-height'a güvenmek kayma yapıyordu
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0 24px",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "opacity .15s ease, transform .12s ease",
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children, onClick, disabled, full,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="kb-primary"
      style={{
        width: full ? "100%" : undefined,
        height: 52, borderRadius: 14,
        background: "var(--s2)", color: "var(--tx)",
        fontSize: 15.5, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 24px", opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Form alanı — tüm ekranlarda aynı ölçü */
export function TextField({
  label, value, onChange, type = "text", autoComplete, inputMode,
  required, hint, autoFocus, maxLength, minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "text" | "numeric";
  required?: boolean;
  hint?: string;
  autoFocus?: boolean;
  maxLength?: number;
  minLength?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{
        display: "block", fontSize: 12.5, fontWeight: 600,
        color: "var(--mu)", marginBottom: 7,
      }}>{label}</span>
      <input
        className="field"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        autoFocus={autoFocus}
        maxLength={maxLength}
        minLength={minLength}
        // 16px altı yazı iOS'ta sayfayı yakınlaştırır
        style={{ height: 52, fontSize: 16 }}
      />
      {hint && (
        <span style={{ display: "block", fontSize: 12, color: "var(--mu)", marginTop: 6 }}>
          {hint}
        </span>
      )}
    </label>
  );
}
