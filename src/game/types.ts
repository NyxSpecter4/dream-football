export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type Slot = "QB" | "RB1" | "RB2" | "WR1" | "WR2" | "TE" | "FLEX" | "K" | "DST";

export const STARTER_SLOTS: Slot[] = [
  "QB",
  "RB1",
  "RB2",
  "WR1",
  "WR2",
  "TE",
  "FLEX",
  "K",
  "DST",
];

export const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];

export const ROSTER_SIZE = 10;
export const TEAM_COUNT = 8;
/** 2026 NFL salary cap. Internal unit is $1,000. */
export const SALARY_CAP = 301_200;
/** 2026 rookie minimum. */
export const MIN_BID = 885;
/** Raise size — $100K. */
export const BID_STEP = 100;
export const HOUSE_CASH = 100_000;
/** Cap that must stay for each remaining skill hole. */
export const SKILL_RESERVE = 8_000;

export const FAAB_BUDGET = 100;
export const WAIVER_MAX = 3;

export type TradeOffer = {
  id: string;
  week: number;
  fromId: string;
  toId: string;
  giveId: string;
  getId: string;
  status: "open" | "done" | "dead";
};

export type SideBet = {
  id: string;
  week: number;
  fromId: string;
  toId: string;
  stake: number;
  status: "open" | "live" | "done" | "dead";
  winnerId: string | null;
};

export const REGULAR_WEEKS = 14;
export const PLAYOFF_WEEK = 15;
export const CHAMPIONSHIP_WEEK = 16;
export const TOTAL_WEEKS = 16;

export type Player = {
  id: string;
  name: string;
  pos: Position;
  nfl: string;
  bye: number;
  ovr: number;
  boom: number;
  durability: number;
  injury?: string;
};

export type JerseyId = "pine" | "steel" | "ember" | "midnight" | "bone" | "harbor";

export type LeagueTeam = {
  id: string;
  name: string;
  short: string;
  jersey: JerseyId;
  human: boolean;
  city: string;
  stadium: string;
  nfl: string;
  peerId?: string;
};

export type Lineup = Record<Slot, string | null>;

export type Roster = {
  lineup: Lineup;
  bench: string[];
};

export type Contract = {
  playerId: string;
  teamId: string;
  price: number;
};

export type BidEvent = {
  teamId: string;
  amount: number;
};

export type AuctionBlock = {
  playerId: string;
  nominatorId: string;
  highBid: number;
  highBidderId: string;
  passed: string[];
  going: number;
  waitingForHuman: boolean;
  log: BidEvent[];
};

export type WeekScores = Record<string, number>;

export type BoxScore = {
  teamId: string;
  opponentId: string;
  points: number;
  opponentPoints: number;
  playerPoints: WeekScores;
  won: boolean;
};

export type Matchup = {
  homeId: string;
  awayId: string;
};

export type Phase = "draft" | "offseason" | "regular" | "playoffs" | "complete";

export type Screen =
  | "title"
  | "setup"
  | "lobby"
  | "draft"
  | "offseason"
  | "home"
  | "roster"
  | "matchup"
  | "standings";

export type Career = {
  seasons: number;
  titles: number;
  bestFinish: number | null;
};

export type TickerState = {
  week: number;
  order: string[];
  index: number;
  revealed: Record<string, number>;
  homeId: string;
  awayId: string;
  done: boolean;
};

export type SaveState = {
  version: number;
  seasonSeed: number;
  week: number;
  phase: Phase;
  screen: Screen;
  playerTeamId: string;
  teams: LeagueTeam[];
  nominateIndex: number;
  contracts: Contract[];
  budgets: Record<string, number>;
  block: AuctionBlock | null;
  nominating: boolean;
  autoFill: boolean;
  pauseEvery: boolean;
  rosters: Record<string, Roster>;
  schedule: Matchup[][];
  results: Record<number, Record<string, BoxScore>>;
  playoffBracket: {
    semiA: Matchup;
    semiB: Matchup;
    final: Matchup | null;
    championId: string | null;
  } | null;
  waiverUsedWeek: number;
  waiverClaims: string[];
  faab: Record<string, number>;
  trades: TradeOffer[];
  cash: Record<string, number>;
  bets: SideBet[];
  mode: "solo" | "online";
  peerTeams: Record<string, string>;
  hostPeerId: string;
  nflWeekStart: number;
  seasonNo: number;
};
