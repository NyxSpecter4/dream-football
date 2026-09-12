let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio() {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const c = context();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sfxTick() {
  tone(620, 0.06, "square", 0.03);
}

export function sfxBid() {
  tone(280, 0.07, "triangle", 0.04);
  tone(420, 0.09, "sine", 0.03, 0.03);
}

export function sfxSold() {
  tone(196, 0.12, "triangle", 0.05);
  tone(294, 0.16, "sine", 0.04, 0.05);
}

export function sfxScore() {
  tone(480, 0.08, "triangle", 0.035);
}

export function sfxWin() {
  tone(392, 0.18, "sine", 0.05);
  tone(494, 0.22, "sine", 0.045, 0.08);
  tone(587, 0.28, "sine", 0.04, 0.16);
}

export function sfxLoss() {
  tone(196, 0.28, "sine", 0.04);
  tone(147, 0.32, "triangle", 0.03, 0.06);
}
