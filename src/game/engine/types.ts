// Dream Football — deterministic agent-evaluation match engine types.
// CONTRACT: a match is a pure state machine. Every transition is a function of
// (state, actionA, actionB). All randomness comes from an explicit seeded PRNG
// state carried inside MatchState, so any match replays byte-for-byte from
// (seed, policies, totalTurns). No Date.now(), no Math.random(), no hidden state.

export type Side = "A" | "B";

export type ActionType = "advance" | "pass" | "shoot" | "press" | "contain";

export type ActionStatus =
  | "accepted"
  | "rejected_malformed"
  | "rejected_illegal";

/** Well-formed action shape. Anything else is rejected as malformed. */
export interface MatchAction {
  side: Side;
  type: ActionType;
}

export type DefenderPosture = "press" | "contain";

/** Gym-style observation handed to a policy each turn. */
export interface Observation {
  turn: number;
  totalTurns: number;
  scoreA: number;
  scoreB: number;
  /** Ball zone 0..10. Side A attacks toward zone 10, side B toward zone 0. */
  ball: number;
  possession: Side;
  defenderPosture: DefenderPosture;
  /** The side this observation was built for. */
  side: Side;
  /** Legal action types for `side` in this state. */
  legal: ActionType[];
}

/** Full match state — everything needed to replay a match is in here. */
export interface MatchState {
  turn: number;
  totalTurns: number;
  scoreA: number;
  scoreB: number;
  ball: number;
  possession: Side;
  defenderPosture: DefenderPosture;
  /** mulberry32 internal state; exactly one draw per ACCEPTED attacker action. */
  rngState: number;
  phase: "kickoff" | "open" | "terminal";
}

export type TurnOutcome =
  | "advance"
  | "pass"
  | "shot_saved"
  | "goal"
  | "turnover";

/** Per-turn record of what each policy submitted and what the engine did. */
export interface SubmittedAction {
  side: Side;
  /** Raw policy output exactly as received, before validation. */
  raw: unknown;
  /** Parsed action type if well-formed, else null. */
  parsedType: ActionType | null;
  status: ActionStatus;
  reason?: string;
}

export interface MatchEvent {
  turn: number;
  actions: Record<Side, SubmittedAction>;
  outcome: TurnOutcome;
  /** Set on a goal. */
  goalSide?: Side;
  /** Set when a side submits a rejected action (malformed or illegal). */
  penaltySide?: Side;
  /** State AFTER this turn's transition. */
  scoreA: number;
  scoreB: number;
  ball: number;
  possession: Side;
  defenderPosture: DefenderPosture;
  rngState: number;
}

export interface FinalResult {
  scoreA: number;
  scoreB: number;
  winner: Side | "draw";
}

/** Policy contract: deterministic function of the observation. */
export interface Policy {
  name: string;
  version: string;
  act(obs: Observation): unknown;
}
