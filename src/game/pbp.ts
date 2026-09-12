import { PLAYERS } from "./players";
import { normAbbr } from "./nfl";
import type { WireInjury, WireSnap } from "./wire";

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown) {
  return typeof v === "string" ? v : "";
}
function num(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

const SKIP = new Set([
  "official timeout",
  "timeout",
  "two-minute warning",
  "two minute warning",
  "end period",
  "end of half",
  "end of game",
  "end of regulation",
  "coin toss",
  "delay of game",
]);

function kindOf(typeText: string, scoring: boolean, turnover: boolean): WireSnap["kind"] | null {
  const t = typeText.trim().toLowerCase();
  if (!t || SKIP.has(t)) return null;
  if (t.includes("kickoff")) return "kickoff";
  if (t.includes("punt")) return "punt";
  if (t.includes("field goal")) return "fg";
  if (t.includes("extra point") || t === "xp") return "xp";
  if (t.includes("sack")) return "sack";
  if (t.includes("kneel")) return "kneel";
  if (t.includes("scramble")) return "scramble";
  if (t.includes("incomplete")) return "incomplete";
  if (t.includes("interception")) return scoring ? "td" : "int";
  if (t.includes("fumble recovery (opponent)") || t.includes("fumble return")) return scoring ? "td" : "int";
  if (t.includes("touchdown") || scoring) return "td";
  if (t.includes("pass reception") || t.includes("pass complete") || t === "rec") return "catch";
  if (t.includes("pass") && turnover) return "int";
  if (t.includes("rush") || t.includes("run")) return "run";
  if (t.includes("penalty")) return null;
  if (turnover) return "int";
  return "run";
}

function clip(n: number) {
  return Math.max(1, Math.min(99, Math.round(n)));
}

function fieldSpot(poss: "home" | "away", yardsToEndzone: number) {
  const y = Number.isFinite(yardsToEndzone) ? yardsToEndzone : 50;
  return clip(poss === "home" ? 100 - y : y);
}

function possOf(teamId: string, homeId: string, awayId: string, fallback: "home" | "away"): "home" | "away" {
  if (teamId && teamId === homeId) return "home";
  if (teamId && teamId === awayId) return "away";
  return fallback;
}

function cleanCall(text: string) {
  return text
    .replace(/^\([^)]+\)\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

const NAME_RE = /\b([A-Z])\.([A-Z][A-Za-z']+(?:-[A-Z][A-Za-z]+)?)\b/g;

function namesIn(text: string): Array<{ initial: string; last: string }> {
  const out: Array<{ initial: string; last: string }> = [];
  const seen = new Set<string>();
  NAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAME_RE.exec(text))) {
    const initial = m[1]!;
    const last = m[2]!;
    const key = `${initial}.${last.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ initial, last });
  }
  return out;
}

function lastOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? name).replace(/\./g, "");
}

function matchName(initial: string, last: string, prefer: string[]): string | null {
  const lastKey = last.toLowerCase();
  const init = initial.toLowerCase();
  const pool = PLAYERS.filter((p) => p.pos !== "DST");
  const ranked = [...pool].sort((a, b) => {
    const ao = prefer.includes(a.nfl) ? 0 : 1;
    const bo = prefer.includes(b.nfl) ? 0 : 1;
    return ao - bo;
  });
  const hit = ranked.find((p) => {
    if (lastOf(p.name).toLowerCase() !== lastKey) return false;
    return p.name.trim()[0]?.toLowerCase() === init;
  });
  if (hit) return hit.id;
  const lastOnly = ranked.filter((p) => lastOf(p.name).toLowerCase() === lastKey);
  return lastOnly.length === 1 ? lastOnly[0]!.id : lastOnly.find((p) => prefer.includes(p.nfl))?.id ?? null;
}

function teamIdOf(rec: Record<string, unknown>): string {
  const team = asRec(rec.team);
  return str(team.id) || str(rec.id);
}

function teamAbbrOf(rec: Record<string, unknown>): string {
  const team = asRec(rec.team);
  return normAbbr(str(team.abbreviation) || str(rec.abbreviation));
}

export function parseEspnSummary(raw: unknown, homeAbbr: string, awayAbbr: string): {
  plays: WireSnap[];
  injuries: WireInjury[];
} {
  const d = asRec(raw);
  const header = asRec(d.header);
  const comps = Array.isArray(header.competitions) ? header.competitions : [];
  const comp = asRec(comps[0]);
  const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
  let homeId = "";
  let awayId = "";
  const idToAbbr: Record<string, string> = {};
  for (const row of competitors) {
    const r = asRec(row);
    const abbr = teamAbbrOf(r);
    const id = teamIdOf(r);
    if (!id) continue;
    idToAbbr[id] = abbr;
    if (str(r.homeAway) === "home") homeId = id;
    if (str(r.homeAway) === "away") awayId = id;
  }
  const home = normAbbr(homeAbbr);
  const away = normAbbr(awayAbbr);

  const drivesWrap = asRec(d.drives);
  const previous = Array.isArray(drivesWrap.previous) ? drivesWrap.previous : [];
  const current = drivesWrap.current ? [drivesWrap.current] : [];
  const drives = [...previous, ...current];

  const plays: WireSnap[] = [];
  let lastPoss: "home" | "away" = "away";

  for (const driveRaw of drives) {
    const drive = asRec(driveRaw);
    const driveAbbr = teamAbbrOf(drive);
    const driveId = teamIdOf(drive);
    if (driveId && driveAbbr) idToAbbr[driveId] = driveAbbr;
    const drivePoss: "home" | "away" =
      driveAbbr === home ? "home" : driveAbbr === away ? "away" : lastPoss;
    const rawPlays = Array.isArray(drive.plays) ? drive.plays : [];
    for (const playRaw of rawPlays) {
      const p = asRec(playRaw);
      const typeText = str(asRec(p.type).text);
      const kind = kindOf(typeText, Boolean(p.scoringPlay), Boolean(p.isTurnover));
      if (!kind) continue;
      const text = cleanCall(str(p.text));
      if (!text) continue;
      const start = asRec(p.start);
      const end = asRec(p.end);
      const startId = teamIdOf(start);
      const endId = teamIdOf(end);
      const startAbbr = idToAbbr[startId] ?? driveAbbr;
      const poss = possOf(startId, homeId, awayId, startAbbr === home ? "home" : startAbbr === away ? "away" : drivePoss);
      const endPoss = possOf(endId, homeId, awayId, poss);
      const from = fieldSpot(poss, num(start.yardsToEndzone) || num(start.yardLine));
      const toYte = num(end.yardsToEndzone);
      const to = kind === "td" || kind === "fg" || kind === "xp" ? (poss === "home" ? 99 : 1) : fieldSpot(endPoss, toYte || num(end.yardLine) || (100 - from));
      const quarter = Math.max(1, num(asRec(p.period).number) || 1);
      const clock = str(asRec(p.clock).displayValue) || "0:00";
      const down = Math.max(0, num(start.down));
      const toGo = Math.max(1, num(start.distance) || 10);
      const yards = num(p.statYardage);
      const names = namesIn(text);
      const prefer = poss === "home" ? [home, away] : [away, home];
      const defPrefer = poss === "home" ? [away, home] : [home, away];
      let playerId: string | null = null;
      let targetId: string | null = null;
      if (kind === "catch" || kind === "incomplete" || (kind === "td" && /pass/i.test(typeText))) {
        playerId = names[0] ? matchName(names[0].initial, names[0].last, prefer) : null;
        targetId = names[1] ? matchName(names[1].initial, names[1].last, prefer) : null;
      } else if (kind === "int") {
        playerId = names[0] ? matchName(names[0].initial, names[0].last, prefer) : null;
        targetId = names[1] ? matchName(names[1].initial, names[1].last, defPrefer) : null;
      } else {
        playerId = names[0] ? matchName(names[0].initial, names[0].last, prefer) : null;
        targetId = names[1] ? matchName(names[1].initial, names[1].last, prefer) : null;
      }
      plays.push({
        kind,
        call: text,
        clock: `Q${Math.min(4, quarter)} ${clock}`,
        quarter: Math.min(4, quarter),
        down,
        toGo,
        spot: from,
        from,
        to,
        yards,
        possession: poss,
        playerId,
        targetId,
        homeScore: num(p.homeScore),
        awayScore: num(p.awayScore),
      });
      lastPoss = endPoss;
    }
  }

  const injuries: WireInjury[] = [];
  const injBlocks = Array.isArray(d.injuries) ? d.injuries : [];
  for (const block of injBlocks) {
    const b = asRec(block);
    const team = teamAbbrOf(b);
    const rows = Array.isArray(b.injuries) ? b.injuries : [];
    for (const row of rows) {
      const r = asRec(row);
      const athlete = asRec(r.athlete);
      const status = asRec(r.status);
      const name = str(athlete.displayName) || str(r.displayName);
      const tag = str(status.abbreviation) || str(status.name) || str(r.status);
      if (!name || !tag) continue;
      injuries.push({ team: team || home, name, status: tag });
      if (injuries.length >= 8) break;
    }
    if (injuries.length >= 8) break;
  }

  return { plays, injuries };
}
