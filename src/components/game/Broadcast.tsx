import { useEffect, useMemo, useRef, useState } from "react";
import { buildNight, downLabel, lineupIds, type NightPlay } from "@/game/broadcast";
import { getPlayer } from "@/game/players";
import { sfxBid, sfxKick, sfxScore, sfxSnap, sfxTackle, sfxTd, setCrowd, startCrowd, stopCrowd } from "@/game/audio";
import { fmtPts, JerseyMark } from "./chrome";
import { cn } from "@/lib/utils";
import type { JerseyId, Roster } from "@/game/types";

export function NightBroadcast({
  week,
  seed,
  homeName,
  awayName,
  homeJersey,
  awayJersey,
  homeRoster,
  awayRoster,
  homePts,
  awayPts,
  live,
  onDone,
  board = true,
}: {
  week: number;
  seed: number;
  homeName: string;
  awayName: string;
  homeJersey: JerseyId;
  awayJersey: JerseyId;
  homeRoster?: Roster;
  awayRoster?: Roster;
  homePts: Record<string, number>;
  awayPts: Record<string, number>;
  live: boolean;
  onDone: () => void;
  board?: boolean;
}) {
  const ownedHome = useMemo(() => lineupIds(homeRoster), [homeRoster]);
  const ownedAway = useMemo(() => lineupIds(awayRoster), [awayRoster]);
  const game = useMemo(
    () =>
      buildNight({
        week,
        seed,
        ownedHome,
        ownedAway,
        homePts,
        awayPts,
      }),
    [week, seed, ownedHome, ownedAway, homePts, awayPts],
  );
  const plays = game.plays;
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [i, setI] = useState(() => (live && !reduced ? 0 : plays.length));
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const doneRef = useRef(false);
  const vis = useRef({ t: 1, trauma: 0 });
  const pausedRef = useRef(false);
  const fastRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const skipRef = useRef(false);
  pausedRef.current = paused;
  fastRef.current = fast;
  onDoneRef.current = onDone;

  useEffect(() => {
    setI(live && !reduced ? 0 : plays.length);
    doneRef.current = !(live && !reduced);
    skipRef.current = false;
    vis.current = { t: live && !reduced ? 0 : 1, trauma: 0 };
  }, [live, plays, reduced]);

  useEffect(() => {
    if (!live || reduced) {
      if (live && reduced && !doneRef.current) {
        doneRef.current = true;
        onDoneRef.current();
      }
      return;
    }
    startCrowd();
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    let idx = 0;
    const loop = (now: number) => {
      if (skipRef.current) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        acc += dt * (fastRef.current ? 1.85 : 1);
        vis.current.trauma = Math.max(0, vis.current.trauma - dt * 2.4);
        const play = plays[idx];
        const hold = (play?.hold ?? 1) / (fastRef.current ? 1.35 : 1);
        vis.current.t = play ? Math.min(1, acc / Math.max(0.2, hold)) : 1;
        if (acc >= hold) {
          acc = 0;
          vis.current.t = 0;
          if (play) hitSfx(play);
          if (play?.kind === "td") vis.current.trauma = Math.min(1, vis.current.trauma + 0.72);
          else if (play && play.ticks.some((tk) => tk.pts >= 3))
            vis.current.trauma = Math.min(1, vis.current.trauma + 0.28);
          idx += 1;
          setI(idx);
          if (idx >= plays.length) {
            vis.current.t = 1;
            stopCrowd();
            if (!doneRef.current) {
              doneRef.current = true;
              onDoneRef.current();
            }
            return;
          }
        }
        const swell = play?.kind === "td" ? 0.55 : play?.kind === "catch" ? 0.32 : 0.22;
        setCrowd(swell);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      stopCrowd();
    };
  }, [live, plays, reduced]);

  const done = i >= plays.length;
  const current = plays[Math.min(Math.max(0, done ? plays.length - 1 : i), Math.max(0, plays.length - 1))];
  const shown = plays.slice(0, done ? plays.length : Math.min(plays.length, i + 1));
  const homeBoard = shown.reduce((s, p) => s + p.ticks.filter((t) => t.board === "home").reduce((a, t) => a + t.pts, 0), 0);
  const awayBoard = shown.reduce((s, p) => s + p.ticks.filter((t) => t.board === "away").reduce((a, t) => a + t.pts, 0), 0);
  const owned = useMemo(() => new Set([...ownedHome, ...ownedAway]), [ownedHome, ownedAway]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <NflScore
          city={game.featured.home.city}
          abbr={game.featured.home.abbr}
          pts={current?.homeScore ?? 0}
          align="left"
          on={current?.possession === "home"}
        />
        <p className="pb-1 text-center font-mono text-[11px] tabular-nums text-muted">
          {current?.clock ?? "Q1 15:00"}
        </p>
        <NflScore
          city={game.featured.away.city}
          abbr={game.featured.away.abbr}
          pts={current?.awayScore ?? 0}
          align="right"
          on={current?.possession === "away"}
        />
      </div>
      <p className="mt-1 text-center font-mono text-[11px] tracking-wide text-subtle">
        {current
          ? downLabel(
              current.down,
              current.toGo,
              current.spot,
              current.possession,
              game.featured.home,
              game.featured.away,
            )
          : "Kickoff"}
      </p>

      <StadiumCanvas
        play={current}
        vis={vis}
        owned={owned}
        reduced={reduced || !live || done}
        homeAbbr={game.featured.home.abbr}
        awayAbbr={game.featured.away.abbr}
      />

      {current && (
        <div
          key={`${current.clock}-${shown.length}-${current.call}`}
          className={cn(
            "pop-in mt-3 rounded-lg bg-surface-2 px-4 py-3",
            current.kind === "td" && "ring-1 ring-win/40",
          )}
        >
          <p className="font-display text-xl font-semibold tracking-tight">{current.call}</p>
          {current.ticks.length > 0 && board && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {current.ticks.map((t) => (
                <li key={`${t.playerId}-${t.pts}`} className="font-mono text-[11px] tabular-nums text-win">
                  {getPlayer(t.playerId).name} +{fmtPts(t.pts)}
                </li>
              ))}
            </ul>
          )}
          {current.also && board && (
            <p className="mt-2 text-sm text-muted">{current.also.call}</p>
          )}
        </div>
      )}

      {board && (
        <div className="mt-4 flex items-end justify-between gap-3">
          <ScoreBug name={homeName} jersey={homeJersey} pts={homeBoard} align="left" />
          <p className="pb-1 font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Your board</p>
          <ScoreBug name={awayName} jersey={awayJersey} pts={awayBoard} align="right" />
        </div>
      )}

      {live && !done && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="min-h-11 rounded-lg bg-surface px-4 text-sm shadow-[var(--shadow-border)]"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => setFast((f) => !f)}
            className="min-h-11 rounded-lg bg-surface px-4 text-sm shadow-[var(--shadow-border)]"
          >
            {fast ? "Live pace" : "Faster"}
          </button>
          <button
            type="button"
            onClick={() => {
              skipRef.current = true;
              vis.current.t = 1;
              setI(plays.length);
              stopCrowd();
              if (!doneRef.current) {
                doneRef.current = true;
                onDoneRef.current();
              }
            }}
            className="min-h-11 rounded-lg bg-surface px-4 text-sm shadow-[var(--shadow-border)]"
          >
            Skip
          </button>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-subtle">
        Simulated night. Names and public box-score facts. Not an NFL broadcast, and not a league feed.
      </p>
    </div>
  );
}

