import { dropPlayer, rosterPlayerIds } from "./league";
import { getPlayer } from "./players";
import { SALARY_CAP, type Contract, type LeagueTeam, type Roster } from "./types";

export function salaryOf(contracts: Contract[], teamId: string) {
  return contracts.filter((c) => c.teamId === teamId).reduce((s, c) => s + c.price, 0);
}

export function capSpace(contracts: Contract[], teamId: string) {
  return Math.max(0, SALARY_CAP - salaryOf(contracts, teamId));
}

export function cutPlayerFromClub(
  teamId: string,
  playerId: string,
  rosters: Record<string, Roster>,
  contracts: Contract[],
  budgets: Record<string, number>,
) {
  const roster = rosters[teamId];
  if (!roster) return { rosters, contracts, budgets };
  const deal = contracts.find((c) => c.teamId === teamId && c.playerId === playerId);
  if (!deal) return { rosters, contracts, budgets };
  return {
    rosters: { ...rosters, [teamId]: dropPlayer(roster, playerId) },
    contracts: contracts.filter((c) => !(c.teamId === teamId && c.playerId === playerId)),
    budgets: { ...budgets, [teamId]: (budgets[teamId] ?? 0) + deal.price },
  };
}

/** CPU clubs cut two lowest-rated names so the next auction has holes. */
export function cpuRefresh(
  teams: LeagueTeam[],
  rosters: Record<string, Roster>,
  contracts: Contract[],
  budgets: Record<string, number>,
) {
  let nextR = { ...rosters };
  let nextC = contracts.slice();
  let nextB = { ...budgets };
  for (const t of teams) {
    if (t.human) continue;
    const ids = rosterPlayerIds(nextR[t.id]!);
    const ranked = ids
      .map((id) => getPlayer(id))
      .sort((a, b) => a.ovr - b.ovr);
    const cuts = ranked.slice(0, Math.min(2, Math.max(0, ids.length - 7)));
    for (const pl of cuts) {
      const out = cutPlayerFromClub(t.id, pl.id, nextR, nextC, nextB);
      nextR = out.rosters;
      nextC = out.contracts;
      nextB = out.budgets;
    }
  }
  return { rosters: nextR, contracts: nextC, budgets: nextB };
}
