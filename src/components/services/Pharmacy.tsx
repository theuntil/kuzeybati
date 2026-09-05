"use client";
import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/Icon";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Pharmacy, DutyResult } from "@/lib/pharmacy";

/**
 * NÖBETÇİ ECZANE LİSTESİ
 *
 * İki mod: il/ilçe seçimi (sunucudan gelir) ve "yakınımdakiler"
 * (tarayıcı konumu → kendi API ucumuz → sağlayıcı).
 *
 * Konum izni İSTENMEDEN sorulmaz; düğmeye basılınca sorulur.
 * Reddedilirse liste il/ilçe modunda kalır, hata gösterilmez —
 * izin vermemek bir hata değil.
 */
export default function PharmacyList({
  initial, dict, canLocate,
}: {
  initial: DutyResult | null;
  dict: Dictionary;
  canLocate: boolean;
}) {
  const [data, setData] = useState<DutyResult | null>(initial);
  const [mode, setMode] = useState<"city" | "near">("city");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "city") setData(initial);
  }, [initial, mode]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setMsg(dict.srv.noGeo);
      return;
    }
    setLoading(true);
    setMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/eczane?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=8000`,
            { cache: "no-store" },
          );
          if (res.status === 429) throw new Error("rate");
          if (!res.ok) throw new Error("down");
          const json = (await res.json()) as DutyResult;
          setData(json);
          setMode("near");
          if (json.pharmacies.length === 0) setMsg(dict.srv.noNearby);
        } catch (e) {
          setMsg(e instanceof Error && e.message === "rate" ? dict.comments.rateLimit : dict.common.error);
        } finally {
          setLoading(false);
        }
      },
      () => {
        // İzin verilmedi: sessizce il/ilçe moduna dön
        setLoading(false);
        setMsg(dict.srv.geoDenied);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [dict]);

  const list = data?.pharmacies ?? [];

  return (
    <div>
      {canLocate && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={locate}
            disabled={loading}
            className="kb-locate"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 16px", borderRadius: 999,
              background: mode === "near" ? "#E5484D" : "var(--s2)",
              color: mode === "near" ? "#fff" : "var(--tx)",
              fontSize: 13.5, fontWeight: 700,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <span style={{ display: "flex", animation: loading ? "kbPulse 1.1s ease-in-out infinite" : undefined }}>
              <Icon name="pin" size={16} />
            </span>
            {loading ? dict.common.loading : dict.srv.nearMe}
          </button>

          {mode === "near" && (
            <button
              onClick={() => { setMode("city"); setData(initial); setMsg(null); }}
              style={{
                padding: "10px 16px", borderRadius: 999, background: "var(--s2)",
                fontSize: 13.5, fontWeight: 600, color: "var(--mu)",
              }}
            >
              {dict.common.back}
            </button>
          )}
        </div>
      )}

      {msg && (
        <p role="status" style={{ fontSize: 13.5, color: "var(--mu)", marginBottom: 14 }}>
          {msg}
        </p>
      )}

      {data?.date && (
        <p style={{ fontSize: 12.5, color: "var(--mu)", marginBottom: 14 }}>
          {new Date(data.date).toLocaleDateString("tr-TR", {
            day: "numeric", month: "long", year: "numeric", weekday: "long",
          })}
        </p>
      )}

      {list.length === 0 ? (
        <div
          style={{
            background: "var(--s1)", border: "1px solid var(--bd)",
            borderRadius: 18, padding: "44px 24px", textAlign: "center",
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--mu)", margin: 0 }}>
            {dict.srv.noPharmacy}
          </p>
        </div>
      ) : (
        <ul
          className="kb-pharm-grid"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}
        >
          {list.map((p, i) => (
            <li key={p.id} style={{ animation: `kbIn .34s cubic-bezier(.32,.72,0,1) ${Math.min(i, 8) * 40}ms both` }}>
              <Card p={p} dict={dict} />
            </li>
          ))}
        </ul>
      )}

      <style>{`
        /* Kare kart ızgarası: masaüstü 3, mobil 2 */
        .kb-pharm-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        @media (max-width: 860px) {
          .kb-pharm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .kb-pharm-card { padding: 13px; border-radius: 16px; }
        }
        .kb-pharm-card { transition: border-color .18s ease, transform .18s ease; }
        .kb-pharm-card:hover { border-color: rgba(229,72,77,.5); }

        @keyframes kbIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes kbPulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        .kb-locate { transition: transform .15s ease; }
        .kb-locate:active { transform: scale(.97); }
        .kb-act { transition: background .15s ease, transform .15s ease; }
        .kb-act:active { transform: scale(.96); }
      `}</style>
    </div>
  );
}

/**
 * ECZANE KARTI — KARE
 *
 * Masaüstünde satırda üç, mobilde iki kart. Kare oran içerikten
 * bağımsız sabit yükseklik verir; farklı uzunluktaki adresler
 * ızgarayı bozmaz. Ad iki, adres iki satırda kırpılır.
 */
function Card({ p, dict }: { p: Pharmacy; dict: Dictionary }) {
  const maps = p.konum
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.konum.lat},${p.konum.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.ad} ${p.ilce} ${p.il}`)}`;

  const act: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    flex: 1, minWidth: 0, height: 38, borderRadius: 11,
    fontSize: 13, fontWeight: 700,
  };

  return (
    <article
      className="kb-pharm-card"
      style={{
        background: "var(--s1)",
        border: "1px solid var(--bd)",
        borderRadius: 18,
        padding: 16,
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Kırmızı vurgu şeridi — sağlık/acil çağrışımı */}
      <span
        aria-hidden
        style={{
          position: "absolute", insetInline: 0, top: 0, height: 3,
          background: "linear-gradient(90deg, #E5484D, rgba(229,72,77,.25))",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span
          style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: "rgba(229,72,77,.14)", color: "#E5484D",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="cross" size={20} strokeWidth={1.8} />
        </span>

        {typeof p.mesafe === "number" && (
          <span
            style={{
              marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 4,
              fontSize: 11.5, fontWeight: 700, color: "#E5484D",
              background: "rgba(229,72,77,.12)", padding: "4px 9px", borderRadius: 999,
            }}
          >
            <Icon name="pin" size={11} />
            {p.mesafe < 1000 ? `${p.mesafe} m` : `${(p.mesafe / 1000).toFixed(1)} km`}
          </span>
        )}
      </div>

      <h3
        style={{
          fontSize: 15.5, fontWeight: 800, lineHeight: 1.26,
          overflowWrap: "anywhere",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {p.ad}
      </h3>

      <p
        style={{
          fontSize: 12.5, color: "var(--mu)", margin: "6px 0 0", lineHeight: 1.45,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {p.adres}
      </p>

      <p
        style={{
          fontSize: 11.5, color: "var(--mu)", fontWeight: 600,
          margin: "auto 0 12px", paddingTop: 8,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {p.ilce} · {p.il}
      </p>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {p.telefon && (
          <a
            href={`tel:${p.telefon.replace(/\s/g, "")}`}
            className="kb-act"
            style={{ ...act, background: "#E5484D", color: "#fff" }}
          >
            <Icon name="phone" size={14} color="#fff" />
            {dict.srv.call}
          </a>
        )}
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className="kb-act"
          style={{ ...act, background: "var(--s2)", color: "var(--tx)" }}
        >
          <Icon name="route" size={14} />
          {dict.srv.directions}
        </a>
      </div>
    </article>
  );
}
