/**
 * Two-human auction: both bags can bid the same name.
 * Run: npx tsx scripts/test-auction-multi.ts
 */
import { PLAYERS, getPlayer } from "../src/game/players.ts";
import { marketValue, nextRaise, maxAffordable, spotsLeft, openBlock } from "../src/game/draft.ts";
import { canTeamBid } from "../src/game/net.ts";
import { emptyRoster } from "../src/game/league.ts";
import { BID_STEP, MIN_BID, SALARY_CAP, type SaveState } from "../src/game/types.ts";
import { fmtMoney } from "../src/game/money.ts";

const top = [...PLAYERS].sort((a, b) => marketValue(b.id) - marketValue(a.id)).slice(0, 8);
const cheap = [...PLAYERS].sort((a, b) => marketValue(a.id) - marketValue(b.id)).slice(0, 6);

console.log("Cap", fmtMoney(SALARY_CAP), "· floor", fmtMoney(MIN_BID), "· step", fmtMoney(BID_STEP));
console.log("\nTop board");
for (const p of top) console.log(`  ${p.pos.padEnd(3)} ${p.name.padEnd(22)} ${fmtMoney(marketValue(p.id))}`);
console.log("\nFloor / cheap");
for (const p of cheap) console.log(`  ${p.pos.padEnd(3)} ${p.name.padEnd(22)} ${fmtMoney(marketValue(p.id))}`);

const rosterA = emptyRoster();
const rosterB = emptyRoster();
const save = {
  budgets: { a: SALARY_CAP, b: SALARY_CAP },
  rosters: { a: rosterA, b: rosterB },
  teams: [
    { id: "a", name: "Dream", short: "DRM", jersey: "pine", human: true, peerId: "p1" },
    { id: "b", name: "Cindy", short: "CIN", jersey: "ember", human: true, peerId: "p2" },
  ],
} as unknown as SaveState;

let live = openBlock("qb-allen", "a", true);
const fail: string[] = [];

if (!canTeamBid(save, "b", live)) fail.push("Cindy cannot open-bid Allen");
if (canTeamBid(save, "a", live)) fail.push("Nominator with the bid should not raise themselves");

const cindyBid = nextRaise(live.highBid);
live = { ...live, highBid: cindyBid, highBidderId: "b", log: [...live.log, { teamId: "b", amount: cindyBid }] };
if (!canTeamBid(save, "a", live)) fail.push("Dream cannot raise Cindy");
if (canTeamBid(save, "b", live)) fail.push("Cindy still has the bid — should not raise herself");

const dreamBid = nextRaise(live.highBid) + 1_000;
if (dreamBid <= live.highBid) fail.push("Raise must clear the board");
live = { ...live, highBid: dreamBid, highBidderId: "a" };
if (!canTeamBid(save, "b", live)) fail.push("Cindy cannot raise Dream's +$1M");

const spots = spotsLeft(rosterA);
const cap = maxAffordable(SALARY_CAP, spots);
if (cap < MIN_BID) fail.push("Opening cap broken");
if (nextRaise(MIN_BID) !== MIN_BID + BID_STEP) fail.push("Step is not $100K");

if (fail.length) {
  console.error("\nFAIL\n" + fail.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
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
(globalThis as { fetch?: typeof fetch }).fetch = (async () => ({
  json: async () => ({}),
})) as typeof fetch;

const { useGame } = await import("../src/game/store.ts");
useGame.getState().startOnlineSeason(
  [
    { peerId: "p1", name: "Dream", short: "DRM", jersey: "pine" },
    { peerId: "p2", name: "Cindy", short: "CIN", jersey: "ember" },
  ],
  "p1",
  "p1",
);
const g = useGame.getState();
const dream = g.teams.find((t) => t.peerId === "p1")!;
const cindy = g.teams.find((t) => t.peerId === "p2")!;
useGame.setState({ playerTeamId: dream.id, isHost: true, online: true, mode: "online" });
for (let i = 0; i < 16 && !useGame.getState().block; i++) useGame.getState().cpuStep();
let st = useGame.getState();
if (!st.block) {
  console.error("FAIL desk did not open the block");
  process.exit(1);
}
useGame.getState().bid(nextRaise(st.block.highBid), cindy.id);
st = useGame.getState();
if (st.block?.highBidderId !== cindy.id) {
  console.error("FAIL Cindy bid did not take the board", st.block);
  process.exit(1);
}
useGame.getState().bid(nextRaise(st.block.highBid) + 1_000, dream.id);
st = useGame.getState();
if (st.block?.highBidderId !== dream.id) {
  console.error("FAIL Dream raise did not take the board", st.block);
  process.exit(1);
}
console.log(
  "Store:",
  getPlayer(st.block.playerId).name,
  "Cindy bid",
  fmtMoney(cindyBid),
  "Dream raised to",
  fmtMoney(st.block.highBid),
  "— both bags live.",
);
