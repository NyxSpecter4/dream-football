import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, JerseyMark, useLeaveRoom } from "./chrome";
import { JERSEYS } from "@/game/league";
import { useGame } from "@/game/store";
import { newRoomCode, parseRoomCode, isLiveShareHost, roomShareUrl } from "@/game/net";
import { TEAM_COUNT, type JerseyId } from "@/game/types";
import { cn } from "@/lib/utils";
import { unlockAudio } from "@/game/audio";

export function LobbyScreen() {
  const online = useGame((s) => s.online);
  const roomCode = useGame((s) => s.roomCode);
  if (online && roomCode) return <WaitingRoom />;
  return <LobbyGate />;
}

function LobbyGate() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const enterOnline = useGame((s) => s.enterOnline);
  const setOnlineIdentity = useGame((s) => s.setOnlineIdentity);
  const setScreen = useGame((s) => s.setScreen);
  const pending = parseRoomCode(typeof search.room === "string" ? search.room : "");
  const [name, setName] = useState("Night Hawks");
  const [short, setShort] = useState("NGT");
  const [jersey, setJersey] = useState<JerseyId>("pine");
  const [joinCode, setJoinCode] = useState(pending ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (pending) setJoinCode(pending);
  }, [pending]);

  const ident = () => ({
    name: name.trim() || "Night Hawks",
    short: (short.trim() || "NGT").slice(0, 4).toUpperCase(),
    jersey,
  });

  const hostRoom = () => {
    unlockAudio();
    const code = newRoomCode();
    setOnlineIdentity(ident());
    enterOnline(code, "", true);
    void navigate({ search: { room: code } });
  };

  const joinRoom = () => {
    unlockAudio();
    const code = parseRoomCode(joinCode);
    if (!code) {
      setError("Need a 4-letter room code.");
      return;
    }
    setError("");
    setOnlineIdentity(ident());
    enterOnline(code, "", false);
    void navigate({ search: { room: code } });
  };

  return (
    <Field>
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-28 pt-10">
        <button
          type="button"
          className="self-start text-sm text-muted hover:text-fg"
          onClick={() => {
            setScreen("title");
            void navigate({ search: { room: undefined } });
          }}
        >
          Back
        </button>
        <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">
          {pending ? "Join the room" : "Play with friends"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {pending
            ? "Name your club, then sit. Same $200 board as everyone else."
            : isLiveShareHost()
              ? "Host gets a 4-letter code. Friend opens this same page and joins. Empty seats play themselves."
              : "Cindy can’t join from this preview. Open the live Night League link on both phones, then host or join."}
        </p>

        <label className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Team name</label>
        <input
          value={name}
          maxLength={22}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-12 rounded-lg bg-surface px-4 text-base text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />

        <label className="mt-5 text-xs font-medium tracking-wide text-muted uppercase">Tag</label>
        <input
          value={short}
          maxLength={4}
          onChange={(e) => setShort(e.target.value.toUpperCase())}
          className="mt-2 h-12 w-28 rounded-lg bg-surface px-4 font-display text-xl tracking-wide text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />

        <p className="mt-6 text-xs font-medium tracking-wide text-muted uppercase">Jersey</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {JERSEYS.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setJersey(j.id)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm",
                jersey === j.id ? "bg-surface-2 shadow-[var(--shadow-border-hover)]" : "bg-surface shadow-[var(--shadow-border)]",
              )}
            >
              <span className={cn("size-3 rounded-full", `jersey-${j.id}`)} />
              {j.label}
            </button>
          ))}
        </div>

        {!pending && (
          <Button size="lg" className="mt-10" onClick={hostRoom}>
            Host a room
          </Button>
        )}

        <label className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Room code</label>
        <input
          value={joinCode}
          maxLength={8}
          placeholder="K7MQ"
          onChange={(e) => {
            setJoinCode(e.target.value.toUpperCase());
            setError("");
          }}
          className="mt-2 h-12 w-40 rounded-lg bg-surface px-4 font-display text-2xl tracking-[0.3em] text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />
        {error && <p className="mt-2 text-sm text-loss">{error}</p>}
        <Button size="lg" variant={pending ? "primary" : "secondary"} className="mt-4" onClick={joinRoom}>
          Join room
        </Button>
      </main>
    </Field>
  );
}

