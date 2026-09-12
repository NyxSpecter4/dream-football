import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "nl-board-guide";
const SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST", "BN"] as const;
const SEATS = [
  { short: "YOU", you: true },
  { short: "HRB", you: false },
  { short: "IRN", you: false },
  { short: "DST", you: false },
  { short: "LKE", you: false },
  { short: "RED", you: false },
  { short: "PIN", you: false },
  { short: "MTR", you: false },
];

export type GuideTab = "auction" | "grass";

export function BoardGuide({
  open,
  tab = "auction",
  onClose,
}: {
  open: boolean;
  tab?: GuideTab;
  onClose: () => void;
}) {
  const [pane, setPane] = useState<GuideTab>(tab);

  useEffect(() => {
    if (open) setPane(tab);
  }, [open, tab]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Layout</p>
        <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight">How the board sits</h2>
        <div className="mt-4 flex gap-1.5">
          {(
            [
              ["auction", "The auction"],
              ["grass", "The grass"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPane(id)}
              className={cn(
                "chip min-h-9 rounded-full px-3 text-xs font-medium",
                pane === id ? "bg-accent text-accent-fg" : "bg-surface text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {pane === "auction" ? <AuctionLayout /> : <GrassLayout />}
        </div>

        <p className="mt-4 text-sm text-muted">
          {pane === "auction"
            ? "Eight bags. One name on the block. Ten holes. Floor $885K. Leave enough to fill."
            : "End zones are city paint. Yellow stick is first down. The ball follows public downs when they exist."}
        </p>

        <Button className="mt-6" onClick={onClose}>
          Sit
        </Button>
      </div>
    </div>,
    document.body,
  );
}

export function GuideLink({
  onClick,
  children = "How the board sits",
}: {
  onClick: () => void;
  children?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 text-left text-xs text-muted hover:text-fg"
    >
      {children}
    </button>
  );
}

export function markGuideSeen() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function shouldShowGuide() {
  try {
    return sessionStorage.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

function AuctionLayout() {
  return (
    <div className="rounded-xl bg-turf p-3 shadow-[var(--shadow-border)]">
      <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-win uppercase">Eight bags</p>
      <ul className="grid grid-cols-4 gap-1.5">
        {SEATS.map((s) => (
          <li
            key={s.short}
            className={cn(
              "rounded-md px-2 py-1.5 text-center",
              s.you ? "bg-accent text-accent-fg" : "bg-bg/45 text-fg",
            )}
          >
            <p className="font-mono text-[11px]">{s.short}</p>
            <p className="font-mono text-xs tabular-nums">{s.you ? "$301.2M" : "$301.2M"}</p>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-lg bg-bg/50 px-3 py-4 text-center">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">The block</p>
        <p className="mt-1 font-display text-3xl font-semibold tabular-nums">$885K</p>
        <p className="mt-1 text-xs text-muted">A name opens here. Highest bag wins it.</p>
      </div>

      <p className="mt-3 font-mono text-[10px] tracking-[0.16em] text-win uppercase">Ten holes</p>
      <ul className="mt-1.5 grid grid-cols-5 gap-1">
        {SLOTS.map((slot, i) => (
          <li
            key={`${slot}-${i}`}
            className="rounded-md bg-bg/45 py-2 text-center font-mono text-[10px] tracking-wide text-fg"
          >
            {slot}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-center font-mono text-[10px] text-subtle">QB · 2 RB · 2 WR · TE · FLEX · K · DST · bench</p>
    </div>
  );
}

function GrassLayout() {
  return (
    <div className="overflow-hidden rounded-xl bg-turf shadow-[var(--shadow-border)]">
      <svg viewBox="0 0 320 168" className="block w-full" aria-hidden>
        <defs>
          <linearGradient id="nl-end-a" x1="0" x2="1">
            <stop offset="0" stopColor="#203731" />
            <stop offset="1" stopColor="#69BE28" />
          </linearGradient>
          <linearGradient id="nl-end-h" x1="0" x2="1">
            <stop offset="0" stopColor="#AA0000" />
            <stop offset="1" stopColor="#B3995D" />
          </linearGradient>
        </defs>
        <rect width="320" height="168" fill="#142218" />
        <rect x="0" y="0" width="28" height="168" fill="url(#nl-end-a)" />
        <rect x="292" y="0" width="28" height="168" fill="url(#nl-end-h)" />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <line
            key={n}
            x1={28 + n * 26.4}
            y1="0"
            x2={28 + n * 26.4}
            y2="168"
            stroke="#eef2ec"
            strokeOpacity={n === 5 ? 0.28 : 0.1}
            strokeWidth={n === 5 ? 1.6 : 1}
          />
        ))}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <g key={`h-${n}`}>
            <line x1={28 + n * 26.4 - 4} y1="52" x2={28 + n * 26.4 + 4} y2="52" stroke="#eef2ec" strokeOpacity="0.2" />
            <line x1={28 + n * 26.4 - 4} y1="116" x2={28 + n * 26.4 + 4} y2="116" stroke="#eef2ec" strokeOpacity="0.2" />
          </g>
        ))}
        <text x="14" y="90" fill="#eef2ec" fontSize="8" fontFamily="Barlow Condensed, sans-serif" textAnchor="middle" transform="rotate(-90 14 90)">
          AWAY
        </text>
        <text x="306" y="90" fill="#0c0f0c" fontSize="8" fontFamily="Barlow Condensed, sans-serif" textAnchor="middle" transform="rotate(90 306 90)">
          HOME
        </text>
        <text x="160" y="22" fill="#eef2ec" fillOpacity="0.55" fontSize="9" fontFamily="IBM Plex Mono, monospace" textAnchor="middle">
          50
        </text>
        <line x1="201" y1="18" x2="201" y2="150" stroke="#e8d44d" strokeWidth="2" strokeDasharray="4 3" />
        <circle cx="186" cy="84" r="5.5" fill="#6b3a1e" stroke="#d7b38a" strokeWidth="1" />
        <line x1="184" y1="81" x2="184" y2="87" stroke="#f3e6d0" strokeWidth="0.8" />
        <line x1="185.2" y1="81" x2="185.2" y2="87" stroke="#f3e6d0" strokeWidth="0.8" />
        <rect x="12" y="8" width="36" height="14" rx="7" fill="#0c0f0c" fillOpacity="0.55" />
        <text x="30" y="18" fill="#7dba8e" fontSize="8" fontFamily="IBM Plex Mono, monospace" textAnchor="middle">
          TAPE
        </text>
      </svg>
      <ul className="grid grid-cols-3 gap-px bg-border text-[10px]">
        <li className="bg-turf px-2 py-2">
          <p className="font-mono tracking-wide text-win uppercase">Ball</p>
          <p className="mt-0.5 text-muted">Spot of the last public down</p>
        </li>
        <li className="bg-turf px-2 py-2">
          <p className="font-mono tracking-wide text-win uppercase">Stick</p>
          <p className="mt-0.5 text-muted">Yellow = first down</p>
        </li>
        <li className="bg-turf px-2 py-2">
          <p className="font-mono tracking-wide text-win uppercase">Chip</p>
          <p className="mt-0.5 text-muted">LIVE · TAPE · SIM</p>
        </li>
      </ul>
    </div>
  );
}
