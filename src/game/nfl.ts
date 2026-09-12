import { PLAYERS } from "./players";
import { hashSeed, mulberry32, shuffle } from "./rng";
import type { Player } from "./types";

export type NflTeam = {
  abbr: string;
  city: string;
  primary: string;
  secondary: string;
  ink: string;
};

const W = "#eef2ec";
const K = "#0c0f0c";

function club(abbr: string, city: string, primary: string, secondary: string, ink = W): NflTeam {
  return { abbr, city, primary, secondary, ink };
}

export const NFL_TEAMS: NflTeam[] = [
  club("ARI", "Arizona", "#97233F", "#000000"),
  club("ATL", "Atlanta", "#A71930", "#A5ACAF"),
  club("BAL", "Baltimore", "#241773", "#9E7C0C"),
  club("BUF", "Buffalo", "#00338D", "#C60C30"),
  club("CAR", "Carolina", "#0085CA", "#101820"),
  club("CHI", "Chicago", "#0B162A", "#C83803"),
  club("CIN", "Cincinnati", "#FB4F14", "#000000"),
  club("CLE", "Cleveland", "#311D00", "#FF3C00"),
  club("DAL", "Dallas", "#041E42", "#869397"),
  club("DEN", "Denver", "#FB4F14", "#002244"),
  club("DET", "Detroit", "#0076B6", "#B0B7BC"),
  club("GB", "Green Bay", "#203731", "#FFB612"),
  club("HOU", "Houston", "#03202F", "#A71930"),
  club("IND", "Indianapolis", "#002C5F", "#A2AAAD"),
  club("JAX", "Jacksonville", "#006778", "#D7A22A"),
  club("KC", "Kansas City", "#E31837", "#FFB81C"),
  club("LAC", "Los Angeles", "#0080C6", "#FFC20E"),
  club("LAR", "Los Angeles", "#003594", "#FFA300"),
  club("LV", "Las Vegas", "#000000", "#A5ACAF"),
  club("MIA", "Miami", "#008E97", "#FC4C02"),
  club("MIN", "Minnesota", "#4F2683", "#FFC62F"),
  club("NE", "New England", "#002244", "#C60C30"),
  club("NO", "New Orleans", "#D3BC8D", "#101820", K),
  club("NYG", "New York", "#0B2265", "#A71930"),
  club("NYJ", "New York", "#125740", "#FFFFFF"),
  club("PHI", "Philadelphia", "#004C54", "#A5ACAF"),
  club("PIT", "Pittsburgh", "#101820", "#FFB612"),
  club("SEA", "Seattle", "#002244", "#69BE28"),
  club("SF", "San Francisco", "#AA0000", "#B3995D"),
  club("TB", "Tampa Bay", "#D50A0A", "#34302B"),
  club("TEN", "Tennessee", "#0C2340", "#4B92DB"),
  club("WAS", "Washington", "#5A1414", "#FFB612"),
];

export const NFL_BY_ABBR: Record<string, NflTeam> = Object.fromEntries(
  NFL_TEAMS.map((t) => [t.abbr, t]),
);

const ESPN_ABBR: Record<string, string> = {
  WSH: "WAS",
  WAS: "WAS",
  JAC: "JAX",
  JAX: "JAX",
  LA: "LAR",
};

export function normAbbr(abbr: string) {
  const u = abbr.trim().toUpperCase();
  return ESPN_ABBR[u] ?? u;
}

const FALLBACK: NflTeam = { abbr: "NFL", city: "Night", primary: "#3d6b4f", secondary: "#d7d2c8", ink: W };

export function teamOf(abbr: string): NflTeam {
  const id = normAbbr(abbr);
  return NFL_BY_ABBR[id] ?? { ...FALLBACK, abbr: id, city: id };
}

export function teamCity(abbr: string) {
  return teamOf(abbr).city;
}

export function playersOnTeam(abbr: string): Player[] {
  const id = normAbbr(abbr);
  return PLAYERS.filter((p) => p.nfl === id && p.pos !== "DST");
}

export function weekMatchups(week: number, seed: number): Array<[NflTeam, NflTeam]> {
  const order = shuffle(NFL_TEAMS, mulberry32(hashSeed(seed, "nfl-card", week)));
  const out: Array<[NflTeam, NflTeam]> = [];
  for (let i = 0; i + 1 < order.length; i += 2) {
    out.push([order[i]!, order[i + 1]!]);
  }
  return out;
}

const MARQUEE = new Set(["BUF", "KC", "PHI", "BAL", "DET", "SF", "DAL", "GB", "CIN", "MIA"]);

export function pickFeaturedGame(
  week: number,
  seed: number,
  ownedIds: string[],
): { home: NflTeam; away: NflTeam } {
  const owned = new Set(ownedIds);
  const ownedByTeam = new Map<string, number>();
  for (const pl of PLAYERS) {
    if (!owned.has(pl.id) || pl.bye === week) continue;
    ownedByTeam.set(pl.nfl, (ownedByTeam.get(pl.nfl) ?? 0) + 1 + pl.ovr / 200);
  }
  const card = weekMatchups(week, seed);
  let best = card[0]!;
  let bestScore = -1;
  for (const m of card) {
    const ownedScore = (ownedByTeam.get(m[0].abbr) ?? 0) + (ownedByTeam.get(m[1].abbr) ?? 0);
    const marquee = (MARQUEE.has(m[0].abbr) ? 0.4 : 0) + (MARQUEE.has(m[1].abbr) ? 0.4 : 0);
    const score = ownedScore * 10 + marquee;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return { home: best[0]!, away: best[1]! };
}

export function calendarNight() {
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const week = 1 + (day % 14);
  const seed = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0;
  return { week, seed };
}
