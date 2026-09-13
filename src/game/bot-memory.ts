import type { Position } from "./types";
import { botByManager } from "./bots";
import { getPlayer } from "./players";
import { rosterPlayerIds } from "./league";
import { REGULAR_WEEKS, type LeagueTeam, type Roster, type BoxScore } from "./types";
import { standings } from "./simulate";

export type BotMem = {
  seasons: number;
  titles: number;
  wins: number;
  aggDelta: number;
  pos: Partial<Record<Position, number>>;
  lesson: string;
};

const KEY = "dream-football-desk";
const EMPTY: BotMem = { seasons: 0, titles: 0, wins: 0, aggDelta: 0, pos: {}, lesson: "" };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function loadDesk(): Record<string, BotMem> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BotMem>;
  } catch {
    return {};
  }
}

function saveDesk(map: Record<string, BotMem>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function memOf(manager: string): BotMem {
  return loadDesk()[manager] ?? { ...EMPTY };
}

export function deskAggression(manager: string | undefined, fallback: number) {
  if (!manager) return fallback;
  const bot = botByManager(manager);
  const mem = memOf(manager);
  return clamp((bot?.aggression ?? fallback) + mem.aggDelta, 0.8, 1.32);
}

export function deskPosBias(manager: string | undefined, pos: Position): number {
  if (!manager) return 1;
  const mem = memOf(manager);
  return clamp(mem.pos[pos] ?? 1, 0.72, 1.35);
}

/** After the title: bots remember who beat them and which positions died. */
export function learnSeason(
  teams: LeagueTeam[],
  results: Record<number, Record<string, BoxScore>>,
  championId: string,
  rosters: Record<string, Roster>,
) {
  const rows = standings(teams, results, REGULAR_WEEKS);
  const map = loadDesk();
  for (const t of teams) {
    if (t.human || !t.manager) continue;
    const row = rows.find((r) => r.teamId === t.id);
    const mem = map[t.manager] ?? { ...EMPTY };
    mem.seasons += 1;
    mem.wins += row?.wins ?? 0;
    if (championId === t.id) mem.titles += 1;
    const finish = rows.findIndex((r) => r.teamId === t.id) + 1;
    if (finish === 0) continue;
    if (finish > 4) mem.aggDelta = clamp(mem.aggDelta + 0.03, -0.12, 0.18);
    else if (finish === 1) mem.aggDelta = clamp(mem.aggDelta - 0.02, -0.12, 0.18);

    const ids = rosterPlayerIds(rosters[t.id]!);
    const byPos: Partial<Record<Position, number>> = {};
    const nPos: Partial<Record<Position, number>> = {};
    for (const id of ids) {
      const p = getPlayer(id);
      byPos[p.pos] = (byPos[p.pos] ?? 0) + p.ovr;
      nPos[p.pos] = (nPos[p.pos] ?? 0) + 1;
    }
    let weak: Position = "RB";
    let weakAvg = 99;
    for (const pos of ["RB", "WR", "QB", "TE"] as Position[]) {
      const n = nPos[pos] ?? 0;
      const avg = n ? (byPos[pos] ?? 0) / n : 0;
      if (avg < weakAvg) {
        weakAvg = avg;
        weak = pos;
      }
    }
    if (finish > 4) {
      mem.pos[weak] = clamp((mem.pos[weak] ?? 1) + 0.08, 0.72, 1.35);
      mem.lesson = `Missed the four. Next year I pay ${weak}.`;
    } else {
      mem.lesson = finish === 1 ? "Won it. Don't get cute." : "In the four. Stay boring.";
    }
    map[t.manager] = mem;
  }
  saveDesk(map);
}
