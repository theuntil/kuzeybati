import { href, type Locale } from "@/i18n/config";

/* ══════════════════════════════════════════════════════════════
   YAZAR / YAYINCI PROFİL BAŞLIĞI

   İkisi de aynı bileşeni kullanıyor: kapak görseli, avatar/logo,
   ad, unvan, açıklama, sosyal bağlantılar ve haber sayısı.

   ┌─ SOSYAL ADRESLER BURADA KURULUYOR ⚠️ ─────────────────────┐
   │ Veritabanında yalnızca KULLANICI ADI saklanıyor            │
   │ ("kuzeybatihaber"), tam adres değil. Böylece Instagram      │
   │ adres yapısını değiştirse tek yerden düzeltiliyor ve        │
   │ kullanıcı ne yapıştırırsa yapıştırsın doğru kaydediliyor.   │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface Sosyal {
  instagram?: string; facebook?: string; x?: string;
  youtube?: string; linkedin?: string; tiktok?: string;
  website?: string;
}

const ADRES: Record<string, (k: string) => string> = {
  instagram: (k) => `https://instagram.com/${k}`,
  facebook:  (k) => `https://facebook.com/${k}`,
  x:         (k) => `https://x.com/${k}`,
  youtube:   (k) => `https://youtube.com/@${k}`,
  linkedin:  (k) => `https://linkedin.com/in/${k}`,
  tiktok:    (k) => `https://tiktok.com/@${k}`,
  website:   (k) => `https://${k}`,
};

const AD: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", x: "X",
  youtube: "YouTube", linkedin: "LinkedIn", tiktok: "TikTok",
  website: "Web sitesi",
};

/** Basit marka simgeleri — ikon paketi eklemeye değmezdi */
function Simge({ tur }: { tur: string }) {
  const ortak = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "currentColor" };
  if (tur === "instagram")
    return <svg {...ortak}><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 5.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 7.4a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8Zm5.7-7.6a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0Z"/></svg>;
  if (tur === "facebook")
    return <svg {...ortak}><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z"/></svg>;
  if (tur === "x")
    return <svg {...ortak}><path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5 21H1.9l7.3-8.3L2.4 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z"/></svg>;
  if (tur === "youtube")
    return <svg {...ortak}><path d="M21.6 7.2s-.2-1.4-.8-2c-.7-.8-1.6-.8-2-.9C16 4.1 12 4.1 12 4.1s-4 0-6.8.2c-.4 0-1.3.1-2 .9-.6.6-.8 2-.8 2S2.2 8.8 2.2 10.5v1.6c0 1.6.2 3.3.2 3.3s.2 1.4.8 2c.7.8 1.7.7 2.1.8 1.6.2 6.7.2 6.7.2s4 0 6.8-.2c.4-.1 1.3-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.3v-1.6c0-1.6-.2-3.2-.2-3.2ZM9.9 14.6V8.8l5.2 2.9-5.2 2.9Z"/></svg>;
  if (tur === "linkedin")
    return <svg {...ortak}><path d="M20.4 3H3.6C2.7 3 2 3.7 2 4.6v14.8c0 .9.7 1.6 1.6 1.6h16.8c.9 0 1.6-.7 1.6-1.6V4.6c0-.9-.7-1.6-1.6-1.6ZM8.1 18.3H5.3V9.7h2.8v8.6ZM6.7 8.5a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Zm12 9.8h-2.8v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3H10V9.7h2.7v1.2h.1c.4-.7 1.3-1.4 2.6-1.4 2.8 0 3.3 1.8 3.3 4.2v4.6Z"/></svg>;
  if (tur === "tiktok")
    return <svg {...ortak}><path d="M16.6 2h3c.2 1.6 1.1 3 2.4 3.8v3.1c-1.3 0-2.5-.4-3.6-1.1v6.5a6.3 6.3 0 1 1-6.3-6.3c.3 0 .7 0 1 .1v3.2a3.1 3.1 0 1 0 2.2 3V2Z"/></svg>;
  return <svg {...ortak} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/></svg>;
}

