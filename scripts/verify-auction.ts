/**
 * Prove the desk sits and the auction starts with no human tap.
 * npx tsx scripts/verify-auction.ts
 */
import { getPlayer } from "../src/game/players.ts";
import { spotsLeft } from "../src/game/draft.ts";
import { GROK_BOTS } from "../src/game/bots.ts";

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
  new Response(JSON.stringify({ week: 1, board: [], games: [] }), {
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;

const { useGame } = await import("../src/game/store.ts");
const fail: string[] = [];
const ok = (c: unknown, m: string) => {
  if (!c) fail.push(m);
};

useGame.getState().startSeason("Dream", "DRM", "midnight", "Dallas", "Trinity Field");
let g = useGame.getState();
const desk = g.teams.filter((t) => !t.human);
ok(g.teams.length === 8, `solo clubs ${g.teams.length}`);
ok(desk.length === 7, `solo desk ${desk.length}`);
ok(
  desk.every((t) => GROK_BOTS.some((b) => b.manager === t.manager)),
  `solo unknown manager ${desk.map((t) => t.manager).join(",")}`,
);
ok(!g.nominating, "solo opened waiting on you to nominate");

for (let i = 0; i < 12 && !useGame.getState().block; i++) useGame.getState().cpuStep();
g = useGame.getState();
ok(g.block, "solo: no name on the block after 12 steps");
if (g.block) {
  const pl = getPlayer(g.block.playerId);
  const nom = g.teams.find((t) => t.id === g.block!.nominatorId);
  ok(!nom?.human, `solo nominator is human ${nom?.name}`);
  ok(pl.name && pl.name !== "Unsigned", `solo dead player ${pl.name}`);
  console.log(`solo block: ${pl.name} by ${nom?.manager ?? nom?.name} at open`);
}

for (let i = 0; i < 40 && useGame.getState().block && !useGame.getState().block.waitingForHuman; i++) {
  useGame.getState().cpuStep();
}
g = useGame.getState();
ok(g.block, "solo lost the block");
if (g.block) {
  const high = g.teams.find((t) => t.id === g.block!.highBidderId);
  console.log(
    `solo live: ${getPlayer(g.block.playerId).name} high ${g.block.highBid} ${high?.manager ?? high?.name} going ${g.block.going} waitHuman ${g.block.waitingForHuman}`,
  );
}

mem.clear();
useGame.getState().resetSeason();
useGame.getState().startOnlineSeason(
  [
    { peerId: "p1", name: "Dream", short: "DRM", jersey: "pine", city: "Dallas" },
    { peerId: "p2", name: "Cindy", short: "CIN", jersey: "ember", city: "Kansas City" },
  ],
  "p1",
  "p1",
);
g = useGame.getState();
const humans = g.teams.filter((t) => t.human);
const bots = g.teams.filter((t) => !t.human);
ok(humans.length === 2, `online humans ${humans.length}`);
ok(bots.length === 6, `online desk ${bots.length}`);
ok(
  bots.every((t) => GROK_BOTS.some((b) => b.manager === t.manager)),
  `online unknown ${bots.map((t) => t.manager).join(",")}`,
);
ok(g.teams.every((t) => spotsLeft(g.rosters[t.id]!) === 10), "rosters not empty at open");

for (let i = 0; i < 12 && !useGame.getState().block; i++) useGame.getState().cpuStep();
g = useGame.getState();
ok(g.block, "online: desk did not open a name — that's the freeze");
if (g.block) {
  const nom = g.teams.find((t) => t.id === g.block!.nominatorId);
  ok(!nom?.human, `online first nominator human ${nom?.name}`);
  console.log(`online block: ${getPlayer(g.block.playerId).name} by ${nom?.manager ?? nom?.name}`);
}

if (fail.length) {
  console.error("\nFAIL");
  for (const f of fail) console.error(" -", f);
  process.exit(1);
}
console.log("verify-auction ok — 7 solo / 6 with Cindy, desk opens the block.");
