import type { WireGame } from "./wire";
import { normAbbr } from "./nfl";

/** Standard PPR — same math Sleeper and ESPN PPR use. */
export const PPR_RULES = [
  { k: "Pass", v: "25 yds = 1 · TD = 4 · INT = −2" },
  { k: "Rush", v: "10 yds = 1 · TD = 6" },
  { k: "Rec", v: "catch = 1 · 10 yds = 1 · TD = 6" },
  { k: "Kick", v: "FG 3 · XP 1" },
  { k: "DST", v: "sack / TO / points allowed" },
];

export function gameForTeam(games: WireGame[], abbr: string): WireGame | null {
  const id = normAbbr(abbr);
  return (
    games.find((g) => normAbbr(g.homeAbbr) === id || normAbbr(g.awayAbbr) === id) ?? null
  );
}

export function weekLocked(games: WireGame[] | undefined): boolean {
  if (!games || games.length === 0) return false;
  return games.every((g) => g.state === "final");
}

/** This week's NFL card for a club — `@ LAC` / `vs MIN`. */
export function nflContext(abbr: string, games: WireGame[] | undefined) {
  const g = games ? gameForTeam(games, abbr) : null;
  if (!g) return null;
  const home = normAbbr(g.homeAbbr) === normAbbr(abbr);
  const opp = home ? normAbbr(g.awayAbbr) : normAbbr(g.homeAbbr);
  return {
    opp,
    home,
    state: g.state,
    clock: g.clock,
    line: home ? `vs ${opp}` : `@ ${opp}`,
  };
}
