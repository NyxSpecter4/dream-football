import { PLAYERS } from "./players";
import { SLEEPER_IDS } from "./sleeper-ids";
import type { Player, Position } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const POS_OF: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
  DST: "DST",
};
const CAP: Record<Position, number> = {
  QB: 28,
  RB: 48,
  WR: 64,
  TE: 22,
  K: 16,
  DST: 32,
};

type SleeperRow = {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  fantasy_positions?: string[];
  team?: string;
  status?: string;
  injury_status?: string | null;
  search_rank?: number;
  bye_week?: number;
  active?: boolean;
};

type FileCache = { at: number; rows: Record<string, SleeperRow> };
let fileCache: FileCache | null = null;
let inflight: Promise<Record<string, SleeperRow>> | null = null;

function posOf(row: SleeperRow): Position | null {
  const raw = row.position || row.fantasy_positions?.[0] || "";
  return POS_OF[raw] ?? null;
}

function displayName(row: SleeperRow, pos: Position, team: string) {
  if (pos === "DST") return row.last_name || row.full_name || team;
  return (row.full_name || `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()).trim();
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ovrFrom(pos: Position, proj: number, rank: number) {
  if (proj > 0) {
    const scale = pos === "QB" ? 3.1 : pos === "RB" || pos === "WR" ? 4.2 : pos === "TE" ? 5.4 : 6.2;
    return Math.max(62, Math.min(95, Math.round(58 + proj * scale)));
  }
  const r = rank > 0 && rank < 10_000 ? rank : 400;
  return Math.max(62, Math.min(86, Math.round(86 - r / 14)));
}

export async function loadSleeperPlayers(): Promise<Record<string, SleeperRow>> {
  if (fileCache && Date.now() - fileCache.at < DAY) return fileCache.rows;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch("https://api.sleeper.app/v1/players/nfl", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) throw new Error("sleeper players");
    const rows = (await res.json()) as Record<string, SleeperRow>;
    fileCache = { at: Date.now(), rows };
    return rows;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function sleeperIdFor(
  pl: Player,
  rows: Record<string, SleeperRow>,
): string | undefined {
  const known = SLEEPER_IDS[pl.id];
  if (known) return known;
  if (pl.id.startsWith("sl-")) return pl.id.slice(3);
  const want = norm(pl.name);
  const pos = pl.pos;
  for (const [id, row] of Object.entries(rows)) {
    const p = posOf(row);
    if (p !== pos) continue;
    const team = (row.team || (p === "DST" ? id : "")).toUpperCase();
    if (pl.nfl && team && team !== pl.nfl) continue;
    const name = norm(displayName(row, p, team));
    if (name && name === want) return id;
  }
  return undefined;
}

export function expandBoard(
  rows: Record<string, SleeperRow>,
  projs: Record<string, Record<string, unknown>>,
): Player[] {
  const taken = new Set(PLAYERS.map((p) => `${p.pos}:${norm(p.name)}`));
  const buckets: Record<Position, Player[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DST: [],
  };

  for (const [sid, row] of Object.entries(rows)) {
    const pos = posOf(row);
    if (!pos) continue;
    if (row.active === false) continue;
    const status = (row.status || "").toLowerCase();
    if (status === "retired" || status === "inactive") continue;
    const team = (row.team || (pos === "DST" ? sid : "")).toUpperCase();
    if (!team || team === "FA") continue;
    const name = displayName(row, pos, team);
    if (!name) continue;
    const key = `${pos}:${norm(name)}`;
    if (taken.has(key)) continue;
    const pj = projs[sid] ?? projs[sid.replace(/^TEAM_/, "")] ?? {};
    const proj = Number(pj.pts_ppr ?? pj.pts_std ?? 0) || 0;
    const rank = Number(row.search_rank) || 9999;
    if (pos !== "DST" && proj < 1.5 && rank > 350) continue;
    const id = `sl-${sid}`;
    buckets[pos].push({
      id,
      name,
      pos,
      nfl: team,
      bye: Number(row.bye_week) || 0,
      ovr: ovrFrom(pos, proj, rank),
      boom: 0.22,
      durability: row.injury_status ? 0.74 : 0.86,
    });
  }

  const extra: Player[] = [];
  (Object.keys(CAP) as Position[]).forEach((pos) => {
    extra.push(
      ...buckets[pos]
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, CAP[pos]),
    );
  });
  return extra;
}
