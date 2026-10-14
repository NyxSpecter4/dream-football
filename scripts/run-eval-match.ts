// Dream Football — agent-evaluation match runner.
// Produces ONE complete deterministic match plus the evidence and receipt.
//
// Usage:
//   node scripts/run-eval-match.ts --commit-sha <engine-commit-sha> --out-dir public/eval-match
//
// Steps (no manual repair, no edited evidence):
//   1. Run match: seed 20261014, 90 turns, A=aggressor v1.0.0, B=conservative v1.0.0.
//   2. Boundary checks on a fresh env: one valid action, one malformed action,
//      one well-formed-but-illegal action — verified against the documented rules.
//   3. Re-run the identical match (same seed, same policy versions) and compare
//      canonical event-log hash, terminal-state hash, final score. PASS only if
//      all three match exactly.
//   4. Write machine-readable receipt + full evidence JSON; print receipt.

import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { FootballEnv, runMatch } from "../src/game/env/footballEnv.ts";
import { aggressor, conservative } from "../src/game/env/policies.ts";
import { ENGINE_VERSION, initialState } from "../src/game/engine/matchEngine.ts";

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const commitSha = arg("commit-sha") ?? "UNCOMMITTED";
const outDir = arg("out-dir") ?? "public/eval-match";

const SEED = 20261014;
const TOTAL_TURNS = 90;

