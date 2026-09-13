import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  applyPlatform,
  loadPlugin,
  PLATFORMS,
  savePlugin,
  type Platform,
  type PluginSave,
} from "@/game/plugin";

export function PluginBar() {
  const [plug, setPlug] = useState<PluginSave>(loadPlugin);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applyPlatform(plug.platform);
  }, [plug.platform]);

  function pick(p: Platform) {
    const next = { ...plug, platform: p };
    setPlug(next);
    savePlugin(next);
    setMsg("");
    setQ(p === "sleeper" ? plug.sleeperUser : p === "espn" ? plug.espnLeague : "");
  }

  async function connect() {
    if (plug.platform === "yahoo") {
      setMsg("Yahoo’s Fantasy API is apply-only. Skin is on. League stays ours.");
      return;
    }
    if (plug.platform === "dream") return;
    const query = q.trim();
    if (!query) {
      setMsg(plug.platform === "sleeper" ? "Type a Sleeper username." : "Paste a public ESPN league ID.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/plugin?host=${plug.platform}&q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        name?: string;
        leagues?: Array<{ name: string; size: number }>;
        size?: number;
      };
      if (!data.ok) {
        setMsg(data.error || "Couldn’t reach them.");
        return;
      }
      const next: PluginSave =
        plug.platform === "sleeper"
          ? {
              ...plug,
              sleeperUser: query,
              sleeperLabel: data.leagues?.[0]
                ? `${data.name} · ${data.leagues[0].name}`
                : data.name ?? query,
            }
          : { ...plug, espnLeague: query, espnLabel: `${data.name} · ${data.size} clubs` };
      setPlug(next);
      savePlugin(next);
      setMsg(plug.platform === "sleeper" ? next.sleeperLabel : next.espnLabel);
    } catch {
      setMsg("Wire down.");
    } finally {
      setBusy(false);
    }
  }

  const linked =
    plug.platform === "sleeper"
      ? plug.sleeperLabel
      : plug.platform === "espn"
        ? plug.espnLabel
        : plug.platform === "yahoo"
          ? "Yahoo skin · our league"
          : "";

  return (
    <div className="plugin-bar sticky top-0 z-30">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-3 py-2">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">Companion</p>
        <div className="flex gap-1">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              className={cn(
                "chip min-h-8 rounded-full px-3 text-[11px] font-medium",
                plug.platform === p.id ? "bg-accent text-accent-fg" : "bg-surface text-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {plug.platform !== "dream" && (
          <form
            className="flex min-w-0 flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={PLATFORMS.find((p) => p.id === plug.platform)?.hint}
              className="h-8 min-w-0 flex-1 rounded-md bg-surface px-2 font-mono text-[11px] text-fg outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-8 shrink-0 rounded-md bg-surface-2 px-2 font-mono text-[11px] text-fg"
            >
              {busy ? "…" : "Link"}
            </button>
          </form>
        )}
      </div>
      {(msg || linked) && (
        <p className="mx-auto max-w-5xl px-3 pb-2 font-mono text-[10px] text-subtle">
          {msg || linked} · we don’t sit inside their app. Read-only.
        </p>
      )}
    </div>
  );
}
