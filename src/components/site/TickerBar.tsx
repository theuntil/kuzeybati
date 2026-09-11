import type { Quote } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/i18n/config";

/**
 * Kayan piyasa şeridi. Sonsuz akış için liste iki kez basılıp
 * -%50 ötelenir; ikinci kopya ekran okuyucudan gizlenir.
 */
export default function TickerBar({
  quotes, speedSec, locale,
}: {
  quotes: Quote[];
  speedSec: number;
  locale: Locale;
}) {
  /*
   * ┌─ ŞERİTTE BOŞLUK OLUŞUYORDU ⚠️ ────────────────────────────┐
   * │ Kaydırma tekniği doğruydu: aynı liste iki kez basılıp    │
   * │ %50 kaydırılıyor — bu kusursuz bir döngü verir.           │
   * │                                                              │
   * │ Ama YALNIZCA liste ekrandan genişse. Altı sembolle iki    │
   * │ kopya bile geniş ekranı dolduramıyor; içerik bitiyor,     │
   * │ boşluk görünüyor, sonra baştan başlıyor.                   │
   * │                                                              │
   * │ Liste yeterince uzun olana kadar çoğaltılıyor. Böylece    │
   * │ tek sembol bile olsa şerit dolu akıyor.                     │
   * └──────────────────────────────────────────────────────────────┘
   */
  const HEDEF_ADET = 18;
  const kopya = quotes.length
    ? Math.max(1, Math.ceil(HEDEF_ADET / quotes.length))
    : 1;

  const uzunListe = Array.from({ length: kopya }, () => quotes).flat();

  const Row = ({ hidden = false }: { hidden?: boolean }) => (
    <div
      aria-hidden={hidden || undefined}
      style={{
        display: "flex", gap: 22, paddingInlineEnd: 22,
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: "var(--mu)",
      }}
    >
      {uzunListe.map((q, i) => {
        const up = q.changePercent >= 0;
        return (
          <span key={`${q.key}-${i}-${hidden ? "b" : "a"}`}>
            {q.label}{" "}
            <b style={{ color: up ? "var(--ac2)" : "var(--dn)" }}>
              {formatNumber(q.value, locale, q.value >= 1000 ? 0 : 2)}{" "}
              {up ? "+" : "−"}
              {formatNumber(Math.abs(q.changePercent), locale, 2)}%
            </b>
          </span>
        );
      })}
    </div>
  );

  return (
    <div data-ticker-bar data-hide-sb style={{ overflow: "hidden", padding: "6px 0", maxHeight: 40 }}>
      <div
        data-ticker
        style={{
          display: "flex", width: "max-content",
          /*
           * ┌─ ŞERİT ÇOK HIZLI AKIYORDU ⚠️ ────────────────────────┐
           * │ Liste ekranı doldursun diye çoğaltılıyor (bkz.      │
           * │ `kopya`). Ama süre sabit kaldığı için AYNI SÜREDE   │
           * │ daha uzun bir şerit kaydırılıyor — hız kopya sayısı │
           * │ kadar artıyordu.                                      │
           * │                                                        │
           * │ Süre kopya sayısıyla çarpılıyor: şerit ne kadar     │
           * │ uzarsa uzasın okuma hızı sabit kalıyor.              │
           * └────────────────────────────────────────────────────────┘
           */
          animation: `tick ${speedSec * kopya}s linear infinite`,
        }}
      >
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
