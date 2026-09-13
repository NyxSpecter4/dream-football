import { useEffect, useState } from "react";
import { House, ListOrdered, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fmtMoney, fmtPts, JerseyMark, PlayerMark, PlayerRow, RoomBar, useLeaveRoom, WeekLabel } from "./chrome";
import { boxChips } from "@/game/box";
import { useGame } from "@/game/store";
import { getPlayer } from "@/game/players";
import { slotLabel, teamById, opponentOf, rosterPlayerIds, clubLine } from "@/game/league";
import { conferenceOf } from "@/game/cities";
import { freeAgents, ownedSet, remainingValue, scoreRosterLive, standings } from "@/game/simulate";
import { NightBroadcast } from "./Broadcast";
import { WireStrip } from "./Wire";
import { lineupIds } from "@/game/broadcast";
import { STAKES } from "@/game/cash";
import { cn } from "@/lib/utils";
import { sfxWin, sfxLoss } from "@/game/audio";
import { salaryOf } from "@/game/franchise";
import { SALARY_CAP, ROSTER_SIZE, CHAMPIONSHIP_WEEK, PLAYOFF_WEEK, REGULAR_WEEKS, STARTER_SLOTS, FAAB_BUDGET, WAIVER_MAX, type LeagueTeam, type Screen, type SideBet, type Slot } from "@/game/types";
import { pickWireForOwned, useWire } from "@/game/wire";
import { LiveScorePeek, MatchupBoard, ScoringCard } from "./MatchupBoard";
import { BoardGuide, GuideLink } from "./BoardGuide";
import { StadiumHero } from "./StadiumHero";
import { nflContext, weekLocked } from "@/game/scoring";

export function LeagueApp() {
  const screen = useGame((s) => s.screen);
  return (
    <Field>
      <div className="mx-auto min-h-dvh max-w-3xl pb-24">
        {screen === "home" && <HomeScreen />}
        {screen === "roster" && <RosterScreen />}
        {screen === "matchup" && <MatchupScreen />}
        {screen === "standings" && <StandingsScreen />}
        {screen === "offseason" && <OffseasonScreen />}
        {screen !== "offseason" && <LeagueNav />}
      </div>
    </Field>
  );
}

