import { getPlayer } from "./players";
import { pickFeaturedGame, playersOnTeam, teamCity, teamOf, type NflTeam } from "./nfl";
import { hashSeed, mulberry32 } from "./rng";
import { STARTER_SLOTS, type Player, type Position, type Roster } from "./types";
import type { WireGame } from "./wire";

export type PlayKind =
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

export type FantasyTick = {
  playerId: string;
  pts: number;
  board: "home" | "away";
};

export type NightPlay = {
  kind: PlayKind;
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
  hold: number;
  ticks: FantasyTick[];
  also: { playerId: string; call: string; pts: number; board: "home" | "away" } | null;
};

export type NightGame = {
  featured: { home: NflTeam; away: NflTeam };
  plays: NightPlay[];
};

type Skill = {
  id: string | null;
  name: string;
  last: string;
  ovr: number;
  pos: Position;
};

function lastName(name: string) {
  const parts = name.trim().split(" ");
  return parts[parts.length - 1] ?? name;
}

function clockStr(quarter: number, seconds: number) {
  const q = Math.min(4, Math.max(1, quarter));
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `Q${q} ${m}:${String(r).padStart(2, "0")}`;
}

function skillOf(
  abbr: string,
  pos: Position,
  prefer: Set<string>,
  rand: () => number,
  used: Set<string>,
): Skill {
  const pool = playersOnTeam(abbr)
    .filter((p) => p.pos === pos)
    .sort((a, b) => {
      const ao = prefer.has(a.id) ? 1 : 0;
      const bo = prefer.has(b.id) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return b.ovr - a.ovr;
    });
  const fresh = pool.filter((p) => !used.has(p.id));
  const pick = (fresh[0] ?? pool[0]) as Player | undefined;
  if (!pick) {
    const city = teamCity(abbr);
    const role =
      pos === "QB"
        ? "quarterback"
        : pos === "RB"
          ? "back"
          : pos === "WR"
            ? "receiver"
            : pos === "TE"
              ? "tight end"
              : pos === "K"
                ? "kicker"
                : "front";
    return { id: null, name: `${city} ${role}`, last: city, ovr: 74, pos };
  }
  if (rand() > 0.22) used.add(pick.id);
  return { id: pick.id, name: pick.name, last: lastName(pick.name), ovr: pick.ovr, pos };
}

function dstName(abbr: string) {
  const dst = getPlayer(`dst-${abbr.toLowerCase()}`);
  if (dst.id.startsWith("dst-")) return dst.name;
  return teamCity(abbr);
}

function spotMark(spot: number) {
  const y = Math.max(1, Math.min(99, Math.round(spot)));
  if (y <= 50) return y;
  return 100 - y;
}

function holdFor(kind: PlayKind) {
  if (kind === "td") return 1.85;
  if (kind === "fg" || kind === "xp") return 1.35;
  if (kind === "int" || kind === "kickoff") return 1.2;
  if (kind === "also") return 0.9;
  if (kind === "incomplete" || kind === "kneel") return 0.85;
  return 1.05;
}

type Engine = {
  q: number;
  clock: number;
  down: number;
  toGo: number;
  spot: number;
  poss: "home" | "away";
  homeScore: number;
  awayScore: number;
};

function clipSpot(n: number) {
  return Math.max(1, Math.min(99, n));
}

