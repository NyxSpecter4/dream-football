import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CHAMPIONSHIP_WEEK,
  BID_STEP,
  HOUSE_CASH,
  MIN_BID,
  PLAYOFF_WEEK,
  REGULAR_WEEKS,
  ROSTER_SIZE,
  SALARY_CAP,
  FAAB_BUDGET,
  WAIVER_MAX,
  STARTER_SLOTS,
  type Career,
  type Contract,
  type JerseyId,
  type Matchup,
  type Phase,
  type SaveState,
  type Screen,
  type Slot,
  type TickerState,
  type TradeOffer,
} from "./types";
import { emptyRoster, placePlayer, dropPlayer, swapLineup, autoSetLineup, buildLeague, buildOnlineLeague, seasonSchedule, rosterPlayerIds, ensureClubHomes, toIr, fromIr } from "./league";
import {
  availablePlayers,
  cpuMaxBid,
  cpuNominate,
  fillUnfinishedRosters,
  maxAffordable,
  nextCpuRaise,
  nextNominator,
  openBlock,
  rankPlayer,
  shouldPauseForHuman,
  spotsLeft,
} from "./draft";
import { hashSeed, mulberry32 } from "./rng";
import {
  freeAgents,
  ownedSet,
  playoffSeeds,
  remainingValue,
  simulateMatchups,
  standings,
} from "./simulate";
import { adoptBoard, getPlayer } from "./players";
import { calendarNight } from "./nfl";
import { autoTakeCpu, canStake, newBetId, settleWeek } from "./cash";
import { capSpace, cpuRefresh, cutPlayerFromClub } from "./franchise";
import { anyHumanCanBid, type LobbyIdentity, type MeshPeer, type RemoteAct } from "./net";
import type { WireGame, WireStat } from "./wire";

const SAVE_VERSION = 12;
const CAREER_KEY = "night-league-career";
let remoteApplying = false;
let lastSoloPersist: Record<string, unknown> | null = null;

function loadCareer(): Career {
  if (typeof window === "undefined") return { seasons: 0, titles: 0, bestFinish: null };
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) return { seasons: 0, titles: 0, bestFinish: null };
    const parsed = JSON.parse(raw) as Career;
    return {
      seasons: parsed.seasons ?? 0,
      titles: parsed.titles ?? 0,
      bestFinish: parsed.bestFinish ?? null,
    };
  } catch {
    return { seasons: 0, titles: 0, bestFinish: null };
  }
}

function saveCareer(career: Career) {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(career));
  } catch {
    /* ignore quota */
  }
}

function scaleMoneyMap(m: Record<string, number>, k: number) {
  const out: Record<string, number> = {};
  for (const id of Object.keys(m ?? {})) out[id] = (m[id] ?? 0) * k;
  return out;
}

function emptySave(): SaveState {
  return {
    version: SAVE_VERSION,
    seasonSeed: 1,
    week: 1,
    phase: "draft",
    screen: "title",
    playerTeamId: "you",
    teams: [],
    nominateIndex: 0,
    contracts: [],
    budgets: {},
    block: null,
    nominating: false,
    autoFill: false,
    pauseEvery: false,
    rosters: {},
    schedule: [],
    results: {},
    playoffBracket: null,
    waiverUsedWeek: 0,
    waiverClaims: [],
    faab: {},
    trades: [],
    cash: {},
    bets: [],
    mode: "solo",
    peerTeams: {},
    hostPeerId: "",
    nflWeekStart: 1,
    seasonNo: 1,
  };
}

function aggressionMap(teams: SaveState["teams"], seed: number): Record<string, number> {
  const rand = mulberry32(hashSeed(seed, "agg"));
  const map: Record<string, number> = {};
  for (const t of teams) {
    map[t.id] = t.human ? 1 : 0.88 + rand() * 0.34;
  }
  return map;
}

function ownedFromRosters(rosters: SaveState["rosters"]): Set<string> {
  return ownedSet(rosters);
}

function finishDraft(s: SaveState): Partial<SaveState> {
  const filled = fillUnfinishedRosters(s.teams, s.rosters, s.budgets, s.contracts);
  const ids = s.teams.map((t) => t.id);
  return {
    phase: "regular",
    screen: "home",
    week: 1,
    block: null,
    nominating: false,
    autoFill: false,
    schedule: seasonSchedule(ids),
    rosters: filled.rosters,
    budgets: filled.budgets,
    contracts: filled.contracts,
  };
}

type GameStore = SaveState & {
  hydrated: boolean;
  career: Career;
  ticker: TickerState | null;
  lastSold: { playerId: string; teamId: string; price: number } | null;
  online: boolean;
  isHost: boolean;
  localPeerId: string;
  roomCode: string;
  applyingRemote: boolean;
  sendAction: ((act: RemoteAct) => void) | null;
  onlineIdentity: LobbyIdentity | null;
  lobbySeats: Record<string, LobbyIdentity>;
  mesh: { joined: boolean; peers: MeshPeer[] };
  lateJoinBlocked: boolean;
  watchNight: { seed: number; week: number } | null;
  chatLog: Array<{ id: string; name: string; text: string; at: number }>;
  setHydrated: () => void;
  setScreen: (screen: Screen) => void;
  startSetup: () => void;
  startSeason: (name: string, short: string, jersey: JerseyId, city?: string, stadium?: string) => void;
  startOnlineSeason: (
    humans: Array<{ peerId: string; name: string; short: string; jersey: JerseyId; city?: string; stadium?: string }>,
    hostPeerId: string,
    localPeerId: string,
  ) => void;
  nominate: (playerId: string, teamId?: string) => void;
  bid: (amount: number, teamId?: string) => void;
  pass: (teamId?: string) => void;
  cpuStep: () => void;
  setPauseEvery: (v: boolean) => void;
  setAutoFill: (v: boolean) => void;
  fillRest: (teamId?: string) => void;
  keepClub: () => void;
  cutKeep: (playerId: string) => void;
  openNextSeason: () => void;
  swapSlot: (slot: Slot, benchId: string, teamId?: string) => void;
  playWeek: () => Promise<void>;
  tickReveal: () => void;
  skipTicker: () => void;
  closeTicker: () => void;
  claimWaiver: (addId: string, dropId: string, teamId?: string) => void;
  skipWaiver: (teamId?: string) => void;
  sendToIr: (playerId: string, teamId?: string) => void;
  activateIr: (playerId: string, teamId?: string) => void;
  sendChat: (text: string, teamId?: string) => void;
  pushChat: (name: string, text: string) => void;
  offerTrade: (toId: string, giveId: string, getId: string, teamId?: string) => void;
  takeTrade: (id: string, teamId?: string) => void;
  passTrade: (id: string, teamId?: string) => void;
  offerBet: (toId: string, stake: number, teamId?: string) => void;
  takeBet: (id: string, teamId?: string) => void;
  passBet: (id: string, teamId?: string) => void;
  resetSeason: () => void;
  enterOnline: (roomCode: string, localPeerId: string, isHost: boolean) => void;
  leaveOnline: () => void;
  setSendAction: (fn: ((act: RemoteAct) => void) | null) => void;
  setLocalPeerId: (id: string) => void;
  setOnlineIdentity: (id: LobbyIdentity) => void;
  upsertLobbySeat: (peerId: string, ident: LobbyIdentity) => void;
  noteHost: (peerId: string) => void;
  setMesh: (mesh: { joined: boolean; peers: MeshPeer[] }) => void;
  applySync: (
    save: SaveState,
    lastSold: { playerId: string; teamId: string; price: number } | null,
  ) => void;
  applyRemote: (fromPeerId: string, act: RemoteAct) => void;
  startWatchNight: () => void;
  reshuffleWatchNight: () => void;
  endWatchNight: () => void;
};

