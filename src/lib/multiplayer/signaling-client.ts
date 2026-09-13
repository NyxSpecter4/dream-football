/**
 * Signaling transport for P2PRoom.
 *
 * Preview / localhost uses this app's /api/rtc (PGLite, single process).
 * A public URL (Vercel, grok.me, custom domain) has no shared database, so
 * rooms meet on a public MQTT broker instead — same wire shapes either way.
 */
import type { RtcPollResponse, SignalKind } from "./p2p";

export interface Signaling {
  poll(q: { room: string; peer: string; name: string; since: number }): Promise<RtcPollResponse>;
  signal(msg: {
    room: string;
    from: string;
    to: string;
    kind: SignalKind;
    payload: unknown;
  }): Promise<void>;
  leave(msg: { room: string; peer: string }): Promise<void>;
}

type Wire =
  | { k: "hb"; peer: string; name: string; ts: number }
  | {
      k: "sig";
      id: number;
      from: string;
      to: string;
      kind: SignalKind;
      payload: unknown;
    }
  | { k: "bye"; peer: string };

const PEER_TTL_MS = 30_000;
const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt"];

export function isPublicShareHost(
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
) {
  const h = hostname.toLowerCase();
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return false;
  if (h === "grok-sandbox.com" || h.endsWith(".grok-sandbox.com")) return false;
  return true;
}

const httpSignaling: Signaling = {
  async poll(q) {
    const params = new URLSearchParams({
      room: q.room,
      peer: q.peer,
      name: q.name,
      since: String(q.since),
    });
    const res = await fetch(`/api/rtc?${params}`);
    if (!res.ok) throw new Error(`signaling poll failed: ${res.status}`);
    return (await res.json()) as RtcPollResponse;
  },
  async signal(msg) {
    const res = await fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "signal", ...msg }),
    });
    if (!res.ok) throw new Error(`signal POST failed: ${res.status}`);
  },
  async leave(msg) {
    await fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "leave", ...msg }),
      keepalive: true,
    });
  },
};

class MqttBroker {
  private ws: WebSocket | null = null;
  private buf = new Uint8Array(0);
  private packetId = 1;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private brokerIndex = 0;
  private closed = false;
  private ready: Promise<void>;
  private resolveReady: () => void = () => {};
  private readonly subs = new Set<string>();
  private readonly onPublish: (topic: string, payload: string) => void;
  readonly clientId: string;

  constructor(clientId: string, onPublish: (topic: string, payload: string) => void) {
    this.clientId = clientId.slice(0, 23);
    this.onPublish = onPublish;
    this.ready = new Promise((r) => {
      this.resolveReady = r;
    });
    this.connect();
  }

  waitReady(): Promise<void> {
    return Promise.race([
      this.ready,
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("mqtt connect timeout")), 5000);
      }),
    ]);
  }

  subscribe(topic: string) {
    this.subs.add(topic);
    if (this.ws?.readyState === WebSocket.OPEN) this.sendSubscribe(topic);
  }

  publish(topic: string, payload: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const t = encodeMqttString(topic);
    const p = new TextEncoder().encode(payload);
    const vh = new Uint8Array(t.length + p.length);
    vh.set(t, 0);
    vh.set(p, t.length);
    this.sendPacket(0x30, vh);
  }

  shutdown() {
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }

  private connect() {
    if (this.closed) return;
    const url = BROKERS[this.brokerIndex % BROKERS.length]!;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, ["mqtt"]);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      this.sendConnect();
    };
    ws.onmessage = (ev) => {
      const chunk = new Uint8Array(ev.data as ArrayBuffer);
      const next = new Uint8Array(this.buf.length + chunk.length);
      next.set(this.buf, 0);
      next.set(chunk, this.buf.length);
      this.buf = next;
      this.drain();
    };
    ws.onerror = () => {
      /* onclose handles retry */
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.brokerIndex += 1;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    this.ready = new Promise((r) => {
      this.resolveReady = r;
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 800);
  }

  private sendConnect() {
    const proto = encodeMqttString("MQTT");
    const id = encodeMqttString(this.clientId);
    const vh = new Uint8Array(proto.length + 4 + id.length);
    vh.set(proto, 0);
    let i = proto.length;
    vh[i++] = 4;
    vh[i++] = 0x02;
    vh[i++] = 0;
    vh[i++] = 45;
    vh.set(id, i);
    this.sendPacket(0x10, vh);
  }

  private sendSubscribe(topic: string) {
    const id = this.packetId++ & 0xffff;
    const t = encodeMqttString(topic);
    const vh = new Uint8Array(2 + t.length + 1);
    vh[0] = (id >> 8) & 0xff;
    vh[1] = id & 0xff;
    vh.set(t, 2);
    vh[2 + t.length] = 0;
    this.sendPacket(0x82, vh);
  }

  private sendPacket(type: number, variable: Uint8Array) {
    const len = encodeRemainingLength(variable.length);
    const out = new Uint8Array(1 + len.length + variable.length);
    out[0] = type;
    out.set(len, 1);
    out.set(variable, 1 + len.length);
    this.ws?.send(out);
  }

  private drain() {
    let offset = 0;
    while (offset < this.buf.length) {
      const type = this.buf[offset]!;
      const rem = decodeRemainingLength(this.buf, offset + 1);
      if (!rem) break;
      const packetEnd = offset + 1 + rem.bytes + rem.value;
      if (packetEnd > this.buf.length) break;
      const variable = this.buf.subarray(offset + 1 + rem.bytes, packetEnd);
      this.handlePacket(type, variable);
      offset = packetEnd;
    }
    this.buf = this.buf.subarray(offset);
  }

  private handlePacket(type: number, variable: Uint8Array) {
    const cmd = type & 0xf0;
    if (cmd === 0x20) {
      const code = variable[1] ?? 1;
      if (code !== 0) {
        this.ws?.close();
        return;
      }
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.sendPacket(0xc0, new Uint8Array(0)), 20_000);
      for (const topic of this.subs) this.sendSubscribe(topic);
      this.resolveReady();
      return;
    }
    if (cmd === 0x30) {
      const topicLen = (variable[0]! << 8) | variable[1]!;
      const qos = (type & 0x06) >> 1;
      let i = 2 + topicLen;
      if (qos > 0) i += 2;
      const topic = new TextDecoder().decode(variable.subarray(2, 2 + topicLen));
      const payload = new TextDecoder().decode(variable.subarray(i));
      this.onPublish(topic, payload);
    }
  }
}

