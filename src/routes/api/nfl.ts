import { createFileRoute } from "@tanstack/react-router";
import { PLAYERS } from "@/game/players";
import { SLEEPER_IDS } from "@/game/sleeper-ids";
import { expandBoard, loadSleeperPlayers, sleeperIdFor, stampInjuries } from "@/game/sleeper-board";
import { normAbbr } from "@/game/nfl";
import { parseEspnSummary } from "@/game/pbp";
import type { WireGame, WireStat } from "@/game/wire";
import type { Player } from "@/game/types";
import { readBox } from "@/game/box";

type Cache = { at: number; body: string; key: string };

let cache: Cache | null = null;

async function getJson(url: string, ms = 8000) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(ms),
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

function pickStat(file: Record<string, Record<string, unknown>>, sid: string) {
  return file[sid] ?? file[sid.replace(/^TEAM_/, "")] ?? file[`TEAM_${sid}`];
}

async function getText(url: string, ms = 8000) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(url);
  return res.text();
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/&#39;/g, "'").replace(/"/g, '"').replace(/\s+/g, " ").trim();
}

function tagText(xml: string, tag: string) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return stripHtml((m?.[1] || m?.[2] || "").trim());
}

function parseRss(xml: string): Array<{ title: string; blurb: string }> {
  return xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((chunk) => ({
      title: tagText(chunk, "title"),
      blurb: tagText(chunk, "description").slice(0, 180),
    }))
    .filter((n) => n.title.length > 8);
}

function newsFromEspn(raw: unknown): Array<{ title: string; blurb: string; source: "espn" }> {
  const j = asRec(raw);
  const nested = asRec(j.news).articles;
  const articles = Array.isArray(j.articles) ? j.articles : Array.isArray(nested) ? nested : [];
  const out: Array<{ title: string; blurb: string; source: "espn" }> = [];
  for (const a of articles) {
    const r = asRec(a);
    const title = str(r.headline) || str(r.title);
    if (!title) continue;
    out.push({ title, blurb: str(r.description).slice(0, 180), source: "espn" });
  }
  const feed = Array.isArray(j.nowFeed) ? j.nowFeed : [];
  for (const a of feed.slice(0, 8)) {
    const r = asRec(a);
    const title = str(r.headline) || str(r.title) || str(r.linkText);
    if (!title) continue;
    out.push({ title: title.slice(0, 140), blurb: str(r.story || r.linkText).slice(0, 180), source: "espn" });
  }
  return out;
}

function tapeTargets(games: WireGame[]): WireGame[] {
  const live = games.filter((g) => g.state === "live");
  const finals = games.filter((g) => g.state === "final");
  return [...live, ...finals].slice(0, 4);
}

async function attachTape(games: WireGame[]) {
  const targets = tapeTargets(games);
  if (targets.length === 0) return;
  const results = await Promise.allSettled(
    targets.map((g) =>
      getJson(
        `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${encodeURIComponent(g.id)}`,
        10000,
      ),
    ),
  );
  results.forEach((res, i) => {
    const game = targets[i];
    if (!game || res.status !== "fulfilled") return;
    const parsed = parseEspnSummary(res.value, game.homeAbbr, game.awayAbbr);
    if (parsed.plays.length >= 2) game.plays = parsed.plays;
    if (parsed.injuries.length > 0) game.injuries = parsed.injuries;
  });
}

