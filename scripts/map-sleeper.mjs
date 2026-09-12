import { writeFileSync } from "node:fs";

const { PLAYERS } = await import("../src/game/players.ts");

const res = await fetch("https://api.sleeper.app/v1/players/nfl");
const all = await res.json();

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const byName = new Map();
for (const [id, p] of Object.entries(all)) {
  const n = p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`;
  const k = norm(n);
  if (!k) continue;
  const arr = byName.get(k) ?? [];
  arr.push(id);
  byName.set(k, arr);
}

const map = {};
const miss = [];
for (const pl of PLAYERS) {
  if (pl.pos === "DST") {
    map[pl.id] = "TEAM_" + pl.nfl;
    continue;
  }
  const ids = byName.get(norm(pl.name)) ?? [];
  let pick = ids[0];
  if (ids.length > 1) {
    pick = ids
      .map((id) => {
        const p = all[id];
        let s = 0;
        if (p.team === pl.nfl) s += 5;
        if (p.position === pl.pos) s += 3;
        if (p.active) s += 1;
        return { id, s };
      })
      .sort((a, b) => b.s - a.s)[0].id;
  }
  if (!pick) miss.push(pl.id + " " + pl.name);
  else map[pl.id] = pick;
}

writeFileSync("/tmp/sleeper-ids.json", JSON.stringify(map));
console.log(JSON.stringify({ n: Object.keys(map).length, miss, sample: { allen: map["qb-allen"], chase: map["wr-chase"] } }));
