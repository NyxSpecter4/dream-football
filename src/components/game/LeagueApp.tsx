import { useEffect, useMemo, useState } from "react";
import { House, ListOrdered, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fmtPts, JerseyMark, PlayerRow, RoomBar, useLeaveRoom, WeekLabel } from "./chrome";
import { useGame } from "@/game/store";
import { getPlayer } from "@/game/players";
import { slotLabel, teamById } from "@/game/league";
import { freeAgents, ownedSet, remainingValue, standings } from "@/game/simulate";
import { NightBroadcast } from "./Broadcast";
import { cn } from "@/lib/utils";
import { sfxWin, sfxLoss } from "@/game/audio";
import { REGULAR_WEEKS, STARTER_SLOTS, type Screen, type Slot } from "@/game/types";

export function LeagueApp() {
  const screen = useGame((s) => s.screen);
  return (
    <Field>
      <div className="mx-auto min-h-dvh max-w-3xl pb-24">
        {screen === "home" && <HomeScreen />}
        {screen === "roster" && <RosterScreen />}
        {screen === "matchup" && <MatchupScreen />}
        {screen === "standings" && <StandingsScreen />}
        <LeagueNav />
      </div>
    </Field>
  );
}

function LeagueNav() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const items: Array<{ id: Screen; label: string; icon: typeof House }> = [
    { id: "home", label: "Home", icon: House },
    { id: "roster", label: "Roster", icon: Users },
    { id: "matchup", label: "Watch", icon: Swords },
    { id: "standings", label: "Table", icon: ListOrdered },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const on = screen === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setScreen(item.id)}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[11px]",
                  on ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeScreen() {
  const teams = useGame((s) => s.teams);
  const you = useGame((s) => s.playerTeamId);
  const week = useGame((s) => s.week);
  const phase = useGame((s) => s.phase);
  const results = useGame((s) => s.results);
  const schedule = useGame((s) => s.schedule);
  const bracket = useGame((s) => s.playoffBracket);
  const playWeek = useGame((s) => s.playWeek);
  const resetSeason = useGame((s) => s.resetSeason);
  const leave = useLeaveRoom();
  const online = useGame((s) => s.online);
  const setScreen = useGame((s) => s.setScreen);
  const ticker = useGame((s) => s.ticker);
  const youTeam = teamById(teams, you);
  const rows = standings(teams, results, Math.min(week - 1, REGULAR_WEEKS));
  const youRow = rows.find((r) => r.teamId === you);
  const rank = rows.findIndex((r) => r.teamId === you) + 1;

  const opponentId = useMemo(() => {
    if (phase === "complete") return null;
    if (week <= REGULAR_WEEKS) {
      const m = (schedule[week - 1] ?? []).find((x) => x.homeId === you || x.awayId === you);
      return m ? (m.homeId === you ? m.awayId : m.homeId) : null;
    }
    if (week === 8 && bracket) {
      const m = [bracket.semiA, bracket.semiB].find((x) => x.homeId === you || x.awayId === you);
      return m ? (m.homeId === you ? m.awayId : m.homeId) : null;
    }
    if (week === 9 && bracket?.final) {
      const m = bracket.final;
      if (m.homeId === you || m.awayId === you) return m.homeId === you ? m.awayId : m.homeId;
    }
    return null;
  }, [phase, week, schedule, bracket, you]);

  const inPlayoffs =
    phase === "playoffs" &&
    Boolean(
      week === 8
        ? bracket && [bracket.semiA, bracket.semiB].some((m) => m.homeId === you || m.awayId === you)
        : bracket?.final && (bracket.final.homeId === you || bracket.final.awayId === you),
    );

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        <WeekLabel week={week} phase={phase} />
      </p>
      <h1 className="mt-1 flex items-center gap-2 font-display text-4xl font-semibold tracking-tight">
        <JerseyMark jersey={youTeam.jersey} className="size-3" />
        {youTeam.name}
      </h1>
      <p className="mt-2 font-mono text-sm tabular-nums text-muted">
        {youRow ? `${youRow.wins}–${youRow.losses}` : "0–0"}
        {rank ? ` · ${rank} of 8` : ""}
      </p>
      {online && <RoomBar className="mt-3" />}

      {phase === "complete" && bracket?.championId && (
        <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Season closed</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            {bracket.championId === you ? "You take the night." : `${teamById(teams, bracket.championId).name} win it.`}
          </h2>
          <Button className="mt-5" onClick={online ? leave : resetSeason}>
            {online ? "Leave room" : "New season"}
          </Button>
        </section>
      )}

      {phase !== "complete" && (
        <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Next</p>
          {opponentId ? (
            <>
              <h2 className="mt-2 font-display text-3xl font-semibold">{teamById(teams, opponentId).name}</h2>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button disabled={Boolean(ticker)} onClick={playWeek}>
                  Watch {week <= REGULAR_WEEKS ? "tonight" : week === 8 ? "the semi" : "the final"}
                </Button>
                <Button variant="secondary" onClick={() => setScreen("roster")}>
                  Set lineup
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                {phase === "playoffs" && !inPlayoffs ? "Eliminated" : "Waiting on the bracket"}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {phase === "playoffs" && !inPlayoffs
                  ? "The final four play on without you. Advance the week to close the book."
                  : "Check the table."}
              </p>
              <Button className="mt-5" disabled={Boolean(ticker)} onClick={playWeek}>
                Advance
              </Button>
            </>
          )}
        </section>
      )}

      {week > 1 && results[week - 1]?.[you] && (
        <p className="mt-6 text-sm text-muted">
          Last: {results[week - 1]![you]!.won ? "Win" : "Loss"} {fmtPts(results[week - 1]![you]!.points)}–
          {fmtPts(results[week - 1]![you]!.opponentPoints)}
        </p>
      )}
    </main>
  );
}