async function build(weekHint = 0) {
  const [board, newsRaw, state, yahooRss, espnCdn] = await Promise.allSettled([
    getJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"),
    getJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=8"),
    getJson("https://api.sleeper.app/v1/state/nfl"),
    getText("https://sports.yahoo.com/nfl/rss.xml"),
    getJson("https://cdn.espn.com/core/nfl/scoreboard?xhr=1"),
  ]);

  const boardJ = board.status === "fulfilled" ? asRec(board.value) : {};
  const cdnJ = espnCdn.status === "fulfilled" ? asRec(espnCdn.value) : {};
  const sbFallback = asRec(asRec(cdnJ.content).sbData);
  const eventsRaw = Array.isArray(boardJ.events)
    ? boardJ.events
    : Array.isArray(sbFallback.events)
      ? sbFallback.events
      : [];
  const games: WireGame[] = eventsRaw.map((ev) => {
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

  await attachTape(games);

  const newsJ = newsRaw.status === "fulfilled" ? asRec(newsRaw.value) : {};
  const espnBits = [...newsFromEspn(newsJ), ...newsFromEspn(cdnJ)];
  const yahooBits =
    yahooRss.status === "fulfilled"
      ? parseRss(yahooRss.value).map((n) => ({ ...n, source: "yahoo" as const }))
      : [];
  const seen = new Set<string>();
  const news: Array<{ title: string; blurb: string; source: "espn" | "yahoo" }> = [];
  const take = (title: string, blurb: string, source: "espn" | "yahoo") => {
    const key = title.toLowerCase().slice(0, 80);
    if (!title || seen.has(key) || news.length >= 10) return;
    seen.add(key);
    news.push({ title, blurb, source });
  };
  const n = Math.max(espnBits.length, yahooBits.length);
  for (let i = 0; i < n && news.length < 10; i++) {
    const e = espnBits[i];
    if (e) take(e.title, e.blurb, "espn");
    const y = yahooBits[i];
    if (y) take(y.title, y.blurb, "yahoo");
  }

  const stateJ = state.status === "fulfilled" ? asRec(state.value) : {};
  const liveWeek = num(stateJ.week) || num(asRec(boardJ.week).number) || 1;
  const season = num(stateJ.season) || 2026;
  const week = weekHint > 0 ? weekHint : liveWeek;

  const [statsRaw, projRaw] = await Promise.allSettled([
    getJson(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`),
    getJson(`https://api.sleeper.app/v1/projections/nfl/regular/${season}/${week}`),
  ]);
  const stats =
    statsRaw.status === "fulfilled"
      ? (statsRaw.value as Record<string, Record<string, unknown>>)
      : {};
  const projs =
    projRaw.status === "fulfilled"
      ? (projRaw.value as Record<string, Record<string, unknown>>)
      : {};

  const mapped: Record<string, WireStat> = {};

  let extra: Player[] = [];
  let sleeperRows: Awaited<ReturnType<typeof loadSleeperPlayers>> | null = null;
  try {
    sleeperRows = await loadSleeperPlayers();
    extra = expandBoard(sleeperRows, projs);
    stampInjuries(PLAYERS, sleeperRows);
    stampInjuries(extra, sleeperRows);
  } catch {
    extra = [];
  }

  const pool = extra.length ? [...PLAYERS, ...extra] : PLAYERS;
  for (const pl of pool) {
    const sid = sleeperRows
      ? sleeperIdFor(pl, sleeperRows) ?? SLEEPER_IDS[pl.id]
      : SLEEPER_IDS[pl.id];
    if (!sid) continue;
    const st = pickStat(stats, sid) ?? {};
    const pj = pickStat(projs, sid) ?? {};
    const pts = num(st.pts_ppr) || num(st.pts_std);
    const proj = num(pj.pts_ppr) || num(pj.pts_std);
    const game = games.find(
      (g) => normAbbr(g.homeAbbr) === pl.nfl || normAbbr(g.awayAbbr) === pl.nfl,
    );
    const gState: "live" | "final" | "soon" | "bye" = game
      ? game.state
      : pl.bye === week
        ? "bye"
        : "soon";
    const actual = gState === "live" || gState === "final";
    const line = actual ? flavor(st) : "";
    mapped[pl.id] = {
      pts: Math.round(pts * 10) / 10,
      proj: Math.round(proj * 10) / 10,
      line,
      done: gState === "final",
      state: gState,
      box: readBox(st, pj, actual),
    };
  }

  return {
    season,
    week,
    games,
    news: news.slice(0, 10),
    stats: mapped,
    board: extra,
    updated: Date.now(),
  };
}

const handle = async ({ request }: { request: Request }) => {
  try {
    const weekQ = Number(new URL(request.url).searchParams.get("week") || 0);
    const key = String(weekQ || "live");
    const hot = cache?.body.includes('"state":"live"');
    const ttl = hot ? 10_000 : 30_000;
    if (cache && cache.key === key && Date.now() - cache.at < ttl) {
      return new Response(cache.body, {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=8" },
      });
    }
    const payload = await build(weekQ);
    const body = JSON.stringify(payload);
    cache = { at: Date.now(), body, key };
    return new Response(body, {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=8" },
    });
  } catch {
    return new Response(
      JSON.stringify({ season: 2026, week: 1, games: [], news: [], stats: {}, board: [], updated: 0 }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }
};

export const Route = createFileRoute("/api/nfl")({
  server: { handlers: { GET: handle } },
});
