import type { Player, Position } from "./types";

/**
 * Dream weekly PPR — open methods, not a paid sheet.
 *
 * 1. Opportunity prior from ovr (volume curve by position).
 * 2. Shrink toward public consensus (Sleeper pts_ppr) when we have it.
 * 3. Availability from durability. Small home bump.
 * 4. Floor / ceiling from boom. VORP vs replacement at the position.
 *
 * Same idea as trailing-mean + consensus blend used in open nflverse models.
 * Not official. Not Sleeper's model. Ours.
 */

const PRIOR: Record<Position, number> = {
  QB: 14,
  RB: 10,
  WR: 9.5,
  TE: 7,
  K: 7.5,
  DST: 8,
};

const REPLACEMENT: Record<Position, number> = {
  QB: 13,
  RB: 8.5,
  WR: 8.8,
  TE: 6.2,
  K: 7.2,
  DST: 6.5,
};

export type ProjCtx = {
  sleeper?: number;
  home?: boolean | null;
};

export type DreamProj = {
  mid: number;
  floor: number;
  ceil: number;
  vorp: number;
  source: "blend" | "prior";
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function opportunityPrior(player: Player): number {
  return round1(PRIOR[player.pos] + (player.ovr - 70) * 0.42);
}

export function dreamProj(player: Player, ctx: ProjCtx = {}): DreamProj {
  const prior = opportunityPrior(player);
  const consensus = ctx.sleeper && ctx.sleeper > 0 ? ctx.sleeper : 0;
  const source: DreamProj["source"] = consensus > 0 ? "blend" : "prior";
  let mid = consensus > 0 ? 0.62 * consensus + 0.38 * prior : prior;
  mid *= 0.82 + player.durability * 0.2;
  if (ctx.home === true) mid += 0.35;
  if (ctx.home === false) mid -= 0.15;
  mid = Math.max(0, mid);
  const spread = 0.2 + player.boom * 0.5;
  const floor = Math.max(0, mid * (1 - spread));
  const ceil = mid * (1 + spread);
  return {
    mid: round1(mid),
    floor: round1(floor),
    ceil: round1(ceil),
    vorp: round1(mid - REPLACEMENT[player.pos]),
    source,
  };
}

export function dreamMid(player: Player, sleeper?: number, home?: boolean | null) {
  return dreamProj(player, { sleeper, home }).mid;
}