export default function ProfilBasi({
  ad, altAd, aciklama, avatar, kapak, basHarf,
  sosyal, haberSayisi, rozet, locale,
}: {
  ad: string;
  altAd?: string | null;
  aciklama?: string | null;
  avatar?: string | null;
  kapak?: string | null;
  basHarf: string;
  sosyal?: Sosyal | null;
  haberSayisi: number;
  rozet?: string | null;
  locale: Locale;
}) {
  const linkler = Object.entries(sosyal ?? {})
    .filter(([k, v]) => v && ADRES[k])
    .slice(0, 7);

  return (
    <header style={{ marginBottom: 26 }}>
      {/*
        Kapak görseli. Yoksa yumuşak bir renk geçişi —
        boş gri bir alan bırakmak yerine.
      */}
      {/*
        ⚠ KAPAK GÖRSELİ AVATARIN ALTINDA KALMALI.
        `z-index` verilmeyince avatar kapağın ARKASINDA
        kalıyordu — kapak yüklendiğinde profil fotoğrafı ve
        logo kayboluyordu.
      */}
      <div
        style={{
          position: "relative",
          zIndex: 0,
          height: "clamp(120px, 26vw, 220px)",
          borderRadius: 18,
          overflow: "hidden",
          background: kapak
            ? undefined
            : "linear-gradient(135deg, var(--s2), var(--s3))",
        }}
      >
        {kapak && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={kapak} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {/*
        KİŞİ KARTI

        ⚠ ÖNCE KAPAĞIN ÜSTÜNE BİNİYORDU.
        Tüm satıra `marginTop: -42` veriliyordu; avatar kapağın
        üstüne taşıyordu ama YAZILAR da beraberinde yukarı
        kayıyor, kapak görselinin üzerine denk gelen ad ve unvan
        okunamıyordu (koyu kapakta koyu yazı).

        Artık yalnızca AVATAR yukarı taşıyor (`marginTop` onun
        üzerinde); ad, unvan ve rozet kapağın tamamen altında
        kalıyor ve her koşulda okunuyor.
      */}
      <div
        style={{
          position: "relative",
          zIndex: 1,            // kapağın üstünde
          display: "flex", alignItems: "center", gap: 16,
          paddingInline: 4, flexWrap: "wrap",
        }}
      >
        {/*
          Avatar / logo — kapağın üstüne taşan tek öğe.

          ⚠ HİZA: `-42` DEĞİL `-28`.
          Avatar çok yukarı taşıyordu; sağındaki ad ve etiket
          bloğuyla ortak bir hizası yoktu, kopuk duruyordu.
          Daha az taşırınca avatarın dikey ortası, ad + etiket
          ikilisinin ortasına denk geliyor.
        */}
        <span
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 88, height: 88,
            /*
             * ⚠ TAM YUVARLAK.
             * `borderRadius: 22` köşeleri yuvarlatılmış bir kare
             * bırakıyordu; profil fotoğrafı için beklenen daire.
             */
            borderRadius: "50%",
            flexShrink: 0,
            background: "var(--bg)", border: "4px solid var(--bg)",
            overflow: "hidden", fontSize: 32, fontWeight: 800,
            color: "var(--mu)",
            marginTop: -28,
          }}
        >
          {avatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatar} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : basHarf}
        </span>

        {/*
          Ad bloğu avatarla dikey olarak ortalanıyor
          (`alignItems: center` üst satırda).
        */}
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <h1 style={{ fontSize: "clamp(21px, 4vw, 28px)", fontWeight: 800, margin: 0 }}>
            {ad}
          </h1>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              flexWrap: "wrap", marginTop: 5,
              fontSize: 14, color: "var(--mu)",
            }}
          >
            {altAd && <span>{altAd}</span>}
            {rozet && (
              <span
                style={{
                  padding: "2px 9px", borderRadius: 999,
                  background: "var(--s2)", fontSize: 12, fontWeight: 700,
                }}
              >
                {rozet}
              </span>
            )}
            <span>{haberSayisi.toLocaleString("tr-TR")} haber</span>
          </div>
        </div>

        {linkler.length > 0 && (
          /*
            Mobilde tam genişlik ve kaydırılabilir: butonlar
            ekranın kenarına yapışıp taşıyordu.
          */
          <div
            className="profil-sosyal"
            style={{
              display: "flex", gap: 6, paddingBottom: 8,
              flexWrap: "wrap", maxWidth: "100%",
            }}
          >
            {linkler.map(([tur, kod]) => (
              <a
                key={tur}
                href={ADRES[tur]!(kod as string)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                title={`${AD[tur]}: ${kod}`}
                aria-label={AD[tur]}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 11,
                  background: "var(--s2)", color: "var(--tx)",
                }}
              >
                <Simge tur={tur} />
              </a>
            ))}
          </div>
        )}
      </div>

      {aciklama && (
        <p
          style={{
            marginTop: 14, paddingInline: 4,
            fontSize: 15, lineHeight: 1.7, color: "var(--tx)",
            maxWidth: "72ch",
          }}
        >
          {aciklama}
        </p>
      )}
    </header>
  );
}
