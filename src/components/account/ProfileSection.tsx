"use client";
import { useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import Icon from "@/components/ui/Icon";
import PhotoSheet from "./PhotoSheet";
import { assetUrl } from "@/lib/media";

/**
 * PROFİLİM BÖLÜMÜ
 *
 * Kapak ve profil fotoğrafı YALNIZCA BURADA. Eskiden her
 * sekmenin üstünde duruyor ve sayfanın yarısını kaplıyordu;
 * kaydedilenlere bakarken kapak fotoğrafı görmenin anlamı yok.
 *
 * Fotoğrafa dokununca tabaka açılıyor: ekle / değiştir / kaldır,
 * ardından kırpma ve kaydetme.
 */
export default function ProfileSection({
  userId, avatarKey, avatarUrl, coverKey, name, username,
  cityName, role, verified, joinedAt, dict, stats,
}: {
  userId: string;
  avatarKey: string | null;
  avatarUrl: string | null;
  coverKey: string | null;
  name: string;
  username: string;
  cityName: string | null;
  role: string;
  verified: boolean;
  joinedAt: string;
  dict: Dictionary;
  stats: { saved: number; likes: number; comments: number };
}) {
  const pub = (k: string | null) =>
    assetUrl(k);

  const [avatar, setAvatar] = useState<string | null>(avatarKey ? pub(avatarKey) : avatarUrl);
  const [cover, setCover] = useState<string | null>(pub(coverKey));
  const [sheet, setSheet] = useState<null | "avatar" | "cover">(null);

  const roleLabel =
    role === "admin" ? dict.profile.roleAdmin
    : role === "author" ? dict.profile.roleAuthor
    : dict.profile.roleReader;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/*
        Kişi kartı.

        ⚠ MOBİLDE TAM GENİŞLİK.
        `kb-kisi-kart` sınıfı dar ekranda kenar yarıçapını ve
        yan kenarlıkları kaldırıp kartı kenardan kenara
        uzatıyor — kapak fotoğrafı ortada dar bir şerit gibi
        durmuyor artık.
      */}
      <section className="kb-kisi-kart" style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, overflow: "hidden",
      }}>
        {/* ---- kapak ---- */}
        <button
          onClick={() => setSheet("cover")}
          aria-label={dict.profile.coverPhoto}
          className="kb-cover-btn"
          style={{
            position: "relative", width: "100%", display: "block",
            aspectRatio: "3 / 1",
            background: cover
              ? undefined
              : "linear-gradient(135deg, var(--s2), var(--s3))",
          }}
        >
          {cover && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <span style={{
            position: "absolute", insetInlineEnd: 12, top: 12,
            width: 34, height: 34, borderRadius: 999,
            background: "rgba(0,0,0,.5)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}>
            <Icon name="camera" size={15} color="#fff" />
          </span>
        </button>

        {/* ---- kimlik ---- */}
        <div style={{ padding: "0 22px 22px", marginTop: -34 }}>
          <button
            onClick={() => setSheet("avatar")}
            aria-label={dict.profile.profilePhoto}
            style={{
              position: "relative", width: 84, height: 84, borderRadius: 999,
              border: "4px solid var(--s1)", background: "var(--s2)",
              display: "grid", placeItems: "center", overflow: "hidden",
              fontSize: 30, fontWeight: 800, color: "var(--mu)",
            }}
          >
            {avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (name || "?").slice(0, 1).toLocaleUpperCase("tr")
            )}
            <span style={{
              position: "absolute", insetInline: 0, bottom: 0, height: 24,
              background: "rgba(0,0,0,.55)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="camera" size={12} color="#fff" />
            </span>
          </button>

          <h2 style={{
            fontSize: 21, fontWeight: 800, letterSpacing: "-.02em",
            marginTop: 12, overflowWrap: "anywhere",
          }}>{name}</h2>

          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 6,
            fontSize: 13.5, color: "var(--mu)", flexWrap: "wrap",
          }}>
            <span>@{username}</span>
            {cityName && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="pin" size={12} />{cityName}
              </span>
            )}
            {verified && (
              <span style={{
                display: "flex", alignItems: "center", gap: 4,
                color: "#30D158", fontWeight: 700, fontSize: 12,
              }}>
                <Icon name="verified" size={12} />{dict.profile.verified}
              </span>
            )}
            <span style={{display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center",
              fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em",
              textTransform: "uppercase", color: "var(--mu)",
              background: "var(--s2)", padding: "3px 9px", borderRadius: 6,
            }}>{roleLabel}</span>
          </div>

          <p style={{ fontSize: 12.5, color: "var(--mu)", marginTop: 10 }}>
            {new Date(joinedAt).toLocaleDateString("tr-TR", {
              month: "long", year: "numeric",
            })} tarihinde katıldı
          </p>
        </div>
      </section>

      {/* ---- sayaçlar ---- */}
      <section style={{
        display: "grid", gap: 10,
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      }}>
        {[
          [dict.auth.savedArticles, stats.saved],
          [dict.auth.likedArticles, stats.likes],
          [dict.auth.myComments, stats.comments],
        ].map(([label, n]) => (
          <div key={String(label)} style={{
            background: "var(--s1)", border: "1px solid var(--bd)",
            borderRadius: 14, padding: "14px 12px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>{n}</div>
            <div style={{ fontSize: 11.5, color: "var(--mu)", fontWeight: 600, marginTop: 3 }}>
              {label}
            </div>
          </div>
        ))}
      </section>

      <PhotoSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        kind={sheet ?? "avatar"}
        userId={userId}
        current={sheet === "cover" ? cover : avatar}
        dict={dict}
        onSaved={(url) => (sheet === "cover" ? setCover(url) : setAvatar(url))}
      />

      <style>{`
        .kb-cover-btn { transition: opacity .15s ease; }
        .kb-cover-btn:hover { opacity: .92; }
      `}</style>
    </div>
  );
}
