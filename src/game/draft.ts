import { getPlayer, PLAYERS } from "./players";
import { placePlayer, preferredSlot, rosterPlayerIds, slotAccepts } from "./league";
import { ownedSet, projection } from "./simulate";
import {
  BID_STEP,
  MIN_BID,
  ROSTER_SIZE,
  SKILL_RESERVE,
  STARTER_SLOTS,
  type AuctionBlock,
  type Contract,
  type LeagueTeam,
  type Player,
  type Position,
  type Roster,
} from "./types";

const NEED_WEIGHT: Record<Position, number> = {
  QB: 1.12,
  RB: 1.22,
  WR: 1.18,
  TE: 1.08,
  K: 0.95,
  DST: 0.95,
};

const CEIL: Record<Position, number> = {
  QB: 64_000,
  WR: 35_000,
  RB: 20_000,
  TE: 18_000,
  K: 6_000,
  DST: 4_000,
};

export function snapBid(n: number) {
  if (n <= MIN_BID) return MIN_BID;
  const steps = Math.round((n - MIN_BID) / BID_STEP);
  return MIN_BID + Math.max(1, steps) * BID_STEP;
}

export function nextRaise(high: number) {
  return high + BID_STEP;
}

function marketOf(pl: Player): number {
  const band = Math.max(0, Math.min(1, (pl.ovr - 68) / 30));
  const shaped = band ** 1.45;
  return snapBid(MIN_BID + shaped * (CEIL[pl.pos] - MIN_BID));
}

const MARKET: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const pl of PLAYERS) map[pl.id] = marketOf(pl);
  return map;
})();

export function marketValue(playerId: string): number {
  return MARKET[playerId] ?? MIN_BID;
}

export function spotsLeft(roster: Roster): number {
  return Math.max(0, ROSTER_SIZE - rosterPlayerIds(roster).length);
}

/** Money that must stay in the bag so the rest of the roster can still fill. */
export function leftoverReserve(spots: number): number {
  const rest = spots - 1;
  if (rest <= 0) return 0;
  const cheap = Math.min(2, rest);
  const skill = rest - cheap;
  return cheap * MIN_BID + skill * SKILL_RESERVE;
}

export function maxAffordable(budget: number, spots: number): number {
  if (spots <= 0) return 0;
  const floor = budget - (spots - 1) * MIN_BID;
  if (floor < MIN_BID) return 0;
  const want = leftoverReserve(spots);
  if (budget < want + MIN_BID) return floor;
  return Math.max(MIN_BID, Math.min(floor, budget - want));
}

export function countPos(roster: Roster, pos: Position): number {
  return rosterPlayerIds(roster).filter((id) => getPlayer(id).pos === pos).length;
}

export function needMultiplier(roster: Roster, pos: Position): number {
  const count = countPos(roster, pos);
  const spots = spotsLeft(roster);
  if (pos === "K" || pos === "DST") {
    if (spots > 3) return 0.28;
    if (count >= 1) return 0.12;
    return 1.35;
  }
  if (count === 0) return 1.5;
  if ((pos === "RB" || pos === "WR") && count === 1) return 1.22;
  if ((pos === "RB" || pos === "WR") && count === 2) return 0.92;
  if ((pos === "RB" || pos === "WR") && count >= 3) return 0.5;
  if (count >= 1 && pos !== "RB" && pos !== "WR") return 0.38;
  return 1;
}

export function rankPlayer(id: string): number {
  return projection(getPlayer(id));
}

export function cpuMaxBid(
  playerId: string,
  roster: Roster,
  budget: number,
  aggression: number,
): number {
  const spots = spotsLeft(roster);
  const cap = maxAffordable(budget, spots);
  if (cap < MIN_BID || spots <= 0) return 0;
  const pl = getPlayer(playerId);
  const fair = marketValue(playerId);
  const need = needMultiplier(roster, pl.pos);
  const stretch = Math.max(
    0.45,
    Math.min(1.1, 0.72 + need * 0.16 + (aggression - 1) * 0.28),
  );
  const raw = fair * stretch;
  const late = spots <= 2 ? Math.min(cap, Math.max(fair * 0.35, MIN_BID)) : raw;
  return Math.max(0, Math.min(cap, snapBid(late)));
}

