/**
 * Solo + two-human: auction fill, 16 weeks, keepers, year 2.
 * Run: npx tsx scripts/test-season-e2e.ts
 */
import { rosterPlayerIds } from "../src/game/league.ts";
import { spotsLeft } from "../src/game/draft.ts";
import { standings } from "../src/game/simulate.ts";
import {
  REGULAR_WEEKS,
  ROSTER_SIZE,
  TEAM_COUNT,
  TOTAL_WEEKS,
  type LeagueTeam,
} from "../src/game/types.ts";
import { fmtMoney } from "../src/game/money.ts";

const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;
(globalThis as { window?: { localStorage: Storage } }).window = {
  localStorage: globalThis.localStorage,
};
(globalThis as { fetch?: typeof fetch }).fetch = (async () =>
  new Response(JSON.stringify({ week: 1, stats: {}, games: [] }), {
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;

const { useGame } = await import("../src/game/store.ts");

const fail: string[] = [];
function ok(cond: unknown, msg: string) {
  if (!cond) fail.push(msg);
}

function fillTable() {
  const g = useGame.getState();
  for (const t of g.teams) {
    if (spotsLeft(g.rosters[t.id]!) > 0) useGame.getState().fillRest(t.id);
  }
}

function assertRosters(label: string) {
  const g = useGame.getState();
  ok(g.teams.length === TEAM_COUNT, `${label}: ${g.teams.length} clubs, want ${TEAM_COUNT}`);
  const tags = new Set(g.teams.map((t) => t.nfl));
  ok(tags.size === TEAM_COUNT, `${label}: duplicate NFL twins ${[...tags]}`);
  const seen = new Set<string>();
  for (const t of g.teams) {
    const ids = rosterPlayerIds(g.rosters[t.id]!);
    ok(ids.length === ROSTER_SIZE, `${label}: ${t.name} has ${ids.length}`);
    ok((g.budgets[t.id] ?? -1) >= 0, `${label}: ${t.name} budget ${g.budgets[t.id]}`);
    for (const id of ids) {
      ok(!seen.has(id), `${label}: ${id} owned twice`);
      seen.add(id);
    }
  }
}

async function runWeeks(label: string) {
  for (let n = 1; n <= TOTAL_WEEKS; n++) {
    const before = useGame.getState();
    if (before.phase === "complete") break;
    const week = before.week;
    await useGame.getState().playWeek();
    const mid = useGame.getState();
    if (mid.ticker) {
      useGame.getState().skipTicker();
      useGame.getState().closeTicker();
    }
    const after = useGame.getState();
    const boxes = after.results[week];
    ok(boxes && Object.keys(boxes).length >= 2, `${label} week ${week}: no boxes`);
    for (const box of Object.values(boxes ?? {})) {
      ok(Number.isFinite(box.points), `${label} week ${week}: NaN points ${box.teamId}`);
      ok(box.points >= 0, `${label} week ${week}: negative ${box.teamId}`);
    }
    if (n > TOTAL_WEEKS + 2) {
      fail.push(`${label}: season did not end`);
      break;
    }
  }
}

function logClubs(teams: LeagueTeam[]) {
  for (const t of teams) {
    console.log(`  ${t.nfl.padEnd(3)} ${t.city.padEnd(16)} ${t.name}${t.human ? "  ← you" : ""}`);
  }
}

console.log("— solo —");
useGame.getState().startSeason("Titletown", "GB", "pine", "Green Bay", "Titletown Field");
let g = useGame.getState();
ok(g.teams.find((t) => t.human)?.nfl === "GB", "you are not the GB twin");
ok(g.phase === "draft", "did not open auction");
ok(g.teams.filter((t) => !t.human).length === 7, `solo desk ${g.teams.filter((t) => !t.human).length}`);
ok(g.teams.filter((t) => !t.human).every((t) => t.manager), "solo desk unnamed");
for (let i = 0; i < 8; i++) useGame.getState().cpuStep();
ok(Boolean(useGame.getState().block), "desk never put a name up");
logClubs(g.teams);
fillTable();
g = useGame.getState();
ok(g.phase === "regular", `after fill phase=${g.phase}`);
ok(g.schedule.length === REGULAR_WEEKS, `schedule ${g.schedule.length}`);
assertRosters("year1 draft");
await runWeeks("year1");
g = useGame.getState();
ok(g.phase === "complete", `year1 phase=${g.phase}`);
ok(Boolean(g.playoffBracket?.championId), "no champion");
const rows = standings(g.teams, g.results, REGULAR_WEEKS);
ok(rows.length === TEAM_COUNT, "standings short");
console.log(
  "  champ",
  g.teams.find((t) => t.id === g.playoffBracket?.championId)?.name,
  "· you",
  fmtMoney(g.budgets[g.playerTeamId] ?? 0),
  "left",
);

useGame.getState().keepClub();
g = useGame.getState();
ok(g.phase === "offseason", `keep phase=${g.phase}`);
ok(g.seasonNo === 2, `seasonNo ${g.seasonNo}`);
useGame.getState().openNextSeason();
g = useGame.getState();
if (g.phase === "draft") fillTable();
g = useGame.getState();
ok(g.phase === "regular", `year2 phase=${g.phase}`);
assertRosters("year2");
await runWeeks("year2");
g = useGame.getState();
ok(g.phase === "complete", `year2 end phase=${g.phase}`);
ok((g.career.seasons ?? 0) >= 2, `career seasons ${g.career.seasons}`);

console.log("— two human —");
mem.clear();
useGame.getState().resetSeason();
useGame.getState().startOnlineSeason(
  [
    { peerId: "p1", name: "Dream", short: "DRM", jersey: "pine", city: "Dallas", stadium: "Trinity Field" },
    { peerId: "p2", name: "Cindy", short: "CIN", jersey: "ember", city: "Kansas City", stadium: "West Bottoms" },
  ],
  "p1",
  "p1",
);
g = useGame.getState();
const dream = g.teams.find((t) => t.peerId === "p1");
const cindy = g.teams.find((t) => t.peerId === "p2");
ok(dream?.human && cindy?.human, "both humans missing");
ok(dream?.nfl && cindy?.nfl && dream.nfl !== cindy.nfl, "humans share a twin");
ok(g.teams.filter((t) => t.human).length === 2, "human count");
ok(g.teams.filter((t) => !t.human).length === 6, `online desk ${g.teams.filter((t) => !t.human).length}`);
ok(g.teams.filter((t) => !t.human).every((t) => t.manager), "online desk unnamed");
for (let i = 0; i < 8; i++) useGame.getState().cpuStep();
ok(Boolean(useGame.getState().block), "online desk never put a name up");
fillTable();
g = useGame.getState();
ok(g.phase === "regular", `online fill phase=${g.phase}`);
assertRosters("online");
useGame.setState({ playerTeamId: dream!.id, isHost: true });
await useGame.getState().playWeek();
g = useGame.getState();
ok(g.ticker || g.results[1], "online week 1 did not score");
if (g.ticker) {
  useGame.getState().skipTicker();
  useGame.getState().closeTicker();
}
ok(useGame.getState().week === 2, `online week ${useGame.getState().week}`);

if (fail.length) {
  console.error("\nFAIL");
  for (const f of fail) console.error(" -", f);
  process.exit(1);
}
console.log("\nE2E ok — two seasons + two-human week 1.");
