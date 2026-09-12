import { getPlayer, PLAYERS } from "./players";
import { hashSeed, mulberry32 } from "./rng";
import {
  CHAMPIONSHIP_WEEK,
  PLAYOFF_WEEK,
  STARTER_SLOTS,
  type BoxScore,
  type LeagueTeam,
  type Matchup,
  type Player,
  type Roster,
} from "./types";
import { autoSetLineup } from "./league";

export function projection(player: Player): number {
  const base =
    player.pos === "QB"
      ? 14
      : player.pos === "RB"
        ? 10
        : player.pos === "WR"
          ? 9.5
          : player.pos === "TE"
            ? 7
            : player.pos === "K"
              ? 7.5
              : 8;
  return Math.round((base + (player.ovr - 70) * 0.42) * 10) / 10;
}

export function simulatePlayerWeek(player: Player, week: number, seasonSeed: number): number {
  if (player.bye === week) return 0;
  const rand = mulberry32(hashSeed(seasonSeed, week, player.id));
  const injured = rand() > player.durability && rand() < 0.22;
  if (injured) return 0;
  const proj = projection(player);
  const spread = 0.22 + player.boom * 0.55;
  const roll = rand() * 2 - 1;
  const pts = Math.max(0, proj + roll * spread * proj);
  return Math.round(pts * 10) / 10;
}

export function flavorLine(player: Player, pts: number, week: number, seed: number): string {
  if (player.bye === week) return "Bye week";
  if (pts === 0) return "Inactive";
  const rand = mulberry32(hashSeed(seed, "flavor", week, player.id));
  if (player.pos === "QB") {
    const tds = Math.max(0, Math.round((pts - 10) / 5.5));
    const yards = Math.max(120, Math.round(180 + pts * 8 + rand() * 40));
    return `${yards} pass yds · ${tds} TD`;
  }
  if (player.pos === "RB") {
    const tds = pts > 18 ? 2 : pts > 11 ? 1 : 0;
    const rush = Math.max(20, Math.round(pts * 7.2 + rand() * 25));
    return `${rush} rush yds · ${tds} TD`;
  }
  if (player.pos === "WR" || player.pos === "TE") {
    const rec = Math.max(2, Math.round(pts / 2.4 + rand() * 2));
    const yds = Math.max(18, Math.round(pts * 6.4 + rand() * 20));
    const tds = pts > 16 ? 1 + (pts > 24 ? 1 : 0) : pts > 12 && rand() > 0.5 ? 1 : 0;
    return `${rec} rec · ${yds} yds · ${tds} TD`;
  }
  if (player.pos === "K") {
    const fg = Math.max(0, Math.round(pts / 3.4));
    const xp = Math.max(1, Math.round(pts / 4));
    return `${fg} FG · ${xp} XP`;
  }
  const sacks = Math.max(0, Math.round(pts / 4 + rand() * 2));
  const to = Math.max(0, Math.round((pts - 6) / 5));
  return `${sacks} sack · ${to} TO`;
}

export function scoreRoster(
  roster: Roster,
  week: number,
  seasonSeed: number,
): { points: number; playerPoints: Record<string, number> } {
  const playerPoints: Record<string, number> = {};
  let points = 0;
  for (const slot of STARTER_SLOTS) {
    const id = roster.lineup[slot];
    if (!id) continue;
    const pts = simulatePlayerWeek(getPlayer(id), week, seasonSeed);
    playerPoints[id] = pts;
    points += pts;
  }
  for (const id of roster.bench) {
    playerPoints[id] = simulatePlayerWeek(getPlayer(id), week, seasonSeed);
  }
  return { points: Math.round(points * 10) / 10, playerPoints };
}

export function simulateMatchups(
  matchups: Matchup[],
  teams: LeagueTeam[],
  rosters: Record<string, Roster>,
  week: number,
  seasonSeed: number,
  rank: (id: string) => number,
): Record<string, BoxScore> {
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  const results: Record<string, BoxScore> = {};
  for (const m of matchups) {
    const homeTeam = byId[m.homeId]!;
    const awayTeam = byId[m.awayId]!;
    const homeRoster = homeTeam.human
      ? rosters[m.homeId]!
      : autoSetLineup(rosters[m.homeId]!, week, rank);
    const awayRoster = awayTeam.human
      ? rosters[m.awayId]!
      : autoSetLineup(rosters[m.awayId]!, week, rank);
    const home = scoreRoster(homeRoster, week, seasonSeed);
    const away = scoreRoster(awayRoster, week, seasonSeed);
    const homeWon =
      home.points > away.points || (home.points === away.points && m.homeId < m.awayId);
    results[m.homeId] = {
      teamId: m.homeId,
      opponentId: m.awayId,
      points: home.points,
      opponentPoints: away.points,
      playerPoints: home.playerPoints,
      won: homeWon,
    };
    results[m.awayId] = {
      teamId: m.awayId,
      opponentId: m.homeId,
      points: away.points,
      opponentPoints: home.points,
      playerPoints: away.playerPoints,
      won: !homeWon,
    };
  }
  return results;
}

export type StandingRow = {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

export function standings(
  teams: LeagueTeam[],
  results: Record<number, Record<string, BoxScore>>,
  throughWeek: number,
): StandingRow[] {
  const rows: Record<string, StandingRow> = {};
  for (const t of teams) {
    rows[t.id] = { teamId: t.id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
  }
  for (let w = 1; w <= throughWeek; w++) {
    if (w >= PLAYOFF_WEEK) break;
    const week = results[w];
    if (!week) continue;
    for (const row of Object.values(week)) {
      const s = rows[row.teamId];
      if (!s) continue;
      s.pointsFor += row.points;
      s.pointsAgainst += row.opponentPoints;
      if (row.won) s.wins += 1;
      else s.losses += 1;
    }
  }
  return Object.values(rows).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.teamId.localeCompare(b.teamId);
  });
}

export function playoffSeeds(rows: StandingRow[]): string[] {
  return rows.slice(0, 4).map((r) => r.teamId);
}

export function isPlayoffWeek(week: number) {
  return week === PLAYOFF_WEEK || week === CHAMPIONSHIP_WEEK;
}

export function remainingValue(player: Player, fromWeek: number): number {
  let v = 0;
  for (let w = fromWeek; w <= CHAMPIONSHIP_WEEK; w++) {
    if (player.bye === w) continue;
    v += projection(player);
  }
  return v;
}

export function freeAgents(ownedIds: Set<string>): Player[] {
  return PLAYERS.filter((pl) => !ownedIds.has(pl.id)).sort((a, b) => b.ovr - a.ovr);
}

export function ownedSet(rosters: Record<string, Roster>): Set<string> {
  const s = new Set<string>();
  for (const r of Object.values(rosters)) {
    for (const id of [
      ...Object.values(r.lineup).filter((x): x is string => Boolean(x)),
      ...r.bench,
    ]) {
      s.add(id);
    }
  }
  return s;
}