type RoomState = {
  selfId: string;
  broker: MqttBroker;
  heartbeats: Map<string, { name: string; ts: number }>;
  inbox: { id: number; from: string; kind: SignalKind; payload: unknown }[];
  nextId: number;
};

const rooms = new Map<string, RoomState>();

function topicFor(room: string) {
  return `dreamfootball/${room}`;
}

function getRoom(room: string, peer: string): RoomState {
  const existing = rooms.get(room);
  if (existing) return existing;
  const state: RoomState = {
    selfId: peer,
    broker: null as unknown as MqttBroker,
    heartbeats: new Map(),
    inbox: [],
    nextId: 1,
  };
  const broker = new MqttBroker(`nl${peer}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 23), (_topic, payload) => {
    let msg: Wire;
    try {
      msg = JSON.parse(payload) as Wire;
    } catch {
      return;
    }
    if (msg.k === "hb") {
      state.heartbeats.set(msg.peer, { name: msg.name, ts: msg.ts });
    } else if (msg.k === "bye") {
      state.heartbeats.delete(msg.peer);
    } else if (msg.k === "sig" && msg.to === state.selfId && msg.from !== state.selfId) {
      state.inbox.push({ id: msg.id, from: msg.from, kind: msg.kind, payload: msg.payload });
    }
  });
  state.broker = broker;
  broker.subscribe(topicFor(room));
  rooms.set(room, state);
  return state;
}

const mqttSignaling: Signaling = {
  async poll(q) {
    const state = getRoom(q.room, q.peer);
    await state.broker.waitReady();
    const now = Date.now();
    state.broker.publish(
      topicFor(q.room),
      JSON.stringify({ k: "hb", peer: q.peer, name: q.name, ts: now } satisfies Wire),
    );
    state.heartbeats.set(q.peer, { name: q.name, ts: now });
    for (const [id, hb] of state.heartbeats) {
      if (now - hb.ts > PEER_TTL_MS) state.heartbeats.delete(id);
    }
    const peers = [...state.heartbeats.entries()].map(([id, hb]) => ({ id, name: hb.name }));
    const signals = state.inbox.filter((s) => s.id > q.since);
    if (signals.length) {
      const keep = state.inbox.filter((s) => s.id > q.since).slice(-200);
      state.inbox = keep;
    }
    return { peers, signals };
  },
  async signal(msg) {
    const state = getRoom(msg.room, msg.from);
    await state.broker.waitReady();
    const id = Date.now() * 100 + (state.nextId++ % 100);
    const wire: Wire = {
      k: "sig",
      id,
      from: msg.from,
      to: msg.to,
      kind: msg.kind,
      payload: msg.payload,
    };
    state.broker.publish(topicFor(msg.room), JSON.stringify(wire));
  },
  async leave(msg) {
    const state = rooms.get(msg.room);
    if (!state) return;
    state.broker.publish(topicFor(msg.room), JSON.stringify({ k: "bye", peer: msg.peer } satisfies Wire));
    state.heartbeats.delete(msg.peer);
  },
};

const httpOnly: Signaling = httpSignaling;

export function getSignaling(): Signaling {
  if (typeof window === "undefined") return httpOnly;
  return mqttSignaling;
}

function encodeMqttString(s: string): Uint8Array {
  const body = new TextEncoder().encode(s);
  const out = new Uint8Array(2 + body.length);
  out[0] = (body.length >> 8) & 0xff;
  out[1] = body.length & 0xff;
  out.set(body, 2);
  return out;
}

function encodeRemainingLength(len: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let encoded = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) encoded |= 0x80;
    bytes.push(encoded);
  } while (len > 0);
  return Uint8Array.from(bytes);
}

function decodeRemainingLength(
  buf: Uint8Array,
  start: number,
): { value: number; bytes: number } | null {
  let multiplier = 1;
  let value = 0;
  let bytes = 0;
  while (bytes < 4) {
    if (start + bytes >= buf.length) return null;
    const encoded = buf[start + bytes]!;
    bytes += 1;
    value += (encoded & 0x7f) * multiplier;
    if ((encoded & 0x80) === 0) return { value, bytes };
    multiplier *= 128;
  }
  return null;
}
