import { Skeleton } from "@/components/ui/Skeleton";

/**
 * SAYFA İSKELETİ — YALNIZCA ANA SAYFA
 *
 * ┌─ NEDEN GEREKLİ ⚠️ ────────────────────────────────────────┐
 * │ Ana sayfa 6 paralel sorgu + kategori blokları çekiyor.     │
 * │ Hepsi bitene kadar tarayıcı BEYAZ ekranda bekliyordu —    │
 * │ 4-5 saniye. Kullanıcı sitenin açılmadığını sanıyordu.     │
 * │                                                             │
 * │ Next.js bu dosyayı yükleme durumunda otomatik gösteriyor.  │
 * │ Header ve footer layout'ta olduğu için ANINDA çiziliyor;   │
 * │ yalnızca içerik alanı iskelet görünüyor.                   │
 * │                                                             │
 * │ Toplam süre aynı ama kullanıcı ilk 100 ms'de sayfayı       │
 * │ görüyor ve nereye ne geleceğini anlıyor.                    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * ┌─ NEDEN `(home)` ROTA GRUBUNUN İÇİNDE ⚠️ ──────────────────┐
 * │ Önce bu dosya `[locale]/loading.tsx`'teydi. Next.js bir    │
 * │ segmentteki `loading.tsx`'i, kendi loading.tsx'i olmayan   │
 * │ TÜM alt rotalarda da kullanıyor — bu yüzden hesabım, reels,│
 * │ kategori, arama gibi tamamen farklı görünen sayfalara      │
 * │ girerken bir an ANA SAYFANIN hero+kategori iskeleti         │
 * │ çakıyordu. Alakasız ve göze batan bir "bug" gibi duruyordu.│
 * │                                                              │
 * │ `(home)` bir rota grubu — adrese hiç yansımıyor (site yine │
 * │ `/tr` açılıyor) ama bu dosyanın kapsamını YALNIZCA ana      │
 * │ sayfayla sınırlıyor. Diğer sayfalar artık kendi             │
 * │ `loading.tsx`'i olmadığı için hiçbir iskelet görmüyor;      │
 * │ tarayıcı yeni sayfa hazır olana kadar mevcut sayfada        │
 * │ kalıyor — sessiz ve göze çarpmayan geçiş.                    │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Ölçüler gerçek yerleşimle aynı: veri gelince sayfa ZIPLAMIYOR.
 */
export default function Loading() {
  return (
    <div style={{ padding: "var(--g) var(--gut)" }}>
      {/* hizmet şeridi */}
      <Skeleton h={64} r={16} />

      {/* hero + kenar sütunu */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "var(--g)",
          marginTop: "var(--g)", alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "3 1 var(--main)", minWidth: 0 }}>
          <Skeleton h={420} r={20} />
          <div
            style={{
              display: "grid", gap: "var(--g)", marginTop: "var(--g)",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton h={150} r={14} />
                <Skeleton h={13} style={{ marginTop: 10 }} />
                <Skeleton h={13} w="70%" style={{ marginTop: 6 }} />
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            flex: "1 1 var(--side)", minWidth: 0,
            display: "flex", flexDirection: "column", gap: "var(--g)",
          }}
        >
          <Skeleton h={180} r={18} />
          <Skeleton h={260} r={18} />
        </div>
      </div>

      {/* iki kategori rayı */}
      {[0, 1].map((b) => (
        <div key={b} style={{ marginTop: "calc(var(--g) * 2)" }}>
          <Skeleton h={22} w={160} />
          <div
            style={{
              display: "grid", gap: "var(--g)", marginTop: "var(--g)",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton h={130} r={14} />
                <Skeleton h={13} style={{ marginTop: 10 }} />
                <Skeleton h={13} w="60%" style={{ marginTop: 6 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