function WaitingRoom() {
  const roomCode = useGame((s) => s.roomCode);
  const isHost = useGame((s) => s.isHost);
  const localPeerId = useGame((s) => s.localPeerId);
  const identity = useGame((s) => s.onlineIdentity);
  const seats = useGame((s) => s.lobbySeats);
  const mesh = useGame((s) => s.mesh);
  const hostPeerId = useGame((s) => s.hostPeerId);
  const lateJoinBlocked = useGame((s) => s.lateJoinBlocked);
  const leave = useLeaveRoom();
  const startOnlineSeason = useGame((s) => s.startOnlineSeason);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const connectedIds = useMemo(
    () => new Set(mesh.peers.filter((p) => p.connectionState === "connected").map((p) => p.id)),
    [mesh.peers],
  );

  const rows = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      short: string;
      jersey: JerseyId;
      you: boolean;
      state: string;
    }> = [];
    const seen = new Set<string>();
    const push = (id: string, name: string, short: string, jersey: JerseyId, state: string, you: boolean) => {
      if (seen.has(id)) return;
      seen.add(id);
      list.push({ id, name, short, jersey, you, state });
    };
    if (localPeerId && identity) {
      push(localPeerId, identity.name, identity.short, identity.jersey, "connected", true);
    }
    for (const [id, seat] of Object.entries(seats)) {
      const peer = mesh.peers.find((p) => p.id === id);
      const state = id === localPeerId ? "connected" : (peer?.connectionState ?? "connecting");
      push(id, seat.name, seat.short, seat.jersey, state, id === localPeerId);
    }
    for (const p of mesh.peers) {
      const seat = seats[p.id];
      push(p.id, seat?.name ?? p.name, seat?.short ?? "—", seat?.jersey ?? "bone", p.connectionState, false);
    }
    return list;
  }, [seats, mesh.peers, localPeerId, identity]);

  const liveCount = rows.filter((r) => r.state === "connected").length;
  const cpuFill = Math.max(0, TEAM_COUNT - liveCount);
  const hostMissing =
    !isHost && Boolean(hostPeerId) && !connectedIds.has(hostPeerId) && mesh.joined;
  const failed = rows.filter((r) => r.state === "failed");

  const liveShare = isLiveShareHost();
  const shareLink = roomShareUrl(roomCode);

  const copy = async (kind: "code" | "link") => {
    const text = kind === "link" && shareLink ? shareLink : roomCode;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const start = () => {
    const s = useGame.getState();
    if (!s.localPeerId || !s.onlineIdentity) return;
    const humans = [{ peerId: s.localPeerId, ...s.onlineIdentity }];
    for (const [id, seat] of Object.entries(s.lobbySeats)) {
      if (id === s.localPeerId) continue;
      if (!connectedIds.has(id)) continue;
      humans.push({ peerId: id, ...seat });
      if (humans.length >= TEAM_COUNT) break;
    }
    unlockAudio();
    startOnlineSeason(humans, s.localPeerId, s.localPeerId);
  };

  return (
    <Field>
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-28 pt-10">
        <button type="button" className="self-start text-sm text-muted hover:text-fg" onClick={leave}>
          Leave
        </button>
        <p className="mt-8 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Private room</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Night League</h1>
        <p className="mt-2 text-sm text-muted">
          {lateJoinBlocked
            ? "This game already started. Leave and host a new room."
            : !liveShare
              ? "This preview is only you. Open the live link on each phone, then use this code."
              : isHost
                ? "Text Cindy the code. She opens the same link, taps Play with friends, and joins."
                : "Waiting on the host. Stay on this page."}
        </p>

        <div className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Room code</p>
          <p className="mt-2 font-display text-5xl font-semibold tracking-[0.28em]">{roomCode}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void copy("code")}>
              {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "code" ? "Copied" : "Copy code"}
            </Button>
            {shareLink && (
              <Button size="sm" variant="ghost" onClick={() => void copy("link")}>
                {copied === "link" ? "Link copied" : "Copy join link"}
              </Button>
            )}
          </div>
        </div>

        {!mesh.joined && <p className="mt-5 text-sm text-muted">Linking to the room…</p>}
        {hostMissing && !lateJoinBlocked && (
          <p className="mt-5 text-sm text-loss">Host left. Leave and host a new room.</p>
        )}
        {failed.map((p) => (
          <p key={p.id} className="mt-3 text-sm text-loss">
            Can’t reach {p.name} — they may be behind a strict network.
          </p>
        ))}

        <h2 className="mt-8 font-display text-xl font-semibold">Table</h2>
        <ul className="mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex min-h-14 items-center gap-3 px-4">
              <JerseyMark jersey={row.jersey} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {row.name}
                {row.you ? " · you" : ""}
                {isHost && row.id === localPeerId ? " · host" : ""}
              </span>
              <span className="font-mono text-[11px] text-muted">
                {row.state === "connected" ? row.short : row.state === "failed" ? "Can’t reach" : "Linking"}
              </span>
            </li>
          ))}
          {cpuFill > 0 &&
            Array.from({ length: cpuFill }).map((_, i) => (
              <li key={`cpu-${i}`} className="flex min-h-14 items-center gap-3 px-4 text-subtle">
                <span className="size-2.5 rounded-full bg-surface-2" />
                <span className="text-sm">Open seat</span>
              </li>
            ))}
        </ul>

        {isHost && !lateJoinBlocked ? (
          <Button size="lg" className="mt-8" disabled={!localPeerId} onClick={start}>
            Start auction
          </Button>
        ) : (
          <p className="mt-8 text-sm text-muted">
            {lateJoinBlocked ? "The board is already live." : "The host starts. Stay on this page."}
          </p>
        )}
        <p className="mt-3 font-mono text-xs tabular-nums text-subtle">
          {liveCount} live · {cpuFill} open
        </p>
      </main>
    </Field>
  );
}
