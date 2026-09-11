/** Panel sekmelerinde boş durum kutusu */
export default function Empty({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: "44px 24px", textAlign: "center",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--mu)", margin: 0 }}>{text}</p>
    </div>
  );
}
