# Dream Football — Buyer Evidence Package (Sale 001)

Every claim below is labeled: **VERIFIED** (re-checked live or by execution), **CLAIMED** (documented but not re-verified), or **MISSING** (does not exist yet).

## 1. Verified facts (Oct 18, 2026)

| Claim | Status | Evidence |
| --- | --- | --- |
| Canonical branch `main` @ `66add83a`, 51 commits | VERIFIED | git history |
| 6 branches: 4 merged + `main` + `gh-pages` (demo); 6 PRs, all merged | VERIFIED | branch/PR listing, Oct 18 |
| Acceptance suite passes on a fresh checkout with zero npm packages | VERIFIED | executed Oct 18, Node v22.20.0 native type-stripping — 11/11 PASS |
| Evaluation match reproduces from source, byte-identical hashes | VERIFIED | fresh codeload tarball, zero installs: initial-state `90168e56…`, event-log `2370a27a…`, terminal-state `c03f0d13…`, final 4–1, 180/180 actions, replay PASS |
| Swap test (external LLM agent through unchanged contract) | VERIFIED | `public/swap-match/swap-receipt.json`, overall PASS, trace replay byte-identical; agent declared: Qwen/Qwen2.5-0.5B-Instruct stand-in |
| `nl-play.vercel.app` live and serving the app | VERIFIED | live fetch Oct 18: title "Dream Football", 8-team league UI, Companion chrome |
| Live deployment is current with `main` | MISSING | `/play` route (in `main` since Oct 14) returns Not Found on the live deployment — redeploy needed (§4) |
| gh-pages demo live and current | VERIFIED | https://nyxspecter4.github.io/dream-football/ — seed 20261014, 90 turns, receipt on-page |
| Full web app builds from a fresh checkout | PENDING RECEIPT | CI build guards are green (CLAIMED); engine layer is receipt-backed; the §3 runbook closes this on any machine in ~10 minutes |
| LICENSE file | MISSING | owner decision pending |

## 2. Reproduce the engine evidence yourself (zero dependencies)

Any machine with Node 22+:

```bash
curl -sL https://codeload.github.com/NyxSpecter4/dream-football/tar.gz/refs/heads/main | tar xz --strip-components=1
node --experimental-strip-types --test scripts/acceptance.test.ts
node --experimental-strip-types scripts/run-eval-match.ts --commit-sha 08f17a91f4 --out-dir /tmp/eval
```

Then compare `/tmp/eval/match-receipt.json` against `public/eval-match/match-receipt.json` — every hash, score, and action count must match (only `executed_at_utc` and `runner` differ).

## 3. Clean web-build runbook (fresh checkout → running app)

```bash
git clone https://github.com/NyxSpecter4/dream-football.git
cd dream-football
npm install
npm run build
npm run preview
```

- **Required environment variables: none.** `scripts/with-app-env.mjs` optionally reads `.grok/app-env.json` (only `VITE_*` keys; absent file = defaults, auth on).
- Without `DATABASE_URL`, the build-time migrator skips and the app self-migrates into embedded PG Lite at startup (`[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself.)`).
- Optional deeper checks: `npm run typecheck` · `npm run test:game` (auction + season end-to-end) · `npm run check:auth`.

## 4. Vercel redeploy + post-deploy verification

The repo already carries `vercel.json` (framework: null, `npm run build`, `npm install`). Redeploy the existing project from `main` (or import the repo at root if starting fresh). Then verify:

| Probe | Expected |
| --- | --- |
| `GET /` | title "Dream Football", 8-team league board |
| `GET /play` | 200 — the evaluation spectator route (404 here = the deployment is stale) |
| `/?room=CODE` | lobby join flow with a 4-letter room code |

Deployment is a `*.vercel.app` subdomain; account tier and any custom domain are owner-side facts to state in the listing.

## 5. What the buyer receives (transfer manifest)

- **Evaluation engine** — deterministic rules, Gym-style env, two baseline policies, external-agent adapter (`src/game/env/kinAgentPolicy.ts`), match + swap runners, acceptance suite.
- **Web app** — TanStack Start + React 19 + better-auth + Kysely/PG Lite, migrations, MQTT friend rooms, auction/league/score/dynasty game layer.
- **Android app** — Kotlin, Jetpack Compose, Material 3, Room; Gradle Kotlin DSL + version catalog.
- **Committed evidence** — `public/eval-match/` and `public/swap-match/` receipts + full evidence JSON, reproducible by §2.
- **CI guards** — css-build-guard (vite build), android-build-guard (gradle assembleDebug).
- **Honest records** — merged branch history preserved; known quality backlog tracked in issue #4 rather than deleted.

## 6. Known limitations (documented, not hidden)

1. No `LICENSE` yet — must be resolved before transfer.
2. Live deployment predates Oct-14 `main` until redeployed (§4).
3. Friend rooms depend on a public MQTT broker (no delivery guarantees).
4. Issue #4: open quality backlog.
5. Web build from a fresh checkout: engine layer is receipt-backed (§2); the full-app receipt (§3) should be captured and attached to the listing.