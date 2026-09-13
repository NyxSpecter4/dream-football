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
  const [name, setName] = useState("");
  const [short, setShort] = useState("PLY");
  const [jersey, setJersey] = useState<JerseyId>("pine");
  const [joinCode, setJoinCode] = useState(pending ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (pending) setJoinCode(pending);
  }, [pending]);

  const ident = () => ({
    name: name.trim() || "Player",
    short: (short.trim() || name.trim().slice(0, 3) || "PLY").slice(0, 4).toUpperCase(),
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
          {pending ? "Cindy's joining" : "You and Cindy"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {pending
            ? "Your name. Join. The Sunday desk already sits the other seats."
            : isLiveShareHost()
              ? "Host. Send Cindy the 4-letter code. The desk fills the table."
              : "Both of you open nl-play.vercel.app. The Sunday desk takes the other seats."}
        </p>

        <label className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Your name</label>
        <input
          value={name}
          maxLength={22}
          placeholder="You or Cindy"
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-12 rounded-lg bg-surface px-4 text-base text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />

        {!pending && (
          <>
            <Button size="lg" className="mt-8" onClick={hostRoom}>
              Host a room
            </Button>
            <p className="mt-8 text-center text-xs tracking-wide text-muted uppercase">or join</p>
          </>
        )}

        <label className="mt-6 text-xs font-medium tracking-wide text-muted uppercase">4-letter code</label>
        <input
          value={joinCode}
          maxLength={8}
          placeholder="K7MQ"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          onChange={(e) => {
            setJoinCode(e.target.value.toUpperCase());
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") joinRoom();
          }}
          className="mt-2 h-16 w-full rounded-lg bg-surface px-4 font-display text-4xl tracking-[0.28em] text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />
        {error && <p className="mt-2 text-sm text-loss">{error}</p>}
        <Button size="lg" variant={pending ? "primary" : "secondary"} className="mt-4" onClick={joinRoom}>
          Join room
        </Button>

        <p className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Jersey</p>
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
    const url = shareLink || (typeof window !== "undefined" ? `${window.location.origin}/?room=${roomCode}` : "");
    const text = kind === "link" ? `Dream Football room ${roomCode}\n${url}` : roomCode;
    try {
      await navigator.clipboard.writeText(kind === "link" ? url : roomCode);
    } catch {
      /* ignore */
    }
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
    return text;
  };

  const share = async () => {
    const url = shareLink || `${window.location.origin}/?room=${roomCode}`;
    const text = `Join my Dream Football room ${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Dream Football", text, url });
        return;
      }
    } catch {
      /* user cancelled */
    }
    await copy("link");
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
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Dream Football</h1>
        <p className="mt-2 text-sm text-muted">
          {lateJoinBlocked
            ? "This game already started. Leave and host a new room."
            : !liveShare
              ? "This preview is only you. Open the live link on each phone, then use this code."
              : isHost
                ? "Text her the code OR the link. She stays on this site. Both stay on this page."
                : "You're in. Wait for the host. Don't leave this page."}
        </p>

        <div className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">Room code</p>
          <p className="mt-2 select-all font-display text-5xl font-semibold tracking-[0.28em]">{roomCode}</p>
          {shareLink && (
            <p className="mt-3 break-all font-mono text-[11px] text-muted select-all">{shareLink}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void share()}>
              Text her the link
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void copy("code")}>
              {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied === "code" ? "Copied" : "Copy code"}
            </Button>
            {shareLink && (
              <Button size="sm" variant="ghost" onClick={() => void copy("link")}>
                {copied === "link" ? "Link copied" : "Copy link"}
              </Button>
            )}
          </div>
        </div>

        {!mesh.joined && <p className="mt-5 text-sm text-muted">Connecting… keep this page open.</p>}
        {mesh.joined && liveCount < 2 && isHost && (
          <p className="mt-5 text-sm text-muted">Waiting for her to join. Wi-Fi is more reliable than cell.</p>
        )}
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
            Start the draft
          </Button>
        ) : (
          <p className="mt-8 text-sm text-muted">
            {lateJoinBlocked ? "This draft already started." : "The host starts the draft. Stay on this page."}
          </p>
        )}
        <p className="mt-3 font-mono text-xs tabular-nums text-subtle">
          {liveCount} live · {cpuFill} open
        </p>
      </main>
    </Field>
  );
}
