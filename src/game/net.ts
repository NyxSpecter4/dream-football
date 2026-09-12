import type { AuctionBlock, JerseyId, SaveState, Slot } from "./types";
import { spotsLeft, maxAffordable } from "./draft";

export type RemoteAct =
  | { k: "nominate"; playerId: string }
  | { k: "bid"; amount: number }
  | { k: "pass" }
  | { k: "fillRest" }
  | { k: "swap"; slot: Slot; benchId: string }
  | { k: "playWeek" }
  | { k: "closeTicker" }
  | { k: "claimWaiver"; addId: string; dropId: string }
  | { k: "skipWaiver" }
  | { k: "bet"; toId: string; stake: number }
  | { k: "takeBet"; id: string }
  | { k: "passBet"; id: string };

export type NetMsg =
  | { t: "hello"; name: string; short: string; jersey: JerseyId; host?: boolean }
  | { t: "act"; act: RemoteAct }
  | {
      t: "sync";
      save: SaveState;
      lastSold: { playerId: string; teamId: string; price: number } | null;
    }
  | { t: "start" };

export type LobbyIdentity = {
  name: string;
  short: string;
  jersey: JerseyId;
};

export type MeshPeer = {
  id: string;
  name: string;
  connectionState: string;
  rttMs: number | null;
};

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function canTeamBid(s: SaveState, teamId: string, live: AuctionBlock): boolean {
  if (live.passed.includes(teamId)) return false;
  const roster = s.rosters[teamId];
  if (!roster) return false;
  const spots = spotsLeft(roster);
  if (spots <= 0) return false;
  const cap = maxAffordable(s.budgets[teamId] ?? 0, spots);
  if (cap <= live.highBid) return false;
  if (live.highBidderId === teamId) return false;
  return true;
}

export function anyHumanCanBid(s: SaveState, live: AuctionBlock, liveTeamIds?: Set<string>): boolean {
  return s.teams.some((t) => {
    if (!t.human) return false;
    if (liveTeamIds && !liveTeamIds.has(t.id)) return false;
    return canTeamBid(s, t.id, live);
  });
}

export function pickSave(s: SaveState): SaveState {
  return {
    version: s.version,
    seasonSeed: s.seasonSeed,
    week: s.week,
    phase: s.phase,
    screen: s.screen,
    playerTeamId: s.playerTeamId,
    teams: s.teams,
    nominateIndex: s.nominateIndex,
    contracts: s.contracts,
    budgets: s.budgets,
    block: s.block,
    nominating: s.nominating,
    autoFill: s.autoFill,
    pauseEvery: s.pauseEvery,
    rosters: s.rosters,
    schedule: s.schedule,
    results: s.results,
    playoffBracket: s.playoffBracket,
    waiverUsedWeek: s.waiverUsedWeek,
    waiverClaims: s.waiverClaims,
    cash: s.cash,
    bets: s.bets,
    mode: s.mode,
    peerTeams: s.peerTeams,
    hostPeerId: s.hostPeerId,
    nflWeekStart: s.nflWeekStart ?? 1,
  };
}

export function newRoomCode() {
  let out = "";
  for (let i = 0; i < 4; i++) out += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  return out;
}

export function parseRoomCode(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = compact.startsWith("NL") ? compact.slice(2) : compact;
  if (code.length !== 4) return null;
  return code;
}

export function isLiveShareHost(
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
) {
  const h = hostname.toLowerCase();
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return false;
  if (h === "grok-sandbox.com" || h.endsWith(".grok-sandbox.com")) return false;
  return true;
}

export function roomShareUrl(code: string): string | null {
  if (typeof window === "undefined" || !isLiveShareHost()) return null;
  const path = window.location.pathname.replace(/\/$/, "");
  return `${window.location.origin}${path === "/" ? "" : path}?room=${code}`;
}

export function p2pRoomId(code: string) {
  return `nl-${code}`;
}


export function asNetMsg(data: unknown): NetMsg | null {
  if (!data || typeof data !== "object") return null;
  const t = (data as { t?: unknown }).t;
  if (t === "hello" || t === "act" || t === "sync" || t === "start") return data as NetMsg;
  return null;
}

const JERSEYS: JerseyId[] = ["pine", "steel", "ember", "midnight", "bone", "harbor"];

export function asJersey(v: unknown): JerseyId {
  return JERSEYS.includes(v as JerseyId) ? (v as JerseyId) : "pine";
}