function LeagueNav() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const items: Array<{ id: Screen; label: string; icon: typeof House }> = [
    { id: "home", label: "Club", icon: House },
    { id: "roster", label: "Squad", icon: Users },
    { id: "matchup", label: "Match", icon: Swords },
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
                  "flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-150",
                  on ? "nav-on" : "text-muted hover:text-fg",
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

function StarterDesk({ roster, week }: { roster: import("@/game/types").Roster; week: number }) {
  const { data: wire } = useWire();
  const ids = STARTER_SLOTS.map((s) => roster.lineup[s]).filter((id): id is string => Boolean(id));
  const holes = STARTER_SLOTS.length - ids.length;
  const hurt = ids.map(getPlayer).filter((p) => p.injury);
  const live = scoreRosterLive(roster, week, useGame.getState().seasonSeed, wire?.stats, wire?.games, false);
  return (
    <section className="mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Squad this week</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {fmtPts(live.points)} <span className="text-muted">live</span>
        <span className="text-subtle"> / {fmtPts(live.proj)} proj</span>
      </p>
      {holes > 0 && <p className="mt-2 text-sm text-loss">{holes} starter hole{holes === 1 ? "" : "s"}. Set lineup.</p>}
      {hurt.length > 0 && (
        <ul className="mt-2 space-y-1">
          {hurt.map((p) => (
            <li key={p.id} className="text-sm">
              <span className="font-mono text-[10px] text-loss">{p.injury}</span> {p.name}
            </li>
          ))}
        </ul>
      )}
      {holes === 0 && hurt.length === 0 && <p className="mt-2 text-sm text-muted">Starters in. No injury tags.</p>}
    </section>
  );
}

function ChatDock() {
  const log = useGame((s) => s.chatLog);
  const sendChat = useGame((s) => s.sendChat);
  const pushChat = useGame((s) => s.pushChat);
  const teams = useGame((s) => s.teams);
  const you = useGame((s) => s.playerTeamId);
  const [text, setText] = useState("");
  const bots = teams.filter((t) => !t.human && t.manager);
  return (
    <section className="mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[11px] tracking-wide text-muted uppercase">League chat</p>
      <p className="mt-1 text-xs text-muted">You, Cindy, and six Grok managers.</p>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
        {log.length === 0 && <li className="text-sm text-muted">Talk. A Grok manager will answer.</li>}
        {log.map((row) => (
          <li key={row.id} className="text-sm">
            <span className="font-mono text-[11px] text-muted">{row.name}</span> {row.text}
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const msg = text.trim();
          if (!msg) return;
          sendChat(msg);
          setText("");
          const bot = bots[Math.floor(Math.random() * Math.max(1, bots.length))];
          const human = teams.find((t) => t.id === you)?.short || "You";
          void fetch("/api/grok-bot", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ manager: bot?.manager ?? "Grok Zero", human, text: msg }),
          })
            .then((r) => r.json())
            .then((d: { reply?: string; manager?: string }) => {
              if (d.reply) pushChat(d.manager || bot?.manager || "Grok", d.reply);
            })
            .catch(() => undefined);
        }}
      >
        <input
          value={text}
          maxLength={140}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the room"
          className="h-11 min-w-0 flex-1 rounded-lg bg-surface-2 px-3 text-sm text-fg outline-none"
        />
        <Button type="submit" size="sm" disabled={!text.trim()}>
          Send
        </Button>
      </form>
    </section>
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
  const keepClub = useGame((s) => s.keepClub);
  const leave = useLeaveRoom();
  const online = useGame((s) => s.online);
  const setScreen = useGame((s) => s.setScreen);
  const ticker = useGame((s) => s.ticker);
  const roster = useGame((s) => s.rosters[s.playerTeamId]);
  const rosters = useGame((s) => s.rosters);
  const seasonSeed = useGame((s) => s.seasonSeed);
  const seasonNo = useGame((s) => s.seasonNo ?? 1);
  const youTeam = teamById(teams, you);
  const cash = useGame((s) => s.cash?.[s.playerTeamId] ?? 0);
  const bets = useGame((s) => s.bets ?? []);
  const offerBet = useGame((s) => s.offerBet);
  const takeBet = useGame((s) => s.takeBet);
  const passBet = useGame((s) => s.passBet);
  const { data: wire } = useWire();
  const nflLive = weekLocked(wire?.games);
  const rows = standings(teams, results, Math.min(week - 1, REGULAR_WEEKS));
  const youRow = rows.find((r) => r.teamId === you);
  const rank = rows.findIndex((r) => r.teamId === you) + 1;

  const opponentId = opponentOf(you, week, phase, schedule, bracket);

  const inPlayoffs =
    phase === "playoffs" &&
    Boolean(
      week === PLAYOFF_WEEK
        ? bracket && [bracket.semiA, bracket.semiB].some((m) => m.homeId === you || m.awayId === you)
        : bracket?.final && (bracket.final.homeId === you || bracket.final.awayId === you),
    );

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        Season {seasonNo} · <WeekLabel week={week} phase={phase} />
      </p>
      <h1 className="mt-1 flex items-center gap-2 font-display text-4xl font-semibold tracking-tight">
        <JerseyMark jersey={youTeam.jersey} className="size-3" />
        {youTeam.name}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {clubLine(youTeam)} · {youTeam.nfl} {conferenceOf(youTeam.nfl)}
      </p>
      <div className="mt-4">
        <StadiumHero
          compact
          city={youTeam.city}
          stadium={youTeam.stadium}
          jersey={youTeam.jersey}
          club={youTeam.name}
        />
      </div>
      <p className="mt-2 font-mono text-sm tabular-nums text-muted">
        {youRow ? `${youRow.wins}–${youRow.losses}` : "0–0"}
        {rank ? ` · ${rank} of 8` : ""}
      </p>
      {online && <RoomBar className="mt-3" />}

      {roster && (
        <StarterDesk roster={roster} week={week} />
      )}
      <ChatDock />

      {phase === "complete" && bracket?.championId && (
        <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Title decided</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            {bracket.championId === you ? "You won." : `${teamById(teams, bracket.championId).name} won.`}
          </h2>
          <p className="mt-2 text-sm text-muted">Keep this team for next season, or start over.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {!online && (
              <Button onClick={keepClub}>Keep this team</Button>
            )}
            <Button variant="secondary" onClick={online ? leave : resetSeason}>
              {online ? "Leave room" : "Start over"}
            </Button>
          </div>
        </section>
      )}

      {phase !== "complete" && (
        <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Next</p>
          {opponentId ? (
            <>
              <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold">
                <JerseyMark jersey={teamById(teams, opponentId).jersey} className="size-3" />
                {teamById(teams, opponentId).name}
              </h2>
              {roster && rosters[opponentId] && (
                <div className="mt-4">
                  <LiveScorePeek
                    homeName={youTeam.name}
                    awayName={teamById(teams, opponentId).name}
                    homeRoster={roster}
                    awayRoster={rosters[opponentId]!}
                    week={week}
                    seed={seasonSeed}
                  />
                </div>
              )}
              <p className="mt-3 text-sm text-muted">
                {nflLive
                  ? "Games are on. Live PPR as they land. Names that haven't kicked sit at 0.0."
                  : "Live PPR on this NFL week. Names that haven't kicked sit at 0.0."}
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => setScreen("roster")}>Set lineup</Button>
                <Button variant="secondary" disabled={Boolean(ticker)} onClick={() => setScreen("matchup")}>
                  This week's match
                </Button>
                <Button variant="secondary" disabled={Boolean(ticker)} onClick={playWeek}>
                  {nflLive ? "Score this week" : "Play the week"}
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

      {phase !== "complete" && opponentId && (
        <StakePad
          opponentId={opponentId}
          you={you}
          cash={cash}
          bets={bets.filter((b) => b.week === week)}
          teams={teams}
          offerBet={offerBet}
          takeBet={takeBet}
          passBet={passBet}
        />
      )}

      <div className="mt-8">
        <ScoringCard />
      </div>

      <div className="mt-8">
        <WireStrip owned={lineupIds(roster)} />
      </div>

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
  const seasonSeed = useGame((s) => s.seasonSeed);
  const swapSlot = useGame((s) => s.swapSlot);
  const waiverClaims = useGame((s) => s.waiverClaims);
  const faab = useGame((s) => s.faab?.[s.playerTeamId] ?? FAAB_BUDGET);
  const results = useGame((s) => s.results);
  const rosters = useGame((s) => s.rosters);
  const claimWaiver = useGame((s) => s.claimWaiver);
  const skipWaiver = useGame((s) => s.skipWaiver);
  const sendToIr = useGame((s) => s.sendToIr);
  const activateIr = useGame((s) => s.activateIr);
  const { data: wire } = useWire();
  const [pickedSlot, setPickedSlot] = useState<Slot | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  if (!roster) return null;
  const used = waiverClaims.filter((id) => id === you).length;
  const showWaiver =
    phase === "regular" && week > 1 && used < WAIVER_MAX && Boolean(results[week - 1]);
  const owned = ownedSet(rosters);
  const trend = new Map((wire?.trending ?? []).map((t) => [t.id, t.count]));
  const fa = freeAgents(owned)
    .sort((a, b) => (trend.get(b.id) ?? 0) - (trend.get(a.id) ?? 0) || b.ovr - a.ovr)
    .slice(0, 12);
  const live = scoreRosterLive(roster, week, seasonSeed, wire?.stats, wire?.games, false);

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Lineup</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Roster</h1>
      <p className="mt-2 text-sm text-muted">
        Tap a starter, then a bench piece to swap. {fmtPts(live.points)} live · {fmtPts(live.proj)} proj · PPR.
      </p>

      <ul className="mt-6 flex flex-col gap-1.5">
        {STARTER_SLOTS.map((slot) => {
          const id = roster.lineup[slot];
          const pl = id ? getPlayer(id) : null;
          const mark = pl ? live.marks[pl.id] : null;
          const ctx = pl ? nflContext(pl.nfl, wire?.games) : null;
          const bye = pl && pl.bye === week;
          return (
            <li key={slot}>
              <button
                type="button"
                onClick={() => setPickedSlot(pickedSlot === slot ? null : slot)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface px-3 py-2 text-left shadow-[var(--shadow-border)]",
                  pickedSlot === slot && "shadow-[var(--shadow-border-hover)] bg-surface-2",
                )}
              >
                <span className="w-10 font-mono text-[11px] text-muted">{slotLabel(slot)}</span>
                {pl && mark ? (
                  <>
                    <PlayerMark player={pl} live={mark.state === "live"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{pl.name}</span>
                      <span className="font-mono text-[11px] text-muted">
                        {pl.nfl}
                        {bye ? " · bye" : ctx ? ` · ${ctx.line}` : ""}
                        {mark.line && !bye ? ` · ${mark.line}` : ""}
                      </span>
                      {wire?.stats[pl.id]?.box && (
                        <span className="stagger-in mt-1 flex flex-wrap gap-1">
                          {boxChips(wire.stats[pl.id]!.box!, pl.pos).map((c) => (
                            <span key={c.k} className={cn("stat-chip", mark.state === "live" && "stat-chip-live")}>
                              <span className="text-subtle">{c.k}</span> {c.v}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span
                        key={mark.pts}
                        className={cn(
                          "pop-in block font-mono text-sm tabular-nums",
                          mark.state === "live" ? "text-win" : mark.state === "final" ? "text-fg" : "text-subtle",
                        )}
                      >
                        {fmtPts(mark.pts)}
                      </span>
                      <span className="block font-mono text-[11px] tabular-nums text-subtle">/{fmtPts(mark.proj)}</span>
                    </span>
                  </>
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
                  } else if ((pl.injury === "OUT" || pl.injury === "D") && dropId === id) {
                    sendToIr(id);
                    setDropId(null);
                  } else {
                    setDropId(dropId === id ? null : id);
                  }
                }}
                trailing={
                  pl.injury === "OUT" || pl.injury === "D" ? (
                    <span className="font-mono text-[10px] text-loss">IR</span>
                  ) : undefined
                }
              />
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 font-display text-xl font-semibold">IR</h2>
      <p className="mt-1 text-sm text-muted">Two slots. Doesn't score. Sleeper-style stash for OUT.</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {(roster.ir ?? []).length === 0 && <li className="text-sm text-muted">Empty.</li>}
        {(roster.ir ?? []).map((id) => (
          <li key={id}>
            <PlayerRow
              player={getPlayer(id)}
              onClick={() => activateIr(id)}
              trailing={<span className="font-mono text-[10px] text-muted">Activate</span>}
            />
          </li>
        ))}
      </ul>

      {showWaiver && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Waivers</h2>
          <p className="mt-1 text-sm text-muted">
            FAAB ${faab}. Each add $15. {WAIVER_MAX - used} left this week. Tap bench to drop, then a free agent.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {fa.map((pl) => (
              <li key={pl.id}>
                <PlayerRow
                  player={pl}
                  trailing={
                    <span className="font-mono text-[11px] text-muted">
                      {trend.get(pl.id) ? `+${trend.get(pl.id)} adds` : `${remainingValue(pl, week).toFixed(0)} rest`}
                    </span>
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
  const schedule = useGame((s) => s.schedule);
  const bracket = useGame((s) => s.playoffBracket);
  const skipTicker = useGame((s) => s.skipTicker);
  const closeTicker = useGame((s) => s.closeTicker);
  const setScreen = useGame((s) => s.setScreen);
  const phase = useGame((s) => s.phase);
  const { data: wire } = useWire();
  const [guide, setGuide] = useState(false);

  const opponentId = opponentOf(you, week, phase, schedule, bracket);
  const locking = Boolean(ticker);
  const playedWeek = ticker?.week ?? week;
  const box = results[playedWeek]?.[you];

  useEffect(() => {
    if (!ticker?.done || !box) return;
    if (box.won) sfxWin();
    else sfxLoss();
  }, [ticker?.done, box]);

  const home = ticker?.homeId ?? you;
  const away = ticker?.awayId ?? opponentId ?? box?.opponentId ?? null;
  const homeRoster = away ? rosters[home] : rosters[you];
  const awayRoster = away ? rosters[away] : null;
  const homeTeam = teamById(teams, home);
  const awayTeam = away ? teamById(teams, away) : null;
  const youRoster = rosters[you];
  const card = pickWireForOwned(wire?.games ?? [], lineupIds(youRoster));

  if (!away || !homeRoster || !awayRoster || !awayTeam) {
    return (
      <main className="px-5 pt-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Watch</h1>
        <p className="mt-3 text-sm text-muted">No matchup this week. Check the table.</p>
        <div className="mt-6">
          <WireStrip compact owned={lineupIds(youRoster)} />
        </div>
        <Button className="mt-6" onClick={() => setScreen("home")}>
          Home
        </Button>
      </main>
    );
  }

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        <WeekLabel week={playedWeek} phase={phase} />
        {wire?.week ? ` · NFL week ${wire.week}` : ""}
      </p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">This week</h1>
      <p className="mt-2 text-sm text-muted">
        Your board is live PPR. The field follows real downs when this week's card has them.
      </p>
      <GuideLink onClick={() => setGuide(true)}>Help</GuideLink>

      <div className="mt-6">
        <MatchupBoard
          homeName={homeTeam.name}
          awayName={awayTeam.name}
          homeRoster={homeRoster}
          awayRoster={awayRoster}
          week={playedWeek}
          seed={seasonSeed}
          lockUnplayed={locking}
        />
      </div>

      {!locking && away !== you && <TradePad you={you} them={away} />}

      <div className="mt-8">
        <NightBroadcast
          week={playedWeek}
          seed={seasonSeed}
          homeName={homeTeam.name}
          awayName={awayTeam.name}
          homeJersey={homeTeam.jersey}
          awayJersey={awayTeam.jersey}
          homeRoster={homeRoster}
          awayRoster={awayRoster}
          homePts={locking && results[playedWeek]?.[home] ? results[playedWeek]![home]!.playerPoints : {}}
          awayPts={locking && results[playedWeek]?.[away] ? results[playedWeek]![away]!.playerPoints : {}}
          live={locking ? Boolean(ticker && !ticker.done) : true}
          onDone={locking ? skipTicker : () => undefined}
          board={false}
          card={card}
        />
      </div>

      <div className="mt-8">
        <WireStrip compact owned={lineupIds(youRoster)} />
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
      <BoardGuide open={guide} tab="grass" onClose={() => setGuide(false)} />
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
  const keepClub = useGame((s) => s.keepClub);
  const leave = useLeaveRoom();
  const online = useGame((s) => s.online);
  const rows = standings(teams, results, Math.min(Math.max(0, week - (phase === "regular" ? 1 : 0)), REGULAR_WEEKS));

  return (
    <main className="px-5 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Dream Football</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Table</h1>
      <p className="mt-2 text-sm text-muted">Eight teams. Top four make the playoffs after week {REGULAR_WEEKS}.</p>
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
              <span className="min-w-0 flex-1 truncate text-sm">
                {team.name}
                <span className="ml-2 text-xs text-muted">
                  {team.nfl} · {team.city}
                  {team.manager ? ` · ${team.manager}` : ""}
                </span>
              </span>
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
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          {!online && (
            <Button onClick={keepClub}>Keep the club</Button>
          )}
          <Button variant="secondary" onClick={online ? leave : resetSeason}>
            {online ? "Leave room" : "Fold the club"}
          </Button>
        </div>
      )}
    </main>
  );
}

function OffseasonScreen() {
  const you = useGame((s) => s.playerTeamId);
  const roster = useGame((s) => s.rosters[s.playerTeamId]);
  const contracts = useGame((s) => s.contracts);
  const budget = useGame((s) => s.budgets[s.playerTeamId] ?? 0);
  const seasonNo = useGame((s) => s.seasonNo ?? 1);
  const teams = useGame((s) => s.teams);
  const cutKeep = useGame((s) => s.cutKeep);
  const openNextSeason = useGame((s) => s.openNextSeason);
  const youTeam = teamById(teams, you);
  if (!roster) return null;
  const ids = rosterPlayerIds(roster);
  const payroll = salaryOf(contracts, you);
  const holes = ROSTER_SIZE - ids.length;

  return (
    <main className="px-5 pb-12 pt-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Offseason · year {seasonNo}</p>
      <h1 className="mt-1 flex items-center gap-2 font-display text-4xl font-semibold tracking-tight">
        <JerseyMark jersey={youTeam.jersey} className="size-3" />
        {youTeam.name}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {clubLine(youTeam)} · {youTeam.nfl} {conferenceOf(youTeam.nfl)}
      </p>
      <p className="mt-2 text-sm text-muted">
        You own this club. Payroll {fmtMoney(payroll)} of {fmtMoney(SALARY_CAP)}. Space {fmtMoney(budget)}.
        Cut a name to free cap. CPU clubs already cut two.
      </p>
      <ul className="mt-6 flex flex-col gap-1.5">
        {ids.map((id) => {
          const deal = contracts.find((c) => c.playerId === id && c.teamId === you);
          return (
            <li key={id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <PlayerRow
                  player={getPlayer(id)}
                  trailing={<span className="font-mono text-sm tabular-nums">{fmtMoney(deal?.price ?? 0)}</span>}
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => cutKeep(id)}>
                Cut
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">
        {holes > 0 ? `${holes} hole${holes === 1 ? "" : "s"} go to the auction.` : "Roster full. Skip the auction if you want."}
      </p>
      <Button className="mt-6" onClick={openNextSeason}>
        {holes > 0 ? "Open the auction" : "Open the season"}
      </Button>
    </main>
  );
}

function TradePad({ you, them }: { you: string; them: string }) {
  const rosters = useGame((s) => s.rosters);
  const teams = useGame((s) => s.teams);
  const trades = useGame((s) => s.trades ?? []);
  const offerTrade = useGame((s) => s.offerTrade);
  const takeTrade = useGame((s) => s.takeTrade);
  const passTrade = useGame((s) => s.passTrade);
  const [giveId, setGive] = useState<string | null>(null);
  const [getId, setGet] = useState<string | null>(null);
  const mine = rosterPlayerIds(rosters[you]!);
  const theirs = rosterPlayerIds(rosters[them]!);
  const open = trades.filter((t) => t.status === "open" && (t.toId === you || t.fromId === you));
  return (
    <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Trade</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">1-for-1 vs {teamById(teams, them).name}</h2>
      <p className="mt-1 text-sm text-muted">Tap yours, tap theirs, send. Bots take it if the ovr is close.</p>
      <p className="mt-4 font-mono text-[11px] text-muted uppercase">You send</p>
      <ul className="mt-2 flex flex-col gap-1">
        {mine.map((id) => (
          <li key={id}>
            <PlayerRow player={getPlayer(id)} dense active={giveId === id} onClick={() => setGive(id)} />
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[11px] text-muted uppercase">You get</p>
      <ul className="mt-2 flex flex-col gap-1">
        {theirs.map((id) => (
          <li key={id}>
            <PlayerRow player={getPlayer(id)} dense active={getId === id} onClick={() => setGet(id)} />
          </li>
        ))}
      </ul>
      <Button
        className="mt-4"
        disabled={!giveId || !getId}
        onClick={() => {
          if (!giveId || !getId) return;
          offerTrade(them, giveId, getId);
          setGive(null);
          setGet(null);
        }}
      >
        Send trade
      </Button>
      {open.map((t) => (
        <div key={t.id} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span>
            {getPlayer(t.giveId).name} for {getPlayer(t.getId).name}
          </span>
          {t.toId === you && t.status === "open" && (
            <>
              <Button size="sm" onClick={() => takeTrade(t.id)}>
                Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => passTrade(t.id)}>
                Pass
              </Button>
            </>
          )}
          {t.fromId === you && t.status === "open" && <span className="text-muted">Waiting</span>}
        </div>
      ))}
    </section>
  );
}

function StakePad({
  opponentId,
  you,
  cash,
  bets,
  teams,
  offerBet,
  takeBet,
  passBet,
}: {
  opponentId: string;
  you: string;
  cash: number;
  bets: SideBet[];
  teams: LeagueTeam[];
  offerBet: (toId: string, stake: number) => void;
  takeBet: (id: string) => void;
  passBet: (id: string) => void;
}) {
  const opp = teamById(teams, opponentId);
  const incoming = bets.filter((b) => b.toId === you && b.status === "open");
  const live = bets.filter((b) => b.status === "live" && (b.fromId === you || b.toId === you));
  const done = bets.filter((b) => b.status === "done" && (b.fromId === you || b.toId === you));
  return (
    <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Stake</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">House chips vs {opp.name}</h2>
      <p className="mt-1 text-sm text-muted">Franchise bank. Winner of the week takes both sides. Play money — not a sportsbook.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {STAKES.map((n) => (
          <Button key={n} variant="secondary" size="sm" disabled={cash < n} onClick={() => offerBet(opponentId, n)}>
            {fmtMoney(n)}
          </Button>
        ))}
      </div>
      {incoming.map((b) => (
        <div key={b.id} className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-sm">
            {teamById(teams, b.fromId).name} staked {fmtMoney(b.stake)}
          </p>
          <Button size="sm" onClick={() => takeBet(b.id)}>
            Take
          </Button>
          <Button size="sm" variant="ghost" onClick={() => passBet(b.id)}>
            Pass
          </Button>
        </div>
      ))}
      {live.map((b) => (
        <p key={b.id} className="mt-3 font-mono text-xs text-muted">
          Live {fmtMoney(b.stake)} vs {teamById(teams, b.fromId === you ? b.toId : b.fromId).short}
        </p>
      ))}
      {done.map((b) => (
        <p key={b.id} className="mt-2 text-sm text-muted">
          {b.winnerId === you ? "You take" : b.winnerId ? `${teamById(teams, b.winnerId).short} takes` : "Push"}{" "}
          {fmtMoney(b.stake * (b.winnerId ? 2 : 1))}
        </p>
      ))}
    </section>
  );
}