function guestSend(get: () => GameStore, act: RemoteAct): boolean {
  if (remoteApplying) return false;
  const s = get();
  if (s.online && !s.isHost && s.sendAction) {
    s.sendAction(act);
    return true;
  }
  return false;
}

function liveHumanTeamIds(s: GameStore): Set<string> {
  const live = new Set<string>();
  for (const t of s.teams) {
    if (!t.human) continue;
    if (!s.online) {
      live.add(t.id);
      continue;
    }
    if (t.peerId === s.localPeerId || t.id === s.playerTeamId) live.add(t.id);
    else if (
      t.peerId &&
      s.mesh.peers.some((p) => p.id === t.peerId && p.connectionState === "connected")
    ) {
      live.add(t.id);
    }
  }
  return live;
}

function offlineFields() {
  return {
    online: false,
    isHost: false,
    localPeerId: "",
    roomCode: "",
    sendAction: null as ((act: RemoteAct) => void) | null,
    onlineIdentity: null as LobbyIdentity | null,
    lobbySeats: {} as Record<string, LobbyIdentity>,
    mesh: { joined: false, peers: [] as MeshPeer[] },
    lateJoinBlocked: false,
  };
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      ...emptySave(),
      hydrated: false,
      career: { seasons: 0, titles: 0, bestFinish: null },
      ticker: null,
      lastSold: null,
      applyingRemote: false,
      watchNight: null,
      chatLog: [],
      ...offlineFields(),

      setHydrated: () => {
        const s = get();
        if (s.online || s.screen === "lobby") {
          set({ hydrated: true, career: loadCareer() });
          return;
        }
        const teamOk = s.teams.some((t) => t.id === s.playerTeamId);
        if (s.mode === "online" || !teamOk) {
          set({
            ...emptySave(),
            hydrated: true,
            career: loadCareer(),
            screen: "title",
            ...offlineFields(),
          });
          return;
        }
        if (s.version !== SAVE_VERSION) {
          const staleCap = Object.values(s.budgets).some((n) => n > 0 && n <= 2500);
          if (!staleCap && (s.version === 6 || s.version === 7 || s.version === 8 || s.version === 9) && teamOk) {
            const k = s.version === 8 || s.version === 9 ? 1 : 1000;
            const block =
              k === 1
                ? s.block
                : s.block
                  ? {
                      ...s.block,
                      highBid: s.block.highBid * k,
                      log: s.block.log.map((b) => ({ ...b, amount: b.amount * k })),
                    }
                  : null;
            set({
              hydrated: true,
              career: loadCareer(),
              version: SAVE_VERSION,
              seasonNo: s.seasonNo ?? 1,
              teams: ensureClubHomes(s.teams),
              budgets: k === 1 ? s.budgets : scaleMoneyMap(s.budgets, k),
              cash: k === 1 ? s.cash : scaleMoneyMap(s.cash ?? {}, k),
              contracts: k === 1 ? s.contracts : s.contracts.map((c) => ({ ...c, price: c.price * k })),
              bets: k === 1 ? s.bets : (s.bets ?? []).map((b) => ({ ...b, stake: b.stake * k })),
              block,
            });
            return;
          }
          set({
            ...emptySave(),
            hydrated: true,
            career: loadCareer(),
            screen: "title",
            ...offlineFields(),
          });
          return;
        }
        set({ hydrated: true, career: loadCareer(), teams: ensureClubHomes(s.teams) });
      },
      setScreen: (screen) => set({ screen }),
      startSetup: () => set({ screen: "setup" }),

      startSeason: (name, short, jersey, city, stadium) => {
        const seasonSeed = (Math.floor(Math.random() * 1e9) + Date.now()) >>> 0;
        const rand = mulberry32(seasonSeed);
        const teams = buildLeague(name, short, jersey, rand, city, stadium);
        const rosters: SaveState["rosters"] = {};
        const budgets: Record<string, number> = {};
        const cash: Record<string, number> = {};
        const faab: Record<string, number> = {};
        for (const t of teams) {
          rosters[t.id] = emptyRoster();
          budgets[t.id] = SALARY_CAP;
          cash[t.id] = HOUSE_CASH;
          faab[t.id] = FAAB_BUDGET;
        }
        const boot = () =>
          set({
            ...emptySave(),
            seasonSeed,
            teams,
            rosters,
            budgets,
            cash,
            faab,
            screen: "draft",
            phase: "draft",
            career: get().career,
            hydrated: true,
            mode: "solo",
            ...offlineFields(),
          });
        boot();
        void fetch("/api/nfl", { cache: "no-store" })
          .then((r) => r.json())
          .then((d: { week?: number; board?: import("./types").Player[] }) => {
            if (d.board?.length) adoptBoard(d.board);
            if (d.week) set({ nflWeekStart: d.week });
          })
          .catch(() => undefined);
      },

      startOnlineSeason: (humans, hostPeerId, localPeerId) => {
        const seasonSeed = (Math.floor(Math.random() * 1e9) + Date.now()) >>> 0;
        const rand = mulberry32(seasonSeed);
        const teams = buildOnlineLeague(humans, rand);
        const peerTeams: Record<string, string> = {};
        for (const t of teams) {
          if (t.peerId) peerTeams[t.peerId] = t.id;
        }
        const rosters: SaveState["rosters"] = {};
        const budgets: Record<string, number> = {};
        const cash: Record<string, number> = {};
        const faab: Record<string, number> = {};
        for (const t of teams) {
          rosters[t.id] = emptyRoster();
          budgets[t.id] = SALARY_CAP;
          cash[t.id] = HOUSE_CASH;
          faab[t.id] = FAAB_BUDGET;
        }
        const myTeam = peerTeams[localPeerId] ?? teams[0]!.id;
        const boot = () =>
          set({
            ...emptySave(),
            seasonSeed,
            teams,
            rosters,
            budgets,
            cash,
            faab,
            screen: "draft",
            phase: "draft",
            playerTeamId: myTeam,
            peerTeams,
            hostPeerId,
            mode: "online",
            pauseEvery: true,
            career: get().career,
            hydrated: true,
            online: true,
            isHost: localPeerId === hostPeerId,
            localPeerId,
            roomCode: get().roomCode,
            sendAction: get().sendAction,
            onlineIdentity: get().onlineIdentity,
            lobbySeats: get().lobbySeats,
            mesh: get().mesh,
            lateJoinBlocked: false,
          });
        boot();
        void fetch("/api/nfl", { cache: "no-store" })
          .then((r) => r.json())
          .then((d: { week?: number; board?: import("./types").Player[] }) => {
            if (d.board?.length) adoptBoard(d.board);
            if (d.week) set({ nflWeekStart: d.week });
          })
          .catch(() => undefined);
      },

      nominate: (playerId, teamId) => {
        if (guestSend(get, { k: "nominate", playerId })) return;
        const s = get();
        if (s.block || s.phase !== "draft") return;
        const actor = teamId ?? s.playerTeamId;
        const nom = nextNominator(
          s.teams.map((t) => t.id),
          s.rosters,
          s.nominateIndex,
        );
        if (!nom || nom.teamId !== actor) return;
        const owned = ownedFromRosters(s.rosters);
        if (owned.has(playerId)) return;
        const spots = spotsLeft(s.rosters[actor]!);
        if (maxAffordable(s.budgets[actor] ?? 0, spots) < MIN_BID) return;
        set({
          block: openBlock(playerId, actor, false),
          nominating: false,
        });
      },

      bid: (amount, teamId) => {
        if (guestSend(get, { k: "bid", amount })) return;
        const s = get();
        const block = s.block;
        if (!block || s.phase !== "draft") return;
        const you = teamId ?? s.playerTeamId;
        const spots = spotsLeft(s.rosters[you]!);
        const cap = maxAffordable(s.budgets[you] ?? 0, spots);
        const bid = Math.floor(amount);
        if (bid <= block.highBid || bid > cap) return;
        set({
          block: {
            ...block,
            highBid: bid,
            highBidderId: you,
            going: 0,
            waitingForHuman: false,
            passed: block.passed.filter((id) => id !== you),
            log: [...block.log, { teamId: you, amount: bid }].slice(-8),
          },
        });
      },

      pass: (teamId) => {
        if (guestSend(get, { k: "pass" })) return;
        const s = get();
        const block = s.block;
        if (!block) return;
        const you = teamId ?? s.playerTeamId;
        const live = liveHumanTeamIds(s);
        if (block.passed.includes(you)) {
          set({ block: { ...block, waitingForHuman: anyHumanCanBid(s, block, live) } });
          return;
        }
        const next = { ...block, passed: [...block.passed, you] };
        set({
          block: {
            ...next,
            waitingForHuman: anyHumanCanBid({ ...s, block: next }, next, live),
          },
        });
      },

      cpuStep: () => {
        const s = get();
        if (s.phase !== "draft") return;
        if (s.online && !s.isHost) return;
        if (s.teams.length === 0) return;
        const teamIds = s.teams.map((t) => t.id);
        const agg = aggressionMap(s.teams, s.seasonSeed);
        const owned = ownedFromRosters(s.rosters);
        const available = availablePlayers(owned);
        const liveHumans = liveHumanTeamIds(s);

        const award = (winnerId: string, playerId: string, price: number) => {
          const roster = placePlayer(s.rosters[winnerId]!, playerId);
          const rosters = { ...s.rosters, [winnerId]: roster };
          const budgets = { ...s.budgets, [winnerId]: (s.budgets[winnerId] ?? 0) - price };
          const contracts: Contract[] = [...s.contracts, { playerId, teamId: winnerId, price }];
          const filled = teamIds.every((id) => spotsLeft(rosters[id]!) <= 0);
          const nom = nextNominator(teamIds, rosters, s.nominateIndex + 1);
          if (filled || !nom) {
            set({
              ...finishDraft({ ...s, rosters, budgets, contracts }),
              lastSold: { playerId, teamId: winnerId, price },
            });
            return;
          }
          set({
            rosters,
            budgets,
            contracts,
            block: null,
            nominateIndex: nom.index,
            nominating: liveHumans.has(nom.teamId),
            lastSold: { playerId, teamId: winnerId, price },
          });
        };

        if (!s.block) {
          const nom = nextNominator(teamIds, s.rosters, s.nominateIndex);
          if (!nom) {
            set(finishDraft(s));
            return;
          }
          const skipHumanWait = Boolean(s.autoFill && nom.teamId === s.playerTeamId);
          const nomSpots = spotsLeft(s.rosters[nom.teamId]!);
          const nomCap = maxAffordable(s.budgets[nom.teamId] ?? 0, nomSpots);
          const brokeHuman = liveHumans.has(nom.teamId) && nomSpots > 0 && nomCap <= 2;
          if (liveHumans.has(nom.teamId) && !skipHumanWait && !brokeHuman) {
            if (!s.nominating) set({ nominating: true, nominateIndex: nom.index });
            return;
          }
          if (available.length === 0) {
            set(finishDraft(s));
            return;
          }
          const pick = cpuNominate(
            available,
            s.rosters[nom.teamId]!,
            s.budgets[nom.teamId] ?? 0,
            agg[nom.teamId] ?? 1,
          );
          const youRoster = s.rosters[s.playerTeamId];
          const pause =
            !brokeHuman &&
            !s.autoFill &&
            (s.mode === "online" ||
              (youRoster
                ? shouldPauseForHuman(pick, youRoster, s.budgets[s.playerTeamId] ?? 0, s.pauseEvery)
                : true));
          set({
            block: openBlock(pick, nom.teamId, pause),
            nominating: false,
            nominateIndex: nom.index,
          });
          return;
        }

        const block = s.block;
        if (block.waitingForHuman && !s.autoFill) return;

        if (s.autoFill && !block.passed.includes(s.playerTeamId)) {
          const you = s.playerTeamId;
          const max = cpuMaxBid(block.playerId, s.rosters[you]!, s.budgets[you] ?? 0, 1);
          if (max > block.highBid && block.highBidderId !== you) {
            const amount = Math.min(max, block.highBid + Math.max(BID_STEP, Math.min(8_000, max - block.highBid)));
            set({
              block: {
                ...block,
                highBid: amount,
                highBidderId: you,
                going: 0,
                waitingForHuman: false,
                log: [...block.log, { teamId: you, amount }].slice(-8),
              },
            });
            return;
          }
        }

        let live = block;
        for (let i = 0; i < 20; i++) {
          const raise = nextCpuRaise(live, s.teams, s.rosters, s.budgets, agg);
          if (!raise) break;
          live = {
            ...live,
            highBid: raise.amount,
            highBidderId: raise.teamId,
            going: 0,
            waitingForHuman: false,
            log: [...live.log, raise].slice(-8),
          };
        }

        const humansCanBid = anyHumanCanBid({ ...s, block: live }, live, liveHumans);

        if (live !== block && humansCanBid) {
          set({ block: { ...live, waitingForHuman: true } });
          return;
        }

        if (live !== block) {
          set({ block: live });
          return;
        }

        if (live.going < 2 && !s.autoFill) {
          set({
            block: {
              ...live,
              going: live.going + 1,
              waitingForHuman: humansCanBid,
            },
          });
          return;
        }

        award(live.highBidderId, live.playerId, live.highBid);
      },

      setPauseEvery: (v) => set({ pauseEvery: v }),
      setAutoFill: (v) => set({ autoFill: v, nominating: v ? false : get().nominating }),
      fillRest: (teamId) => {
        if (guestSend(get, { k: "fillRest" })) return;
        const s = get();
        if (s.phase !== "draft") return;
        const who = teamId ?? s.playerTeamId;
        if (spotsLeft(s.rosters[who] ?? emptyRoster()) <= 0) return;
        const skip = new Set(s.block ? [s.block.playerId] : []);
        const filled = fillUnfinishedRosters(s.teams, s.rosters, s.budgets, s.contracts, skip, who);
        const teamIds = s.teams.map((t) => t.id);
        const allFull = teamIds.every((id) => spotsLeft(filled.rosters[id]!) <= 0);
        if (allFull) {
          set({
            ...finishDraft({ ...s, ...filled }),
            lastSold: s.lastSold,
          });
          return;
        }
        const nom = nextNominator(teamIds, filled.rosters, s.nominateIndex);
        const liveHumans = liveHumanTeamIds({ ...s, rosters: filled.rosters });
        const hurry = s.mode !== "online";
        set({
          rosters: filled.rosters,
          budgets: filled.budgets,
          contracts: filled.contracts,
          nominateIndex: nom?.index ?? s.nominateIndex,
          autoFill: hurry ? true : s.autoFill,
          nominating: Boolean(nom && liveHumans.has(nom.teamId) && !(hurry || s.autoFill) && !s.block),
        });
      },

      startWatchNight: () => set({ watchNight: calendarNight() }),
      reshuffleWatchNight: () => {
        const n = calendarNight();
        set({ watchNight: { week: n.week, seed: (Math.floor(Math.random() * 1e9) + Date.now()) >>> 0 } });
      },
      endWatchNight: () => set({ watchNight: null }),

      swapSlot: (slot, benchId, teamId) => {
        if (guestSend(get, { k: "swap", slot, benchId })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const roster = s.rosters[who];
        if (!roster) return;
        const next = swapLineup(roster, slot, benchId);
        if (!next) return;
        set({ rosters: { ...s.rosters, [who]: next } });
      },

      playWeek: () => {
        if (guestSend(get, { k: "playWeek" })) return Promise.resolve();
        return (async () => {
        const s = get();
        if (s.ticker) return;
        if (s.phase !== "regular" && s.phase !== "playoffs") return;
        const week = s.week;
        let matchups: Matchup[] = [];
        if (week <= REGULAR_WEEKS) {
          matchups = s.schedule[week - 1] ?? [];
        } else if (week === PLAYOFF_WEEK && s.playoffBracket) {
          matchups = [s.playoffBracket.semiA, s.playoffBracket.semiB];
        } else if (week === CHAMPIONSHIP_WEEK && s.playoffBracket?.final) {
          matchups = [s.playoffBracket.final];
        }
        if (matchups.length === 0) return;

        const rosters = { ...s.rosters };
        for (const t of s.teams) {
          if (!t.human) {
            rosters[t.id] = autoSetLineup(rosters[t.id]!, week, rankPlayer);
          }
        }

        const nflWeek = (s.nflWeekStart || 1) + week - 1;
        let live: { stats?: Record<string, WireStat>; games?: WireGame[]; lockUnplayed: boolean } = {
          lockUnplayed: true,
        };
        try {
          const res = await fetch(`/api/nfl?week=${nflWeek}`, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as {
              stats?: Record<string, WireStat>;
              games?: WireGame[];
            };
            live = { stats: data.stats, games: data.games, lockUnplayed: true };
          }
        } catch {
          /* sim fallback */
        }

        const results = simulateMatchups(
          matchups,
          s.teams,
          rosters,
          week,
          s.seasonSeed,
          rankPlayer,
          live,
        );
        const nextResults = { ...s.results, [week]: results };
        const taken = autoTakeCpu(s.bets ?? [], s.cash ?? {}, s.teams);
        const settled = settleWeek(taken.bets, taken.cash, results, week);

        let playoffBracket = s.playoffBracket;
        let phase: Phase = s.phase;
        if (week === REGULAR_WEEKS) {
          const rows = standings(s.teams, nextResults, week);
          const seeds = playoffSeeds(rows);
          playoffBracket = {
            semiA: { homeId: seeds[0]!, awayId: seeds[3]! },
            semiB: { homeId: seeds[1]!, awayId: seeds[2]! },
            final: null,
            championId: null,
          };
          phase = "playoffs";
        } else if (week === PLAYOFF_WEEK && playoffBracket) {
          const a = results[playoffBracket.semiA.homeId]!;
          const b = results[playoffBracket.semiB.homeId]!;
          const w1 = a.won ? a.teamId : a.opponentId;
          const w2 = b.won ? b.teamId : b.opponentId;
          playoffBracket = {
            ...playoffBracket,
            final: { homeId: w1, awayId: w2 },
          };
        } else if (week === CHAMPIONSHIP_WEEK && playoffBracket?.final) {
          const finalGame = playoffBracket.final;
          const box = results[finalGame.homeId]!;
          const championId = box.won ? box.teamId : box.opponentId;
          playoffBracket = { ...playoffBracket, championId };
          phase = "complete";
          const career = { ...get().career };
          career.seasons += 1;
          if (championId === s.playerTeamId) career.titles += 1;
          const rows = standings(s.teams, nextResults, REGULAR_WEEKS);
          let finish = rows.findIndex((r) => r.teamId === s.playerTeamId) + 1;
          if (championId === s.playerTeamId) finish = 1;
          else if (finalGame.homeId === s.playerTeamId || finalGame.awayId === s.playerTeamId)
            finish = 2;
          if (career.bestFinish === null || finish < career.bestFinish) career.bestFinish = finish;
          saveCareer(career);
          set({ career });
        }

        const you = s.playerTeamId;
        const yourBox = results[you];
        const oppId = yourBox?.opponentId;
        const order: string[] = [];
        if (yourBox) {
          const mine = STARTER_SLOTS.map((slot) => rosters[you]!.lineup[slot]).filter(
            (id): id is string => Boolean(id),
          );
          const theirs = oppId
            ? STARTER_SLOTS.map((slot) => rosters[oppId]!.lineup[slot]).filter(
                (id): id is string => Boolean(id),
              )
            : [];
          const n = Math.max(mine.length, theirs.length);
          for (let i = 0; i < n; i++) {
            if (mine[i]) order.push(mine[i]!);
            if (theirs[i]) order.push(theirs[i]!);
          }
        }

        if (!yourBox) {
          const nextWeek = phase === "complete" ? week : week + 1;
          set({
            rosters,
            results: nextResults,
            playoffBracket,
            phase,
            ticker: null,
            week: nextWeek,
            screen: "standings",
            cash: settled.cash,
            bets: settled.bets,
          });
          return;
        }

        set({
          rosters,
          results: nextResults,
          playoffBracket,
          phase,
          screen: "matchup",
          cash: settled.cash,
          bets: settled.bets,
          ticker: yourBox
            ? {
                week,
                order,
                index: 0,
                revealed: {},
                homeId: you,
                awayId: yourBox.opponentId,
                done: order.length === 0,
              }
            : null,
        });
        })();
      },

      tickReveal: () => {
        const s = get();
        const ticker = s.ticker;
        if (!ticker || ticker.done) return;
        const id = ticker.order[ticker.index];
        if (!id) {
          set({ ticker: { ...ticker, done: true } });
          return;
        }
        const box = s.results[ticker.week]?.[ticker.homeId];
        const opp = s.results[ticker.week]?.[ticker.awayId];
        const pts = box?.playerPoints[id] ?? opp?.playerPoints[id] ?? 0;
        const nextIndex = ticker.index + 1;
        set({
          ticker: {
            ...ticker,
            index: nextIndex,
            revealed: { ...ticker.revealed, [id]: pts },
            done: nextIndex >= ticker.order.length,
          },
        });
      },

      skipTicker: () => {
        const s = get();
        const ticker = s.ticker;
        if (!ticker) return;
        const box = s.results[ticker.week]?.[ticker.homeId];
        const opp = s.results[ticker.week]?.[ticker.awayId];
        const revealed: Record<string, number> = { ...ticker.revealed };
        for (const id of ticker.order) {
          revealed[id] = box?.playerPoints[id] ?? opp?.playerPoints[id] ?? 0;
        }
        set({ ticker: { ...ticker, revealed, index: ticker.order.length, done: true } });
      },

      closeTicker: () => {
        if (guestSend(get, { k: "closeTicker" })) return;
        const s = get();
        const week = s.week;
        if (s.phase === "complete") {
          set({ ticker: null, screen: "standings", waiverClaims: [] });
          return;
        }
        set({
          ticker: null,
          week: week + 1,
          screen: week < REGULAR_WEEKS ? "roster" : "home",
          waiverClaims: [],
        });
      },

      claimWaiver: (addId, dropId, teamId) => {
        if (guestSend(get, { k: "claimWaiver", addId, dropId })) return;
        const s = get();
        if (s.week > REGULAR_WEEKS) return;
        const who = teamId ?? s.playerTeamId;
        const used = s.waiverClaims.filter((id) => id === who).length;
        if (used >= WAIVER_MAX) return;
        const faab = { ...(s.faab ?? {}) };
        const bid = 15;
        if ((faab[who] ?? 0) < bid) return;
        let roster = s.rosters[who]!;
        if (dropId) roster = dropPlayer(roster, dropId);
        if (rosterPlayerIds(roster).length >= ROSTER_SIZE) return;
        roster = placePlayer(roster, addId);
        const next = { ...s.rosters, [who]: roster };
        const claims = [...s.waiverClaims, who];
        faab[who] = (faab[who] ?? 0) - bid;

        if (s.teams.filter((t) => t.human).every((t) => claims.includes(t.id) || t.id === who)) {
          const owned = ownedSet(next);
          const fas = freeAgents(owned);
          for (const team of s.teams) {
            if (team.human) continue;
            let r = next[team.id]!;
            const ids = rosterPlayerIds(r);
            if (ids.length === 0) continue;
            const worst = ids
              .map((id) => getPlayer(id))
              .sort((a, b) => remainingValue(a, s.week) - remainingValue(b, s.week))[0];
            const best = fas.find(
              (p) => !owned.has(p.id) && remainingValue(p, s.week) > (worst ? remainingValue(worst, s.week) + 4 : 0),
            );
            if (best && worst && (faab[team.id] ?? 0) >= bid) {
              r = dropPlayer(r, worst.id);
              r = placePlayer(r, best.id);
              next[team.id] = autoSetLineup(r, s.week, rankPlayer);
              owned.delete(worst.id);
              owned.add(best.id);
              faab[team.id] = (faab[team.id] ?? 0) - bid;
            }
          }
        }

        set({
          rosters: next,
          waiverClaims: claims,
          waiverUsedWeek: s.week,
          faab,
          screen: used + 1 >= WAIVER_MAX ? "home" : "roster",
        });
      },

      skipWaiver: (teamId) => {
        if (guestSend(get, { k: "skipWaiver" })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const claims = s.waiverClaims.includes(who) ? s.waiverClaims : [...s.waiverClaims, who];
        set({ waiverClaims: claims, waiverUsedWeek: s.week, screen: "home" });
      },

      offerTrade: (toId, giveId, getId, teamId) => {
        if (guestSend(get, { k: "trade", toId, giveId, getId })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        if (who === toId) return;
        if (s.phase !== "regular" && s.phase !== "playoffs") return;
        if (!rosterPlayerIds(s.rosters[who]!).includes(giveId)) return;
        if (!rosterPlayerIds(s.rosters[toId]!).includes(getId)) return;
        const offer: TradeOffer = {
          id: `tr-${Date.now().toString(36)}`,
          week: s.week,
          fromId: who,
          toId,
          giveId,
          getId,
          status: "open",
        };
        const them = s.teams.find((t) => t.id === toId);
        const apply = () => {
          let a = s.rosters[who]!;
          let b = s.rosters[toId]!;
          a = dropPlayer(a, giveId);
          b = dropPlayer(b, getId);
          a = placePlayer(a, getId);
          b = placePlayer(b, giveId);
          const contracts = s.contracts.map((c) => {
            if (c.playerId === giveId) return { ...c, teamId: toId };
            if (c.playerId === getId) return { ...c, teamId: who };
            return c;
          });
          return { rosters: { ...s.rosters, [who]: a, [toId]: b }, contracts };
        };
        if (them && !them.human) {
          const give = getPlayer(giveId);
          const getp = getPlayer(getId);
          if (getp.ovr >= give.ovr - 3) {
            set({ ...apply(), trades: [...(s.trades ?? []), { ...offer, status: "done" }] });
            return;
          }
          set({ trades: [...(s.trades ?? []), { ...offer, status: "dead" }] });
          return;
        }
        set({ trades: [...(s.trades ?? []), offer] });
      },

      takeTrade: (id, teamId) => {
        if (guestSend(get, { k: "takeTrade", id })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const offer = (s.trades ?? []).find((t) => t.id === id);
        if (!offer || offer.status !== "open") return;
        if (offer.toId !== who && offer.fromId !== who) return;
        let a = s.rosters[offer.fromId]!;
        let b = s.rosters[offer.toId]!;
        a = dropPlayer(a, offer.giveId);
        b = dropPlayer(b, offer.getId);
        a = placePlayer(a, offer.getId);
        b = placePlayer(b, offer.giveId);
        const contracts = s.contracts.map((c) => {
          if (c.playerId === offer.giveId) return { ...c, teamId: offer.toId };
          if (c.playerId === offer.getId) return { ...c, teamId: offer.fromId };
          return c;
        });
        set({
          rosters: { ...s.rosters, [offer.fromId]: a, [offer.toId]: b },
          contracts,
          trades: (s.trades ?? []).map((t) => (t.id === id ? { ...t, status: "done" as const } : t)),
        });
      },

      passTrade: (id, teamId) => {
        if (guestSend(get, { k: "passTrade", id })) return;
        const s = get();
        set({
          trades: (s.trades ?? []).map((t) => (t.id === id ? { ...t, status: "dead" as const } : t)),
        });
        void teamId;
      },

      sendToIr: (playerId, teamId) => {
        if (guestSend(get, { k: "ir", playerId })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const next = toIr(s.rosters[who]!, playerId);
        if (!next) return;
        set({ rosters: { ...s.rosters, [who]: next } });
      },

      activateIr: (playerId, teamId) => {
        if (guestSend(get, { k: "activateIr", playerId })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const next = fromIr(s.rosters[who]!, playerId);
        if (!next) return;
        set({ rosters: { ...s.rosters, [who]: next } });
      },

      sendChat: (text, teamId) => {
        const line = text.trim().slice(0, 140);
        if (!line) return;
        if (guestSend(get, { k: "chat", text: line })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const name = s.teams.find((t) => t.id === who)?.short || s.onlineIdentity?.name || "You";
        const row = { id: `${Date.now()}`, name, text: line, at: Date.now() };
        set({ chatLog: [...s.chatLog, row].slice(-40) });
      },

      pushChat: (name, text) => {
        const line = text.trim().slice(0, 180);
        if (!line) return;
        const s = get();
        set({
          chatLog: [...s.chatLog, { id: `${Date.now()}-b`, name, text: line, at: Date.now() }].slice(-40),
        });
      },

      offerBet: (toId, stake, teamId) => {
        if (guestSend(get, { k: "bet", toId, stake })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        if (who === toId) return;
        if (s.phase !== "regular" && s.phase !== "playoffs") return;
        const cash = { ...(s.cash ?? {}) };
        if (!canStake(cash[who] ?? 0, stake)) return;
        const open = (s.bets ?? []).some(
          (b) => b.week === s.week && b.fromId === who && b.toId === toId && (b.status === "open" || b.status === "live"),
        );
        if (open) return;
        cash[who] = (cash[who] ?? 0) - stake;
        const bet = {
          id: newBetId(),
          week: s.week,
          fromId: who,
          toId,
          stake,
          status: "open" as const,
          winnerId: null,
        };
        const taken = autoTakeCpu([...(s.bets ?? []), bet], cash, s.teams);
        set({ cash: taken.cash, bets: taken.bets });
      },

      takeBet: (id, teamId) => {
        if (guestSend(get, { k: "takeBet", id })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const bets = (s.bets ?? []).slice();
        const i = bets.findIndex((b) => b.id === id);
        if (i < 0) return;
        const bet = bets[i]!;
        if (bet.status !== "open" || bet.toId !== who) return;
        const cash = { ...(s.cash ?? {}) };
        if ((cash[who] ?? 0) < bet.stake) return;
        cash[who] = (cash[who] ?? 0) - bet.stake;
        bets[i] = { ...bet, status: "live" };
        set({ cash, bets });
      },

      passBet: (id, teamId) => {
        if (guestSend(get, { k: "passBet", id })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const bets = (s.bets ?? []).slice();
        const i = bets.findIndex((b) => b.id === id);
        if (i < 0) return;
        const bet = bets[i]!;
        if (bet.status !== "open" || (bet.toId !== who && bet.fromId !== who)) return;
        const cash = { ...(s.cash ?? {}) };
        cash[bet.fromId] = (cash[bet.fromId] ?? 0) + bet.stake;
        bets[i] = { ...bet, status: "dead" };
        set({ cash, bets });
      },

      resetSeason: () =>
        set({
          ...emptySave(),
          career: get().career,
          ticker: null,
          lastSold: null,
          watchNight: null,
          hydrated: true,
          screen: "title",
          applyingRemote: false,
          ...offlineFields(),
        }),

      keepClub: () => {
        const s = get();
        if (s.phase !== "complete" || s.online) return;
        const budgets: Record<string, number> = {};
        for (const t of s.teams) {
          budgets[t.id] = capSpace(s.contracts, t.id);
        }
        const refreshed = cpuRefresh(s.teams, s.rosters, s.contracts, budgets);
        set({
          phase: "offseason",
          screen: "offseason",
          week: 1,
          results: {},
          playoffBracket: null,
          schedule: [],
          bets: [],
          waiverClaims: [],
          waiverUsedWeek: 0,
          block: null,
          nominating: false,
          autoFill: false,
          ticker: null,
          lastSold: null,
          contracts: refreshed.contracts,
          rosters: refreshed.rosters,
          budgets: refreshed.budgets,
          seasonNo: (s.seasonNo ?? 1) + 1,
        });
      },

      cutKeep: (playerId) => {
        const s = get();
        if (s.phase !== "offseason") return;
        const out = cutPlayerFromClub(s.playerTeamId, playerId, s.rosters, s.contracts, s.budgets);
        set({ rosters: out.rosters, contracts: out.contracts, budgets: out.budgets });
      },

      openNextSeason: () => {
        const s = get();
        if (s.phase !== "offseason") return;
        const ids = s.teams.map((t) => t.id);
        const holes = ids.some((id) => spotsLeft(s.rosters[id] ?? emptyRoster()) > 0);
        const boot = () => {
          if (holes) {
            const nom = nextNominator(ids, s.rosters, 0);
            set({
              phase: "draft",
              screen: "draft",
              nominateIndex: nom?.index ?? 0,
              nominating: Boolean(nom && s.teams.find((t) => t.id === nom.teamId)?.human),
              block: null,
              autoFill: false,
              schedule: [],
              results: {},
              playoffBracket: null,
            });
            return;
          }
          set({
            ...finishDraft({
              ...s,
              contracts: s.contracts,
              rosters: s.rosters,
              budgets: s.budgets,
            }),
            seasonNo: s.seasonNo,
          });
        };
        boot();
        void fetch("/api/nfl", { cache: "no-store" })
          .then((r) => r.json())
          .then((d: { week?: number; board?: import("./types").Player[] }) => {
            if (d.board?.length) adoptBoard(d.board);
            if (d.week) set({ nflWeekStart: d.week });
          })
          .catch(() => undefined);
      },

      enterOnline: (roomCode, localPeerId, isHost) =>
        set({
          online: true,
          isHost,
          localPeerId,
          roomCode,
          mode: "online",
          screen: "lobby",
          teams: [],
        }),

      leaveOnline: () => {
        const career = get().career;
        const solo = lastSoloPersist as Partial<SaveState> | null;
        if (solo && Array.isArray(solo.teams) && solo.teams.length > 0) {
          set({
            ...emptySave(),
            ...solo,
            career,
            ticker: null,
            lastSold: null,
            hydrated: true,
            applyingRemote: false,
            ...offlineFields(),
          });
          return;
        }
        set({
          ...emptySave(),
          career,
          ticker: null,
          lastSold: null,
          watchNight: null,
          hydrated: true,
          screen: "title",
          applyingRemote: false,
          ...offlineFields(),
        });
      },

      setSendAction: (fn) => set({ sendAction: fn }),
      setLocalPeerId: (id) => set({ localPeerId: id }),
      setOnlineIdentity: (id) => set({ onlineIdentity: id }),
      upsertLobbySeat: (peerId, ident) =>
        set({ lobbySeats: { ...get().lobbySeats, [peerId]: ident } }),
      noteHost: (peerId) => set({ hostPeerId: peerId }),
      setMesh: (mesh) => set({ mesh }),

      applySync: (save, lastSold) => {
        const s = get();
        const myTeam = save.peerTeams[s.localPeerId];
        if (!myTeam) {
          if (save.teams.length > 0) set({ lateJoinBlocked: true, hostPeerId: save.hostPeerId });
          return;
        }
        const weekJustPlayed =
          Boolean(save.results[save.week]) &&
          save.screen === "matchup" &&
          (s.screen !== "matchup" || !s.results[save.week]);
        let ticker = s.ticker;
        if (save.screen !== "matchup" || save.week !== s.week) ticker = null;
        if (weekJustPlayed) {
          const box = save.results[save.week]?.[myTeam];
          if (box) {
            const mine = STARTER_SLOTS.map((slot) => save.rosters[myTeam]?.lineup[slot]).filter(
              (id): id is string => Boolean(id),
            );
            const theirs = STARTER_SLOTS.map((slot) => save.rosters[box.opponentId]?.lineup[slot]).filter(
              (id): id is string => Boolean(id),
            );
            const order: string[] = [];
            const n = Math.max(mine.length, theirs.length);
            for (let i = 0; i < n; i++) {
              if (mine[i]) order.push(mine[i]!);
              if (theirs[i]) order.push(theirs[i]!);
            }
            ticker = {
              week: save.week,
              order,
              index: 0,
              revealed: {},
              homeId: myTeam,
              awayId: box.opponentId,
              done: order.length === 0,
            };
          }
        }
        set({
          ...save,
          playerTeamId: myTeam,
          online: true,
          isHost: s.isHost,
          localPeerId: s.localPeerId,
          roomCode: s.roomCode,
          sendAction: s.sendAction,
          applyingRemote: false,
          lastSold,
          ticker,
          career: s.career,
          hydrated: true,
          onlineIdentity: s.onlineIdentity,
          lobbySeats: s.lobbySeats,
          mesh: s.mesh,
          lateJoinBlocked: false,
        });
      },

      applyRemote: (fromPeerId, act) => {
        const s = get();
        if (!s.isHost) return;
        const teamId = s.peerTeams[fromPeerId];
        if (!teamId && act.k !== "playWeek" && act.k !== "closeTicker") return;
        remoteApplying = true;
        try {
          if (act.k === "nominate") get().nominate(act.playerId, teamId);
          else if (act.k === "bid") get().bid(act.amount, teamId);
          else if (act.k === "pass") get().pass(teamId);
          else if (act.k === "fillRest") get().fillRest(teamId);
          else if (act.k === "swap") get().swapSlot(act.slot, act.benchId, teamId);
          else if (act.k === "playWeek") get().playWeek();
          else if (act.k === "closeTicker") get().closeTicker();
          else if (act.k === "claimWaiver") get().claimWaiver(act.addId, act.dropId, teamId);
          else if (act.k === "skipWaiver") get().skipWaiver(teamId);
          else if (act.k === "trade") get().offerTrade(act.toId, act.giveId, act.getId, teamId);
          else if (act.k === "takeTrade") get().takeTrade(act.id, teamId);
          else if (act.k === "passTrade") get().passTrade(act.id, teamId);
          else if (act.k === "ir") get().sendToIr(act.playerId, teamId);
          else if (act.k === "activateIr") get().activateIr(act.playerId, teamId);
          else if (act.k === "chat") get().sendChat(act.text, teamId);
          else if (act.k === "bet") get().offerBet(act.toId, act.stake, teamId);
          else if (act.k === "takeBet") get().takeBet(act.id, teamId);
          else if (act.k === "passBet") get().passBet(act.id, teamId);
        } finally {
          remoteApplying = false;
        }
      },
    }),
    {
      name: "dream-football-save",
      version: SAVE_VERSION,
      skipHydration: true,
      merge: (persisted, current) => {
        if (current.online || current.screen === "lobby") return current;
        return { ...current, ...(persisted as object) };
      },
      partialize: (s) => {
        const emptyOnline = {
          version: SAVE_VERSION,
          seasonSeed: 1,
          week: 1,
          phase: "draft" as const,
          screen: "title" as const,
          playerTeamId: "you",
          teams: [] as SaveState["teams"],
          nominateIndex: 0,
          contracts: [] as SaveState["contracts"],
          budgets: {} as SaveState["budgets"],
          block: null,
          nominating: false,
          autoFill: false,
          pauseEvery: false,
          rosters: {} as SaveState["rosters"],
          schedule: [] as SaveState["schedule"],
          results: {} as SaveState["results"],
          playoffBracket: null,
          waiverUsedWeek: 0,
          waiverClaims: [] as string[],
          faab: {} as Record<string, number>,
          trades: [] as SaveState["trades"],
          cash: {} as Record<string, number>,
          bets: [] as SaveState["bets"],
          mode: "solo" as const,
          peerTeams: {} as Record<string, string>,
          hostPeerId: "",
          nflWeekStart: 1,
          seasonNo: 1,
        };
        if (s.online || s.mode === "online") {
          return lastSoloPersist ?? emptyOnline;
        }
        const snap = {
          version: s.version,
          seasonSeed: s.seasonSeed,
          week: s.week,
          phase: s.phase,
          screen: (s.screen === "title"
            ? s.screen
            : s.phase === "draft"
              ? "draft"
              : s.phase === "offseason"
                ? "offseason"
                : "home") as SaveState["screen"],
          playerTeamId: s.playerTeamId,
          teams: s.teams,
          nominateIndex: s.nominateIndex,
          contracts: s.contracts,
          budgets: s.budgets,
          block: s.block,
          nominating: s.nominating,
          autoFill: false,
          pauseEvery: s.pauseEvery,
          rosters: s.rosters,
          schedule: s.schedule,
          results: s.results,
          playoffBracket: s.playoffBracket,
          waiverUsedWeek: s.waiverUsedWeek,
          waiverClaims: s.waiverClaims ?? [],
          faab: s.faab ?? {},
          trades: s.trades ?? [],
          cash: s.cash ?? {},
          bets: s.bets ?? [],
          mode: "solo" as const,
          peerTeams: {},
          hostPeerId: "",
          nflWeekStart: s.nflWeekStart ?? 1,
          seasonNo: s.seasonNo ?? 1,
        };
        lastSoloPersist = snap;
        return snap;
      },
    },
  ),
);
