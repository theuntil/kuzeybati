import "server-only";

/**
 * SKOR API — Trendyol Süper Lig
 *
 * Kaynak: https://skor.rovand.cloud/api.php  (TFF verisi, self-hosted)
 *
 * ANAHTAR SUNUCUDA KALIR. Doküman tarayıcıdan çağrı için
 * `?api_key=` öneriyor çünkü `X-Api-Key` preflight tetikliyor;
 * biz sunucudan çağırdığımız için preflight yok, header yöntemi
 * kullanılıyor ve anahtar tarayıcıya hiç inmiyor.
 *
 * .env:
 *   SKOR_API_URL   (varsayılan https://skor.rovand.cloud)
 *   SKOR_API_KEY   zorunlu — yoksa bölümler gösterilmez
 */

/*
 * ⚠ SONDAKİ EĞİK ÇİZGİ TEMİZLENİYOR.
 * Ortam değişkenine "https://skor.example.com/" yazılırsa
 * adres "…com//api.php" olur ve bazı sunucular 404 verir.
 */
const BASE = (process.env.SKOR_API_URL ?? "https://skor.rovand.cloud")
  .trim()
  .replace(/\/+$/, "");

/* ---------- Sağlayıcının ham biçimi ---------- */
interface RawFixture {
  week: number;
  home_team: string;
  away_team: string;
  home_id: number;
  away_id: number;
  home_score: number | null;
  away_score: number | null;
  match_id: number;
  status: "completed" | "scheduled";
  home_logo_url?: string | null;
  away_logo_url?: string | null;
}
interface RawStanding {
  position: number;
  team: string;
  team_id: number;
  played: number; won: number; drawn: number; lost: number;
  goals_for: number; goals_against: number; goal_difference: number;
  points: number;
  logo_url: string | null;
}
interface RawScorer {
  name: string; team: string; goals: number;
  player_id: number; team_id: number;
}
interface RawAll {
  meta: { source: string; scraped_at: string; title: string };
  fixtures: RawFixture[];
  standings: RawStanding[];
  clubs: { id: number; name: string; url: string; logo_url: string | null }[];
  top_scorers: RawScorer[];
}

/* ---------- Sitenin kullandığı biçim ---------- */
export interface Team {
  id: number;
  name: string;   // temizlenmiş: "Galatasaray"
  raw: string;    // TFF biçimi: "GALATASARAY A.Ş."
  logo: string | null;
}
export interface Match {
  id: number;
  week: number;
  played: boolean;
  home: Team;
  away: Team;
  homeScore: number | null;
  awayScore: number | null;
}
export interface StandingRow {
  position: number;
  team: Team;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number;
  points: number;
  /** Son maçlar, yeniden eskiye: w | d | l */
  form: ("w" | "d" | "l")[];
}
export interface Scorer {
  name: string; goals: number; team: Team;
}
export interface ScoreBoard {
  league: string;
  updatedAt: string;
  /** Oynanacak ilk hafta — "bu hafta" */
  currentWeek: number;
  /** Oynanmış son hafta */
  lastWeek: number;
  weeks: number[];
  matches: Match[];
  standings: StandingRow[];
  scorers: Scorer[];
}

export function sportsConfigured(): boolean {
  return Boolean(process.env.SKOR_API_KEY);
}

/**
 * Büyük harfli adı okunur hâle getirir.
 *
 * TÜRKÇE / YABANCI AYRIMI
 *   Türkçe yerelde "I" → "ı" olur. Bu Türkçe adlarda doğru
 *   ("KASIMPAŞA" → "Kasımpaşa") ama yabancı oyuncu adlarında
 *   yanlış: "VICTOR OSIMHEN" → "Vıctor Osımhen" çıkıyordu.
 *
 *   Ad Türkçe'ye özgü harf (İ Ğ Ş Ü Ö Ç) içeriyorsa Türkçe,
 *   içermiyorsa yansız yerel kullanılır. "BERKAN İSMAİL KUTLU"
 *   Türkçe sayılır, "MASON GREENWOOD" sayılmaz.
 */