export function buildNight(opts: {
  week: number;
  seed: number;
  ownedHome: string[];
  ownedAway: string[];
  homePts: Record<string, number>;
  awayPts: Record<string, number>;
  homeAbbr?: string;
  awayAbbr?: string;
}): NightGame {
  const ownedAll = [...opts.ownedHome, ...opts.ownedAway];
  const featured =
    opts.homeAbbr && opts.awayAbbr
      ? { home: teamOf(opts.homeAbbr), away: teamOf(opts.awayAbbr) }
      : pickFeaturedGame(opts.week, opts.seed, ownedAll);
  const prefer = new Set(ownedAll);
  const rand = mulberry32(hashSeed(opts.seed, "night", opts.week, featured.home.abbr, featured.away.abbr));
  const used = new Set<string>();

  const remain: Record<string, number> = {};
  const boardOf = new Map<string, "home" | "away">();
  for (const id of opts.ownedHome) {
    remain[id] = opts.homePts[id] ?? 0;
    boardOf.set(id, "home");
  }
  for (const id of opts.ownedAway) {
    remain[id] = opts.awayPts[id] ?? 0;
    boardOf.set(id, "away");
  }

  const featuredIds = new Set(
    [...playersOnTeam(featured.home.abbr), ...playersOnTeam(featured.away.abbr)].map((p) => p.id),
  );

  const alsoQueue: Array<{ playerId: string; board: "home" | "away"; pts: number }> = [];
  for (const id of ownedAll) {
    if (featuredIds.has(id)) continue;
    const pl = getPlayer(id);
    const pts = remain[id] ?? 0;
    if (pts <= 0) continue;
    alsoQueue.push({ playerId: id, board: boardOf.get(id) ?? "home", pts });
    remain[id] = 0;
  }
  alsoQueue.sort((a, b) => b.pts - a.pts);

  const tick = (ids: Array<string | null>, kind: PlayKind, yards: number): FantasyTick[] => {
    const out: FantasyTick[] = [];
    for (const id of ids) {
      if (!id || remain[id] == null) continue;
      const left = remain[id]!;
      if (left <= 0) continue;
      const board = boardOf.get(id);
      if (!board) continue;
      const pl = getPlayer(id);
      let chunk = 0.4 + Math.abs(yards) * (pl.pos === "QB" ? 0.04 : 0.1);
      if (kind === "td") chunk += pl.pos === "QB" ? 4 : 6;
      if (kind === "int" || kind === "sack") chunk = Math.min(left, 1 + rand() * 2);
      if (kind === "fg") chunk = Math.min(left, 3);
      if (kind === "xp") chunk = Math.min(left, 1);
      chunk = Math.min(left, Math.max(0.3, chunk));
      remain[id] = Math.round((left - chunk) * 10) / 10;
      out.push({ playerId: id, pts: Math.round(chunk * 10) / 10, board });
    }
    return out;
  };

  const plays: NightPlay[] = [];
  const st: Engine = {
    q: 1,
    clock: 15 * 60,
    down: 1,
    toGo: 10,
    spot: 25,
    poss: "away",
    homeScore: 0,
    awayScore: 0,
  };

  const abbrOf = (poss: "home" | "away") => (poss === "home" ? featured.home.abbr : featured.away.abbr);
  const other = (p: "home" | "away") => (p === "home" ? "away" : "home");

  const toward = (poss: "home" | "away", yards: number) => {
    return poss === "home" ? yards : -yards;
  };

  const push = (partial: Omit<NightPlay, "clock" | "quarter" | "homeScore" | "awayScore" | "hold" | "also">) => {
    const alsoRaw = alsoQueue.length > 0 && plays.length > 4 && plays.length % 7 === 3 ? alsoQueue.shift() : null;
    const also = alsoRaw
      ? {
          playerId: alsoRaw.playerId,
          pts: alsoRaw.pts,
          board: alsoRaw.board,
          call: alsoCall(alsoRaw.playerId, alsoRaw.pts, opts.week),
        }
      : null;
    plays.push({
      ...partial,
      clock: clockStr(st.q, st.clock),
      quarter: st.q,
      homeScore: st.homeScore,
      awayScore: st.awayScore,
      hold: holdFor(partial.kind) + (also ? 0.25 : 0),
      also,
    });
  };

  const burn = (lo: number, hi: number) => {
    st.clock -= lo + Math.floor(rand() * Math.max(1, hi - lo));
    while (st.clock <= 0 && st.q < 4) {
      st.q += 1;
      st.clock += 15 * 60;
    }
    if (st.clock < 0) st.clock = 0;
  };

  const kickoff = (to: "home" | "away") => {
    st.poss = to;
    st.spot = to === "home" ? 25 : 75;
    st.down = 1;
    st.toGo = 10;
    const k = skillOf(abbrOf(other(to)), "K", prefer, rand, used);
    push({
      kind: "kickoff",
      call: `${k.last} sends it. Taken at the 25.`,
      down: 1,
      toGo: 10,
      spot: st.spot,
      from: to === "home" ? 65 : 35,
      to: st.spot,
      yards: 0,
      possession: to,
      playerId: k.id,
      targetId: null,
      ticks: tick([k.id], "kickoff", 0),
    });
    burn(8, 14);
  };

  kickoff("away");

  let guard = 0;
  while (guard++ < 62 && !(st.q === 4 && st.clock <= 0)) {
    if (st.q === 4 && st.clock <= 0) break;
    const abbr = abbrOf(st.poss);
    const qb = skillOf(abbr, "QB", prefer, rand, used);
    const rb = skillOf(abbr, "RB", prefer, rand, used);
    const wr = skillOf(abbr, "WR", prefer, rand, used);
    const te = skillOf(abbr, "TE", prefer, rand, used);
    const k = skillOf(abbr, "K", prefer, rand, used);
    const defAbbr = abbrOf(other(st.poss));
    const dir = toward(st.poss, 1);
    const fgDist = st.poss === "home" ? 100 - st.spot + 17 : st.spot + 17;
    const trailing =
      (st.poss === "home" ? st.homeScore - st.awayScore : st.awayScore - st.homeScore) < 0;
    const late = st.q === 4 && st.clock < 180;

    if (st.q === 4 && st.clock < 40 && !trailing) {
      const from = st.spot;
      st.spot = clipSpot(st.spot + dir * 1);
      burn(18, 22);
      push({
        kind: "kneel",
        call: `${qb.last} kneels. Clock.`,
        down: st.down,
        toGo: st.toGo,
        spot: st.spot,
        from,
        to: st.spot,
        yards: 1,
        possession: st.poss,
        playerId: qb.id,
        targetId: null,
        ticks: [],
      });
      continue;
    }

    if (st.down === 4) {
      const goForIt = (st.toGo <= 1 && st.spot > 40 && st.spot < 60) || (trailing && late);
      if (!goForIt && fgDist <= 52 && fgDist >= 20) {
        const good = rand() < 0.78 + (52 - fgDist) * 0.006;
        const from = st.spot;
        burn(12, 18);
        if (good) {
          if (st.poss === "home") st.homeScore += 3;
          else st.awayScore += 3;
          push({
            kind: "fg",
            call: `${k.last} from ${Math.round(fgDist)}. Good.`,
            down: 4,
            toGo: st.toGo,
            spot: st.spot,
            from,
            to: st.poss === "home" ? 99 : 1,
            yards: 0,
            possession: st.poss,
            playerId: k.id,
            targetId: null,
            ticks: tick([k.id], "fg", 0),
          });
          kickoff(other(st.poss));
        } else {
          push({
            kind: "fg",
            call: `${k.last} from ${Math.round(fgDist)}. No.`,
            down: 4,
            toGo: st.toGo,
            spot: st.spot,
            from,
            to: from,
            yards: 0,
            possession: st.poss,
            playerId: k.id,
            targetId: null,
            ticks: [],
          });
          st.poss = other(st.poss);
          st.down = 1;
          st.toGo = 10;
        }
        continue;
      }
      if (!goForIt) {
        const from = st.spot;
        const net = 36 + Math.floor(rand() * 16);
        const land = clipSpot(st.spot + dir * net);
        burn(14, 20);
        push({
          kind: "punt",
          call: `Punt. Downed at the ${spotMark(land)}.`,
          down: 4,
          toGo: st.toGo,
          spot: st.spot,
          from,
          to: land,
          yards: net,
          possession: st.poss,
          playerId: null,
          targetId: null,
          ticks: [],
        });
        st.poss = other(st.poss);
        st.spot = land;
        st.down = 1;
        st.toGo = 10;
        continue;
      }
    }

    const passPlay = st.toGo >= 8 ? rand() < 0.68 : trailing && late ? rand() < 0.72 : rand() < 0.46;
    const from = st.spot;

    if (!passPlay) {
      const boom = rand() > 0.9 - (rb.ovr - 75) * 0.004;
      const yds = boom
        ? 12 + Math.floor(rand() * 28)
        : Math.max(-2, Math.round(2 + rand() * 7 + (rb.ovr - 76) * 0.08));
      const next = clipSpot(st.spot + dir * yds);
      const scored = (st.poss === "home" && next >= 99) || (st.poss === "away" && next <= 1);
      burn(58, 88);
      if (scored) {
        if (st.poss === "home") st.homeScore += 6;
        else st.awayScore += 6;
        push({
          kind: "td",
          call: `${rb.last} punches it in.`,
          down: st.down,
          toGo: st.toGo,
          spot: st.poss === "home" ? 99 : 1,
          from,
          to: st.poss === "home" ? 99 : 1,
          yards: yds,
          possession: st.poss,
          playerId: rb.id,
          targetId: null,
          ticks: tick([rb.id, qb.id], "td", yds),
        });
        extraPoint(st, k, rand, push, tick, kickoff, other);
      } else {
        st.spot = next;
        const gained = yds;
        if (gained >= st.toGo) {
          st.down = 1;
          st.toGo = 10;
        } else {
          st.down += 1;
          st.toGo -= gained;
        }
        if (st.down > 4) {
          st.poss = other(st.poss);
          st.down = 1;
          st.toGo = 10;
        }
        push({
          kind: "run",
          call: boom ? `${rb.last} finds a seam. ${yds}.` : `${rb.last} takes it ${yds}.`,
          down: st.down,
          toGo: Math.max(1, st.toGo),
          spot: st.spot,
          from,
          to: st.spot,
          yards: yds,
          possession: st.poss,
          playerId: rb.id,
          targetId: null,
          ticks: tick([rb.id], "run", yds),
        });
      }
      continue;
    }

    if (rand() < 0.08) {
      const loss = 5 + Math.floor(rand() * 7);
      const next = clipSpot(st.spot - dir * loss);
      burn(16, 24);
      st.spot = next;
      st.down += 1;
      st.toGo += loss;
      push({
        kind: "sack",
        call: `${dstName(defAbbr)} collapse the pocket. ${qb.last} down, ${loss}.`,
        down: st.down,
        toGo: Math.max(1, st.toGo),
        spot: st.spot,
        from,
        to: st.spot,
        yards: -loss,
        possession: st.poss,
        playerId: qb.id,
        targetId: null,
        ticks: tick([qb.id], "sack", -loss),
      });
      if (st.down > 4) {
        st.poss = other(st.poss);
        st.down = 1;
        st.toGo = 10;
      }
      continue;
    }

    if (rand() < 0.11 && qb.ovr >= 84) {
      const yds = 6 + Math.floor(rand() * 18);
      const next = clipSpot(st.spot + dir * yds);
      const scored = (st.poss === "home" && next >= 99) || (st.poss === "away" && next <= 1);
      burn(48, 72);
      if (scored) {
        if (st.poss === "home") st.homeScore += 6;
        else st.awayScore += 6;
        push({
          kind: "td",
          call: `${qb.last} keeps it. Gone.`,
          down: st.down,
          toGo: st.toGo,
          spot: st.poss === "home" ? 99 : 1,
          from,
          to: st.poss === "home" ? 99 : 1,
          yards: yds,
          possession: st.poss,
          playerId: qb.id,
          targetId: null,
          ticks: tick([qb.id], "td", yds),
        });
        extraPoint(st, k, rand, push, tick, kickoff, other);
      } else {
        st.spot = next;
        if (yds >= st.toGo) {
          st.down = 1;
          st.toGo = 10;
        } else {
          st.down += 1;
          st.toGo -= yds;
        }
        if (st.down > 4) {
          st.poss = other(st.poss);
          st.down = 1;
          st.toGo = 10;
        }
        push({
          kind: "scramble",
          call: `${qb.last} out of the pocket, ${yds}.`,
          down: st.down,
          toGo: Math.max(1, st.toGo),
          spot: st.spot,
          from,
          to: st.spot,
          yards: yds,
          possession: st.poss,
          playerId: qb.id,
          targetId: null,
          ticks: tick([qb.id], "scramble", yds),
        });
      }
      continue;
    }

    if (rand() < 0.055) {
      const yds = 4 + Math.floor(rand() * 22);
      const land = clipSpot(st.spot + dir * yds);
      burn(18, 28);
      push({
        kind: "int",
        call: `${dstName(defAbbr)} takes it away.`,
        down: st.down,
        toGo: st.toGo,
        spot: land,
        from,
        to: land,
        yards: yds,
        possession: st.poss,
        playerId: qb.id,
        targetId: null,
        ticks: tick([qb.id], "int", 0),
      });
      st.poss = other(st.poss);
      st.spot = land;
      st.down = 1;
      st.toGo = 10;
      continue;
    }

    if (rand() < 0.34 - (qb.ovr - 80) * 0.004) {
      burn(22, 34);
      st.down += 1;
      push({
        kind: "incomplete",
        call: `${qb.last}, looking… incomplete.`,
        down: st.down,
        toGo: st.toGo,
        spot: st.spot,
        from,
        to: from,
        yards: 0,
        possession: st.poss,
        playerId: qb.id,
        targetId: wr.id,
        ticks: [],
      });
      if (st.down > 4) {
        st.poss = other(st.poss);
        st.down = 1;
        st.toGo = 10;
      }
      continue;
    }

    const target = rand() > 0.28 ? wr : rand() > 0.45 ? te : rb;
    const deep = rand() > 0.82 && st.toGo >= 8;
    const yds = deep
      ? 16 + Math.floor(rand() * 32)
      : 5 + Math.floor(rand() * 14 + (target.ovr - 76) * 0.1);
    const next = clipSpot(st.spot + dir * yds);
    const scored = (st.poss === "home" && next >= 99) || (st.poss === "away" && next <= 1);
    burn(62, 92);
    if (scored) {
      if (st.poss === "home") st.homeScore += 6;
      else st.awayScore += 6;
      push({
        kind: "td",
        call: `${qb.last} finds ${target.last}.`,
        down: st.down,
        toGo: st.toGo,
        spot: st.poss === "home" ? 99 : 1,
        from,
        to: st.poss === "home" ? 99 : 1,
        yards: yds,
        possession: st.poss,
        playerId: qb.id,
        targetId: target.id,
        ticks: tick([qb.id, target.id], "td", yds),
      });
      extraPoint(st, k, rand, push, tick, kickoff, other);
    } else {
      st.spot = next;
      if (yds >= st.toGo) {
        st.down = 1;
        st.toGo = 10;
      } else {
        st.down += 1;
        st.toGo -= yds;
      }
      if (st.down > 4) {
        st.poss = other(st.poss);
        st.down = 1;
        st.toGo = 10;
      }
      push({
        kind: "catch",
        call: deep ? `${target.last} behind the defense, ${yds}.` : `${qb.last} to ${target.last}, ${yds}.`,
        down: st.down,
        toGo: Math.max(1, st.toGo),
        spot: st.spot,
        from,
        to: st.spot,
        yards: yds,
        possession: st.poss,
        playerId: qb.id,
        targetId: target.id,
        ticks: tick([qb.id, target.id], "catch", yds),
      });
    }
  }

  for (const id of ownedAll) {
    const left = remain[id] ?? 0;
    if (left <= 0.2) continue;
    const pl = getPlayer(id);
    const board = boardOf.get(id) ?? "home";
    plays.push({
      kind: "also",
      call: alsoCall(id, left, opts.week),
      clock: "Final",
      quarter: 4,
      down: 1,
      toGo: 10,
      spot: 50,
      from: 50,
      to: 50,
      yards: 0,
      possession: "home",
      playerId: id,
      targetId: null,
      homeScore: st.homeScore,
      awayScore: st.awayScore,
      hold: 1.05,
      ticks: [{ playerId: id, pts: left, board }],
      also: { playerId: id, call: `${pl.name} · rest of the night`, pts: left, board },
    });
    remain[id] = 0;
  }

  if (plays.length > 0) {
    const last = plays[plays.length - 1]!;
    last.homeScore = st.homeScore;
    last.awayScore = st.awayScore;
  }

  plays.push({
    kind: "kneel",
    call: `${featured.home.city} ${st.homeScore}, ${featured.away.city} ${st.awayScore}.`,
    clock: "Final",
    quarter: 4,
    down: 1,
    toGo: 10,
    spot: 50,
    from: 50,
    to: 50,
    yards: 0,
    possession: "home",
    playerId: null,
    targetId: null,
    homeScore: st.homeScore,
    awayScore: st.awayScore,
    hold: 1.4,
    ticks: [],
    also: null,
  });

  return { featured, plays };
}

