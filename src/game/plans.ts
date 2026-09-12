import { countPos, maxAffordable, spotsLeft } from "./draft";
import { getPlayer } from "./players";
import type { Contract, Player, Roster } from "./types";
import { MIN_BID } from "./types";

export type AuctionPlan = "stars" | "hero" | "balanced";

export const AUCTION_PLANS: Array<{ id: AuctionPlan; label: string; line: string }> = [
  { id: "stars", label: "Two stars", line: "Cap ~$64M, then ~$40M. Fill the rest." },
  { id: "hero", label: "Hero RB", line: "One back up to ~$20M. Cheap the rest." },
  { id: "balanced", label: "Balanced", line: "No name over ~$18M." },
];

export function starCount(contracts: Contract[], teamId: string) {
  return contracts.filter((c) => c.teamId === teamId && c.price >= 25_000).length;
}

export function planMax(
  plan: AuctionPlan,
  player: Player,
  budget: number,
  roster: Roster,
  contracts: Contract[],
  teamId: string,
): number {
  const spots = spotsLeft(roster);
  const cap = maxAffordable(budget, spots);
  if (cap < MIN_BID) return 0;
  if (player.pos === "K" || player.pos === "DST") return Math.min(cap, 2_500);

  let ceiling = 18_000;
  if (plan === "stars") {
    const stars = starCount(contracts, teamId);
    ceiling = stars === 0 ? 64_000 : stars === 1 ? 40_000 : 12_000;
  } else if (plan === "hero") {
    const rbs = countPos(roster, "RB");
    ceiling = player.pos === "RB" && rbs === 0 ? 20_000 : 8_000;
  } else {
    ceiling = 18_000;
  }
  return Math.max(MIN_BID, Math.min(cap, ceiling));
}

export function nomAdvice(plan: AuctionPlan, spots: number): string {
  if (spots <= 3) return "Nominate a cheap need. Fill the holes.";
  if (spots <= 6) return "Buy the middle. Walk at your plan max.";
  if (plan === "hero") return "Let them spend on WRs. Save the bag for the back.";
  if (plan === "stars") return "Throw a star you don't want. Let the room spend.";
  return "Let the first two stars go. Buy the third-tier name.";
}

export function leftoverAfter(budget: number, bid: number, spots: number) {
  const nextBudget = Math.max(0, budget - bid);
  const rest = Math.max(0, spots - 1);
  return { nextBudget, rest };
}