function titleCase(raw: string): string {
  /**
   * Ayraç yalnızca TÜRKÇE'YE ÖZGÜ harfler: İ Ğ Ş (ve küçükleri).
   * Ç, Ü, Ö bilerek DIŞARIDA: Portekizce "Conceição", Almanca
   * "Müller", Fransızca "Français" bunları kullanıyor. Ç'yi ayraç
   * saymak "ANDERSON SOUZA CONCEIÇAO" adını Türkçe sanıp
   * "Conceıçao" yapıyordu.
   */
  const turkish = /[İĞŞığş]/.test(raw);
  const lower = turkish ? raw.toLocaleLowerCase("tr") : raw.toLowerCase();
  const up = (c: string) => (turkish ? c.toLocaleUpperCase("tr") : c.toUpperCase());

  return lower
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      // FK, SK gibi iki harfli kısaltmalar büyük kalır
      w.length <= 2 && /^[a-zçğıöşü]+$/.test(w) ? up(w) : up(w.charAt(0)) + w.slice(1),
    )
    .join(" ");
}

/** Oyuncu adı: unvan temizliği yok, yalnızca yazım düzeltmesi. */
export function cleanPerson(raw: string): string {
  return titleCase(raw);
}

/**
 * Takım adını temizle.
 *
 * TFF adları büyük harf ve resmi unvanlı geliyor:
 * "GALATASARAY A.Ş." → "Galatasaray"
 * "GAZİANTEP FUTBOL KULÜBÜ A.Ş." → "Gaziantep"
 */
