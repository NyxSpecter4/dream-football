// /play — spectator surface for the completed agent-evaluation match.
// Reads the committed match artifacts from /eval-match/*.json (static assets)
// and renders the finished match: agents, score, clock, field, event log,
// final result, and the deterministic-replay verdict.

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play")({
  component: PlayScreen,
});

interface Receipt {
  schema: string;
  repository: string;
  branch: string;
  engine_commit: string;
  engine_version: string;
  seed: number;
  total_turns: number;
  policies: {
    A: { name: string; version: string };
    B: { name: string; version: string };
  };
  initial_state_hash: string;
  event_log_hash: string;
  terminal_state_hash: string;
  final_score: { A: number; B: number; winner: string };
  action_count: number;
  accepted_action_count: number;
  rejected_action_count: number;
  deterministic_replay: {
    event_log_hash_match: boolean;
    terminal_state_hash_match: boolean;
    final_score_match: boolean;
    verdict: "PASS" | "FAIL";
  };
  overall_verdict: "PASS" | "FAIL";
  executed_at_utc: string;
}

interface Evidence {
  seed: number;
  totalTurns: number;
  initialState: { scoreA: number; scoreB: number; ball: number };
  turns: Array<{
    turn: number;
    event: {
      turn: number;
      outcome: string;
      goalSide?: string;
      actions: Record<string, { status: string; parsedType: string | null }>;
      scoreA: number;
      scoreB: number;
      ball: number;
      possession: string;
    };
  }>;
  result: { scoreA: number; scoreB: number; winner: string };
}

function verdictColor(v: string) {
  return v === "PASS" ? "text-emerald-400" : "text-red-400";
}

function statusBadge(status: string) {
  if (status === "accepted") return "✓ accepted";
  if (status === "rejected_malformed") return "✗ malformed";
  if (status === "rejected_illegal") return "✗ illegal";
  return status;
}

function PlayScreen() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/eval-match/match-receipt.json").then((r) => {
        if (!r.ok) throw new Error(`receipt HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/eval-match/match-evidence.json").then((r) => {
        if (!r.ok) throw new Error(`evidence HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([r, e]) => {
        setReceipt(r as Receipt);
        setEvidence(e as Evidence);
      })
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-red-400">
        Could not load match artifacts: {error}
      </main>
    );
  }
  if (!receipt || !evidence) {
    return <main className="mx-auto max-w-3xl p-8 opacity-70">Loading match…</main>;
  }

  const last = evidence.turns[evidence.turns.length - 1]!.event;
  const recent = [...evidence.turns].slice(-12).reverse();

  return (
    <main className="mx-auto max-w-4xl p-6 font-mono text-sm text-stone-200">
      <h1 className="mb-1 font-semibold text-lg tracking-wide text-stone-100">
        Dream Football — Agent Evaluation Match
      </h1>
      <p className="mb-4 text-stone-400">
        Two deterministic agent policies played one complete match in the
        deterministic engine. Replay verified from the raw event log.
      </p>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-stone-700 bg-stone-900 p-4">
          <div className="text-stone-400">Agent A</div>
          <div className="text-lg text-sky-300">
            {receipt.policies.A.name} v{receipt.policies.A.version}
          </div>
          <div className="text-3xl font-bold">{receipt.final_score.A}</div>
        </div>
        <div className="rounded-lg border border-stone-700 bg-stone-900 p-4">
          <div className="text-stone-400">Agent B</div>
          <div className="text-lg text-amber-300">
            {receipt.policies.B.name} v{receipt.policies.B.version}
          </div>
          <div className="text-3xl font-bold">{receipt.final_score.B}</div>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-stone-700 bg-stone-900 p-4">
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          <span>
            Clock: <b>{last.turn}</b>/{receipt.total_turns}
          </span>
          <span>
            Ball zone: <b>{last.ball}</b> (0..10, A attacks 10)
          </span>
          <span>
            Possession: <b>{last.possession}</b>
          </span>
          <span>
            Result:{" "}
            <b>
              {receipt.final_score.winner === "draw"
                ? "Draw"
                : `Agent ${receipt.final_score.winner} wins`}
            </b>
          </span>
          <span>
            Replay verification:{" "}
            <b className={verdictColor(receipt.deterministic_replay.verdict)}>
              {receipt.deterministic_replay.verdict}
            </b>
          </span>
          <span>
            Overall:{" "}
            <b className={verdictColor(receipt.overall_verdict)}>
              {receipt.overall_verdict}
            </b>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1" aria-label="field">
          <span className="mr-2 text-sky-300">B◼</span>
          {Array.from({ length: 11 }, (_, z) => (
            <span
              key={z}
              className={
                "inline-flex h-8 w-8 items-center justify-center rounded border border-stone-700 " +
                (z === last.ball ? "bg-stone-100 text-stone-900" : "bg-stone-800 text-stone-500")
              }
            >
              {z === last.ball ? "⚽" : z}
            </span>
          ))}
          <span className="ml-2 text-amber-300">A goal</span>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-stone-700 bg-stone-900 p-4">
        <div className="mb-2 text-stone-400">Recent events (newest first)</div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="py-1 pr-4">Turn</th>
              <th className="py-1 pr-4">A action</th>
              <th className="py-1 pr-4">B action</th>
              <th className="py-1 pr-4">Outcome</th>
              <th className="py-1 pr-4">Score</th>
              <th className="py-1">Ball</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => (
              <tr key={t.turn} className="border-t border-stone-800">
                <td className="py-1 pr-4">{t.turn}</td>
                <td className="py-1 pr-4">
                  {t.event.actions.A.parsedType ?? "—"}{" "}
                  <span className="text-stone-500">{statusBadge(t.event.actions.A.status)}</span>
                </td>
                <td className="py-1 pr-4">
                  {t.event.actions.B.parsedType ?? "—"}{" "}
                  <span className="text-stone-500">{statusBadge(t.event.actions.B.status)}</span>
                </td>
                <td className={"py-1 pr-4 " + (t.event.outcome === "goal" ? "text-emerald-400" : "")}>
                  {t.event.outcome}
                  {t.event.goalSide ? ` (${t.event.goalSide})` : ""}
                </td>
                <td className="py-1 pr-4">
                  {t.event.scoreA}–{t.event.scoreB}
                </td>
                <td className="py-1">{t.event.ball}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-stone-700 bg-stone-900 p-4 text-xs text-stone-400">
        <div>Receipt — engine {receipt.engine_version} @ commit {receipt.engine_commit.slice(0, 12)} (branch {receipt.branch})</div>
        <div>Seed {receipt.seed} · actions {receipt.action_count} · rejected {receipt.rejected_action_count}</div>
        <div className="break-all">event_log_sha256: {receipt.event_log_hash}</div>
        <div className="break-all">terminal_state_sha256: {receipt.terminal_state_hash}</div>
        <div>Executed {receipt.executed_at_utc}</div>
      </section>
    </main>
  );
}