function hitSfx(play: NightPlay) {
  if (play.kind === "td") sfxTd();
  else if (play.kind === "fg" || play.kind === "xp" || play.kind === "kickoff") sfxKick();
  else if (play.kind === "sack" || play.kind === "int") sfxTackle();
  else if (play.kind === "run" || play.kind === "scramble") sfxSnap();
  else if (play.ticks.some((t) => t.pts >= 3)) sfxBid();
  else sfxScore();
}

function NflScore({
  city,
  abbr,
  pts,
  align,
  on,
}: {
  city: string;
  abbr: string;
  pts: number;
  align: "left" | "right";
  on: boolean;
}) {
  return (
    <div className={cn("min-w-0 flex-1", align === "right" && "text-right")}>
      <p className={cn("truncate text-sm", on ? "text-fg" : "text-muted")}>{city}</p>
      <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{abbr}</p>
      <p className="font-display text-4xl font-semibold tabular-nums tracking-tight">{pts}</p>
    </div>
  );
}

function ScoreBug({
  name,
  jersey,
  pts,
  align,
}: {
  name: string;
  jersey: JerseyId;
  pts: number;
  align: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0 flex-1", align === "right" && "text-right")}>
      <p className={cn("flex items-center gap-2 text-sm", align === "right" && "justify-end")}>
        {align === "left" && <JerseyMark jersey={jersey} />}
        <span className="truncate">{name}</span>
        {align === "right" && <JerseyMark jersey={jersey} />}
      </p>
      <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">{fmtPts(pts)}</p>
    </div>
  );
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

function StadiumCanvas({
  play,
  vis,
  owned,
  reduced,
  homeAbbr,
  awayAbbr,
}: {
  play: NightPlay | undefined;
  vis: { current: { t: number; trauma: number } };
  owned: Set<string>;
  reduced: boolean;
  homeAbbr: string;
  awayAbbr: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const playRef = useRef(play);
  playRef.current = play;
  const labels = useRef({ homeAbbr, awayAbbr });
  labels.current = { homeAbbr, awayAbbr };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const root = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => {
      const v = root.getPropertyValue(name).trim();
      return v || fallback;
    };
    const turf = token("--color-turf", "#142218");
    const end = token("--color-turf-end", "#1e3a2a");
    const fg = token("--color-fg", "#eef2ec");
    const win = token("--color-win", "#7dba8e");
    const bone = token("--color-jersey-bone", "#d7d2c8");
    const midnight = token("--color-jersey-steel", "#4a5c6a");
    const bg = token("--color-bg", "#0c0f0c");

    let raf = 0;
    let last = performance.now();
    let cam = 50;
    const lights = Array.from({ length: 18 }, (_, i) => ({
      x: 8 + (i % 9) * 10.5,
      y: i < 9 ? 4 : 96,
      p: i * 0.37,
    }));

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = playRef.current;
      const t = reduced ? 1 : easeOut(vis.current.t);
      const ball = p ? p.from + (p.to - p.from) * t : 50;
      cam += (ball - cam) * (1 - Math.exp(-3.2 * dt));
      const trauma = reduced ? 0 : vis.current.trauma;
      const shake = trauma * trauma;
      draw(
        ctx,
        canvas,
        {
          turf,
          end,
          fg,
          win,
          bone,
          midnight,
          bg,
        },
        p,
        ball,
        cam,
        t,
        shake,
        now / 1000,
        owned,
        lights,
        labels.current,
      );
      raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(() => sizeCanvas(canvas));
    sizeCanvas(canvas);
    ro.observe(canvas);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [owned, reduced, vis]);

  return (
    <canvas
      ref={ref}
      className="mt-3 h-56 w-full rounded-xl bg-turf sm:h-72"
      aria-hidden
    />
  );
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  c: Record<string, string>,
  play: NightPlay | undefined,
  ball: number,
  cam: number,
  t: number,
  shake: number,
  time: number,
  owned: Set<string>,
  lights: Array<{ x: number; y: number; p: number }>,
  labels: { homeAbbr: string; awayAbbr: string },
) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);

  const pad = h * 0.07;
  const fieldH = h - pad * 2;
  const fieldW = w;
  const visible = 52;
  const origin = cam - visible / 2;
  const sx = (yd: number) => ((yd - origin) / visible) * fieldW;
  const sy = (lane: number) => pad + fieldH * lane;

  ctx.save();
  ctx.translate((Math.sin(time * 37) * 5 + Math.cos(time * 21) * 3) * shake, Math.sin(time * 29) * 4 * shake);

  ctx.fillStyle = c.turf;
  ctx.fillRect(0, pad, w, fieldH);
  ctx.fillStyle = c.end;
  ctx.fillRect(sx(-10), pad, sx(0) - sx(-10), fieldH);
  ctx.fillRect(sx(100), pad, sx(110) - sx(100), fieldH);

  ctx.strokeStyle = "rgba(238,242,236,0.22)";
  ctx.lineWidth = Math.max(1, h * 0.004);
  for (let y = 0; y <= 100; y += 10) {
    const x = sx(y);
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, pad + fieldH);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(238,242,236,0.4)";
  ctx.beginPath();
  ctx.moveTo(sx(50), pad);
  ctx.lineTo(sx(50), pad + fieldH);
  ctx.stroke();

  ctx.fillStyle = "rgba(238,242,236,0.28)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const marks = [
    [10, "10"],
    [20, "20"],
    [30, "30"],
    [40, "40"],
    [50, "50"],
    [60, "40"],
    [70, "30"],
    [80, "20"],
    [90, "10"],
  ] as const;
  ctx.font = `${Math.floor(h * 0.06)}px "Barlow Condensed", sans-serif`;
  for (const [yd, label] of marks) {
    ctx.fillText(label, sx(yd), pad + fieldH * 0.14);
    ctx.fillText(label, sx(yd), pad + fieldH * 0.86);
  }

  ctx.fillStyle = "rgba(238,242,236,0.34)";
  ctx.font = `${Math.floor(h * 0.075)}px "Barlow Condensed", sans-serif`;
  ctx.save();
  ctx.translate((sx(-10) + sx(0)) / 2, pad + fieldH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(labels.homeAbbr, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate((sx(100) + sx(110)) / 2, pad + fieldH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(labels.awayAbbr, 0, 0);
  ctx.restore();

  for (const L of lights) {
    const x = (L.x / 100) * w;
    const y = pad + (L.y / 100) * fieldH;
    const pulse = 0.12 + Math.sin(time + L.p) * 0.03;
    const g = ctx.createRadialGradient(x, y, 0, x, y, h * 0.24);
    g.addColorStop(0, `rgba(238,242,236,${pulse})`);
    g.addColorStop(1, "rgba(238,242,236,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - h * 0.24, y - h * 0.24, h * 0.48, h * 0.48);
  }

  const poss = play?.possession ?? "home";
  const dir = poss === "home" ? 1 : -1;
  const form = formation(ball, dir, t, play);
  for (const u of form) {
    const x = sx(u.yd);
    const y = sy(u.lane);
    const mine = u.id ? owned.has(u.id) : false;
    drawMan(
      ctx,
      x,
      y,
      h,
      u.side === "off" ? c.bone : c.midnight,
      u.side === "off" ? c.bg : c.fg,
      mine ? c.win : null,
      u.tag,
    );
  }

  const bx = sx(ball);
  const by = sy(play?.kind === "pass" || play?.kind === "catch" || play?.kind === "incomplete" ? 0.38 + (1 - t) * 0.18 : 0.5);
  const br = h * (play?.kind === "td" ? 0.032 : 0.022);
  ctx.fillStyle = play?.kind === "td" ? c.win : c.fg;
  ctx.beginPath();
  ctx.ellipse(bx, by, br * (1.35 + t * 0.2), br, dir * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function formation(ball: number, dir: number, t: number, play: NightPlay | undefined) {
  const shift = (play?.yards ?? 0) * t * 0.35 * dir;
  const off = [
    { yd: ball - dir * 7, lane: 0.5, tag: "", id: play?.playerId ?? null, side: "off" as const },
    { yd: ball - dir * 2, lane: 0.5, tag: "", id: null, side: "off" as const },
    { yd: ball + dir * (8 + shift), lane: 0.22, tag: "", id: play?.targetId ?? null, side: "off" as const },
    { yd: ball + dir * (6 + shift), lane: 0.78, tag: "", id: null, side: "off" as const },
    { yd: ball - dir * 1, lane: 0.36, tag: "", id: null, side: "off" as const },
    { yd: ball + dir * 2, lane: 0.64, tag: "", id: null, side: "off" as const },
  ];
  const def = [
    { yd: ball + dir * 3, lane: 0.5, tag: "", id: null, side: "def" as const },
    { yd: ball + dir * 5, lane: 0.28, tag: "", id: null, side: "def" as const },
    { yd: ball + dir * 5, lane: 0.72, tag: "", id: null, side: "def" as const },
    { yd: ball + dir * 12, lane: 0.4, tag: "", id: null, side: "def" as const },
    { yd: ball + dir * 14, lane: 0.62, tag: "", id: null, side: "def" as const },
  ];
  const carrier = play?.targetId ?? play?.playerId;
  if (carrier && (play?.kind === "run" || play?.kind === "scramble" || play?.kind === "td" || play?.kind === "catch")) {
    off[0] = { yd: ball, lane: 0.5, tag: "", id: carrier, side: "off" };
  }
  return [...off, ...def];
}

function drawMan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  fill: string,
  ink: string,
  ring: string | null,
  tag: string,
) {
  const r = h * 0.038;
  ctx.fillStyle = fill;
  roundRect(ctx, x - r * 0.7, y - r * 1.1, r * 1.4, r * 2.1, r * 0.45);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - r * 1.25, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(1.5, h * 0.006);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (tag) {
    ctx.fillStyle = ink;
    ctx.font = `${Math.floor(h * 0.04)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(tag, x, y + r * 2.4);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
