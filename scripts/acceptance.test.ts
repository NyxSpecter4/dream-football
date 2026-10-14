// Dream Football — acceptance tests for the agent-evaluation match.
// Plain Node assertions, no test framework. Run:
//   node scripts/acceptance.test.ts
// Exit 0 = all pass, exit 1 = any failure (each failure is printed).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { FootballEnv, runMatch } from "../src/game/env/footballEnv.ts";
import { aggressor, conservative } from "../src/game/env/policies.ts";

const SEED = 20261014;
const TURNS = 90;

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}
function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// 1. match reaches a terminal state
const ev = runMatch(SEED, aggressor, conservative, TURNS);
check("T1 terminal state reached", ev.finalState.phase === "terminal");
check("T1b all turns played", ev.turns.length === TURNS, `turns=${ev.turns.length}`);

// 2. both agents submit an action every turn
check(
  "T2 both agents submit every turn",
  ev.turns.every(
    (t) => t.event.actions.A.raw !== undefined && t.event.actions.B.raw !== undefined
  )
);

// 3. valid actions are accepted and do move the match
const validAccepted = ev.turns.some((t) => t.event.actions.A.status === "accepted");
check("T3 valid actions accepted", validAccepted);

// 4. malformed actions rejected without corrupting state
{
  const env = new FootballEnv(SEED, TURNS);
  env.step({ side: "A", type: "advance" }, { side: "B", type: "contain" });
  const before = JSON.stringify(env.state);
  const e2 = env.step(42, { side: "B", type: "contain" }); // A submits a number
  const ok =
    e2.actions.A.status === "rejected_malformed" &&
    JSON.parse(before).rngState === env.state.rngState &&
    env.state.possession === "B" && // documented R2 turnover
    env.state.scoreA === 0 && env.state.scoreB === 0;
  check("T4 malformed action rejected, no corruption", ok);
}

// 5. well-formed but illegal actions rejected per documented rule
{
  const env = new FootballEnv(SEED, TURNS);
  const e1 = env.step({ side: "A", type: "shoot" }, { side: "B", type: "contain" }); // A at ball 5, shoot illegal
  const ok = e1.actions.A.status === "rejected_illegal" && e1.penaltySide === "A";
  check("T5 illegal action rejected + penalty recorded", ok);
}

// 6. score changes ONLY through permitted transitions (accepted shoot -> goal)
{
  let ok = true;
  let prevA = 0;
  let prevB = 0;
  for (const t of ev.turns) {
    const e = t.event;
    if (e.scoreA !== prevA || e.scoreB !== prevB) {
      const scorer = e.scoreA > prevA ? "A" : "B";
      const sub = e.actions[scorer];
      if (e.outcome !== "goal" || e.goalSide !== scorer || sub.status !== "accepted" || sub.parsedType !== "shoot") {
        ok = false;
        break;
      }
    }
    prevA = e.scoreA;
    prevB = e.scoreB;
  }
  check("T6 scoring only via permitted transitions", ok);
}

// 7. same seed + same policies -> identical evidence
{
  const again = runMatch(SEED, aggressor, conservative, TURNS);
  const h1 = sha256(canonical(ev.turns.map((t) => t.event)));
  const h2 = sha256(canonical(again.turns.map((t) => t.event)));
  check(
    "T7 same seed+policies -> identical event log, final state, score",
    h1 === h2 &&
      sha256(canonical(ev.finalState)) === sha256(canonical(again.finalState)) &&
      ev.result.scoreA === again.result.scoreA &&
      ev.result.scoreB === again.result.scoreB
  );
}

// 8. different policies -> distinct action traces
{
  const swapped = runMatch(SEED, conservative, aggressor, TURNS);
  const h1 = sha256(canonical(ev.turns.map((t) => t.event)));
  const h2 = sha256(canonical(swapped.turns.map((t) => t.event)));
  const traceA1 = ev.turns.map((t) => t.event.actions.A.parsedType).join(",");
  const traceA2 = swapped.turns.map((t) => t.event.actions.A.parsedType).join(",");
  check(
    "T8 different policies -> distinct traces",
    h1 !== h2 && traceA1 !== traceA2
  );
}

// 9. receipt hashes match the committed artifacts (when artifacts exist)
{
  const receiptPath = "public/eval-match/match-receipt.json";
  const evidencePath = "public/eval-match/match-evidence.json";
  if (existsSync(receiptPath) && existsSync(evidencePath)) {
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    const art = JSON.parse(readFileSync(evidencePath, "utf8"));
    const logHash = sha256(canonical(art.turns.map((t: { event: unknown }) => t.event)));
    const termHash = sha256(canonical(art.finalState));
    check(
      "T9 receipt hashes match artifacts",
      receipt.event_log_hash === logHash &&
        receipt.terminal_state_hash === termHash &&
        receipt.final_score.A === art.result.scoreA &&
        receipt.final_score.B === art.result.scoreB &&
        receipt.deterministic_replay.verdict === "PASS" &&
        receipt.overall_verdict === "PASS",
      `receipt=${receipt.event_log_hash} artifacts=${logHash}`
    );
  } else {
    console.log("SKIP T9 (artifacts not present — run scripts/run-eval-match.ts first)");
  }
}

// 10. /play route file exists and reads the committed artifacts
{
  const route = existsSync("src/routes/play.tsx")
    ? readFileSync("src/routes/play.tsx", "utf8")
    : "";
  check(
    "T10 /play route present and wired to artifacts",
    route.includes('createFileRoute("/play")') &&
      route.includes("eval-match/match-receipt.json")
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