function RosterScreen() {
  const you = useGame((s) => s.playerTeamId);
  const roster = useGame((s) => s.rosters[s.playerTeamId]);
  const week = useGame((s) => s.week);
  const phase = useGame((s) => s.phase);
  const swapSlot = useGame((s) => s.swapSlot);
  const waiverClaims = useGame((s) => s.waiverClaims);
  const results = useGame((s) => s.results);
  const rosters = useGame((s) => s.rosters);
  const claimWaiver = useGame((s) => s.claimWaiver);
  const skipWaiver = useGame((s) => s.skipWaiver);
  const [pickedSlot, setPickedSlot] = useState<Slot | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  if (!roster) return null;
  const showWaiver =
    phase === "regular" && week > 1 && !waiverClaims.includes(you) && Boolean(results[week - 1]);
  const owned = ownedSet(rosters);
  const fa = freeAgents(owned).slice(0, 8);

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Lineup</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Roster</h1>
      <p className="mt-2 text-sm text-muted">Tap a starter, then a bench piece to swap.</p>

      <ul className="mt-6 flex flex-col gap-1.5">
        {STARTER_SLOTS.map((slot) => {
          const id = roster.lineup[slot];
          const pl = id ? getPlayer(id) : null;
          const bye = pl && pl.bye === week;
          return (
            <li key={slot}>
              <button
                type="button"
                onClick={() => setPickedSlot(pickedSlot === slot ? null : slot)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface px-3 text-left shadow-[var(--shadow-border)]",
                  pickedSlot === slot && "shadow-[var(--shadow-border-hover)] bg-surface-2",
                )}
              >
                <span className="w-10 font-mono text-[11px] text-muted">{slotLabel(slot)}</span>
                {pl ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{pl.name}</span>
                    <span className="font-mono text-[11px] text-muted">
                      {pl.nfl}
                      {bye ? " · bye" : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-subtle">Empty</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 font-display text-xl font-semibold">Bench</h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {roster.bench.length === 0 && <li className="text-sm text-muted">No bench.</li>}
        {roster.bench.map((id) => {
          const pl = getPlayer(id);
          return (
            <li key={id}>
              <PlayerRow
                player={pl}
                active={dropId === id}
                onClick={() => {
                  if (pickedSlot) {
                    swapSlot(pickedSlot, id);
                    setPickedSlot(null);
                  } else {
                    setDropId(dropId === id ? null : id);
                  }
                }}
              />
            </li>
          );
        })}
      </ul>

      {showWaiver && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Waivers</h2>
          <p className="mt-1 text-sm text-muted">One add this week. Tap a bench name to drop, then a free agent.</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {fa.map((pl) => (
              <li key={pl.id}>
                <PlayerRow
                  player={pl}
                  trailing={
                    <span className="font-mono text-[11px] text-muted">{remainingValue(pl, week).toFixed(0)} rest</span>
                  }
                  onClick={() => {
                    const drop = dropId ?? roster.bench[0];
                    if (!drop) return;
                    claimWaiver(pl.id, drop);
                    setDropId(null);
                  }}
                />
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="mt-3" onClick={() => skipWaiver()}>
            Skip waivers
          </Button>
        </section>
      )}
    </main>
  );
}

function MatchupScreen() {
  const ticker = useGame((s) => s.ticker);
  const results = useGame((s) => s.results);
  const teams = useGame((s) => s.teams);
  const you = useGame((s) => s.playerTeamId);
  const week = useGame((s) => s.week);
  const seasonSeed = useGame((s) => s.seasonSeed);
  const rosters = useGame((s) => s.rosters);
  const skipTicker = useGame((s) => s.skipTicker);
  const closeTicker = useGame((s) => s.closeTicker);
  const setScreen = useGame((s) => s.setScreen);
  const phase = useGame((s) => s.phase);

  const playedWeek = ticker?.week ?? (results[week - 1] ? week - 1 : week);
  const box = results[playedWeek]?.[you];

  useEffect(() => {
    if (!ticker?.done || !box) return;
    if (box.won) sfxWin();
    else sfxLoss();
  }, [ticker?.done, box]);

  if (!box && !ticker) {
    return (
      <main className="px-5 pt-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Watch</h1>
        <p className="mt-3 text-sm text-muted">Nothing on tonight. Set your lineup, then watch from Home.</p>
        <Button className="mt-6" onClick={() => setScreen("home")}>
          Home
        </Button>
      </main>
    );
  }

  const home = ticker?.homeId ?? you;
  const away = ticker?.awayId ?? box?.opponentId ?? you;
  const homeTeam = teamById(teams, home);
  const awayTeam = teamById(teams, away);
  const homeBox = results[playedWeek]?.[home];
  const awayBox = results[playedWeek]?.[away];

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        <WeekLabel week={playedWeek} phase={phase} />
      </p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Tonight</h1>
      <p className="mt-2 text-sm text-muted">The game, then your board. Sit with it.</p>

      <div className="mt-6">
        {homeBox && awayBox && rosters[home] && rosters[away] && (
          <NightBroadcast
            week={playedWeek}
            seed={seasonSeed}
            homeName={homeTeam.name}
            awayName={awayTeam.name}
            homeJersey={homeTeam.jersey}
            awayJersey={awayTeam.jersey}
            homeRoster={rosters[home]!}
            awayRoster={rosters[away]!}
            homePts={homeBox.playerPoints}
            awayPts={awayBox.playerPoints}
            live={Boolean(ticker && !ticker.done)}
            onDone={skipTicker}
          />
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {ticker?.done && (
          <Button onClick={closeTicker}>{phase === "complete" ? "Final table" : "Continue"}</Button>
        )}
      </div>

      {ticker?.done && box && (
        <p className={cn("mt-6 font-display text-2xl font-semibold", box.won ? "text-win" : "text-loss")}>
          {box.won ? "Win" : "Loss"} · {fmtPts(box.points)}–{fmtPts(box.opponentPoints)}
        </p>
      )}
    </main>
  );
}

function StandingsScreen() {
  const teams = useGame((s) => s.teams);
  const results = useGame((s) => s.results);
  const week = useGame((s) => s.week);
  const phase = useGame((s) => s.phase);
  const you = useGame((s) => s.playerTeamId);
  const bracket = useGame((s) => s.playoffBracket);
  const resetSeason = useGame((s) => s.resetSeason);
  const leave = useLeaveRoom();
  const online = useGame((s) => s.online);
  const rows = standings(teams, results, Math.min(Math.max(0, week - (phase === "regular" ? 1 : 0)), REGULAR_WEEKS));

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">League</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Table</h1>
      <p className="mt-2 text-sm text-muted">Top four play in week 8.</p>
      <ol className="mt-6 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
        {rows.map((row, i) => {
          const team = teamById(teams, row.teamId);
          return (
            <li
              key={row.teamId}
              className={cn(
                "flex min-h-14 items-center gap-3 px-4",
                row.teamId === you && "bg-surface-2",
                i === 3 && "border-b border-border-strong",
              )}
            >
              <span className="w-6 font-mono text-xs tabular-nums text-muted">{i + 1}</span>
              <JerseyMark jersey={team.jersey} />
              <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>
              <span className="font-mono text-sm tabular-nums">
                {row.wins}–{row.losses}
              </span>
              <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">
                {fmtPts(row.pointsFor)}
              </span>
            </li>
          );
        })}
      </ol>

      {bracket && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Bracket</h2>
          <p className="mt-3 text-sm text-muted">
            Semi · {teamById(teams, bracket.semiA.homeId).short} vs {teamById(teams, bracket.semiA.awayId).short}
          </p>
          <p className="mt-1 text-sm text-muted">
            Semi · {teamById(teams, bracket.semiB.homeId).short} vs {teamById(teams, bracket.semiB.awayId).short}
          </p>
          {bracket.final && (
            <p className="mt-1 text-sm text-muted">
              Final · {teamById(teams, bracket.final.homeId).short} vs {teamById(teams, bracket.final.awayId).short}
            </p>
          )}
          {bracket.championId && (
            <p className="mt-3 font-display text-2xl font-semibold">
              Champion · {teamById(teams, bracket.championId).name}
            </p>
          )}
        </section>
      )}

      {phase === "complete" && (
        <Button className="mt-8" onClick={online ? leave : resetSeason}>
          {online ? "Leave room" : "New season"}
        </Button>
      )}
    </main>
  );
}
