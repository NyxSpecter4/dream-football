/**
 * Haptic feedback — the phone half of "juice".
 *
 * Every cue in this game is audio (see `src/game/audio.ts`). A draft is played one-handed on
 * a phone, and vibration lands harder than a synth blip: the same events get a physical tick.
 * Patterns stay SHORT on purpose — the bid window is about a second, so a long buzz would
 * still be running when the next one starts.
 *
 * Defaults ON where the API exists, and the player can switch it off (persisted).
 */
const KEY = "dream-football:haptics";

export type HapticCue = "tick" | "pick" | "bid" | "sold" | "win" | "loss";

/** Deliberately terse: 8ms reads as a tick, 20-45-20 as a gavel. */
const PATTERNS: Record<HapticCue, number | number[]> = {
  tick: 8,
  pick: 12,
  bid: 16,
  sold: [20, 45, 20],
  win: [14, 55, 14, 55, 90],
  loss: [45, 90, 45],
};

export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function hapticsOn(): boolean {
  if (typeof window === "undefined" || !hapticsSupported()) return false;
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    // Storage can be blocked (private mode / installed-webview quirks): fall back to on.
    return true;
  }
}

export function setHaptics(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked — the choice holds for this session only.
  }
  if (on) buzz("pick");
}

/** Fire a cue. Safe to call anywhere: no-ops when unsupported, disabled, or on the server. */
export function buzz(cue: HapticCue) {
  if (typeof navigator === "undefined" || !hapticsOn()) return;
  try {
    navigator.vibrate(PATTERNS[cue]);
  } catch {
    // Some browsers throw while the page is hidden or the context is suspended.
  }
}
