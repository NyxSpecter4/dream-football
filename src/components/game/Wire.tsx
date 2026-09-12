import { useWire } from "@/game/wire";
import { getPlayer } from "@/game/players";
import { normAbbr } from "@/game/nfl";
import { cn } from "@/lib/utils";
import { fmtPts } from "./chrome";

export function WireTicker() {
  const { data } = useWire();
  if (!data || data.games.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-muted">
      {data.games.slice(0, 10).map((g) => (
        <li key={g.id} className={g.state === "live" ? "text-win" : "text-muted"}>
          {g.awayAbbr}
          {g.state === "soon" ? "" : ` ${g.awayScore}`}
          <span> </span>
          {g.homeAbbr}
          {g.state === "soon" ? "" : ` ${g.homeScore}`}
          <span className="text-subtle"> {g.state === "final" ? "F" : g.state === "live" ? g.clock : ""}</span>
        </li>
      ))}
    </ul>
  );
}

export function WireStrip({
  owned,
  compact,
}: {
  owned?: string[];
  compact?: boolean;
}) {
  const { data, fail } = useWire();
  if (fail && !data) {
    return (
      <p className="text-[11px] text-subtle">
        The wire is quiet. Public scores will show when they land.
      </p>
    );
  }
  if (!data) {
    return <p className="font-mono text-[11px] text-subtle">Pulling the week…</p>;
  }

  const myNfl = new Set((owned ?? []).map((id) => getPlayer(id).nfl));
  const games = data.games.slice(0, compact ? 6 : 12);
  const myStats = (owned ?? [])
    .map((id) => ({ id, st: data.stats[id] }))
    .filter((x) => x.st);

  return (
    <section>
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        The wire · real week {data.week}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {games.map((g) => {
          const hot = myNfl.has(normAbbr(g.homeAbbr)) || myNfl.has(normAbbr(g.awayAbbr));
          return (
            <li
              key={g.id}
              className={cn(
                "flex min-h-10 items-center justify-between gap-3 rounded-md px-3 font-mono text-xs tabular-nums",
                hot ? "bg-surface-2" : "bg-surface",
              )}
            >
              <span className="min-w-0 truncate text-fg">
                {g.awayAbbr} {g.state === "soon" ? "" : g.awayScore}
                <span className="text-muted"> · </span>
                {g.homeAbbr} {g.state === "soon" ? "" : g.homeScore}
              </span>
              <span className={cn("shrink-0 text-[11px]", g.state === "live" ? "text-win" : "text-muted")}>
                {g.state === "live" ? g.clock : g.state === "final" ? "Final" : g.clock}
              </span>
            </li>
          );
        })}
      </ul>

      {!compact && myStats.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {myStats.map(({ id, st }) => (
            <li key={id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {getPlayer(id).name}
                {st!.line ? <span className="text-muted"> · {st!.line}</span> : null}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums",
                  st!.state === "live" ? "text-win" : st!.state === "soon" ? "text-subtle" : "text-fg",
                )}
              >
                {st!.state === "soon" ? `proj ${fmtPts(st!.proj)}` : fmtPts(st!.pts)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!compact && data.news.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {data.news.slice(0, 4).map((n) => (
            <li key={n.title}>
              <p className="text-sm text-fg">{n.title}</p>
              {n.blurb ? <p className="text-[12px] text-muted">{n.blurb}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-subtle">
        Public scores and PPR from this NFL week. Same math as ESPN and Sleeper. Not a league feed.
      </p>
    </section>
  );
}
