"use client";
import { useEffect, useState } from "react";

/**
 * Doğrulandıktan sonra geri sayım.
 *
 * Kullanıcıyı anında atmak yerine 5 saniye beklenir: "doğrulandı"
 * mesajını okuması için. Sayaç görünür olduğu için ne olduğu
 * belli; sessizce bekletmek kafa karıştırırdı.
 */
export default function VerifiedRedirect({
  to, label, seconds = 5,
}: {
  to: string;
  label: string;
  seconds?: number;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) { window.location.href = to; return; }
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left, to]);

  return (
    <p style={{ fontSize: 13, color: "var(--mu)", marginTop: 18 }}>
      <b style={{ color: "var(--tx)", fontVariantNumeric: "tabular-nums" }}>{left}</b>{" "}
      {label}
    </p>
  );
}
