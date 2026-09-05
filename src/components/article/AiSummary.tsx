import type { ArticleAi } from "@/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon from "@/components/ui/Icon";

/**
 * AI özeti. İki şey bilinçli:
 *  - Üretildiği açıkça yazıyor; okur neyi okuduğunu bilmeli.
 *  - cocuk_guvenli üç durumlu: null ise HİÇBİR rozet gösterilmez.
 *    "Değerlendirilmedi"yi "uygun" gibi göstermek yanlış olurdu.
 */
export default function AiSummary({
  ai, dict,
}: {
  ai: ArticleAi | null;
  dict: Dictionary;
}) {
  if (!ai?.ozet) return null;

  return (
    <aside
      style={{
        border: "1px solid var(--bd)", borderRadius: "var(--radius)",
        background: "var(--s1)", padding: "15px 17px", margin: "22px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9, flexWrap: "wrap" }}>
        <span className="badge" style={{ background: "var(--s3)", color: "var(--mu)" }}>
          <Icon name="sparkles" size={12} />
          {dict.article.aiSummary}
        </span>

        {/*
          ⚠ ÇOCUK ROZETİ BURADAN KALDIRILDI.
          Aynı bilgi başlığın altında zaten var; burada
          tekrarlanınca sayfada iki kez çıkıyordu.
        */}
      </div>

      {/*
        Alt not kaldırıldı. "Bu özet yapay zekâ tarafından
        üretildi" yazısı üstteki rozetle aynı şeyi söylüyordu.
      */}
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{ai.ozet}</p>
    </aside>
  );
}
