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
export const SALARY_CAP = 200;
export const MIN_BID = 1;
export const REGULAR_WEEKS = 7;
export const PLAYOFF_WEEK = 8;
export const CHAMPIONSHIP_WEEK = 9;
export const TOTAL_WEEKS = 9;

export type Player = {
  id: string;
  name: string;
  pos: Position;
  nfl: string;
  bye: number;
  ovr: number;
  boom: number;
  durability: number;
};

export type JerseyId = "pine" | "steel" | "ember" | "midnight" | "bone" | "harbor";

export type LeagueTeam = {
  id: string;
  name: string;
  short: string;
  jersey: JerseyId;
  human: boolean;
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

export type Phase = "draft" | "regular" | "playoffs" | "complete";

export type Screen =
  | "title"
  | "setup"
  | "lobby"
  | "draft"
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
  mode: "solo" | "online";
  peerTeams: Record<string, string>;
  hostPeerId: string;
};
