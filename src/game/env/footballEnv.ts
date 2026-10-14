// Dream Football — Gym-style agent evaluation environment.
// Wraps the pure engine: reset(seed) -> observe(side) -> legalActions(side) ->
// step(actionA, actionB) -> ... until isTerminal(). runMatch() drives two
// policies through a complete match and returns the full evidence (every
// observation, every action, every transition). Deterministic given
// (seed, policies, totalTurns).

import {
  ENGINE_VERSION,
  finalResult,
  initialState,
  legalActions,
  observe,
  transition,
} from "../engine/matchEngine.ts";
import type {
  FinalResult,
  MatchEvent,
  MatchState,
  Observation,
  Policy,
} from "../engine/types.ts";

export interface TurnRecord {
  turn: number;
  obsA: Observation;
  obsB: Observation;
  event: MatchEvent;
}

export interface MatchEvidence {
  engineVersion: string;
  seed: number;
  totalTurns: number;
  policyA: { name: string; version: string };
  policyB: { name: string; version: string };
  initialState: MatchState;
  turns: TurnRecord[];
  finalState: MatchState;
  result: FinalResult;
}

/** Gym-style environment over the pure engine. */
export class FootballEnv {
  state: MatchState;

  constructor(seed: number, totalTurns: number) {
    this.state = initialState(seed, totalTurns);
  }

  reset(seed: number, totalTurns: number): void {
    this.state = initialState(seed, totalTurns);
  }

  observe(side: "A" | "B"): Observation {
    return observe(this.state, side);
  }

  legalActions(side: "A" | "B"): ReturnType<typeof legalActions> {
    return legalActions(this.state, side);
  }

  step(rawActionA: unknown, rawActionB: unknown): MatchEvent {
    const { state, event } = transition(this.state, rawActionA, rawActionB);
    this.state = state;
    return event;
  }

  isTerminal(): boolean {
    return this.state.phase === "terminal";
  }

  finalResult(): FinalResult {
    return finalResult(this.state);
  }
}

/**
 * Run one complete deterministic match.
 * Each turn both policies receive their own observation and submit one raw
 * action; the engine validates and transitions. Every turn is preserved.
 */
export function runMatch(
  seed: number,
  policyA: Policy,
  policyB: Policy,
  totalTurns: number
): MatchEvidence {
  const env = new FootballEnv(seed, totalTurns);
  const turns: TurnRecord[] = [];

  while (!env.isTerminal()) {
    const obsA = env.observe("A");
    const obsB = env.observe("B");
    const rawA = policyA.act(obsA);
    const rawB = policyB.act(obsB);
    const event = env.step(rawA, rawB);
    turns.push({ turn: event.turn, obsA, obsB, event });
  }

  return {
    engineVersion: ENGINE_VERSION,
    seed,
    totalTurns,
    policyA: { name: policyA.name, version: policyA.version },
    policyB: { name: policyB.version ? policyB.name : policyB.name, version: policyB.version },
    initialState: initialState(seed, totalTurns),
    turns,
    finalState: env.state,
    result: env.finalResult(),
  };
}
