import type { ScoreBoard, Match, StandingRow } from "@/lib/sports";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * FUTBOL SKORLARI
 *
 * Üç bölüm: hafta seçici + maçlar, puan durumu, gol krallığı.
 * Hafta seçimi adres üzerinden (`?week=`) — paylaşılabilir olsun
 * ve sunucuda önbelleklensin diye istemci durumu kullanılmadı.
 */
export function Fixtures({
  board, week, dict,
}: {
  board: ScoreBoard;
  week: number;
  dict: Dictionary;
}) {
  const list = board.matches.filter((m) => m.week === week);

  return (
    <section>
      {/* hafta seçici */}
      <div
        data-hide-sb
        style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}
      >
        {board.weeks.map((w) => {
          const on = w === week;
          return (
            <Link
              key={w}
              href={`?week=${w}`}
              aria-current={on}
              style={{
                flexShrink: 0, minWidth: 40, textAlign: "center",
                padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: on ? "var(--tx)" : "var(--s2)",
                color: on ? "var(--bg)" : "var(--mu)",
              }}
            >
              {w}
            </Link>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {list.map((m, i) => (
          <MatchCard
            key={m.id}
            m={m}
            dict={dict}
            // Haftanın ilk oynanmış maçı vurgulu gösterilir
            featured={m.played && i === list.findIndex((x) => x.played)}
          />
        ))}
        {list.length === 0 && (
          <p style={{ color: "var(--mu)", fontSize: 14 }}>{dict.search.noResults}</p>
        )}
      </div>
    </section>
  );
}

function TeamCell({ t, align }: { t: Match["home"]; align: "start" | "end" }) {
  return (
    <span
      style={{
        display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1,
        flexDirection: align === "end" ? "row-reverse" : "row",
        textAlign: align === "end" ? "end" : "start",
      }}
    >
      {t.logo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={t.logo}
          alt=""
          loading="lazy"
          style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }}
        />
      ) : (
        <span
          style={{
            width: 26, height: 26, borderRadius: 999, background: "var(--s3)",
            display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800,
            color: "var(--mu)", flexShrink: 0,
          }}
        >
          {t.name.slice(0, 2).toLocaleUpperCase("tr")}
        </span>
      )}
      <span
        style={{
          fontSize: 14, fontWeight: 600, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {t.name}
      </span>
    </span>
  );
}

export function MatchCard({
  m, dict, featured = false,
}: {
  m: Match;
  dict: Dictionary;
  /** Son biten maç: bir tık büyük ve vurgulu */
  featured?: boolean;
}) {
  return (
    <article
      style={{
        display: "flex", alignItems: "center", gap: featured ? 16 : 12,
        background: "var(--s1)",
        border: `1px solid ${featured ? "var(--mu)" : "var(--bd)"}`,
        borderRadius: featured ? 18 : 14,
        padding: featured ? "22px 20px" : "14px 16px",
      }}
    >
      <TeamCell t={m.home} align="start" />

      <span
        style={{
          flexShrink: 0, minWidth: featured ? 96 : 74, textAlign: "center",
          fontSize: m.played ? (featured ? 26 : 18) : 13,
          fontWeight: 800, fontVariantNumeric: "tabular-nums",
          color: m.played ? "var(--tx)" : "var(--mu)",
        }}
      >
        {m.played ? `${m.homeScore} - ${m.awayScore}` : "—"}
        <span
          style={{
            display: "block", fontSize: 10.5, fontWeight: 700, marginTop: 3,
            color: "var(--mu)", textTransform: "uppercase", letterSpacing: ".05em",
          }}
        >
          {m.played ? dict.srv.finished : `${m.week}. ${dict.srv.week}`}
        </span>
      </span>

      <TeamCell t={m.away} align="end" />
    </article>
  );
}

export function Standings({
  rows, dict,
}: {
  rows: StandingRow[];
  dict: Dictionary;
}) {
  const COLS = "20px 26px 1fr 54px 26px 26px 26px 30px";
  const head: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 800, color: "var(--mu)",
    letterSpacing: ".04em", textAlign: "end",
  };

  /** İlk 4 Şampiyonlar Ligi, 5-6 Avrupa, son 3 küme düşme */
  const band = (pos: number, total: number) =>
    pos <= 4 ? "#30D158" : pos <= 6 ? "#0A84FF" : pos > total - 3 ? "var(--dn)" : "transparent";

  return (
    <section
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>
        {dict.srv.standings}
      </h2>

      <div
        data-hide-sb
        style={{ overflowX: "auto" }}
      >
        <div style={{ minWidth: 420 }}>
          <div
            style={{
              display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center",
              paddingBottom: 9, borderBottom: "1px solid var(--bd)",
            }}
          >
            <span /><span />
            <span style={{ ...head, textAlign: "start" }}>{dict.srv.team}</span>
            {/* "FORM" tek başına ne anlama geldiği belli değildi.
              Sütun son beş maçın sonucunu gösteriyor: kazandı /
              berabere / kaybetti. Başlık artık bunu söylüyor. */}
          <span style={{ ...head, textAlign: "start" }}>{dict.srv.last5}</span>
            <span style={head}>{dict.srv.played}</span>
            <span style={head}>{dict.srv.goalDiff}</span>
            <span style={head}>{dict.srv.won}</span>
            <span style={head}>{dict.srv.points}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 11 }}>
            {rows.map((r) => (
              <div
                key={r.team.id}
                style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center", fontSize: 13.5 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 3, height: 16, borderRadius: 2,
                      background: band(r.position, rows.length),
                    }}
                  />
                  <b style={{ color: "var(--mu)", fontSize: 12 }}>{r.position}</b>
                </span>

                {r.team.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.team.logo}
                    alt=""
                    loading="lazy"
                    style={{ width: 22, height: 22, objectFit: "contain" }}
                  />
                ) : (
                  <span />
                )}

                <span
                  style={{
                    fontWeight: 600, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {r.team.name}
                </span>

                <span style={{ display: "flex", gap: 3 }}>
                  {r.form.slice(0, 5).map((f, i) => (
                    <span
                      key={i}
                      title={f === "w" ? dict.srv.won : f === "l" ? dict.srv.lost : dict.srv.drawn}
                      style={{
                        width: 7, height: 7, borderRadius: 99,
                        background: f === "w" ? "#30D158" : f === "l" ? "var(--dn)" : "var(--s3)",
                      }}
                    />
                  ))}
                </span>

                <span style={{ textAlign: "end", color: "var(--mu)", fontVariantNumeric: "tabular-nums" }}>
                  {r.played}
                </span>
                <span style={{ textAlign: "end", color: "var(--mu)", fontVariantNumeric: "tabular-nums" }}>
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </span>
                <span style={{ textAlign: "end", color: "var(--mu)", fontVariantNumeric: "tabular-nums" }}>
                  {r.won}
                </span>
                <b style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{r.points}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TopScorers({
  board, dict, limit = 10,
}: {
  board: ScoreBoard;
  dict: Dictionary;
  limit?: number;
}) {
  const list = board.scorers.slice(0, limit);
  if (!list.length) return null;

  return (
    <section
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>
        {dict.srv.topScorers}
      </h2>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {list.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
              borderBottom: i === list.length - 1 ? undefined : "1px solid var(--bd)",
            }}
          >
            <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: "var(--mu)" }}>
              {i + 1}
            </span>
            {p.team.logo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={p.team.logo}
                alt=""
                loading="lazy"
                style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block", fontSize: 13.5, fontWeight: 600,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--mu)", marginTop: 1 }}>
                {p.team.name}
              </span>
            </span>
            <b style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{p.goals}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ScoreFooter({ board, dict }: { board: ScoreBoard; dict: Dictionary }) {
  if (!board.updatedAt) return null;
  return (
    <p style={{ fontSize: 12, color: "var(--mu)", marginTop: 18, display: "flex", alignItems: "center", gap: 6 }}>
      <Icon name="clock" size={13} />
      {dict.srv.lastUpdate}: {board.updatedAt} · TFF
    </p>
  );
}

export type { Locale };
