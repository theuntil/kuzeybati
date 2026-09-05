import { Skeleton } from "@/components/ui/Skeleton";

/**
 * HABER SAYFASI İSKELETİ
 *
 * Haber sayfası gövde, medya, AI özeti, çeviri, yorumlar ve
 * ilgili haberleri birlikte çekiyor. İskelet olmadan tıklamayla
 * içerik arasında saniyeler geçiyor ve kullanıcı geri dönüyordu.
 */
export default function Loading() {
  return (
    <div style={{ padding: "var(--g) var(--gut)", maxWidth: 820, margin: "0 auto" }}>
      <Skeleton h={13} w={180} />
      <Skeleton h={38} style={{ marginTop: 16 }} />
      <Skeleton h={38} w="80%" style={{ marginTop: 8 }} />
      <Skeleton h={15} w={240} style={{ marginTop: 16 }} />
      <Skeleton h={380} r={18} style={{ marginTop: 24 }} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} h={15} w={i % 3 === 2 ? "72%" : "100%"}
          style={{ marginTop: i === 0 ? 24 : 12 }} />
      ))}
    </div>
  );
}
