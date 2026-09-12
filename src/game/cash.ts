import type { BoxScore, LeagueTeam, SideBet } from "./types";
import { HOUSE_CASH } from "./types";

export { HOUSE_CASH };
export const STAKES = [5_000, 10_000, 20_000, 40_000] as const;

export function newBetId() {
  return `b-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function canStake(cash: number, stake: number) {
  return STAKES.includes(stake as (typeof STAKES)[number]) && cash >= stake;
}

export function settleWeek(
  bets: SideBet[],
  cash: Record<string, number>,
  results: Record<string, BoxScore>,
  week: number,
): { bets: SideBet[]; cash: Record<string, number> } {
  const nextCash = { ...cash };
  const nextBets = bets.map((bet) => {
    if (bet.week !== week || bet.status !== "live") return bet;
    const a = results[bet.fromId]?.points ?? 0;
    const b = results[bet.toId]?.points ?? 0;
    if (a === b) {
      nextCash[bet.fromId] = (nextCash[bet.fromId] ?? 0) + bet.stake;
      nextCash[bet.toId] = (nextCash[bet.toId] ?? 0) + bet.stake;
      return { ...bet, status: "done" as const, winnerId: null };
    }
    const winnerId = a > b ? bet.fromId : bet.toId;
    nextCash[winnerId] = (nextCash[winnerId] ?? 0) + bet.stake * 2;
    return { ...bet, status: "done" as const, winnerId };
  });
  return { bets: nextBets, cash: nextCash };
}

export function autoTakeCpu(
  bets: SideBet[],
  cash: Record<string, number>,
  teams: LeagueTeam[],
): { bets: SideBet[]; cash: Record<string, number> } {
  const nextCash = { ...cash };
  const nextBets = bets.map((bet) => {
    if (bet.status !== "open") return bet;
    const to = teams.find((t) => t.id === bet.toId);
    if (!to || to.human) return bet;
    if ((nextCash[to.id] ?? 0) < bet.stake) return { ...bet, status: "dead" as const };
    nextCash[to.id] = (nextCash[to.id] ?? 0) - bet.stake;
    return { ...bet, status: "live" as const };
  });
  return { bets: nextBets, cash: nextCash };
}
