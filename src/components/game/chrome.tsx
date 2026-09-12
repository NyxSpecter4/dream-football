import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { JerseyId, Player, Position } from "@/game/types";
import { marketValue } from "@/game/draft";
import { projection } from "@/game/simulate";
import { useGame } from "@/game/store";

export function fmtPts(n: number) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative min-h-dvh bg-bg text-fg", className)}>
      <div className="field-stripes pointer-events-none absolute inset-0" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function JerseyMark({ jersey, className }: { jersey: JerseyId; className?: string }) {
  return <span className={cn("inline-block size-2.5 rounded-full jersey-" + jersey, className)} aria-hidden />;
}

export function jerseyNum(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 1 + (h >>> 0) % 99;
}

export function PlayerMark({ player }: { player: Player }) {
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 font-display text-sm font-semibold tabular-nums text-fg"
      aria-hidden
    >
      {jerseyNum(player.id)}
    </span>
  );
}

export function PosChip({ pos }: { pos: Position }) {
  return (
    <span className="inline-flex min-w-8 items-center justify-center rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-muted">
      {pos}
    </span>
  );
}

export function PlayerRow({
  player,
  trailing,
  onClick,
  active,
}: {
  player: Player;
  trailing?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-left transition-[background-color,box-shadow] duration-150",
        onClick && "hover:bg-surface-2",
        active ? "bg-surface-2 shadow-[var(--shadow-border-hover)]" : "shadow-[var(--shadow-border)]",
      )}
    >
      <PlayerMark player={player} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{player.name}</span>
        <span className="block font-mono text-[11px] text-muted">
          {player.nfl} · bye {player.bye} · {projection(player).toFixed(1)} proj
        </span>
      </span>
      {trailing ?? (
        <span className="font-mono text-sm tabular-nums text-muted">${marketValue(player.id)}</span>
      )}
    </Comp>
  );
}

export function WeekLabel({ week, phase }: { week: number; phase: string }) {
  if (phase === "complete") return "Final";
  if (week === 8) return "Semifinals";
  if (week === 9) return "Championship";
  return `Week ${week}`;
}

export function useLeaveRoom() {
  const leaveOnline = useGame((s) => s.leaveOnline);
  const navigate = useNavigate({ from: "/" });
  return () => {
    leaveOnline();
    void navigate({ search: { room: undefined } });
  };
}

export function RoomBar({ className }: { className?: string }) {
  const online = useGame((s) => s.online);
  const roomCode = useGame((s) => s.roomCode);
  const mesh = useGame((s) => s.mesh);
  const hostPeerId = useGame((s) => s.hostPeerId);
  const isHost = useGame((s) => s.isHost);
  const leave = useLeaveRoom();
  if (!online || !roomCode) return null;
  const failed = mesh.peers.filter((p) => p.connectionState === "failed");
  const hostGone =
    !isHost &&
    Boolean(hostPeerId) &&
    mesh.joined &&
    !mesh.peers.some((p) => p.id === hostPeerId && p.connectionState === "connected");
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted", className)}>
      <span className="tracking-[0.14em] uppercase">Room {roomCode}</span>
      <span className="flex items-center gap-3">
        {hostGone ? (
          <span className="text-loss">Host left</span>
        ) : failed.length > 0 ? (
          <span className="text-loss">Can’t reach {failed[0]!.name}</span>
        ) : (
          <span>{mesh.peers.filter((p) => p.connectionState === "connected").length + 1} live</span>
        )}
        <button type="button" className="text-muted hover:text-fg" onClick={leave}>
          Leave
        </button>
      </span>
    </div>
  );
}
