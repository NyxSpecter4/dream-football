import { useEffect, useRef, useState } from "react";
import type { StatBox } from "./box";
import { adoptBoard, getPlayer } from "./players";
import type { Player } from "./types";
import { normAbbr } from "./nfl";

export type WireSnap = {
  kind:
    | "kickoff"
    | "run"
    | "pass"
    | "catch"
    | "incomplete"
    | "sack"
    | "scramble"
    | "int"
    | "punt"
    | "fg"
    | "xp"
    | "td"
    | "kneel"
    | "also";
  call: string;
  clock: string;
  quarter: number;
  down: number;
  toGo: number;
  spot: number;
  from: number;
  to: number;
  yards: number;
  possession: "home" | "away";
  playerId: string | null;
  targetId: string | null;
  homeScore: number;
  awayScore: number;
};

export type WireInjury = {
  team: string;
  name: string;
  status: string;
};

export type WireGame = {
  id: string;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number;
  awayScore: number;
  state: "live" | "final" | "soon";
  clock: string;
  detail: string;
  plays?: WireSnap[];
  injuries?: WireInjury[];
};

export type WireNews = {
  title: string;
  blurb: string;
  source: "espn" | "yahoo";
};

export type WireStat = {
  pts: number;
  proj: number;
  line: string;
  done: boolean;
  state: "live" | "final" | "soon" | "bye";
  box?: StatBox;
};

export type WirePayload = {
  season: number;
  week: number;
  games: WireGame[];
  news: WireNews[];
  stats: Record<string, WireStat>;
  board?: Player[];
  trending?: Array<{ id: string; count: number }>;
  updated: number;
};

export function hasTape(game: WireGame | null | undefined): boolean {
  return Boolean(game?.plays && game.plays.length >= 2);
}

export function pickWireFeatured(games: WireGame[]): WireGame | null {
  if (games.length === 0) return null;
  return (
    games.find((g) => g.state === "live") ??
    games.find((g) => g.state === "final" && hasTape(g)) ??
    games.find((g) => g.state === "soon") ??
    games[0] ??
    null
  );
}

export function pickWireForOwned(games: WireGame[], ownedIds: string[]): WireGame | null {
  const teams = new Set(ownedIds.map((id) => getPlayer(id).nfl));
  const hits = games.filter(
    (g) => teams.has(normAbbr(g.homeAbbr)) || teams.has(normAbbr(g.awayAbbr)),
  );
  return pickWireFeatured(hits) ?? pickWireFeatured(games);
}

export function watchPool(games: WireGame[]): WireGame[] {
  const live = games.filter((g) => g.state === "live");
  if (live.length) return live;
  const tape = games.filter((g) => g.state === "final" && hasTape(g));
  if (tape.length) return tape;
  const soon = games.filter((g) => g.state === "soon");
  if (soon.length) return soon;
  return games;
}

export function useWire() {
  const [data, setData] = useState<WirePayload | null>(null);
  const [fail, setFail] = useState(false);
  const hotRef = useRef(false);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const load = async () => {
      try {
        const res = await fetch("/api/nfl", { cache: "no-store" });
        if (!res.ok) throw new Error("wire");
        const json = (await res.json()) as WirePayload;
        if (!stop) {
          if (json.board?.length) adoptBoard(json.board);
          setData(json);
          setFail(false);
          hotRef.current = json.games.some((g) => g.state === "live");
        }
      } catch {
        if (!stop) setFail(true);
      }
    };
    const tick = () => {
      void load().finally(() => {
        if (stop) return;
        timer = window.setTimeout(tick, hotRef.current ? 8000 : 20000);
      });
    };
    tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, []);

  return { data, fail };
}
