import type { Dictionary } from "@/i18n/get-dictionary";
import type { ScoreBoard } from "@/lib/sports";
import { serviceHref, type Locale } from "@/i18n/config";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/**
 * ANA SAYFA PUAN DURUMU
 *
 * Skor API'sinden gelen ilk beş takım. Tam tablo, fikstür ve gol
 * krallığı için hizmet sayfasına bağlantı var — ana sayfada 18
 * satır fazla yer kaplardı.
 */
const COLS = "14px 22px 1fr 46px 26px 26px";

export default function LeagueTable({
  board, dict, locale, limit = 5,
}: {
  board: ScoreBoard;
  dict: Dictionary;
  locale: Locale;
  limit?: number;
}) {
  const rows = board.standings.slice(0, limit);
  if (!rows.length) return null;

  const next = board.matches
    .filter((m) => !m.played && m.week === board.currentWeek)
    .sort((a, b) => a.id - b.id)[0];

  return (
    <aside
      style={{
        background: "var(--s1)", border: "1px solid var(--bd)",
        borderRadius: 18, padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800 }}>{board.league}</h3>
        <span style={{ fontSize: 11.5, color: "var(--mu)", fontWeight: 600, marginInlineStart: "auto" }}>
          {board.currentWeek}. {dict.srv.week}
        </span>
      </div>

      <div
        style={{
          display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center",
          fontSize: 10.5, fontWeight: 800, color: "var(--mu)", letterSpacing: ".04em",
          paddingBottom: 9, borderBottom: "1px solid var(--bd)",
        }}
      >
        <span /><span />
        <span>{dict.srv.team.toLocaleUpperCase("tr")}</span>
        <span>{dict.srv.last5.toLocaleUpperCase("tr")}</span>
        <span style={{ textAlign: "end" }}>{dict.srv.goalDiff}</span>
        <span style={{ textAlign: "end" }}>{dict.srv.points}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 11, fontSize: 13.5 }}>
        {rows.map((r) => (
          <div key={r.team.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center" }}>
            <span style={{ fontWeight: 800, color: "var(--mu)" }}>{r.position}</span>

            {r.team.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={r.team.logo}
                alt=""
                loading="lazy"
                style={{ width: 20, height: 20, objectFit: "contain" }}
              />
            ) : (
              <span
                style={{
                  width: 20, height: 20, borderRadius: 999, background: "var(--s3)",
                  display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800,
                  color: "var(--mu)",
                }}
              >
                {r.team.name.slice(0, 1)}
              </span>
            )}

            <span
              style={{
                fontWeight: 700, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {r.team.name}
            </span>

            <span style={{ display: "flex", gap: 3 }}>
              {r.form.slice(0, 3).map((f, i) => (
                <span
                  key={i}
                  style={{
                    width: 7, height: 7, borderRadius: 99,
                    background: f === "w" ? "#30D158" : f === "l" ? "var(--dn)" : "var(--s3)",
                  }}
                />
              ))}
            </span>

            <span style={{ textAlign: "end", color: "var(--mu)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
            </span>
            <b style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{r.points}</b>
          </div>
        ))}
      </div>

      {next && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--bd)" }}>
          <div
            style={{
              fontSize: 10.5, fontWeight: 800, color: "var(--mu)",
              letterSpacing: ".05em", textTransform: "uppercase",
            }}
          >
            {dict.srv.upcoming}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 5 }}>
            {next.home.name} – {next.away.name}
          </div>
        </div>
      )}

      <Link
        href={serviceHref(locale, "scores")}
        style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 14,
          fontSize: 13, fontWeight: 700, color: "var(--ac)",
        }}
      >
        {dict.srv.standings}
        <Icon name="chevronRight" size={15} />
      </Link>
    </aside>
  );
}
