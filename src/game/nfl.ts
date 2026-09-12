import { PLAYERS } from "./players";
import { hashSeed, mulberry32, shuffle } from "./rng";
import type { Player } from "./types";

export type NflTeam = {
  abbr: string;
  city: string;
};

export const NFL_TEAMS: NflTeam[] = [
  { abbr: "ARI", city: "Arizona" },
  { abbr: "ATL", city: "Atlanta" },
  { abbr: "BAL", city: "Baltimore" },
  { abbr: "BUF", city: "Buffalo" },
  { abbr: "CAR", city: "Carolina" },
  { abbr: "CHI", city: "Chicago" },
  { abbr: "CIN", city: "Cincinnati" },
  { abbr: "CLE", city: "Cleveland" },
  { abbr: "DAL", city: "Dallas" },
  { abbr: "DEN", city: "Denver" },
  { abbr: "DET", city: "Detroit" },
  { abbr: "GB", city: "Green Bay" },
  { abbr: "HOU", city: "Houston" },
  { abbr: "IND", city: "Indianapolis" },
  { abbr: "JAX", city: "Jacksonville" },
  { abbr: "KC", city: "Kansas City" },
  { abbr: "LAC", city: "Los Angeles" },
  { abbr: "LAR", city: "Los Angeles" },
  { abbr: "LV", city: "Las Vegas" },
  { abbr: "MIA", city: "Miami" },
  { abbr: "MIN", city: "Minnesota" },
  { abbr: "NE", city: "New England" },
  { abbr: "NO", city: "New Orleans" },
  { abbr: "NYG", city: "New York" },
  { abbr: "NYJ", city: "New York" },
  { abbr: "PHI", city: "Philadelphia" },
  { abbr: "PIT", city: "Pittsburgh" },
  { abbr: "SEA", city: "Seattle" },
  { abbr: "SF", city: "San Francisco" },
  { abbr: "TB", city: "Tampa Bay" },
  { abbr: "TEN", city: "Tennessee" },
  { abbr: "WAS", city: "Washington" },
];

export const NFL_BY_ABBR: Record<string, NflTeam> = Object.fromEntries(
  NFL_TEAMS.map((t) => [t.abbr, t]),
);

export function teamCity(abbr: string) {
  return NFL_BY_ABBR[abbr]?.city ?? abbr;
}

export function playersOnTeam(abbr: string): Player[] {
  return PLAYERS.filter((p) => p.nfl === abbr && p.pos !== "DST");
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
  return { home: best[0], away: best[1] };
}

export function calendarNight() {
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const week = 1 + (day % 14);
  const seed = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0;
  return { week, seed };
}