export function cleanTeam(raw: string): string {
  /**
   * `\b` sınırı Türkçe harflerle ÇALIŞMAZ: "Ş" JavaScript'te sözcük
   * karakteri sayılmadığı için `\bA\.?\s?Ş\.?\b` hiç eşleşmiyor ve
   * "GALATASARAY A.Ş." → "Galatasaray A.ş." çıkıyordu.
   * Bu yüzden sınır yerine açık boşluk/başlangıç grupları ve
   * harfler için karakter sınıfı kullanılıyor.
   */
  const stripped = raw
    .replace(/\s*FUTBOL\s+KUL[üÜ]B[üÜ]\s*/g, " ")
    .replace(/\s*SPOR\s+KUL[üÜ]B[üÜ]\s*/g, " ")
    .replace(/\s*KUL[üÜ]B[üÜ]\s*/g, " ")
    .replace(/(^|\s)A\.?\s?[şŞ]\.?(?=\s|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return titleCase(stripped);
}

const teamOf = (id: number, raw: string, logo?: string | null): Team => ({
  id,
  raw,
  name: cleanTeam(raw),
  logo: logo ?? `${BASE}/logos/${id}.png`,
});

/**
 * Tüm veriyi tek istekte çeker.
 *
 * Doküman tek sayfalık uygulamalar için `type=all` öneriyor;
 * bizde de doğrusu bu: `revalidate: 300` ile beş dakika
 * önbelleklenir, veri zaten günde birkaç kez güncelleniyor ve
 * IP başına dakikada 60 istek sınırı var.
 */
/*
 * ┌─ SESSİZ BAŞARISIZLIK ⚠️ ───────────────────────────────────┐
 * │ Bu fonksiyon her hatada sessizce `null` dönüyordu: anahtar │
 * │ tanımsızsa, adres yanlışsa, sunucu 500 verse, JSON bozuk   │
 * │ olsa — hepsi aynı sonuç. Skorlar görünmediğinde SEBEBİ     │
 * │ öğrenmenin hiçbir yolu yoktu.                               │
 * │                                                              │
 * │ Artık her başarısızlık sunucu günlüğüne net bir satır       │
 * │ yazıyor. Bu satırlar yalnızca sunucuda görünüyor —          │
 * │ tarayıcıya ve okura sızmıyor.                                │
 * └──────────────────────────────────────────────────────────────┘
 */
function skorHata(sebep: string, ayrinti?: unknown) {
  console.error(`[SKOR] Veri alınamadı — ${sebep}`,
    ayrinti === undefined ? "" : ayrinti);
}

async function fetchAll(): Promise<RawAll | null> {
  const key = process.env.SKOR_API_KEY;
  if (!key) {
    skorHata("SKOR_API_KEY tanımlı değil. Web servisinin ortam "
      + "değişkenlerine eklenmeli.");
    return null;
  }

  const adres = `${BASE}/api.php?type=all`;

  try {
    const res = await fetch(adres, {
      headers: { "X-Api-Key": key },
      /*
       * ⚠ ZAMAN AŞIMI ŞART.
       * Sağlayıcı yanıt vermediğinde istek süresiz asılı
       * kalıyor ve sayfa hiç açılmıyordu.
       */
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });

    // Başarılı yanıtta gövdede `status` alanı YOK; hata kontrolü
    // HTTP koduna göre yapılır (dokümanın 7. bölümü).
    if (!res.ok) {
      skorHata(`sunucu ${res.status} döndü. Adres: ${adres}`
        + (res.status === 401 || res.status === 403
            ? " — SKOR_API_KEY yanlış olabilir."
            : ""));
      return null;
    }

    const govde = (await res.json()) as RawAll & {
      status?: string; message?: string;
    };

    /*
     * ⚠ HATA GÖVDESİ HTTP 200 İLE DE GELEBİLİYOR.
     *
     * Kodda "başarılı yanıtta `status` alanı yok, hata kontrolü
     * HTTP koduna göre yapılır" yazıyordu. Ama API anahtar
     * hatasında şunu döndürüyor:
     *
     *   { "status": "error", "message": "Geçersiz veya eksik API key." }
     *
     * Bunu 200 ile gönderirse `res.ok` doğru çıkıyor, gövde
     * geçerli veri sanılıyor, `fixtures` bulunamadığı için boş
     * liste üretiliyor ve sayfa SESSİZCE BOŞ kalıyordu.
     *
     * Artık gövdedeki hata zarfı HTTP kodundan bağımsız olarak
     * yakalanıyor.
     */
    if (govde?.status === "error") {
      skorHata(
        `API hata döndü: ${govde.message ?? "(mesaj yok)"} — `
        + "büyük ihtimalle SKOR_API_KEY yanlış ya da web servisine "
        + `geçmemiş. Adres: ${adres}`,
      );
      return null;
    }

    /*
     * ⚠ BOŞ YANIT DA BAŞARISIZLIKTIR.
     * Sunucu 200 dönüp içi boş bir nesne verebiliyor (örneğin
     * kazıma henüz çalışmadıysa). Bu durumda sayfa sessizce
     * boş kalıyordu; artık sebebi günlüğe yazılıyor.
     */
    if (!govde || typeof govde !== "object") {
      skorHata(`yanıt JSON nesnesi değil. Adres: ${adres}`);
      return null;
    }
    /*
     * ⚠ BOŞ FİKSTÜR TÜM VERİYİ ÇÖPE ATMAMALI.
     *
     * İlk düzeltmemde burada `return null` vardı — yanlıştı.
     * Kazıma başarısız olduğunda fikstür boş kalıyor ama puan
     * durumu ve gol krallığı hâlâ geçerli olabiliyor. `null`
     * dönmek çalışan bölümleri de gizlerdi.
     *
     * Artık yalnızca uyarı yazılıyor, veri geçiriliyor.
     */
    if (!Array.isArray(govde.fixtures) || govde.fixtures.length === 0) {
      skorHata(
        "fikstür listesi BOŞ — skor sunucusunda kazıma başarısız "
        + `olmuş olabilir. Veri tarihi: ${govde.meta?.scraped_at ?? "bilinmiyor"}`,
      );
    }

    return govde;
  } catch (e) {
    skorHata(`bağlantı kurulamadı. Adres: ${adres}`,
      e instanceof Error ? e.message : e);
    return null;
  }
}

/** Bir takımın son maçlarından form dizisi üretir. */
function formOf(teamId: number, fixtures: RawFixture[], limit = 5): ("w" | "d" | "l")[] {
  return fixtures
    .filter((f) => f.status === "completed" && (f.home_id === teamId || f.away_id === teamId))
    .sort((a, b) => b.week - a.week)
    .slice(0, limit)
    .map((f) => {
      const isHome = f.home_id === teamId;
      const gf = (isHome ? f.home_score : f.away_score) ?? 0;
      const ga = (isHome ? f.away_score : f.home_score) ?? 0;
      return gf > ga ? "w" : gf < ga ? "l" : "d";
    });
}

export async function getScoreBoard(): Promise<ScoreBoard | null> {
  const raw = await fetchAll();
  if (!raw) return null;

  const fixtures = raw.fixtures ?? [];
  const completed = fixtures.filter((f) => f.status === "completed");
  const scheduled = fixtures.filter((f) => f.status === "scheduled");

  /**
   * Fikstürde MAÇ SAATİ YOK — yalnızca hafta numarası var.
   * O yüzden "bu hafta" = oynanmamış en küçük hafta.
   */
  const currentWeek = scheduled.length
    ? Math.min(...scheduled.map((f) => f.week))
    : Math.max(1, ...fixtures.map((f) => f.week));
  const lastWeek = completed.length ? Math.max(...completed.map((f) => f.week)) : 0;

  return {
    league: raw.meta?.title ?? "Trendyol Süper Lig",
    updatedAt: raw.meta?.scraped_at ?? "",
    currentWeek,
    lastWeek,
    weeks: [...new Set(fixtures.map((f) => f.week))].sort((a, b) => a - b),
    matches: fixtures.map((f) => ({
      id: f.match_id,
      week: f.week,
      played: f.status === "completed",
      home: teamOf(f.home_id, f.home_team, f.home_logo_url),
      away: teamOf(f.away_id, f.away_team, f.away_logo_url),
      homeScore: f.home_score,
      awayScore: f.away_score,
    })),
    standings: (raw.standings ?? []).map((s) => ({
      position: s.position,
      team: teamOf(s.team_id, s.team, s.logo_url),
      played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
      goalsFor: s.goals_for, goalsAgainst: s.goals_against,
      goalDiff: s.goal_difference, points: s.points,
      form: formOf(s.team_id, fixtures),
    })),
    scorers: (raw.top_scorers ?? []).map((p) => ({
      name: cleanPerson(p.name),
      goals: p.goals,
      team: teamOf(p.team_id, p.team),
    })),
  };
}

/**
 * Ana sayfa şeridi için tek maç.
 *
 * Sağlayıcı CANLI durum vermiyor (`status` yalnızca completed /
 * scheduled). O yüzden "en yakın karşılaşma" şöyle seçilir:
 *   1) son oynanan haftadan bir maç (skorlu)
 *   2) yoksa oynanacak ilk maç
 */
export async function getFeaturedMatch(): Promise<
  { match: Match; league: string; label: "result" | "upcoming" } | null
> {
  const board = await getScoreBoard();
  if (!board) return null;

  const recent = board.matches
    .filter((m) => m.played && m.week === board.lastWeek)
    .sort((a, b) => b.id - a.id)[0];
  if (recent) return { match: recent, league: board.league, label: "result" };

  const next = board.matches
    .filter((m) => !m.played)
    .sort((a, b) => a.week - b.week || a.id - b.id)[0];
  return next ? { match: next, league: board.league, label: "upcoming" } : null;
}
