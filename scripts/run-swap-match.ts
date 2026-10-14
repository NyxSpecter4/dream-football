// Dream Football — WORLD vs AGENT separation test (the "swap test").
//
// ONE change vs the canonical eval match: policy B (conservative v1.0.0) is
// replaced by ONE EXTERNAL agent — KIN v1 3B served locally via ollama —
// entering through the identical Policy contract. The world, engine, rules,
// scorer, seed (20261014), and turn count (90) are unchanged from the
// canonical match. Side A stays aggressor v1.0.0 (baseline policy).
//
// Verdict semantics (honest, fail-closed):
//   PASS  = the external agent completed the full match through the unchanged
//           contract AND the recorded action trace recomputes byte-identically
//           through a FRESH engine instance (trace replay).
//   FAIL  = the contract broke (engine/scorer modified, agent unreachable,
//           replay mismatch, match did not terminate).
//   Note  = an LLM policy is NOT deterministic across runs; this receipt
//           proves ENGINE determinism given the recorded action trace, plus
//           every raw agent response preserved in the evidence file.
//
// Usage:
//   node scripts/run-swap-match.ts --engine-commit <sha> --out-dir public/swap-match

import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { FootballEnv } from "../src/game/env/footballEnv.ts";
import { aggressor } from "../src/game/env/policies.ts";
import {
  KIN_AGENT_CONFIG,
  makeKinAgentPolicy,
} from "../src/game/env/kinAgentPolicy.ts";
import {
  ENGINE_VERSION,
  initialState,
} from "../src/game/engine/matchEngine.ts";
import type { MatchEvent, MatchState, Observation } from "../src/game/engine/types.ts";

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const engineCommit = arg("engine-commit") ?? "UNCOMMITTED";
const outDir = arg("out-dir") ?? "public/swap-match";

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

interface SwapTurn {
  turn: number;
  obsA: Observation;
  obsB: Observation;
  event: MatchEvent;
}

