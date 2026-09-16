import type { ScoreBoard, Match } from "@/lib/sports";
import type { Dictionary } from "@/i18n/get-dictionary";
import { serviceHref, type Locale } from "@/i18n/config";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * SPOR KATEGORİSİ — MAÇ VE PUAN ŞERİDİ
 *
 * Kategori sayfası düz bir haber listesi olmak zorunda değil.
 * Spor okuru sayfaya girdiğinde önce skoru merak eder; haberler
 * onun altında.
 *
 * Tam genişlik: solda haftanın maçları (yatay kaydırılır),
 * sağda ilk beş takım.
 */
export default function ScoreStrip({
  board, locale, dict,
}: {
  board: ScoreBoard;
  locale: Locale;
  dict: Dictionary;
}) {
  const week = board.lastWeek || board.currentWeek;
  const matches = board.matches
    .filter((m) => m.week === week)
    .sort((a, b) => Number(b.played) - Number(a.played));

  if (!matches.length && !board.standings.length) return null;

  return (
    <section
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18, marginBottom: "calc(var(--g) + 8px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: "rgba(191,90,242,.15)", color: "#BF5AF2",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="trophy" size={17} />
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>{board.league}</h2>
        <span style={{ fontSize: 12, color: "var(--mu)", fontWeight: 600 }}>
          {week}. {dict.srv.week}
        </span>
        <Link
          href={serviceHref(locale, "scores")}
          style={{
            marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 4,
            fontSize: 13, fontWeight: 700, color: "var(--ac)", flexShrink: 0,
          }}
        >
          {dict.common.all}
          <Icon name="chevronRight" size={15} />
        </Link>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--g)", alignItems: "flex-start" }}>
        {/* maçlar */}
        <div style={{ flex: "2 1 420px", minWidth: 0 }}>
          <div
            data-hide-sb
            style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x proximity", paddingBottom: 2 }}
          >
            {matches.map((m) => (
              <MiniMatch key={m.id} m={m} dict={dict} />
            ))}
          </div>
        </div>

        {/* ilk beş */}
        {board.standings.length > 0 && (
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {board.standings.slice(0, 5).map((r) => (
                <div
                  key={r.team.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}
                >
                  <span style={{ width: 14, fontSize: 12, fontWeight: 800, color: "var(--mu)" }}>
                    {r.position}
                  </span>
                  {r.team.logo && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.team.logo}
                      alt=""
                      loading="lazy"
                      style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1, minWidth: 0, fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {r.team.name}
                  </span>
                  <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {r.form.slice(0, 3).map((f, i) => (
                      <span
                        key={i}
                        title={f === "w" ? dict.srv.won : f === "l" ? dict.srv.lost : dict.srv.drawn}
                        style={{
                          width: 6, height: 6, borderRadius: 99,
                          background: f === "w" ? "#30D158" : f === "l" ? "var(--dn)" : "var(--s3)",
                        }}
                      />
                    ))}
                  </span>
                  <b style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 20, textAlign: "end" }}>
                    {r.points}
                  </b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MiniMatch({ m, dict }: { m: Match; dict: Dictionary }) {
  const side = (t: Match["home"], score: number | null) => (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {t.logo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={t.logo}
          alt=""
          loading="lazy"
          style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }}
        />
      ) : (
        <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--s3)", flexShrink: 0 }} />
      )}
      <span
        style={{
          flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {t.name}
      </span>
      <b style={{ flexShrink: 0, fontSize: 15, fontVariantNumeric: "tabular-nums", color: m.played ? "var(--tx)" : "var(--mu)" }}>
        {m.played ? score : "—"}
      </b>
    </span>
  );

  return (
    <article
      style={{
        flex: "0 0 auto", width: 220, scrollSnapAlign: "start",
        background: "var(--s2)", borderRadius: 14, padding: "13px 14px",
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em",
          textTransform: "uppercase",
          color: m.played ? "var(--mu)" : "var(--ac)",
        }}
      >
        {m.played ? dict.srv.finished : dict.srv.upcoming}
      </span>
      {side(m.home, m.homeScore)}
      {side(m.away, m.awayScore)}
    </article>
  );
}
