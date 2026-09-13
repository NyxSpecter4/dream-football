export type Platform = "dream" | "espn" | "yahoo" | "sleeper";

export const PLATFORMS: Array<{ id: Platform; label: string; hint: string }> = [
  { id: "espn", label: "ESPN", hint: "Public league ID" },
  { id: "yahoo", label: "Yahoo", hint: "Skin — their API is apply-only" },
  { id: "sleeper", label: "Sleeper", hint: "Username, public leagues" },
];

const KEY = "dream-football-plugin";

export type PluginSave = {
  platform: Platform;
  sleeperUser: string;
  sleeperLabel: string;
  espnLeague: string;
  espnLabel: string;
};

const EMPTY: PluginSave = {
  platform: "dream",
  sleeperUser: "",
  sleeperLabel: "",
  espnLeague: "",
  espnLabel: "",
};

export function loadPlugin(): PluginSave {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<PluginSave>) };
  } catch {
    return EMPTY;
  }
}

export function savePlugin(next: PluginSave) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  document.documentElement.dataset.platform = next.platform === "dream" ? "" : next.platform;
}

export function applyPlatform(p: Platform) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.platform = p === "dream" ? "" : p;
}
