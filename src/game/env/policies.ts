// Two baseline deterministic policies. No LLMs, no randomness: each policy is a
// pure function of the observation. They use the SAME observation and action
// contracts and are deliberately different in style, so their action traces
// differ on the same match.

import type { Observation, Policy } from "../engine/types.ts";

/**
 * AGGRESSOR v1.0.0 — always attacks at maximum aggression.
 * Possession: shoot the moment it is legal, otherwise advance.
 * Defending: always press.
 */
export const aggressor: Policy = {
  name: "aggressor",
  version: "1.0.0",
  act(obs: Observation): unknown {
    if (obs.possession === obs.side) {
      if (obs.legal.includes("shoot")) return { side: obs.side, type: "shoot" };
      return { side: obs.side, type: "advance" };
    }
    return { side: obs.side, type: "press" };
  },
};

/**
 * CONSERVATIVE v1.0.0 — possession-first, defense-first.
 * Possession: pass out of own half, advance in the attacking half, shoot only
 * from the closest zone. Defending: always contain.
 */
export const conservative: Policy = {
  name: "conservative",
  version: "1.0.0",
  act(obs: Observation): unknown {
    if (obs.possession === obs.side) {
      const inOwnHalf = obs.side === "A" ? obs.ball <= 5 : obs.ball >= 5;
      const closestZone = obs.side === "A" ? obs.ball === 10 : obs.ball === 0;
      if (obs.legal.includes("shoot") && closestZone) {
        return { side: obs.side, type: "shoot" };
      }
      if (inOwnHalf) return { side: obs.side, type: "pass" };
      return { side: obs.side, type: "advance" };
    }
    return { side: obs.side, type: "contain" };
  },
};
