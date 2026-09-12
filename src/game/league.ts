import {
  CHAMPIONSHIP_WEEK,
  FLEX_POSITIONS,
  PLAYOFF_WEEK,
  REGULAR_WEEKS,
  STARTER_SLOTS,
  TEAM_COUNT,
  type JerseyId,
  type LeagueTeam,
  type Lineup,
  type Matchup,
  type Phase,
  type Player,
  type Position,
  type Roster,
  type Slot,
} from "./types";
import { getPlayer } from "./players";
import { shuffle } from "./rng";

export const CPU_TEAMS: Array<Omit<LeagueTeam, "id" | "human">> = [
  { name: "Harbor Wolves", short: "HRB", jersey: "harbor" },
  { name: "Iron Ridge", short: "IRN", jersey: "steel" },
  { name: "Dust Devils", short: "DST", jersey: "ember" },
  { name: "Lake Effect", short: "LKE", jersey: "midnight" },
  { name: "Redline", short: "RED", jersey: "ember" },
  { name: "North Pine", short: "PIN", jersey: "pine" },
  { name: "Metro Kings", short: "MTR", jersey: "bone" },
];

export const JERSEYS: Array<{ id: JerseyId; label: string }> = [
  { id: "pine", label: "Pine" },
  { id: "steel", label: "Steel" },
  { id: "ember", label: "Ember" },
  { id: "midnight", label: "Midnight" },
  { id: "bone", label: "Bone" },
  { id: "harbor", label: "Harbor" },
];

export function emptyLineup(): Lineup {
  return {
    QB: null,
    RB1: null,
    RB2: null,
    WR1: null,
    WR2: null,
    TE: null,
    FLEX: null,
    K: null,
    DST: null,
  };
}

export function emptyRoster(): Roster {
  return { lineup: emptyLineup(), bench: [] };
}

export function rosterPlayerIds(roster: Roster): string[] {
  const starters = STARTER_SLOTS.map((s) => roster.lineup[s]).filter(
    (id): id is string => Boolean(id),
  );
  return [...starters, ...roster.bench];
}

export function slotAccepts(slot: Slot, pos: Position): boolean {
  if (slot === "FLEX") return FLEX_POSITIONS.includes(pos);
  if (slot === "RB1" || slot === "RB2") return pos === "RB";
  if (slot === "WR1" || slot === "WR2") return pos === "WR";
  return slot === pos;
}

export function preferredSlot(pos: Position, lineup: Lineup): Slot | "BENCH" {
  const order: Slot[] =
    pos === "RB"
      ? ["RB1", "RB2", "FLEX"]
      : pos === "WR"
        ? ["WR1", "WR2", "FLEX"]
        : pos === "TE"
          ? ["TE", "FLEX"]
          : pos === "QB"
            ? ["QB"]
            : pos === "K"
              ? ["K"]
              : ["DST"];
  for (const slot of order) {
    if (!lineup[slot]) return slot;
  }
  return "BENCH";
}

export function placePlayer(roster: Roster, playerId: string): Roster {
  const player = getPlayer(playerId);
  const slot = preferredSlot(player.pos, roster.lineup);
  if (slot === "BENCH") {
    return { ...roster, bench: [...roster.bench, playerId] };
  }
  return {
    lineup: { ...roster.lineup, [slot]: playerId },
    bench: roster.bench,
  };
}

export function dropPlayer(roster: Roster, playerId: string): Roster {
  const next: Roster = {
    lineup: { ...roster.lineup },
    bench: roster.bench.filter((id) => id !== playerId),
  };
  for (const slot of STARTER_SLOTS) {
    if (next.lineup[slot] === playerId) next.lineup[slot] = null;
  }
  return next;
}

export function swapLineup(roster: Roster, slot: Slot, benchId: string): Roster | null {
  const starterId = roster.lineup[slot];
  const benchPlayer = getPlayer(benchId);
  if (!slotAccepts(slot, benchPlayer.pos)) return null;
  const bench = roster.bench.filter((id) => id !== benchId);
  if (starterId) bench.push(starterId);
  return {
    lineup: { ...roster.lineup, [slot]: benchId },
    bench,
  };
}

export function moveStarterToBench(roster: Roster, slot: Slot): Roster | null {
  const id = roster.lineup[slot];
  if (!id) return null;
  return {
    lineup: { ...roster.lineup, [slot]: null },
    bench: [...roster.bench, id],
  };
}