/** Canonical JSON: recursively key-sorted, no whitespace -> stable hashing. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
    .join(",");
  return `{${body}}`;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// --- 1. canonical match run -------------------------------------------------
const evidence = runMatch(SEED, aggressor, conservative, TOTAL_TURNS);

const eventLogHash = sha256(canonical(evidence.turns.map((t) => t.event)));
const initialStateHash = sha256(canonical(initialState(SEED, TOTAL_TURNS)));
const terminalStateHash = sha256(canonical(evidence.finalState));

// --- 2. agent boundary checks ----------------------------------------------
const bEnv = new FootballEnv(SEED, TOTAL_TURNS);
const checks: Array<Record<string, unknown>> = [];

// (a) one VALID action accepted
{
  const before = JSON.stringify(bEnv.state);
  const ev = bEnv.step({ side: "A", type: "advance" }, { side: "B", type: "contain" });
  checks.push({
    check: "valid_action_accepted",
    input: { side: "A", type: "advance" },
    status: ev.actions.A.status,
    verdict: ev.actions.A.status === "accepted" ? "PASS" : "FAIL",
    stateChanged: JSON.stringify(bEnv.state) !== before,
  });
}
// (b) one MALFORMED action rejected, state not corrupted beyond documented rule
{
  const snapshot = JSON.stringify(bEnv.state);
  const ev = bEnv.step("advance", { side: "B", type: "contain" });
  const attackerRejected = ev.actions.A.status === "rejected_malformed";
  // documented rule R2: rejected attacker action -> turnover only (ball, score, rng unchanged)
  const s = JSON.parse(snapshot);
  const n = bEnv.state;
  const rngUnchanged = s.rngState === n.rngState;
  checks.push({
    check: "malformed_action_rejected",
    input: "advance (raw string, not an object)",
    status: ev.actions.A.status,
    reason: ev.actions.A.reason,
    turnoverApplied: n.possession === "B" && s.possession === "A",
    rngStateUnchanged: rngUnchanged,
    verdict: attackerRejected && rngUnchanged && n.possession === "B" ? "PASS" : "FAIL",
  });
}
// (c) one WELL-FORMED-BUT-ILLEGAL action rejected per documented rule
{
  // B now possesses (after turnover). B submits "shoot" from ball 5 — well-formed
  // but illegal (B needs ball <= 2). Rule R2: turnover back to A, penalty recorded.
  const snapshot = JSON.stringify(bEnv.state);
  const ev = bEnv.step({ side: "A", type: "contain" }, { side: "B", type: "shoot" });
  const s = JSON.parse(snapshot);
  const n = bEnv.state;
  checks.push({
    check: "illegal_action_rejected",
    input: { side: "B", type: "shoot" },
    status: ev.actions.B.status,
    reason: ev.actions.B.reason,
    documentedRule: "R2",
    turnoverApplied: s.possession === "B" && n.possession === "A",
    rngStateUnchanged: s.rngState === n.rngState,
    penaltyRecorded: ev.penaltySide === "B",
    verdict:
      ev.actions.B.status === "rejected_illegal" &&
      s.rngState === n.rngState &&
      n.possession === "A" &&
      ev.penaltySide === "B"
        ? "PASS"
        : "FAIL",
  });
}

// --- 3. determinism proof: identical rerun ----------------------------------
const rerun = runMatch(SEED, aggressor, conservative, TOTAL_TURNS);
const rerunEventLogHash = sha256(canonical(rerun.turns.map((t) => t.event)));
const rerunTerminalStateHash = sha256(canonical(rerun.finalState));
const scoreMatch =
  evidence.result.scoreA === rerun.result.scoreA &&
  evidence.result.scoreB === rerun.result.scoreB &&
  evidence.result.winner === rerun.result.winner;
const determinism =
  eventLogHash === rerunEventLogHash &&
  terminalStateHash === rerunTerminalStateHash &&
  scoreMatch
    ? "PASS"
    : "FAIL";

// --- 4. receipt ---------------------------------------------------------------
const submitted = evidence.turns.length * 2;
const rejected = evidence.turns.filter(
  (t) => t.event.actions.A.status !== "accepted" || t.event.actions.B.status !== "accepted"
).length;
const allChecksPass = checks.every((c) => c.verdict === "PASS");

const receipt = {
  schema: "dream-football-match-receipt/1.0.0",
  repository: "NyxSpecter4/dream-football",
  branch: "agent/eval-match",
  engine_commit: commitSha,
  engine_version: ENGINE_VERSION,
  seed: SEED,
  total_turns: TOTAL_TURNS,
  policies: {
    A: { name: aggressor.name, version: aggressor.version },
    B: { name: conservative.name, version: conservative.version },
  },
  initial_state_hash: initialStateHash,
  event_log_hash: eventLogHash,
  terminal_state_hash: terminalStateHash,
  final_score: {
    A: evidence.result.scoreA,
    B: evidence.result.scoreB,
    winner: evidence.result.winner,
  },
  action_count: submitted,
  accepted_action_count: submitted - rejected,
  rejected_action_count: rejected,
  boundary_checks: checks,
  deterministic_replay: {
    event_log_hash_match: eventLogHash === rerunEventLogHash,
    terminal_state_hash_match: terminalStateHash === rerunTerminalStateHash,
    final_score_match: scoreMatch,
    verdict: determinism,
  },
  overall_verdict:
    determinism === "PASS" && allChecksPass && evidence.finalState.phase === "terminal"
      ? "PASS"
      : "FAIL",
  executed_at_utc: new Date().toISOString(),
  runner: `node ${process.version} (native TypeScript type-stripping)`,
};

mkdirSync(outDir, { recursive: true });
const receiptPath = `${outDir}/match-receipt.json`;
const evidencePath = `${outDir}/match-evidence.json`;
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
writeFileSync(
  evidencePath,
  JSON.stringify(
    {
      schema: "dream-football-match-evidence/1.0.0",
      ...evidence,
      boundary_checks: checks,
      hashes: { initialStateHash, eventLogHash, terminalStateHash },
    },
    null,
    2
  ) + "\n"
);

console.log("MATCH RECEIPT (compact):");
console.log(JSON.stringify(receipt));
console.log(`receipt: ${receiptPath}`);
console.log(`evidence: ${evidencePath}`);
if (receipt.overall_verdict !== "PASS") process.exit(1);
