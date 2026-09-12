import { createFileRoute } from "@tanstack/react-router";
import { PLAYERS } from "@/game/players";
import { SLEEPER_IDS } from "@/game/sleeper-ids";

type Cache = { at: number; body: string };

let cache: Cache | null = null;
const TTL = 30_000;

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(url);
  return res.json() as Promise<unknown>;
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown) {
  return typeof v === "string" ? v : "";
}
function num(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function flavor(st: Record<string, unknown>) {
  const pass = num(st.pass_yd);
  const rush = num(st.rush_yd);
  const rec = num(st.rec);
  const recYd = num(st.rec_yd);
  const ptd = num(st.pass_td);
  const rtd = num(st.rush_td);
  const ctd = num(st.rec_td);
  const fgm = num(st.fgm);
  const sack = num(st.sack);
  if (pass > 0) return `${Math.round(pass)} pass · ${ptd} TD`;
  if (rec > 0 || recYd > 0) return `${Math.round(rec)} rec · ${Math.round(recYd)} yds${ctd ? ` · ${ctd} TD` : ""}`;
  if (rush > 0) return `${Math.round(rush)} rush${rtd ? ` · ${rtd} TD` : ""}`;
  if (fgm > 0) return `${fgm} FG`;
  if (sack > 0) return `${sack} sack`;
  return "";
}

async function build() {
  const [board, newsRaw, state, statsRaw] = await Promise.allSettled([
    getJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"),
    getJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=8"),
    getJson("https://api.sleeper.app/v1/state/nfl"),
    getJson("https://api.sleeper.app/v1/stats/nfl/regular/2026/1"),
  ]);

  const boardJ = board.status === "fulfilled" ? asRec(board.value) : {};
  const events = Array.isArray(boardJ.events) ? boardJ.events : [];
  const games = events.map((ev) => {
    const e = asRec(ev);
    const comps = Array.isArray(e.competitions) ? e.competitions : [];
    const c = asRec(comps[0]);
    const status = asRec(asRec(c.status).type);
    const st = str(status.state);
    const competitors = Array.isArray(c.competitors) ? c.competitors : [];
    const home = asRec(competitors.find((x) => str(asRec(x).homeAway) === "home") ?? competitors[0]);
    const away = asRec(competitors.find((x) => str(asRec(x).homeAway) === "away") ?? competitors[1]);
    const homeTeam = asRec(home.team);
    const awayTeam = asRec(away.team);
    const stateName = st === "in" ? "live" : st === "post" ? "final" : "soon";
    const clock = str(asRec(c.status).displayClock);
    const period = num(asRec(c.status).period);
    const detail = str(status.shortDetail) || str(status.detail);
    return {
      id: str(e.id),
      home: str(homeTeam.shortDisplayName) || str(homeTeam.displayName),
      away: str(awayTeam.shortDisplayName) || str(awayTeam.displayName),
      homeAbbr: str(homeTeam.abbreviation),
      awayAbbr: str(awayTeam.abbreviation),
      homeScore: num(home.score),
      awayScore: num(away.score),
      state: stateName as "live" | "final" | "soon",
      clock: stateName === "live" && period ? `Q${period} ${clock}` : detail,
      detail,
    };
  });
  games.sort((a, b) => {
    const rank = { live: 0, final: 1, soon: 2 };
    return rank[a.state] - rank[b.state];
  });

  const newsJ = newsRaw.status === "fulfilled" ? asRec(newsRaw.value) : {};
  const articles = Array.isArray(newsJ.articles) ? newsJ.articles : [];
  const news = articles.slice(0, 6).map((a) => {
    const r = asRec(a);
    return { title: str(r.headline), blurb: str(r.description).slice(0, 180) };
  }).filter((n) => n.title);

  const stateJ = state.status === "fulfilled" ? asRec(state.value) : {};
  const week = num(stateJ.week) || num(asRec(boardJ.week).number) || 1;
  const season = num(stateJ.season) || 2026;

  const statsFile =
    statsRaw.status === "fulfilled"
      ? (statsRaw.value as Record<string, Record<string, unknown>>)
      : {};
  // If sleeper week mismatches, try the live week.
  let stats = statsFile;
  if (week !== 1) {
    try {
      stats = (await getJson(
        `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`,
      )) as Record<string, Record<string, unknown>>;
    } catch {
      stats = statsFile;
    }
  }

  const mapped: Record<string, { pts: number; line: string; done: boolean }> = {};
  for (const pl of PLAYERS) {
    const sid = SLEEPER_IDS[pl.id];
    if (!sid) continue;
    const st = stats[sid];
    if (!st) continue;
    const pts = num(st.pts_ppr) || num(st.pts_std);
    const line = flavor(st);
    if (pts <= 0 && !line) continue;
    mapped[pl.id] = { pts: Math.round(pts * 10) / 10, line, done: true };
  }

  return {
    season,
    week,
    games,
    news,
    stats: mapped,
    updated: Date.now(),
  };
}

const handle = async () => {
  try {
    if (cache && Date.now() - cache.at < TTL) {
      return new Response(cache.body, {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=20" },
      });
    }
    const payload = await build();
    const body = JSON.stringify(payload);
    cache = { at: Date.now(), body };
    return new Response(body, {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=20" },
    });
  } catch {
    return new Response(JSON.stringify({ season: 2026, week: 1, games: [], news: [], stats: {}, updated: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
};

export const Route = createFileRoute("/api/nfl")({
  server: { handlers: { GET: handle } },
});
