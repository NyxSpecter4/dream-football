import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, JerseyMark, PlayerRow, PosChip, RoomBar } from "./chrome";
import { useGame } from "@/game/store";
import { availablePlayers, marketValue, maxAffordable, nextNominator, spotsLeft } from "@/game/draft";
import { getPlayer } from "@/game/players";
import { ownedSet } from "@/game/simulate";
import { rosterPlayerIds, slotLabel, teamById } from "@/game/league";
import { canTeamBid } from "@/game/net";
import { sfxBid, sfxSold, sfxTick } from "@/game/audio";
import { ROSTER_SIZE, STARTER_SLOTS, type Position } from "@/game/types";
import { cn } from "@/lib/utils";

const POS_FILTERS: Array<Position | "ALL"> = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

export function AuctionScreen() {
  const block = useGame((s) => s.block);
  const nominating = useGame((s) => s.nominating);
  const teams = useGame((s) => s.teams);
  const budgets = useGame((s) => s.budgets);
  const rosters = useGame((s) => s.rosters);
  const contracts = useGame((s) => s.contracts);
  const you = useGame((s) => s.playerTeamId);
  const lastSold = useGame((s) => s.lastSold);
  const pauseEvery = useGame((s) => s.pauseEvery);
  const autoFill = useGame((s) => s.autoFill);
  const online = useGame((s) => s.online);
  const nominateIndex = useGame((s) => s.nominateIndex);
  const nominate = useGame((s) => s.nominate);
  const bid = useGame((s) => s.bid);
  const pass = useGame((s) => s.pass);
  const setPauseEvery = useGame((s) => s.setPauseEvery);
  const setAutoFill = useGame((s) => s.setAutoFill);
  const fillRest = useGame((s) => s.fillRest);

  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [soldFlash, setSoldFlash] = useState(lastSold);

  const yourRoster = rosters[you];
  const spots = yourRoster ? spotsLeft(yourRoster) : 10;
  const budget = budgets[you] ?? 0;
  const cap = maxAffordable(budget, spots);

  const nom = useMemo(
    () => nextNominator(teams.map((t) => t.id), rosters, nominateIndex),
    [teams, rosters, nominateIndex],
  );
  const myNomination = Boolean(nominating && !block && nom && nom.teamId === you);
  const waitingOn = nominating && !block && nom && nom.teamId !== you ? teamById(teams, nom.teamId) : null;

  const owned = useMemo(() => ownedSet(rosters), [rosters]);
  const pool = useMemo(() => {
    const ids = availablePlayers(owned);
    return ids
      .map(getPlayer)
      .filter((p) => (filter === "ALL" ? true : p.pos === filter));
  }, [owned, filter]);

  useEffect(() => {
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = useGame.getState();
      if (st.online && !st.isHost) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (st.phase === "draft") {
        const waiting = Boolean(st.block?.waitingForHuman) && !st.autoFill;
        const humanNom = st.nominating && !st.block && !st.autoFill;
        if (!waiting && !humanNom) {
          acc += dt;
          const youRoster = st.rosters[st.playerTeamId];
          const youDone = youRoster ? spotsLeft(youRoster) <= 0 : false;
          const delay = reduced || st.autoFill || youDone ? 0.045 : st.block ? 0.32 : 0.22;
          if (acc >= delay) {
            acc = 0;
            st.cpuStep();
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!lastSold) return;
    sfxSold();
    setSoldFlash(lastSold);
    const t = window.setTimeout(() => setSoldFlash(null), 1400);
    return () => window.clearTimeout(t);
  }, [lastSold]);

  const filled = contracts.length;
  const totalLots = teams.length * 10;

  return (
    <Field>
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-28 pt-5 sm:px-6">
        <header className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Auction</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">The board</h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-2xl tabular-nums leading-none">${budget}</p>
            <p className="mt-1 text-xs text-muted">
              {spots} of {ROSTER_SIZE} open · max ${cap} on one name
            </p>
            {spots > 1 && (
              <p className="mt-0.5 text-[11px] text-subtle">Leave ${budget - cap} to fill the rest</p>
            )}
          </div>
        </header>

        {online && <RoomBar className="mt-3" />}

        <p className="mt-3 font-mono text-xs tabular-nums text-subtle">
          {filled}/{totalLots} signed
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-field transition-[width] duration-300"
            style={{ width: `${(filled / Math.max(1, totalLots)) * 100}%` }}
          />
        </div>

        {block ? (
          <BlockCard
            onBid={(n) => {
              sfxBid();
              bid(n);
            }}
            onPass={() => {
              sfxTick();
              pass();
            }}
            cap={cap}
          />
        ) : myNomination ? (
          <div className="mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Your nomination</p>
            <p className="mt-1 text-sm text-muted">Put a name on the block at $1. You still need {spots}.</p>
          </div>
        ) : waitingOn ? (
          <div className="mt-6 rounded-xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">
            Waiting on {waitingOn.name} to nominate.
          </div>
        ) : (
          <div className="mt-6 rounded-xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">
            Waiting on the next nomination.
          </div>
        )}

        {soldFlash && (
          <p className="pop-in mt-3 font-mono text-xs text-win">
            Sold · {getPlayer(soldFlash.playerId).name} to {teamById(teams, soldFlash.teamId).name} · $
            {soldFlash.price}
          </p>
        )}

        {(myNomination || (!block && !nominating)) && (
          <>
            <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1">
              {POS_FILTERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFilter(p)}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full px-3 text-xs font-medium",
                    filter === p ? "bg-accent text-accent-fg" : "bg-surface text-muted",
                  )}
                >
                  {p === "ALL" ? "All" : p}
                </button>
              ))}
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {pool.slice(0, 24).map((pl) => (
                <li key={pl.id}>
                  <PlayerRow
                    player={pl}
                    active={selected === pl.id}
                    onClick={
                      myNomination
                        ? () => setSelected(pl.id)
                        : undefined
                    }
                    trailing={
                      <span className="font-mono text-sm tabular-nums text-muted">${marketValue(pl.id)}</span>
                    }
                  />
                </li>
              ))}
            </ul>
            {myNomination && selected && (
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-5xl items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{getPlayer(selected).name}</p>
                    <p className="font-mono text-xs text-muted">Opens at $1 · value ${marketValue(selected)}</p>
                  </div>
                  <Button
                    onClick={() => {
                      sfxTick();
                      nominate(selected);
                      setSelected(null);
                    }}
                  >
                    Nominate
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <YourRoster />

        <div className="mt-8 flex flex-wrap gap-2 pb-4">
          {spots > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                sfxTick();
                fillRest();
              }}
            >
              Fill my last {spots} at $1
            </Button>
          )}
          {!online && (
            <>
              {spots > 0 && (
                <Button size="sm" variant={pauseEvery ? "primary" : "secondary"} onClick={() => setPauseEvery(!pauseEvery)}>
                  {pauseEvery ? "Pausing every name" : "Pause on targets"}
                </Button>
              )}
              <Button size="sm" variant={autoFill ? "primary" : "secondary"} onClick={() => setAutoFill(!autoFill)}>
                {autoFill ? "Auto-bidding" : "Sit the rest"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Field>
  );
}

function BlockCard({
  onBid,
  onPass,
  cap,
}: {
  onBid: (n: number) => void;
  onPass: () => void;
  cap: number;
}) {
  const block = useGame((s) => s.block)!;
  const teams = useGame((s) => s.teams);
  const you = useGame((s) => s.playerTeamId);
  const canBid = useGame((s) => (s.block ? canTeamBid(s, s.playerTeamId, s.block) : false));
  const player = getPlayer(block.playerId);
  const high = teamById(teams, block.highBidderId);
  const nextBid = block.highBid + 1;
  const going =
    block.going === 1 ? "Going once" : block.going === 2 ? "Going twice" : "On the block";
  const valueBid = Math.min(cap, Math.max(nextBid, marketValue(player.id)));

  return (
    <section className="mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">{going}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">{player.name}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <PosChip pos={player.pos} />
            {player.nfl} · value ${marketValue(player.id)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-semibold tabular-nums leading-none">${block.highBid}</p>
          <p className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted">
            <JerseyMark jersey={high.jersey} />
            {high.id === you ? "You" : high.short}
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-1 font-mono text-[11px] text-subtle">
        {block.log.slice(-5).map((b, i) => (
          <li key={`${b.teamId}-${b.amount}-${i}`}>
            {teamById(teams, b.teamId).short} · ${b.amount}
          </li>
        ))}
      </ol>

      {block.waitingForHuman && canBid && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="secondary" onClick={onPass}>
            Pass
          </Button>
          <Button disabled={!canBid} onClick={() => onBid(nextBid)}>
            Bid ${nextBid}
          </Button>
          <Button
            variant="secondary"
            disabled={!canBid || cap < nextBid + 4}
            onClick={() => onBid(Math.min(cap, nextBid + 4))}
          >
            +$5
          </Button>
          <Button
            variant="secondary"
            disabled={!canBid || valueBid <= block.highBid}
            onClick={() => onBid(valueBid)}
          >
            Value ${valueBid}
          </Button>
        </div>
      )}
      {block.waitingForHuman && !canBid && (
        <p className="mt-4 text-xs text-muted">
          {block.highBidderId === you ? "You have the bid." : "Waiting on other managers."}
        </p>
      )}
      {!block.waitingForHuman && (
        <p className="mt-4 text-xs text-muted">
          {block.highBidderId === you ? "You have the bid." : "Bids incoming."}
        </p>
      )}
    </section>
  );
}

function YourRoster() {
  const you = useGame((s) => s.playerTeamId);
  const roster = useGame((s) => s.rosters[s.playerTeamId]);
  const contracts = useGame((s) => s.contracts);
  if (!roster) return null;
  const ids = rosterPlayerIds(roster);
  const open = ROSTER_SIZE - ids.length;
  const price = (id: string) => contracts.find((c) => c.playerId === id && c.teamId === you)?.price ?? 0;
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">Your roster</h2>
      <p className="mt-1 text-sm text-muted">
        {ids.length} of {ROSTER_SIZE} signed
        {open > 0 ? ` · ${open} still open` : ""}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {STARTER_SLOTS.map((slot) => {
          const id = roster.lineup[slot];
          if (!id) {
            return (
              <li
                key={slot}
                className="flex min-h-12 items-center justify-between rounded-lg bg-surface px-3 text-sm text-subtle shadow-[var(--shadow-border)]"
              >
                <span>Open</span>
                <span className="font-mono text-[11px] tracking-wide uppercase">{slotLabel(slot)}</span>
              </li>
            );
          }
          return (
            <li key={slot}>
              <PlayerRow
                player={getPlayer(id)}
                trailing={<span className="font-mono text-sm tabular-nums">${price(id)}</span>}
              />
            </li>
          );
        })}
        {roster.bench.map((id) => (
          <li key={id}>
            <PlayerRow
              player={getPlayer(id)}
              trailing={<span className="font-mono text-sm tabular-nums">${price(id)}</span>}
            />
          </li>
        ))}
        {roster.bench.length === 0 && (
          <li className="flex min-h-12 items-center justify-between rounded-lg bg-surface px-3 text-sm text-subtle shadow-[var(--shadow-border)]">
            <span>Open</span>
            <span className="font-mono text-[11px] tracking-wide uppercase">Bench</span>
          </li>
        )}
      </ul>
    </section>
  );
}
