import Icon, { type IconName } from "@/components/ui/Icon";
import { getPrayerTimes } from "@/lib/services";
import type { Dictionary } from "@/i18n/get-dictionary";

/* ══════════════════════════════════════════════════════════════
   NAMAZ VAKİTLERİ KARTI

   Haber sayfasının yan sütununda, hava durumunun altında.
   Aynı görsel dili kullanıyor: kart, üst etiket, büyük vurgu.

   ┌─ İKON SEÇİMİ ⚠️ ──────────────────────────────────────────┐
   │ Her vakit günün farklı bir anını gösteriyor; ikon buna    │
   │ uymalı, yoksa yanlış bilgi verir:                          │
   │                                                              │
   │   İmsak   → ay      (gün doğmadan önce, karanlık)         │
   │   Güneş   → güneş   (gün doğuşu)                           │
   │   Öğle    → güneş   (en tepede)                            │
   │   İkindi  → parçalı (güneş alçalıyor)                      │
   │   Akşam   → bulutlu (gün batıyor)                          │
   │   Yatsı   → ay      (gece)                                 │
   │                                                              │
   │ İkon seti gün doğumu/batımı simgesi taşımıyor; en yakın    │
   │ anlamı veren mevcut ikonlar seçildi.                        │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const VAKIT_IKON: Record<string, IconName> = {
  Imsak:   "moon",
  Sunrise: "sun",
  Dhuhr:   "sun",
  Asr:     "wPartly",
  Maghrib: "wCloudy",
  Isha:    "moon",
};

const VAKIT_AD: Record<string, string> = {
  Imsak: "İmsak", Sunrise: "Güneş", Dhuhr: "Öğle",
  Asr: "İkindi", Maghrib: "Akşam", Isha: "Yatsı",
};

/**
 * "HH:MM" biçimindeki vakte kalan süre.
 *
 * ⚠ SUNUCUDA HESAPLANIYOR ve sayfa saatte bir yenileniyor.
 * Dakika dakika doğru olması gerekmiyor; "2 sa 15 dk" gibi
 * bir yaklaşıklık okur için yeterli ve istemci JavaScript'i
 * gerektirmiyor.
 */
function kalanSure(hhmm: string): string | null {
  const [s, d] = hhmm.split(":").map(Number);
  if (!Number.isFinite(s) || !Number.isFinite(d)) return null;

  const simdi = new Date();
  const hedef = new Date(simdi);
  hedef.setHours(s, d, 0, 0);

  /* Vakit geçmişse ertesi güne ait demektir */
  if (hedef.getTime() <= simdi.getTime()) {
    hedef.setDate(hedef.getDate() + 1);
  }

  const dk = Math.round((hedef.getTime() - simdi.getTime()) / 60000);
  if (dk < 1) return "birazdan";
  if (dk < 60) return `${dk} dk`;

  const saat = Math.floor(dk / 60);
  const kalanDk = dk % 60;
  return kalanDk === 0 ? `${saat} sa` : `${saat} sa ${kalanDk} dk`;
}

export default async function PrayerCard({
  city, dict,
}: {
  city: string;
  dict: Dictionary;
}) {
  const veri = await getPrayerTimes(city).catch(() => null);

  /* Veri yoksa kart hiç basılmıyor — boş kutu güven kaybettirir */
  if (!veri || veri.times.length === 0) return null;

  const sonraki = veri.next ?? veri.times[0];
  if (!sonraki) return null;

  const kalan = kalanSure(sonraki.time);
  const ikon = VAKIT_IKON[sonraki.key] ?? "mosque";

  return (
    <aside
      style={{
        border: "1px solid var(--bd)", borderRadius: 18,
        background: "var(--s1)", padding: 18,
      }}
    >
      <div className="eyebrow muted" style={{ marginBottom: 10 }}>
        {dict.services.prayer} · {veri.city}
      </div>

      {/* ---- Sıradaki vakit ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{
          display: "grid", placeItems: "center", flexShrink: 0,
          width: 52, height: 52, borderRadius: 15,
          background: "var(--s2)", color: "var(--tx)",
        }}>
          <Icon name={ikon} size={28} strokeWidth={1.4} />
        </span>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--mu)", fontWeight: 600 }}>
            {VAKIT_AD[sonraki.key] ?? sonraki.key} vaktine
          </div>
          {/* Vurgulu ve büyük — kartın asıl bilgisi */}
          <div style={{
            fontSize: 28, fontWeight: 800, lineHeight: 1.1,
            letterSpacing: "-.02em", marginTop: 2,
          }}>
            {kalan ?? sonraki.time}
          </div>
        </div>
      </div>

      {/* ---- Günün tüm vakitleri ---- */}
      <div style={{
        display: "grid", gap: 6, marginTop: 14,
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      }}>
        {veri.times.map((v) => {
          const aktif = v.key === sonraki.key;
          return (
            <div
              key={v.key}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "9px 4px", borderRadius: 11,
                background: aktif ? "var(--s3)" : "var(--s2)",
                border: aktif ? "1px solid var(--bd)" : "1px solid transparent",
              }}
            >
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: "var(--mu)",
                letterSpacing: ".02em",
              }}>
                {VAKIT_AD[v.key] ?? v.key}
              </span>
              <span style={{
                fontSize: 13.5, fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}>
                {v.time}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
