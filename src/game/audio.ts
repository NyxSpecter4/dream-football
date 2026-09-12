let ctx: AudioContext | null = null;
let crowdSrc: AudioBufferSourceNode | null = null;
let crowdGain: GainNode | null = null;
let master: GainNode | null = null;

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

function bus(): GainNode | null {
  const c = context();
  if (!c) return null;
  if (!master) {
    master = c.createGain();
    master.gain.value = 0.9;
    master.connect(c.destination);
  }
  return master;
}

export function unlockAudio() {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const c = context();
  const out = bus();
  if (!c || !out) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur: number, gain: number, hp: number, delay = 0) {
  const c = context();
  const out = bus();
  if (!c || !out) return;
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = n.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = n;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hp;
  const g = c.createGain();
  const t = c.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
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

export function sfxTd() {
  tone(196, 0.14, "triangle", 0.05);
  tone(294, 0.16, "sine", 0.045, 0.05);
  tone(392, 0.2, "sine", 0.04, 0.12);
  noiseBurst(0.28, 0.04, 200);
}

export function sfxSnap() {
  noiseBurst(0.05, 0.035, 400);
  tone(140, 0.07, "triangle", 0.03);
}

export function sfxTackle() {
  noiseBurst(0.12, 0.05, 180);
  tone(90, 0.1, "sine", 0.04);
}

export function sfxKick() {
  tone(220, 0.08, "triangle", 0.04);
  tone(510, 0.12, "sine", 0.025, 0.04);
  noiseBurst(0.08, 0.03, 600);
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

export function startCrowd() {
  const c = context();
  const out = bus();
  if (!c || !out) return;
  if (crowdSrc) return;
  const len = 2;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
    data[i] = last;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 680;
  filter.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0.0001;
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start();
  crowdSrc = src;
  crowdGain = g;
}

export function setCrowd(level: number) {
  const c = context();
  if (!c || !crowdGain) return;
  const v = Math.max(0.0001, Math.min(0.08, level * 0.08));
  crowdGain.gain.setTargetAtTime(v, c.currentTime, 0.08);
}

export function stopCrowd() {
  const c = context();
  if (crowdGain && c) {
    crowdGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.12);
  }
  const src = crowdSrc;
  crowdSrc = null;
  crowdGain = null;
  if (src) {
    try {
      src.stop(c ? c.currentTime + 0.3 : 0);
    } catch {
      /* already stopped */
    }
  }
}
