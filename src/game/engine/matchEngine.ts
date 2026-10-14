// Dream Football — deterministic match engine (pure transition rules).
//
// DOCUMENTED RULES (the full rulebook; nothing outside this file may change state):
// R0  Zones 0..10. Side A attacks toward zone 10; side B attacks toward zone 0.
// R1  Each turn BOTH sides submit one action simultaneously.
//     - The possessing side is the attacker; its legal actions are advance, pass,
//       and shoot (shoot only in range: A needs ball >= 8, B needs ball <= 2).
//     - The non-possessing side is the defender; its legal actions are press, contain.
// R2  REJECTED ATTACKER ACTION (malformed OR well-formed-but-illegal):
//     possession turns over to the defender, the ball does not move, a penalty
//     is recorded against the attacker. Documented rule, applied uniformly.
// R3  REJECTED DEFENDER ACTION (malformed OR well-formed-but-illegal):
//     the defender's posture is forced to "contain" for this turn, a penalty is
//     recorded against the defender. Documented rule, applied uniformly.
// R4  Malformed actions (not an object, wrong side, unknown action type) never
//     corrupt state: they are rejected at the boundary and consume no PRNG draws.
// R5  Exactly one PRNG draw is consumed per ACCEPTED attacker action; rejected
//     actions and defender actions consume none. This keeps replay exact.
// R6  advance: ball +1 toward the goal. Turnover chance: press 0.35, contain 0.15.
//     On turnover, possession flips, ball stays.
// R7  pass: ball +2 toward the goal (clamped to 0..10). Turnover chance: press 0.25,
//     contain 0.10. On turnover, possession flips, ball stays.
// R8  shoot: only legal in range. Goal chance by distance from goal:
//     distance 2 -> 0.35, distance 1 -> 0.50, distance 0 -> 0.65.
//     Goal: +1 score, ball resets to 5, possession to the conceding side.
//     Shot saved: possession to the defending side, ball resets to 5.
// R9  Turn counter increments once per turn. Match terminates when turn reaches
//     totalTurns (phase "terminal"). Highest score wins; equal score is a draw.

import type {
  ActionType,
  FinalResult,
  MatchEvent,
  MatchState,
  Observation,
  Side,
  SubmittedAction,
} from "./types.ts";

export const ENGINE_VERSION = "1.0.0";
export const TOTAL_ZONES = 10;

const ALL_ACTION_TYPES: ActionType[] = [
  "advance",
  "pass",
  "shoot",
  "press",
  "contain",
];

export function other(side: Side): Side {
  return side === "A" ? "B" : "A";
}

/** One mulberry32 step carried explicitly in state (rule R5). */
export function rngDraw(state: number): { value: number; next: number } {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next: a >>> 0 };
}

export function initialState(seed: number, totalTurns: number): MatchState {
  return {
    turn: 0,
    totalTurns,
    scoreA: 0,
    scoreB: 0,
    ball: 5,
    possession: "A",
    defenderPosture: "contain",
    rngState: seed >>> 0,
    phase: "kickoff",
  };
}

/** Legal action types for a side under rule R1. */
export function legalActions(state: MatchState, side: Side): ActionType[] {
  if (state.possession === side) {
    const legal: ActionType[] = ["advance", "pass"];
    const inRange =
      side === "A" ? state.ball >= 8 : state.ball <= 2;
    if (inRange) legal.push("shoot");
    return legal;
  }
  return ["press", "contain"];
}

export function observe(state: MatchState, side: Side): Observation {
  return {
    turn: state.turn,
    totalTurns: state.totalTurns,
    scoreA: state.scoreA,
    scoreB: state.scoreB,
    ball: state.ball,
    possession: state.possession,
    defenderPosture: state.defenderPosture,
    side,
    legal: legalActions(state, side),
  };
}

