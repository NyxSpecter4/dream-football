import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CHAMPIONSHIP_WEEK,
  MIN_BID,
  PLAYOFF_WEEK,
  REGULAR_WEEKS,
  ROSTER_SIZE,
  SALARY_CAP,
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
} from "./types";
import { emptyRoster, placePlayer, dropPlayer, swapLineup, autoSetLineup, buildLeague, buildOnlineLeague, roundRobin, rosterPlayerIds } from "./league";
import {
  availablePlayers,
  cpuMaxBid,
  cpuNominate,
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
import { getPlayer } from "./players";
import { anyHumanCanBid, type LobbyIdentity, type MeshPeer, type RemoteAct } from "./net";

const SAVE_VERSION = 3;
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
    mode: "solo",
    peerTeams: {},
    hostPeerId: "",
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
  const ids = s.teams.map((t) => t.id);
  return {
    phase: "regular",
    screen: "home",
    week: 1,
    block: null,
    nominating: false,
    autoFill: false,
    schedule: roundRobin(ids),
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
  setHydrated: () => void;
  setScreen: (screen: Screen) => void;
  startSetup: () => void;
  startSeason: (name: string, short: string, jersey: JerseyId) => void;
  startOnlineSeason: (
    humans: Array<{ peerId: string; name: string; short: string; jersey: JerseyId }>,
    hostPeerId: string,
    localPeerId: string,
  ) => void;
  nominate: (playerId: string, teamId?: string) => void;
  bid: (amount: number, teamId?: string) => void;
  pass: (teamId?: string) => void;
  cpuStep: () => void;
  setPauseEvery: (v: boolean) => void;
  setAutoFill: (v: boolean) => void;
  swapSlot: (slot: Slot, benchId: string, teamId?: string) => void;
  playWeek: () => void;
  tickReveal: () => void;
  skipTicker: () => void;
  closeTicker: () => void;
  claimWaiver: (addId: string, dropId: string, teamId?: string) => void;
  skipWaiver: (teamId?: string) => void;
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
        set({ hydrated: true, career: loadCareer() });
      },
      setScreen: (screen) => set({ screen }),
      startSetup: () => set({ screen: "setup" }),

      startSeason: (name, short, jersey) => {
        const seasonSeed = (Math.floor(Math.random() * 1e9) + Date.now()) >>> 0;
        const rand = mulberry32(seasonSeed);
        const teams = buildLeague(name, short, jersey, rand);
        const rosters: SaveState["rosters"] = {};
        const budgets: Record<string, number> = {};
        for (const t of teams) {
          rosters[t.id] = emptyRoster();
          budgets[t.id] = SALARY_CAP;
        }
        set({
          ...emptySave(),
          seasonSeed,
          teams,
          rosters,
          budgets,
          screen: "draft",
          phase: "draft",
          career: get().career,
          hydrated: true,
          mode: "solo",
          ...offlineFields(),
        });
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
        for (const t of teams) {
          rosters[t.id] = emptyRoster();
          budgets[t.id] = SALARY_CAP;
        }
        const myTeam = peerTeams[localPeerId] ?? teams[0]!.id;
        set({
          ...emptySave(),
          seasonSeed,
          teams,
          rosters,
          budgets,
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
              rosters,
              budgets,
              contracts,
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
          if (liveHumans.has(nom.teamId) && !skipHumanWait) {
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
            const amount = Math.min(max, block.highBid + Math.max(1, Math.min(8, max - block.highBid)));
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
        if (guestSend(get, { k: "playWeek" })) return;
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

        const results = simulateMatchups(
          matchups,
          s.teams,
          rosters,
          week,
          s.seasonSeed,
          rankPlayer,
        );
        const nextResults = { ...s.results, [week]: results };

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
          });
          return;
        }

        set({
          rosters,
          results: nextResults,
          playoffBracket,
          phase,
          screen: "matchup",
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
        if (s.waiverClaims.includes(who)) return;
        let roster = s.rosters[who]!;
        if (dropId) roster = dropPlayer(roster, dropId);
        if (rosterPlayerIds(roster).length >= ROSTER_SIZE) return;
        roster = placePlayer(roster, addId);
        const next = { ...s.rosters, [who]: roster };
        const claims = [...s.waiverClaims, who];

        const humansLeft = s.teams.filter((t) => t.human && !claims.includes(t.id));
        if (humansLeft.length === 0) {
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
            if (best && worst) {
              r = dropPlayer(r, worst.id);
              r = placePlayer(r, best.id);
              next[team.id] = autoSetLineup(r, s.week, rankPlayer);
              owned.delete(worst.id);
              owned.add(best.id);
            }
          }
        }

        set({
          rosters: next,
          waiverClaims: claims,
          waiverUsedWeek: s.week,
          screen: "home",
        });
      },

      skipWaiver: (teamId) => {
        if (guestSend(get, { k: "skipWaiver" })) return;
        const s = get();
        const who = teamId ?? s.playerTeamId;
        const claims = s.waiverClaims.includes(who) ? s.waiverClaims : [...s.waiverClaims, who];
        set({ waiverClaims: claims, waiverUsedWeek: s.week, screen: "home" });
      },

      resetSeason: () =>
        set({
          ...emptySave(),
          career: get().career,
          ticker: null,
          lastSold: null,
          hydrated: true,
          screen: "title",
          applyingRemote: false,
          ...offlineFields(),
        }),

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
          else if (act.k === "swap") get().swapSlot(act.slot, act.benchId, teamId);
          else if (act.k === "playWeek") get().playWeek();
          else if (act.k === "closeTicker") get().closeTicker();
          else if (act.k === "claimWaiver") get().claimWaiver(act.addId, act.dropId, teamId);
          else if (act.k === "skipWaiver") get().skipWaiver(teamId);
        } finally {
          remoteApplying = false;
        }
      },
    }),
    {
      name: "night-league-save",
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
          mode: "solo" as const,
          peerTeams: {} as Record<string, string>,
          hostPeerId: "",
        };
        if (s.online || s.mode === "online") {
          return lastSoloPersist ?? emptyOnline;
        }
        const snap = {
          version: s.version,
          seasonSeed: s.seasonSeed,
          week: s.week,
          phase: s.phase,
          screen: (s.screen === "title" ? s.screen : s.phase === "draft" ? "draft" : "home") as SaveState["screen"],
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
          mode: "solo" as const,
          peerTeams: {},
          hostPeerId: "",
        };
        lastSoloPersist = snap;
        return snap;
      },
    },
  ),
);