export function autoSetLineup(roster: Roster, week: number, rank: (id: string) => number): Roster {
  const ids = rosterPlayerIds(roster);
  const available = ids
    .map((id) => getPlayer(id))
    .filter((pl) => pl.bye !== week)
    .sort((a, b) => rank(b.id) - rank(a.id));

  const used = new Set<string>();
  const lineup = emptyLineup();

  const take = (pred: (p: Player) => boolean): string | null => {
    const found = available.find((pl) => !used.has(pl.id) && pred(pl));
    if (!found) return null;
    used.add(found.id);
    return found.id;
  };

  lineup.QB = take((pl) => pl.pos === "QB");
  lineup.RB1 = take((pl) => pl.pos === "RB");
  lineup.RB2 = take((pl) => pl.pos === "RB");
  lineup.WR1 = take((pl) => pl.pos === "WR");
  lineup.WR2 = take((pl) => pl.pos === "WR");
  lineup.TE = take((pl) => pl.pos === "TE");
  lineup.FLEX = take((pl) => FLEX_POSITIONS.includes(pl.pos));
  lineup.K = take((pl) => pl.pos === "K");
  lineup.DST = take((pl) => pl.pos === "DST");

  const bench = ids.filter((id) => !used.has(id));
  return { lineup, bench };
}

export function roundRobin(teamIds: string[]): Matchup[][] {
  const ids = teamIds.slice();
  if (ids.length % 2 === 1) ids.push("BYE");
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const weeks: Matchup[][] = [];
  const circle = ids.slice(1);

  for (let round = 0; round < rounds; round++) {
    const pairings: Matchup[] = [];
    const current = [ids[0]!, ...circle];
    for (let i = 0; i < half; i++) {
      const a = current[i]!;
      const b = current[n - 1 - i]!;
      if (a !== "BYE" && b !== "BYE") {
        pairings.push(round % 2 === 0 ? { homeId: a, awayId: b } : { homeId: b, awayId: a });
      }
    }
    weeks.push(pairings);
    circle.unshift(circle.pop()!);
  }
  return weeks;
}

/** 8 clubs, each other twice — 14 regular weeks. */
export function seasonSchedule(teamIds: string[]): Matchup[][] {
  const first = roundRobin(teamIds);
  const second = first.map((week) =>
    week.map((m) => ({ homeId: m.awayId, awayId: m.homeId })),
  );
  return [...first, ...second];
}

export function buildLeague(
  humanName: string,
  humanShort: string,
  jersey: JerseyId,
  rand: () => number,
): LeagueTeam[] {
  const cpus = shuffle(CPU_TEAMS, rand).slice(0, TEAM_COUNT - 1);
  const human: LeagueTeam = {
    id: "you",
    name: humanName.trim() || "Night Hawks",
    short: (humanShort.trim() || "NGT").slice(0, 4).toUpperCase(),
    jersey,
    human: true,
  };
  const others: LeagueTeam[] = cpus.map((t, i) => ({
    ...t,
    id: `cpu-${i}`,
    human: false,
  }));
  return [human, ...others];
}

export function buildOnlineLeague(
  humans: Array<{ peerId: string; name: string; short: string; jersey: JerseyId }>,
  rand: () => number,
): LeagueTeam[] {
  const seats = humans.slice(0, TEAM_COUNT).map((h) => ({
    id: `h-${h.peerId}`,
    name: h.name.trim() || "Night Hawks",
    short: (h.short.trim() || "NGT").slice(0, 4).toUpperCase(),
    jersey: h.jersey,
    human: true,
    peerId: h.peerId,
  }));
  const cpuNeed = Math.max(0, TEAM_COUNT - seats.length);
  const cpus = shuffle(CPU_TEAMS, rand)
    .slice(0, cpuNeed)
    .map((t, i) => ({
      ...t,
      id: `cpu-${i}`,
      human: false,
    }));
  return [...seats, ...cpus];
}

export function slotLabel(slot: Slot): string {
  if (slot === "RB1" || slot === "RB2") return "RB";
  if (slot === "WR1" || slot === "WR2") return "WR";
  return slot;
}

export function teamById(teams: LeagueTeam[], id: string): LeagueTeam {
  const t = teams.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

export function opponentOf(
  you: string,
  week: number,
  phase: Phase,
  schedule: Matchup[][],
  bracket: {
    semiA: Matchup;
    semiB: Matchup;
    final: Matchup | null;
    championId: string | null;
  } | null,
): string | null {
  if (phase === "complete") return null;
  if (week <= REGULAR_WEEKS) {
    const m = (schedule[week - 1] ?? []).find((x) => x.homeId === you || x.awayId === you);
    return m ? (m.homeId === you ? m.awayId : m.homeId) : null;
  }
  if (week === PLAYOFF_WEEK && bracket) {
    const m = [bracket.semiA, bracket.semiB].find((x) => x.homeId === you || x.awayId === you);
    return m ? (m.homeId === you ? m.awayId : m.homeId) : null;
  }
  if (week === CHAMPIONSHIP_WEEK && bracket?.final) {
    const m = bracket.final;
    if (m.homeId === you || m.awayId === you) return m.homeId === you ? m.awayId : m.homeId;
  }
  return null;
}