export function cpuNominate(
  available: string[],
  roster: Roster,
  budget: number,
  aggression: number,
): string {
  let best = available[0]!;
  let bestScore = -Infinity;
  const spots = spotsLeft(roster);
  const cap = maxAffordable(budget, spots);
  for (const id of available) {
    const pl = getPlayer(id);
    const fair = marketValue(id);
    if (fair > cap + SKILL_RESERVE && spots > 1) continue;
    const score = fair * needMultiplier(roster, pl.pos) * NEED_WEIGHT[pl.pos] * aggression;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export function nextNominator(
  teamIds: string[],
  rosters: Record<string, Roster>,
  startIndex: number,
): { teamId: string; index: number } | null {
  if (teamIds.length === 0) return null;
  for (let i = 0; i < teamIds.length; i++) {
    const index = (startIndex + i) % teamIds.length;
    const teamId = teamIds[index]!;
    if (spotsLeft(rosters[teamId] ?? { lineup: {} as Roster["lineup"], bench: [] }) > 0) {
      return { teamId, index };
    }
  }
  return null;
}

export function nextCpuRaise(
  block: AuctionBlock,
  teams: LeagueTeam[],
  rosters: Record<string, Roster>,
  budgets: Record<string, number>,
  aggression: Record<string, number>,
): { teamId: string; amount: number } | null {
  const nomRoster = rosters[block.nominatorId];
  const nomHuman = Boolean(teams.find((t) => t.id === block.nominatorId)?.human);
  const nomSpots = nomRoster ? spotsLeft(nomRoster) : 0;
  const filling =
    nomHuman &&
    nomSpots > 0 &&
    block.highBidderId === block.nominatorId &&
    block.highBid <= MIN_BID + BID_STEP &&
    marketValue(block.playerId) <= 2_500;
  if (filling) return null;

  const passed = new Set(block.passed);
  const candidates: Array<{ teamId: string; amount: number }> = [];
  for (const team of teams) {
    if (team.id === block.highBidderId) continue;
    if (passed.has(team.id)) continue;
    if (team.human) continue;
    const max = cpuMaxBid(
      block.playerId,
      rosters[team.id]!,
      budgets[team.id] ?? 0,
      aggression[team.id] ?? 1,
    );
    if (max > block.highBid) {
      const gap = max - block.highBid;
      const bump =
        gap >= 12_000
          ? Math.min(9_000, Math.max(1_000, Math.round((gap * 0.22) / BID_STEP) * BID_STEP))
          : gap >= 4_000
            ? 500
            : BID_STEP;
      candidates.push({ teamId: team.id, amount: Math.min(max, block.highBid + bump) });
    }
  }
  candidates.sort((a, b) => b.amount - a.amount);
  return candidates[0] ?? null;
}

export function shouldPauseForHuman(
  playerId: string,
  roster: Roster,
  budget: number,
  pauseEvery: boolean,
): boolean {
  if (pauseEvery) return true;
  const spots = spotsLeft(roster);
  if (spots <= 0) return false;
  const cap = maxAffordable(budget, spots);
  if (cap < MIN_BID) return false;
  const pl = getPlayer(playerId);
  const fair = marketValue(playerId);
  if (fair > cap) return false;
  if (pl.ovr >= 88) return true;
  if (fair >= 22_000) return true;
  const need = needMultiplier(roster, pl.pos);
  if (need >= 1.2 && fair >= 6_000) return true;
  if (fair <= cap * 0.4 && fair >= 10_000) return true;
  if (spots <= 3 && (pl.pos === "K" || pl.pos === "DST") && countPos(roster, pl.pos) === 0) return true;
  return false;
}

export function availablePlayers(owned: Set<string>): string[] {
  return PLAYERS.filter((pl) => !owned.has(pl.id))
    .sort((a, b) => marketValue(b.id) - marketValue(a.id) || b.ovr - a.ovr)
    .map((pl) => pl.id);
}

export function canStart(roster: Roster, playerId: string): boolean {
  return preferredSlot(getPlayer(playerId).pos, roster.lineup) !== "BENCH";
}

export function openBlock(playerId: string, nominatorId: string, waitingForHuman: boolean): AuctionBlock {
  return {
    playerId,
    nominatorId,
    highBid: MIN_BID,
    highBidderId: nominatorId,
    passed: [],
    going: 0,
    waitingForHuman,
    log: [{ teamId: nominatorId, amount: MIN_BID }],
  };
}

export function fillNeedPick(available: string[], roster: Roster): string {
  for (const slot of STARTER_SLOTS) {
    if (roster.lineup[slot]) continue;
    const fit = available
      .filter((id) => slotAccepts(slot, getPlayer(id).pos))
      .sort((a, b) => getPlayer(b).ovr - getPlayer(a).ovr);
    if (fit[0]) return fit[0];
  }
  return [...available].sort((a, b) => getPlayer(b).ovr - getPlayer(a).ovr)[0] ?? available[0]!;
}

export function fillUnfinishedRosters(
  teams: LeagueTeam[],
  rosters: Record<string, Roster>,
  budgets: Record<string, number>,
  contracts: Contract[],
  skipIds: Set<string> = new Set(),
  onlyTeamId?: string,
): { rosters: Record<string, Roster>; budgets: Record<string, number>; contracts: Contract[] } {
  const nextR = { ...rosters };
  const nextB = { ...budgets };
  const nextC = [...contracts];
  const order = [...teams].sort((a, b) => Number(b.human) - Number(a.human));
  let avail = availablePlayers(ownedSet(nextR)).filter((id) => !skipIds.has(id));

  for (const team of order) {
    if (onlyTeamId && team.id !== onlyTeamId) continue;
    while (spotsLeft(nextR[team.id]!) > 0 && avail.length > 0) {
      const pick = fillNeedPick(avail, nextR[team.id]!);
      const price = Math.min(MIN_BID, Math.max(0, nextB[team.id] ?? 0));
      nextR[team.id] = placePlayer(nextR[team.id]!, pick);
      nextB[team.id] = (nextB[team.id] ?? 0) - price;
      nextC.push({ playerId: pick, teamId: team.id, price });
      avail = avail.filter((id) => id !== pick);
    }
  }
  return { rosters: nextR, budgets: nextB, contracts: nextC };
}