export function nightFromWire(opts: {
  card: WireGame;
  ownedHome: string[];
  ownedAway: string[];
  homePts: Record<string, number>;
  awayPts: Record<string, number>;
  week: number;
}): NightGame | null {
  const snaps = opts.card.plays;
  if (!snaps || snaps.length < 2) return null;
  const featured = { home: teamOf(opts.card.homeAbbr), away: teamOf(opts.card.awayAbbr) };
  const ownedAll = [...opts.ownedHome, ...opts.ownedAway];
  const remain: Record<string, number> = {};
  const boardOf = new Map<string, "home" | "away">();
  for (const id of opts.ownedHome) {
    remain[id] = opts.homePts[id] ?? 0;
    boardOf.set(id, "home");
  }
  for (const id of opts.ownedAway) {
    remain[id] = opts.awayPts[id] ?? 0;
    boardOf.set(id, "away");
  }
  const featuredIds = new Set(
    [...playersOnTeam(featured.home.abbr), ...playersOnTeam(featured.away.abbr)].map((p) => p.id),
  );
  const alsoQueue: Array<{ playerId: string; board: "home" | "away"; pts: number }> = [];
  for (const id of ownedAll) {
    if (featuredIds.has(id)) continue;
    const pts = remain[id] ?? 0;
    if (pts <= 0) continue;
    alsoQueue.push({ playerId: id, board: boardOf.get(id) ?? "home", pts });
    remain[id] = 0;
  }
  alsoQueue.sort((a, b) => b.pts - a.pts);

  const tick = (ids: Array<string | null>, kind: PlayKind, yards: number): FantasyTick[] => {
    const out: FantasyTick[] = [];
    for (const id of ids) {
      if (!id || remain[id] == null) continue;
      const left = remain[id]!;
      if (left <= 0) continue;
      const board = boardOf.get(id);
      if (!board) continue;
      const pl = getPlayer(id);
      let chunk = 0.4 + Math.abs(yards) * (pl.pos === "QB" ? 0.04 : 0.1);
      if (kind === "td") chunk += pl.pos === "QB" ? 4 : 6;
      if (kind === "int" || kind === "sack") chunk = Math.min(left, 1.2);
      if (kind === "fg") chunk = Math.min(left, 3);
      if (kind === "xp") chunk = Math.min(left, 1);
      chunk = Math.min(left, Math.max(0.3, chunk));
      remain[id] = Math.round((left - chunk) * 10) / 10;
      out.push({ playerId: id, pts: Math.round(chunk * 10) / 10, board });
    }
    return out;
  };

  const plays: NightPlay[] = snaps.map((snap, i) => {
    const alsoRaw = alsoQueue.length > 0 && i > 4 && i % 9 === 3 ? alsoQueue.shift() : null;
    const also = alsoRaw
      ? {
          playerId: alsoRaw.playerId,
          pts: alsoRaw.pts,
          board: alsoRaw.board,
          call: alsoCall(alsoRaw.playerId, alsoRaw.pts, opts.week),
        }
      : null;
    return {
      kind: snap.kind,
      call: snap.call,
      clock: snap.clock,
      quarter: snap.quarter,
      down: snap.down,
      toGo: snap.toGo,
      spot: snap.spot,
      from: snap.from,
      to: snap.to,
      yards: snap.yards,
      possession: snap.possession,
      playerId: snap.playerId,
      targetId: snap.targetId,
      homeScore: snap.homeScore,
      awayScore: snap.awayScore,
      hold: holdFor(snap.kind) * 0.82 + (also ? 0.2 : 0),
      ticks: tick([snap.playerId, snap.targetId], snap.kind, snap.yards),
      also,
    };
  });

  const lastSnap = snaps[snaps.length - 1]!;
  if (opts.card.state !== "live") {
    for (const id of ownedAll) {
      const left = remain[id] ?? 0;
      if (left <= 0.2) continue;
      const pl = getPlayer(id);
      const board = boardOf.get(id) ?? "home";
      const last = plays[plays.length - 1]!;
      plays.push({
        kind: "also",
        call: alsoCall(id, left, opts.week),
        clock: last.clock,
        quarter: last.quarter,
        down: 1,
        toGo: 10,
        spot: 50,
        from: 50,
        to: 50,
        yards: 0,
        possession: "home",
        playerId: id,
        targetId: null,
        homeScore: last.homeScore,
        awayScore: last.awayScore,
        hold: 1,
        ticks: [{ playerId: id, pts: left, board }],
        also: { playerId: id, call: `${pl.name} · rest of the night`, pts: left, board },
      });
      remain[id] = 0;
    }
    plays.push({
      kind: "kneel",
      call: `${featured.away.city} ${lastSnap.awayScore}, ${featured.home.city} ${lastSnap.homeScore}.`,
      clock: "Final",
      quarter: 4,
      down: 1,
      toGo: 10,
      spot: 50,
      from: 50,
      to: 50,
      yards: 0,
      possession: "home",
      playerId: null,
      targetId: null,
      homeScore: lastSnap.homeScore,
      awayScore: lastSnap.awayScore,
      hold: 1.4,
      ticks: [],
      also: null,
    });
  }

  return { featured, plays };
}