/** Boundary validation (rules R2-R4). Never throws; returns a record instead. */
function validate(
  state: MatchState,
  side: Side,
  raw: unknown
): SubmittedAction {
  const base = { side, raw };
  if (typeof raw !== "object" || raw === null) {
    return {
      ...base,
      parsedType: null,
      status: "rejected_malformed",
      reason: "action must be an object like { side, type }",
    };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.side !== side) {
    return {
      ...base,
      parsedType: null,
      status: "rejected_malformed",
      reason: `action.side must be "${side}"`,
    };
  }
  if (typeof obj.type !== "string" || !ALL_ACTION_TYPES.includes(obj.type as ActionType)) {
    return {
      ...base,
      parsedType: null,
      status: "rejected_malformed",
      reason: "unknown action type",
    };
  }
  const type = obj.type as ActionType;
  if (!legalActions(state, side).includes(type)) {
    return {
      ...base,
      parsedType: type,
      status: "rejected_illegal",
      reason: `"${type}" is not legal for the ${state.possession === side ? "attacking" : "defending"} side here (rule R1)`,
    };
  }
  return { ...base, parsedType: type, status: "accepted" };
}

function goalChance(distanceToGoal: number): number {
  if (distanceToGoal <= 0) return 0.65;
  if (distanceToGoal === 1) return 0.5;
  return 0.35;
}

/** Pure transition: (state, rawActionA, rawActionB) -> { state, event }. */
export function transition(
  prev: MatchState,
  rawA: unknown,
  rawB: unknown
): { state: MatchState; event: MatchEvent } {
  const subA = validate(prev, "A", rawA);
  const subB = validate(prev, "B", rawB);

  const attacker = prev.possession;
  const defender = other(attacker);
  const subAttacker = attacker === "A" ? subA : subB;
  const subDefender = defender === "A" ? subA : subB;

  // Defender posture (rule R1 / R3).
  const defenderPosture: "press" | "contain" =
    subDefender.status === "accepted" && subDefender.parsedType === "press"
      ? "press"
      : "contain";

  let next: MatchState = {
    ...prev,
    defenderPosture,
    phase: "open",
  };

  let outcome: MatchEvent["outcome"] = "turnover";
  let goalSide: Side | undefined;
  let penaltySide: Side | undefined;

  if (subAttacker.status !== "accepted") {
    // Rule R2: rejected attacker action -> turnover, ball unchanged.
    next = { ...next, possession: defender };
    penaltySide = attacker;
  } else {
    // Rule R5: exactly one draw per accepted attacker action.
    const draw = rngDraw(prev.rngState);
    next = { ...next, rngState: draw.next };
    const toward = attacker === "A" ? 1 : -1;
    const type = subAttacker.parsedType as ActionType;

    if (type === "advance" || type === "pass") {
      const steps = type === "advance" ? 1 : 2;
      const turnoverChance =
        type === "advance"
          ? defenderPosture === "press"
            ? 0.35
            : 0.15
          : defenderPosture === "press"
            ? 0.25
            : 0.1;
      if (draw.value < turnoverChance) {
        next = { ...next, possession: defender };
        outcome = "turnover";
      } else {
        next = {
          ...next,
          ball: Math.min(10, Math.max(0, prev.ball + toward * steps)),
        };
        outcome = type;
      }
    } else {
      // shoot (rule R8)
      const distanceToGoal = attacker === "A" ? 10 - prev.ball : prev.ball;
      if (draw.value < goalChance(distanceToGoal)) {
        goalSide = attacker;
        next = {
          ...next,
          ball: 5,
          possession: defender,
          scoreA: attacker === "A" ? prev.scoreA + 1 : prev.scoreA,
          scoreB: attacker === "B" ? prev.scoreB + 1 : prev.scoreB,
        };
        outcome = "goal";
      } else {
        next = { ...next, ball: 5, possession: defender };
        outcome = "shot_saved";
      }
    }
  }

  next = { ...next, turn: prev.turn + 1 };
  if (next.turn >= prev.totalTurns) next = { ...next, phase: "terminal" };

  const event: MatchEvent = {
    turn: next.turn,
    actions: { A: subA, B: subB },
    outcome,
    ...(goalSide !== undefined ? { goalSide } : {}),
    ...(penaltySide !== undefined ? { penaltySide } : {}),
    scoreA: next.scoreA,
    scoreB: next.scoreB,
    ball: next.ball,
    possession: next.possession,
    defenderPosture: next.defenderPosture,
    rngState: next.rngState,
  };

  return { state: next, event };
}

export function finalResult(state: MatchState): FinalResult {
  if (state.phase !== "terminal") {
    throw new Error("match not terminal");
  }
  return {
    scoreA: state.scoreA,
    scoreB: state.scoreB,
    winner:
      state.scoreA > state.scoreB
        ? "A"
        : state.scoreB > state.scoreA
          ? "B"
          : "draw",
  };
}
