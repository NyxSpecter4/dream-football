import { botByManager, GROK_BOTS } from "@/game/bots";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import type { LeagueTeam } from "@/game/types";

type Seat = {
  id: string;
  name: string;
  tag: string;
  avatar?: string;
  human?: boolean;
  you?: boolean;
};

function previewSeats(): Seat[] {
  return [
    { id: "you", name: "You", tag: "YOU", human: true, you: true },
    { id: "cindy", name: "Cindy", tag: "CIN", human: true },
    ...GROK_BOTS.slice(0, 6).map((b) => ({
      id: b.manager,
      name: b.manager.split(" ")[0]!,
      tag: b.desk.replace("The ", ""),
      avatar: b.avatar,
    })),
  ];
}

function fromTeams(teams: LeagueTeam[], youId: string): Seat[] {
  return teams.map((t) => {
    const bot = t.manager ? botByManager(t.manager) : undefined;
    return {
      id: t.id,
      name: t.human ? t.name : (t.manager ?? t.short).split(" ")[0]!,
      tag: t.human ? t.short : (bot?.desk.replace("The ", "") ?? t.short),
      avatar: bot?.avatar,
      human: t.human,
      you: t.id === youId,
    };
  });
}

export function RoundTable({
  compact,
  hotId,
}: {
  compact?: boolean;
  hotId?: string;
}) {
  const teams = useGame((s) => s.teams);
  const you = useGame((s) => s.playerTeamId);
  const seats = teams.length >= 2 ? fromTeams(teams, you) : previewSeats();
  const n = seats.length;
  return (
    <div className={cn("relative mx-auto", compact ? "h-52 w-52" : "h-72 w-72 sm:h-80 sm:w-80")}>
      <div className="felt-table absolute inset-[18%] rounded-full" />
      <div className="absolute inset-[34%] flex items-center justify-center rounded-full bg-black/35 shadow-[inset_0_0_24px_#000]">
        <p className="font-display text-lg font-semibold tracking-tight text-live sm:text-xl">$301.2M</p>
      </div>
      {seats.map((seat, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = compact ? 42 : 44;
        const left = 50 + r * Math.cos(a);
        const top = 50 + r * Math.sin(a);
        const hot = hotId === seat.id || (seat.you && hotId === "you");
        return (
          <div
            key={seat.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div
              className={cn(
                "seat-chip mx-auto overflow-hidden rounded-full border-2",
                compact ? "size-9" : "size-12 sm:size-14",
                seat.you ? "border-live" : seat.human ? "border-win" : "border-white/25",
                hot && "seat-hot",
              )}
            >
              {seat.avatar ? (
                <img src={seat.avatar} alt="" className="size-full object-cover" />
              ) : (
                <span
                  className={cn(
                    "flex size-full items-center justify-center font-display text-[11px] font-semibold",
                    seat.you ? "bg-live text-bg" : "bg-surface-2 text-fg",
                  )}
                >
                  {seat.tag.slice(0, 3)}
                </span>
              )}
            </div>
            {!compact && (
              <p className="mt-1 max-w-16 truncate font-mono text-[9px] uppercase tracking-wide text-muted">
                {seat.name}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