function extraPoint(
  st: Engine,
  k: Skill,
  rand: () => number,
  push: (p: Omit<NightPlay, "clock" | "quarter" | "homeScore" | "awayScore" | "hold" | "also">) => void,
  tick: (ids: Array<string | null>, kind: PlayKind, yards: number) => FantasyTick[],
  kickoff: (to: "home" | "away") => void,
  other: (p: "home" | "away") => "home" | "away",
) {
  const good = rand() < 0.94;
  if (good) {
    if (st.poss === "home") st.homeScore += 1;
    else st.awayScore += 1;
  }
  push({
    kind: "xp",
    call: good ? `${k.last}, extra point.` : `${k.last} misses the extra.`,
    down: 1,
    toGo: 10,
    spot: st.poss === "home" ? 85 : 15,
    from: st.poss === "home" ? 85 : 15,
    to: st.poss === "home" ? 99 : 1,
    yards: 0,
    possession: st.poss,
    playerId: k.id,
    targetId: null,
    ticks: good ? tick([k.id], "xp", 0) : [],
  });
  kickoff(other(st.poss));
}

function alsoCall(playerId: string, pts: number, week: number) {
  const pl = getPlayer(playerId);
  const city = teamCity(pl.nfl);
  if (pl.bye === week) return `${pl.name} sits. Bye.`;
  if (pts <= 0) return `${pl.name} — quiet night.`;
  if (pl.pos === "QB") return `${pl.name} still throwing in ${city}.`;
  if (pl.pos === "RB") return `${pl.name} finds the end zone. ${city}.`;
  if (pl.pos === "K") return `${pl.name} from distance. ${city}.`;
  if (pl.pos === "DST") return `${pl.name} get after the quarterback.`;
  return `${pl.name} wins a jump ball. ${city}.`;
}

export function lineupIds(roster: Roster | undefined): string[] {
  if (!roster) return [];
  return STARTER_SLOTS.map((s) => roster.lineup[s]).filter((id): id is string => Boolean(id));
}

export function downLabel(down: number, toGo: number, spot: number, poss: "home" | "away", home: NflTeam, away: NflTeam) {
  if (down < 1) return "";
  const nth = ["", "1st", "2nd", "3rd", "4th"][Math.min(4, down)] ?? `${down}th`;
  const side = poss === "home" ? home.abbr : away.abbr;
  const y = spotMark(spot);
  return `${nth} & ${Math.max(1, Math.round(toGo))} · ${side} ${y}`;
}