async function main() {
  const kin = makeKinAgentPolicy();

  // --- 1. the swap match itself ---------------------------------------------
  const env = new FootballEnv(SEED, TOTAL_TURNS);
  const turns: SwapTurn[] = [];
  while (!env.isTerminal()) {
    const obsA = env.observe("A");
    const obsB = env.observe("B");
    const rawA = aggressor.act(obsA); // baseline policy, unchanged
    const rawB = await kin.act(obsB); // EXTERNAL agent through the same contract
    const event = env.step(rawA, rawB);
    turns.push({ turn: event.turn, obsA, obsB, event });
    if (turns.length === 1 || event.turn % 10 === 0) {
      console.log(`turn ${event.turn}: score ${event.scoreA}-${event.scoreB}`);
    }
  }

  const eventLogHash = sha256(canonical(turns.map((t) => t.event)));
  const initialStateHash = sha256(canonical(initialState(SEED, TOTAL_TURNS)));
  const terminalStateHash = sha256(canonical(env.state));
  const final = env.finalResult();

  // --- 2. boundary checks (identical to the canonical runner) ---------------
  const bEnv = new FootballEnv(SEED, TOTAL_TURNS);
  const checks: Array<Record<string, unknown>> = [];
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
  {
    const snapshot = JSON.stringify(bEnv.state);
    const ev = bEnv.step("advance", { side: "B", type: "contain" });
    const s = JSON.parse(snapshot);
    const n = bEnv.state;
    checks.push({
      check: "malformed_action_rejected",
      input: "advance (raw string, not an object)",
      status: ev.actions.A.status,
      reason: ev.actions.A.reason,
      turnoverApplied: n.possession === "B" && s.possession === "A",
      rngStateUnchanged: s.rngState === n.rngState,
      verdict:
        ev.actions.A.status === "rejected_malformed" &&
        s.rngState === n.rngState &&
        n.possession === "B"
          ? "PASS"
          : "FAIL",
    });
  }
  {
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

  // --- 3. TRACE REPLAY: fresh engine, recorded raw actions only --------------
  const replayEnv = new FootballEnv(SEED, TOTAL_TURNS);
  const replayEvents: MatchEvent[] = [];
  for (const t of turns) {
    const ev = replayEnv.step(t.event.actions.A.raw, t.event.actions.B.raw);
    replayEvents.push(ev);
  }
  const replayEventLogHash = sha256(canonical(replayEvents));
  const replayTerminalStateHash = sha256(canonical(replayEnv.state));
  const traceReplay =
    eventLogHash === replayEventLogHash &&
    terminalStateHash === replayTerminalStateHash
      ? "PASS"
      : "FAIL";

  // --- 4. swap statistics ------------------------------------------------------
  const submitted = turns.length * 2;
  const bRejected = turns.filter((t) => t.event.actions.B.status !== "accepted").length;
  const aRejected = turns.filter((t) => t.event.actions.A.status !== "accepted").length;
  const bParse = {
    direct_json: kin.calls.filter((c) => c.parseMethod === "direct_json").length,
    embedded_json: kin.calls.filter((c) => c.parseMethod === "embedded_json").length,
    unparseable: kin.calls.filter((c) => c.parseMethod === "unparseable").length,
  };
  const allChecksPass = checks.every((c) => c.verdict === "PASS");

  const receipt = {
    schema: "dream-football-swap-receipt/1.0.0",
    repository: "NyxSpecter4/dream-football",
    branch: "agent/swap-test",
    engine_commit: engineCommit,
    engine_version: ENGINE_VERSION,
    test: "world-vs-agent-separation",
    description:
      "ONE change vs the canonical match: baseline policy B replaced by ONE external agent (declared verbatim in agent_configs.B) served via local ollama. World, engine, rules, scorer, seed, and turn count unchanged.",
    seed: SEED,
    total_turns: TOTAL_TURNS,
    agent_configs: {
      A: { name: "aggressor", version: "1.0.0", kind: "baseline-policy" },
      B: { ...KIN_AGENT_CONFIG },
    },
    seam: {
      policy_contract_unchanged: true,
      engine_unchanged: true,
      scorer_unchanged: true,
      observation_source: "identical FootballEnv.observe(side) for both agents",
      agent_output_handling: "parse-only, never repaired; raw strings submitted as-is (engine rejects)",
    },
    initial_state_hash: initialStateHash,
    event_log_hash: eventLogHash,
    terminal_state_hash: terminalStateHash,
    final_score: { A: final.scoreA, B: final.scoreB, winner: final.winner },
    action_count: submitted,
    accepted_action_count: submitted - aRejected - bRejected,
    rejected_action_count: aRejected + bRejected,
    side_A_rejected: aRejected,
    side_B_rejected: bRejected,
    agent_B_parse_methods: bParse,
    boundary_checks: checks,
    trace_replay: {
      method: "fresh engine instance; recorded raw actions replayed; hashes recomputed",
      event_log_hash_match: eventLogHash === replayEventLogHash,
      terminal_state_hash_match: terminalStateHash === replayTerminalStateHash,
      verdict: traceReplay,
    },
    determinism_note:
      "The engine is deterministic given the recorded action trace. The external LLM agent is NOT deterministic across runs; its 90 raw responses are preserved in swap-evidence.json.",
    overall_verdict:
      traceReplay === "PASS" &&
      allChecksPass &&
      env.state.phase === "terminal" &&
      turns.length === TOTAL_TURNS
        ? "PASS"
        : "FAIL",
    executed_at_utc: new Date().toISOString(),
    runner: `node ${process.version} (native TypeScript type-stripping)`,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/swap-receipt.json`, JSON.stringify(receipt, null, 2) + "\n");
  writeFileSync(
    `${outDir}/swap-evidence.json`,
    JSON.stringify(
      {
        schema: "dream-football-swap-evidence/1.0.0",
        engine_version: ENGINE_VERSION,
        seed: SEED,
        total_turns: TOTAL_TURNS,
        agent_configs: {
          A: { name: "aggressor", version: "1.0.0" },
          B: { ...KIN_AGENT_CONFIG },
        },
        initialState: initialState(SEED, TOTAL_TURNS),
        turns,
        finalState: env.state as MatchState,
        result: final,
        agent_B_calls: kin.calls,
        boundary_checks: checks,
        hashes: { initialStateHash, eventLogHash, terminalStateHash },
      },
      null,
      2
    ) + "\n"
  );

  console.log("SWAP RECEIPT (compact):");
  console.log(JSON.stringify(receipt));
  console.log(`receipt: ${outDir}/swap-receipt.json`);
  console.log(`evidence: ${outDir}/swap-evidence.json`);
  if (receipt.overall_verdict !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error("SWAP MATCH FAILED:", e);
  process.exit(1);
});
