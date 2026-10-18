# Dream Football

Fantasy football you can actually play — and a deterministic evaluation world that can prove what happened on the field.

This repository contains three things:

1. **Night League** — a playable fantasy football web app. Draft an 8-team league under a $301.2M salary cap, play full-PPR weekly matchups against CPU managers, and invite friends to your league room with a share link.
2. **A deterministic agent-evaluation engine** — a rule-based football world that AI agents can be dropped into. Same rules for every agent, machine-readable receipts for every match, and replay verification from the recorded evidence.
3. **An Android app** — the same league concept as a native Kotlin app.

## Live

| Surface | URL | What it is |
| --- | --- | --- |
| Night League app | https://nl-play.vercel.app | The playable web app. Friend rooms meet over public MQTT signaling; share links look like `nl-play.vercel.app?room=CODE`. |
| Evaluation match demo | https://nyxspecter4.github.io/dream-football/ | A completed deterministic match with its full receipt rendered on the page. |

> **Deployment note (honest):** the live `nl-play.vercel.app` deployment currently serves a pre-Oct-14 build. Current `main` additionally contains the evaluation engine and its `/play` spectator route. One redeploy from `main` syncs them — see [BUYER-EVIDENCE.md](BUYER-EVIDENCE.md) §4.

## Quickstart

Verify the evaluation engine with zero installs (Node 22+):

```bash
node --experimental-strip-types --test scripts/acceptance.test.ts   # acceptance suite (11 checks)
node --experimental-strip-types scripts/run-eval-match.ts --commit-sha $(git rev-parse --short HEAD) --out-dir /tmp/eval
```

Run the full web app:

```bash
npm install
npm run build     # no required env vars; DATABASE_URL optional (PG Lite fallback)
npm run preview
```

## The evaluation engine (world vs. agent)

The engine is a rule-based world (seed 20261014, 90 turns, documented rules) with a Gym-style environment contract: agents observe, return actions, and the world scores them.

- **Deterministic:** same seed + same policies → byte-identical event log, terminal state, and score.
- **Receipts:** every match emits a machine-readable receipt with sha256 hashes of the event log and terminal state.
- **Replay verification:** the recorded raw actions can be replayed through a fresh engine instance and must reproduce the committed hashes.
- **World vs. agent separation:** a baseline policy was swapped for an external LLM agent through the unchanged contract — engine, scorer, rules and seed untouched (see `public/swap-match/`).

Evidence: `public/eval-match/` (the reference match + receipt), `public/swap-match/` (the swap test + receipt), `scripts/acceptance.test.ts` (the checks a buyer can re-run).

## The web app (Night League)

- **Stack:** TanStack Start, React 19, better-auth, Kysely with embedded PG Lite (no external database required), MQTT room signaling.
- **Game:** auction draft room with CPU bidding AI, weekly full-PPR matchups with box scores, side bets, waivers, trades, playoffs, and dynasty offseason rollover.

## The Android app

A fantasy football auction draft and franchise simulation built with Kotlin, Jetpack Compose, Material 3, and Room (MVVM, StateFlow, KSP). Same league concept as the web app: $301.2M cap, real-time auction draft, PPR head-to-head scoring, house-chip side bets, dynasty roster management.

## Documentation

- **[BUYER-EVIDENCE.md](BUYER-EVIDENCE.md)** — verified facts, reproduction recipes, build runbook, deploy verification, transfer manifest, and known limitations.

## Known limitations (honest record)

- No `LICENSE` file yet (owner decision pending — do not redistribute before one is added).
- The live Vercel deployment predates the Oct-14 `main` until redeployed (see note above).
- Friend rooms use a public MQTT broker: no private infrastructure needed, but no delivery guarantees either.
- Open quality backlog is tracked in GitHub issues rather than hidden (see issue #4).