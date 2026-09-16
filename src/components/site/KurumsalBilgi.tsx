import type { SiteSettings } from "@/lib/types";
import SosyalBaglantilar from "./SosyalBaglantilar";
import YoneticiKarti from "./YoneticiKarti";

/* ══════════════════════════════════════════════════════════════
   RESMİ KURUM BİLGİLERİ

   Hakkımızda ve Künye sayfalarının altında gösteriliyor.

   ┌─ HİÇBİR BİLGİ KODA GÖMÜLÜ DEĞİL ⚠️ ───────────────────────┐
   │ Mail, adres, şirket adı, vergi no — hepsi panelden        │
   │ (`site_settings`) geliyor. Sayfalara sabit yazılsaydı bir │
   │ adres değişikliği kod dağıtımı gerektirirdi ve mail       │
   │ servisiyle site farklı bilgi gösterebilirdi.               │
   │                                                              │
   │ ⚠ BOŞ ALAN HİÇ BASILMIYOR. Yarım doldurulmuş bir künye    │
   │ "—" işaretleriyle dolmasın; satır yoksa görünmüyor.        │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

type Satir = { etiket: string; deger: string | null | undefined };

export default function KurumsalBilgi({
  settings, tur, locale,
}: {
  settings: SiteSettings;
  tur: "hakkimizda" | "kunye" | "iletisim";
  locale: string;
}) {
  const s = settings as SiteSettings & Record<string, string | null>;

  /* Hakkımızda: şirket kimliği ve iletişim */
  const hakkimizda: { baslik: string; satirlar: Satir[] }[] = [
    {
      baslik: "Şirket bilgileri",
      satirlar: [
        { etiket: "Ticari unvan", deger: s.company_legal_name ?? s.company_name },
        { etiket: "Şirket sahibi", deger: s.company_owner },
        { etiket: "Vergi dairesi", deger: s.company_tax_office },
        { etiket: "Vergi numarası", deger: s.company_tax_no },
        { etiket: "Ticaret sicil no", deger: s.company_trade_no },
      ],
    },
    {
      baslik: "İletişim",
      satirlar: [
        { etiket: "Adres", deger: s.contact_address },
        { etiket: "E-posta", deger: s.contact_email },
        { etiket: "Telefon", deger: s.contact_phone },
      ],
    },
    {
      baslik: "Teknik",
      satirlar: [
        { etiket: "Yazılım altyapısı", deger: s.yazilim_altyapisi },
        { etiket: "Barındırma", deger: s.hosting_saglayici },
      ],
    },
  ];

  /* Künye: yayın sorumluluğu */
  const kunye: { baslik: string; satirlar: Satir[] }[] = [
    {
      baslik: "Yayın",
      satirlar: [
        { etiket: "İmtiyaz sahibi", deger: s.imtiyaz_sahibi ?? s.company_owner },
        { etiket: "Genel yayın yönetmeni", deger: s.genel_yayin_yonetmeni },
        { etiket: "Sorumlu yazı işleri müdürü", deger: s.sorumlu_yazi_isleri },
        { etiket: "Yayın türü", deger: s.yayin_turu },
      ],
    },
    {
      baslik: "Kurum",
      satirlar: [
        { etiket: "Ticari unvan", deger: s.company_legal_name ?? s.company_name },
        { etiket: "Adres", deger: s.contact_address },
        { etiket: "E-posta", deger: s.contact_email },
        { etiket: "Telefon", deger: s.contact_phone },
      ],
    },
    {
      baslik: "Teknik",
      satirlar: [
        { etiket: "Yazılım altyapısı", deger: s.yazilim_altyapisi },
        { etiket: "Barındırma", deger: s.hosting_saglayici },
      ],
    },
  ];

  /*
   * İLETİŞİM — üç ayrı adres
   *
   * ⚠ BOŞ OLAN GENEL ADRESE DÜŞÜYOR.
   * Reklam ya da tekzip adresi girilmemişse o satır genel
   * iletişim adresini gösteriyor; ziyaretçi hiçbir durumda
   * boş bir iletişim sayfasıyla karşılaşmıyor.
   */
  const iletisim: { baslik: string; satirlar: Satir[] }[] = [
    {
      baslik: "İletişim",
      satirlar: [
        { etiket: "Genel", deger: s.contact_email },
        { etiket: "Reklam", deger: s.reklam_email ?? s.contact_email },
        { etiket: "Tekzip ve düzeltme", deger: s.tekzip_email ?? s.contact_email },
        { etiket: "Telefon", deger: s.contact_phone },
        { etiket: "Adres", deger: s.contact_address },
      ],
    },
    {
      baslik: "Kurum",
      satirlar: [
        { etiket: "Ticari unvan", deger: s.company_legal_name ?? s.company_name },
        { etiket: "İmtiyaz sahibi", deger: s.imtiyaz_sahibi ?? s.company_owner },
      ],
    },
  ];

  const bloklar = (tur === "kunye" ? kunye : tur === "iletisim" ? iletisim : hakkimizda)
    /* Tamamen boş blok basılmıyor */
    .map((b) => ({
      ...b,
      satirlar: b.satirlar.filter((x) => Boolean(x.deger?.trim())),
    }))
    .filter((b) => b.satirlar.length > 0);

  const hikaye = tur === "hakkimizda" ? s.company_story?.trim() : null;

  if (bloklar.length === 0 && !hikaye) return null;

  return (
    <div style={{ marginTop: 34 }}>
      {hikaye && (
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 10px" }}>
            Hikâyemiz
          </h2>
          {hikaye.split(/\n{2,}/).filter(Boolean).map((para, i) => (
            <p key={i} style={{
              fontSize: 15, lineHeight: 1.7, color: "var(--tx)",
              opacity: .88, margin: "0 0 12px",
            }}>
              {para}
            </p>
          ))}
        </section>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {bloklar.map((b) => (
          <section
            key={b.baslik}
            style={{
              background: "var(--s1)", border: "1px solid var(--bd)",
              borderRadius: 16, padding: 18,
            }}
          >
            <h2 style={{
              fontSize: 12, fontWeight: 800, letterSpacing: ".05em",
              textTransform: "uppercase", color: "var(--mu)",
              margin: "0 0 12px",
            }}>
              {b.baslik}
            </h2>

            <dl style={{ margin: 0, display: "grid", gap: 10 }}>
              {b.satirlar.map((x) => (
                <div
                  key={x.etiket}
                  /*
                   * Etiket sabit genişlikte, değer esnek. Dar
                   * ekranda alt alta geçiyor.
                   */
                  className="kb-kurumsal-satir"
                >
                  <dt style={{
                    fontSize: 13, fontWeight: 600, color: "var(--mu)",
                  }}>
                    {x.etiket}
                  </dt>
                  <dd style={{
                    margin: 0, fontSize: 14.5, color: "var(--tx)",
                    overflowWrap: "anywhere",
                  }}>
                    {/*
                      ⚠ E-POSTA VE TELEFON TIKLANABİLİR.
                      Mobilde kopyalamaya çalışmak yerine
                      doğrudan arama/mail açılıyor.
                    */}
                    {x.etiket === "E-posta" ? (
                      <a href={`mailto:${x.deger}`} style={{ color: "inherit" }}>
                        {x.deger}
                      </a>
                    ) : x.etiket === "Telefon" ? (
                      <a href={`tel:${String(x.deger).replace(/\s/g, "")}`} style={{ color: "inherit" }}>
                        {x.deger}
                      </a>
                    ) : (
                      x.deger
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {/*
        Sosyal hesaplar — footer'la aynı bileşen, aynı kaynak.
        Panelden bir hesap eklenince üç yerde birden çıkıyor.
      */}
      {/* Kişi kartı — yalnızca Hakkımızda'da */}
      {tur === "hakkimizda" && (
        <YoneticiKarti settings={settings} locale={locale} />
      )}

      {tur !== "kunye" && (
        <section style={{ marginTop: 14 }}>
          <h2 style={{
            fontSize: 12, fontWeight: 800, letterSpacing: ".05em",
            textTransform: "uppercase", color: "var(--mu)",
            margin: "0 0 12px",
          }}>
            Bizi takip edin
          </h2>
          <SosyalBaglantilar settings={settings} boyut={40} />
        </section>
      )}
    </div>
  );
}
