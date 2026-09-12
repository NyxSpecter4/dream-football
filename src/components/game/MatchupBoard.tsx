import { fmtPts, LiveDot, PosChip } from "./chrome";
import { getPlayer } from "@/game/players";
import { liveMark, scoreRosterLive } from "@/game/simulate";
import { slotLabel } from "@/game/league";
import { nflContext, PPR_RULES } from "@/game/scoring";
import { STARTER_SLOTS, type Roster } from "@/game/types";
import { useWire, type WireGame } from "@/game/wire";
import { cn } from "@/lib/utils";

export function ScoringCard() {
  return (
    <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">PPR · this NFL week</p>
      <ul className="mt-2 flex flex-col gap-1">
        {PPR_RULES.map((r) => (
          <li key={r.k} className="flex justify-between gap-3 text-xs">
            <span className="text-muted">{r.k}</span>
            <span className="font-mono tabular-nums text-fg">{r.v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LiveScorePeek({
  homeName,
  awayName,
  homeRoster,
  awayRoster,
  week,
  seed,
}: {
  homeName: string;
  awayName: string;
  homeRoster: Roster;
  awayRoster: Roster;
  week: number;
  seed: number;
}) {
  const { data } = useWire();
  const home = scoreRosterLive(homeRoster, week, seed, data?.stats, data?.games, false);
  const away = scoreRosterLive(awayRoster, week, seed, data?.stats, data?.games, false);
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted">{homeName}</p>
        <p className="font-display text-3xl font-semibold tabular-nums">{fmtPts(home.points)}</p>
        <p className="font-mono text-[11px] tabular-nums text-subtle">proj {fmtPts(home.proj)}</p>
      </div>
      <p className="pb-5 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">
        <LiveDot />
        Live PPR
      </p>
      <div className="min-w-0 flex-1 text-right">
        <p className="truncate text-sm text-muted">{awayName}</p>
        <p className="font-display text-3xl font-semibold tabular-nums">{fmtPts(away.points)}</p>
        <p className="font-mono text-[11px] tabular-nums text-subtle">proj {fmtPts(away.proj)}</p>
      </div>
    </div>
  );
}

export function MatchupBoard({
  homeName,
  awayName,
  homeRoster,
  awayRoster,
  week,
  seed,
  lockUnplayed = false,
}: {
  homeName: string;
  awayName: string;
  homeRoster: Roster;
  awayRoster: Roster;
  week: number;
  seed: number;
  lockUnplayed?: boolean;
}) {
  const { data } = useWire();
  const stats = data?.stats;
  const games = data?.games;

  let homePts = 0;
  let awayPts = 0;
  let homeProj = 0;
  let awayProj = 0;
  const rows = STARTER_SLOTS.map((slot) => {
    const hid = homeRoster.lineup[slot];
    const aid = awayRoster.lineup[slot];
    const hp = hid ? getPlayer(hid) : null;
    const ap = aid ? getPlayer(aid) : null;
    const hm = hp ? liveMark(hp, week, seed, stats, games, lockUnplayed) : null;
    const am = ap ? liveMark(ap, week, seed, stats, games, lockUnplayed) : null;
    if (hm) {
      homePts += hm.pts;
      homeProj += hm.proj;
    }
    if (am) {
      awayPts += am.pts;
      awayProj += am.proj;
    }
    return { slot, hp, ap, hm, am };
  });

  const homeBench = homeRoster.bench.map((id) => {
    const p = getPlayer(id);
    return { p, m: liveMark(p, week, seed, stats, games, lockUnplayed) };
  });
  const awayBench = awayRoster.bench.map((id) => {
    const p = getPlayer(id);
    return { p, m: liveMark(p, week, seed, stats, games, lockUnplayed) };
  });
  const benchN = Math.max(homeBench.length, awayBench.length);

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted">{homeName}</p>
          <p className="font-display text-4xl font-semibold tabular-nums">{fmtPts(homePts)}</p>
          <p className="font-mono text-[11px] tabular-nums text-subtle">proj {fmtPts(homeProj)}</p>
        </div>
        <p className="pb-6 font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">PPR</p>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-sm text-muted">{awayName}</p>
          <p className="font-display text-4xl font-semibold tabular-nums">{fmtPts(awayPts)}</p>
          <p className="font-mono text-[11px] tabular-nums text-subtle">proj {fmtPts(awayProj)}</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={row.slot}
            className={cn(
              "grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150",
              (row.hm?.state === "live" || row.am?.state === "live") &&
                "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-live)_35%,transparent)]",
            )}
          >
            <SlotSide player={row.hp} mark={row.hm} games={games} align="left" />
            <span className="font-mono text-[10px] tracking-wide text-subtle uppercase">{slotLabel(row.slot)}</span>
            <SlotSide player={row.ap} mark={row.am} games={games} align="right" />
          </li>
        ))}
      </ul>
      {benchN > 0 && (
        <>
          <p className="mt-6 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Bench · does not score</p>
          <ul className="mt-2 flex flex-col gap-1">
            {Array.from({ length: benchN }, (_, i) => {
              const hb = homeBench[i];
              const ab = awayBench[i];
              return (
                <li
                  key={`b-${i}`}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-[var(--shadow-border)]"
                >
                  <SlotSide player={hb?.p ?? null} mark={hb?.m ?? null} games={games} align="left" />
                  <span className="font-mono text-[10px] tracking-wide text-subtle uppercase">BN</span>
                  <SlotSide player={ab?.p ?? null} mark={ab?.m ?? null} games={games} align="right" />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function SlotSide({
  player,
  mark,
  games,
  align,
}: {
  player: ReturnType<typeof getPlayer> | null;
  mark: ReturnType<typeof liveMark> | null;
  games: WireGame[] | undefined;
  align: "left" | "right";
}) {
  if (!player || !mark) {
    return <p className={cn("text-sm text-subtle", align === "right" && "text-right")}>—</p>;
  }
  const live = mark.state === "live";
  const done = mark.state === "final";
  const ctx = nflContext(player.nfl, games);
  const tag = ctx ? ctx.line : player.nfl;
  const extra =
    mark.line && mark.line !== ctx?.clock && mark.line !== "Yet to play" ? mark.line : ctx?.clock || mark.line;
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <p className="truncate text-sm font-medium">{player.name}</p>
      <p
        className={cn(
          "flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted",
          align === "right" && "justify-end",
        )}
      >
        {align === "right" && <PosChip pos={player.pos} />}
        {live && <LiveDot />}
        <span className={cn(live ? "text-live" : done ? "text-fg" : "text-subtle")}>{fmtPts(mark.pts)}</span>
        <span className="text-subtle">/{fmtPts(mark.proj)}</span>
        {align === "left" && <PosChip pos={player.pos} />}
      </p>
      <p className="truncate text-[11px] text-subtle">
        {tag}
        {extra ? ` · ${extra}` : ""}
      </p>
    </div>
  );
}
