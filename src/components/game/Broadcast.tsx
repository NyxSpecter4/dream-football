import { useEffect, useMemo, useRef, useState } from "react";
import { buildNight, downLabel, lineupIds, nightFromWire, type NightPlay } from "@/game/broadcast";
import { getPlayer } from "@/game/players";
import { sfxBid, sfxKick, sfxScore, sfxSnap, sfxTackle, sfxTd, setCrowd, startCrowd, stopCrowd } from "@/game/audio";
import { fmtPts, JerseyMark, jerseyNum } from "./chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JerseyId, Roster } from "@/game/types";
import { hasTape, type WireGame } from "@/game/wire";
import { teamOf } from "@/game/nfl";

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
  card,
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
  card?: WireGame | null;
}) {
  const ownedHome = useMemo(() => lineupIds(homeRoster), [homeRoster]);
  const ownedAway = useMemo(() => lineupIds(awayRoster), [awayRoster]);
  const taped = hasTape(card);
  const game = useMemo(() => {
    if (card && taped) {
      return (
        nightFromWire({
          card,
          ownedHome,
          ownedAway,
          homePts,
          awayPts,
          week,
        }) ??
        buildNight({
          week,
          seed,
          ownedHome,
          ownedAway,
          homePts,
          awayPts,
          homeAbbr: card.homeAbbr,
          awayAbbr: card.awayAbbr,
        })
      );
    }
    return buildNight({
      week,
      seed,
      ownedHome,
      ownedAway,
      homePts,
      awayPts,
      homeAbbr: card?.homeAbbr,
      awayAbbr: card?.awayAbbr,
    });
  }, [week, seed, ownedHome, ownedAway, homePts, awayPts, card, taped]);
  const plays = game.plays;
  const playsRef = useRef(plays);
  playsRef.current = plays;
  const cardStateRef = useRef(card?.state);
  cardStateRef.current = card?.state;
  const tapedRef = useRef(taped);
  tapedRef.current = taped;
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resetKey = `${seed}-${card?.id ?? "sim"}-${taped ? "tape" : "sim"}`;
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
    setI(live && !reduced ? 0 : playsRef.current.length);
    doneRef.current = !(live && !reduced);
    skipRef.current = false;
    vis.current = { t: live && !reduced ? 0 : 1, trauma: 0 };
  }, [live, reduced, resetKey]);

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
      const list = playsRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        acc += dt * (fastRef.current ? 1.85 : 1);
        vis.current.trauma = Math.max(0, vis.current.trauma - dt * 2.4);
        const play = list[idx];
        const hold = (play?.hold ?? 1) / (fastRef.current ? 1.35 : 1);
        vis.current.t = play ? Math.min(1, acc / Math.max(0.2, hold)) : 1;
        if (acc >= hold) {
          const more = idx + 1 < list.length;
          const canEnd = !(tapedRef.current && cardStateRef.current === "live");
          if (!more && !canEnd) {
            acc = 0;
            vis.current.t = 1;
            setI(list.length);
          } else {
            acc = 0;
            vis.current.t = 0;
            if (play) hitSfx(play);
            if (play?.kind === "td") vis.current.trauma = Math.min(1, vis.current.trauma + 0.72);
            else if (play && play.ticks.some((tk) => tk.pts >= 3))
              vis.current.trauma = Math.min(1, vis.current.trauma + 0.28);
            idx += 1;
            setI(idx);
            if (idx >= list.length) {
              vis.current.t = 1;
              stopCrowd();
              if (!doneRef.current) {
                doneRef.current = true;
                onDoneRef.current();
              }
              return;
            }
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
  }, [live, reduced, resetKey]);

  const done = i >= plays.length;
  const current = plays[Math.min(Math.max(0, done ? plays.length - 1 : i), Math.max(0, plays.length - 1))];
  const shown = plays.slice(0, done ? plays.length : Math.min(plays.length, i + 1));
  const homeBoard = shown.reduce((s, p) => s + p.ticks.filter((t) => t.board === "home").reduce((a, t) => a + t.pts, 0), 0);
  const awayBoard = shown.reduce((s, p) => s + p.ticks.filter((t) => t.board === "away").reduce((a, t) => a + t.pts, 0), 0);
  const owned = useMemo(() => new Set([...ownedHome, ...ownedAway]), [ownedHome, ownedAway]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase",
            taped && card?.state === "live"
              ? "bg-live/15 text-live"
              : taped
                ? "bg-win/15 text-win"
                : "bg-surface-2 text-muted",
          )}
        >
          {taped ? (card?.state === "live" ? "Live downs" : "Real downs") : "Sim"}
        </span>
        <p className="min-w-0 font-mono text-[11px] text-subtle">{wireNote(card, taped)}</p>
      </div>
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
          <span className="mt-0.5 block tracking-[0.16em] uppercase text-subtle">
            {taped ? (card?.state === "final" ? "Tape" : "Live") : "Sim"}
          </span>
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

      <div className="field-glow mt-3">
      <StadiumCanvas
        play={current}
        vis={vis}
        owned={owned}
        reduced={reduced || !live || done}
        homeAbbr={game.featured.home.abbr}
        awayAbbr={game.featured.away.abbr}
      />
      </div>

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
          <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant={fast ? "field" : "secondary"} onClick={() => setFast((f) => !f)}>
            {fast ? "Live pace" : "Faster"}
          </Button>
          <Button variant="ghost" onClick={() => {
              skipRef.current = true;
              vis.current.t = 1;
              setI(plays.length);
              stopCrowd();
              if (!doneRef.current) {
                doneRef.current = true;
                onDoneRef.current();
              }
            }}>
            Skip
          </Button>
        </div>
      )}

      {taped && card?.injuries && card.injuries.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-subtle">
          {card.injuries
            .slice(0, 4)
            .map((inj) => `${inj.name} ${inj.status}`)
            .join(" · ")}
        </p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-subtle">
        {taped
          ? "Ball follows public play-by-play. Not an NFL broadcast."
          : "Sim of this week's card. Real scores sit on the wire. Not an NFL broadcast."}
      </p>
    </div>
  );
}

function wireNote(card?: WireGame | null, taped = false) {
  if (!card) return "Scores on the field are the sim — not the live score.";
  if (card.state === "soon") return `This week's card · kicks ${card.clock}`;
  if (taped && card.state === "final") {
    return `Real downs · ${card.awayAbbr} ${card.awayScore} · ${card.homeAbbr} ${card.homeScore} Final`;
  }
  if (taped && card.state === "live") {
    return `Live downs · ${card.awayAbbr} ${card.awayScore} · ${card.homeAbbr} ${card.homeScore} ${card.clock}`;
  }
  if (card.state === "final") {
    return `Real score ${card.awayAbbr} ${card.awayScore} · ${card.homeAbbr} ${card.homeScore} Final`;
  }
  return `Real score ${card.awayAbbr} ${card.awayScore} · ${card.homeAbbr} ${card.homeScore} ${card.clock}`;
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
  const tone = teamOf(abbr);
  return (
    <div className={cn("min-w-0 flex-1", align === "right" && "text-right")}>
      <p className={cn("flex items-center gap-2 truncate text-sm", on ? "text-fg" : "text-muted", align === "right" && "justify-end")}>
        {align === "left" && (
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: tone.primary }} aria-hidden />
        )}
        {city}
        {align === "right" && (
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: tone.primary }} aria-hidden />
        )}
      </p>
      <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{abbr}</p>
      <p key={pts} className="pop-in font-display text-4xl font-semibold tabular-nums tracking-tight">
        {pts}
      </p>
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
      className="mt-3 h-72 w-full rounded-xl bg-turf sm:h-96"
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

  const pad = h * 0.11;
  const fieldH = h - pad * 2;
  const fieldW = w;
  const visible = 48;
  const origin = cam - visible / 2;
  const sx = (yd: number) => ((yd - origin) / visible) * fieldW;
  const sy = (lane: number) => pad + fieldH * lane;
  const home = teamOf(labels.homeAbbr);
  const away = teamOf(labels.awayAbbr);

  ctx.save();
  ctx.translate((Math.sin(time * 37) * 5 + Math.cos(time * 21) * 3) * shake, Math.sin(time * 29) * 4 * shake);

  drawCrowd(ctx, w, pad, true, time, home.primary, away.primary);
  drawCrowd(ctx, w, pad + fieldH, false, time, home.primary, away.primary);

  ctx.fillStyle = c.turf;
  ctx.fillRect(0, pad, w, fieldH);
  for (let y = -10; y < 110; y += 5) {
    if (Math.floor((y + 10) / 5) % 2 === 0) continue;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(sx(y), pad, sx(y + 5) - sx(y), fieldH);
  }

  ctx.fillStyle = hexA(home.primary, 0.72);
  ctx.fillRect(sx(-10), pad, sx(0) - sx(-10), fieldH);
  ctx.fillStyle = hexA(away.primary, 0.72);
  ctx.fillRect(sx(100), pad, sx(110) - sx(100), fieldH);

  ctx.strokeStyle = "rgba(238,242,236,0.16)";
  ctx.lineWidth = Math.max(1, h * 0.003);
  for (let y = 0; y <= 100; y += 5) {
    const x = sx(y);
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, pad + fieldH);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(238,242,236,0.55)";
  ctx.lineWidth = Math.max(1.5, h * 0.005);
  ctx.beginPath();
  ctx.moveTo(sx(50), pad);
  ctx.lineTo(sx(50), pad + fieldH);
  ctx.stroke();

  ctx.strokeStyle = "rgba(238,242,236,0.28)";
  ctx.lineWidth = Math.max(1, h * 0.003);
  const hashTop = pad + fieldH * 0.32;
  const hashBot = pad + fieldH * 0.68;
  const tick = fieldH * 0.035;
  for (let y = 1; y < 100; y++) {
    if (y % 5 === 0) continue;
    const x = sx(y);
    ctx.beginPath();
    ctx.moveTo(x, hashTop - tick);
    ctx.lineTo(x, hashTop);
    ctx.moveTo(x, hashBot);
    ctx.lineTo(x, hashBot + tick);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(238,242,236,0.5)";
  ctx.lineWidth = Math.max(2, h * 0.008);
  ctx.beginPath();
  ctx.moveTo(0, pad);
  ctx.lineTo(w, pad);
  ctx.moveTo(0, pad + fieldH);
  ctx.lineTo(w, pad + fieldH);
  ctx.stroke();

  if (play && play.down > 0) {
    const stick = play.spot + play.toGo * (play.possession === "home" ? 1 : -1);
    ctx.strokeStyle = "rgba(232, 212, 77, 0.9)";
    ctx.lineWidth = Math.max(2, h * 0.007);
    ctx.beginPath();
    ctx.moveTo(sx(stick), pad);
    ctx.lineTo(sx(stick), pad + fieldH);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(238,242,236,0.34)";
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
  ctx.font = `600 ${Math.floor(h * 0.055)}px "Barlow Condensed", sans-serif`;
  for (const [yd, label] of marks) {
    ctx.fillText(label, sx(yd), pad + fieldH * 0.14);
    ctx.fillText(label, sx(yd), pad + fieldH * 0.86);
  }

  ctx.font = `700 ${Math.floor(h * 0.08)}px "Barlow Condensed", sans-serif`;
  ctx.fillStyle = home.ink;
  ctx.save();
  ctx.translate((sx(-10) + sx(0)) / 2, pad + fieldH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(home.city.toUpperCase(), 0, 0);
  ctx.restore();
  ctx.fillStyle = away.ink;
  ctx.save();
  ctx.translate((sx(100) + sx(110)) / 2, pad + fieldH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(away.city.toUpperCase(), 0, 0);
  ctx.restore();

  for (const L of lights) {
    const x = (L.x / 100) * w;
    const y = pad + (L.y / 100) * fieldH;
    const pulse = 0.18 + Math.sin(time * 1.4 + L.p) * 0.07;
    const g = ctx.createRadialGradient(x, y, 0, x, y, h * 0.28);
    g.addColorStop(0, `rgba(255,244,210,${pulse})`);
    g.addColorStop(1, "rgba(255,244,210,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - h * 0.28, y - h * 0.28, h * 0.56, h * 0.56);
  }

  const poss = play?.possession ?? "home";
  const dir = poss === "home" ? 1 : -1;
  const offClub = poss === "home" ? home : away;
  const defClub = poss === "home" ? away : home;
  const form = formation(ball, dir, t, play);
  for (const u of form) {
    const x = sx(u.yd);
    const y = sy(u.lane);
    const mine = u.id ? owned.has(u.id) : false;
    const club = u.side === "off" ? offClub : defClub;
    const pl = u.id ? getPlayer(u.id) : null;
    drawMan(ctx, x, y, h, club.primary, club.ink, club.secondary, mine ? c.win : null, u.tag, pl?.name.split(" ").pop() ?? "");
  }

  const air = play?.kind === "pass" || play?.kind === "catch" || play?.kind === "incomplete";
  const bx = sx(ball);
  const by = sy(air ? 0.38 + (1 - t) * 0.2 : 0.5);
  drawBall(ctx, bx, by, h, t, dir, play?.kind === "td", play?.from, ball, sx, air ? 0.38 + (1 - t) * 0.2 : 0.5, sy);

  if (play?.kind === "td" || play?.kind === "fg") {
    const n = play.kind === "td" ? 18 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + time * 3;
      const d = (0.15 + (t % 1) * 0.7) * h * 0.12;
      ctx.fillStyle = play.kind === "td" ? `rgba(125,186,142,${0.7 - t * 0.3})` : "rgba(255,196,72,0.55)";
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.55, Math.max(1.2, h * 0.008), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function hexA(hex: string, a: number) {
  const n = hex.replace("#", "");
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawCrowd(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  top: boolean,
  time: number,
  homeHex: string,
  awayHex: string,
) {
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const yy = top ? y - 6 - r * 5 : y + 6 + r * 5;
    for (let i = 0; i < 40; i++) {
      const x = ((i + r * 0.4) / 40) * w;
      const pulse = 0.12 + Math.sin(time * 2.2 + i * 0.4 + r) * 0.05;
      const tone = i % 7 === 0 ? hexA(homeHex, 0.42) : i % 7 === 3 ? hexA(awayHex, 0.36) : `rgba(18, 22, 18, ${0.55 + pulse})`;
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(x, yy, 3.2 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  t: number,
  dir: number,
  td: boolean,
  from: number | undefined,
  ball: number,
  sx: (yd: number) => number,
  lane: number,
  sy: (lane: number) => number,
) {
  if (from != null) {
    for (let i = 3; i >= 1; i--) {
      const p = Math.max(0, t - i * 0.08);
      const gx = sx(from + (ball - from) * p);
      const gy = sy(lane);
      ctx.fillStyle = `rgba(196, 154, 90, ${0.12 * i})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy, h * 0.03, h * 0.016, dir * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const br = h * (td ? 0.034 : 0.026);
  ctx.save();
  ctx.translate(x, y + br * 0.9);
  ctx.scale(1, 0.35);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(0, 0, br * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir * 0.45 + t * 0.4 * dir);
  ctx.fillStyle = td ? "#d7c48a" : "#b08a4a";
  ctx.beginPath();
  ctx.ellipse(0, 0, br * 1.45, br * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(243,239,228,0.28)";
  ctx.beginPath();
  ctx.ellipse(-br * 0.28, -br * 0.22, br * 0.55, br * 0.28, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,24,12,0.55)";
  ctx.lineWidth = Math.max(1, h * 0.004);
  ctx.beginPath();
  ctx.ellipse(0, 0, br * 1.45, br * 0.82, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#f3efe4";
  ctx.lineWidth = Math.max(1.2, h * 0.005);
  ctx.beginPath();
  ctx.moveTo(-br * 0.55, 0);
  ctx.lineTo(br * 0.55, 0);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, h * 0.0035);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * br * 0.18, -br * 0.22);
    ctx.lineTo(i * br * 0.18, br * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

function formation(ball: number, dir: number, t: number, play: NightPlay | undefined) {
  const shift = (play?.yards ?? 0) * t * 0.35 * dir;
  const qbId = play?.playerId ?? null;
  const tgtId = play?.targetId ?? null;
  const off = [
    { yd: ball - dir * 7, lane: 0.5, tag: qbId ? String(jerseyNum(qbId)) : "", id: qbId, side: "off" as const },
    { yd: ball - dir * 2, lane: 0.5, tag: "", id: null, side: "off" as const },
    { yd: ball + dir * (8 + shift), lane: 0.22, tag: tgtId ? String(jerseyNum(tgtId)) : "", id: tgtId, side: "off" as const },
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
    off[0] = { yd: ball, lane: 0.5, tag: String(jerseyNum(carrier)), id: carrier, side: "off" };
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
  helmet: string,
  ring: string | null,
  tag: string,
  last: string,
) {
  const r = h * 0.04;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.15, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fill;
  roundRect(ctx, x - r * 0.72, y - r * 1.05, r * 1.44, r * 2.05, r * 0.4);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y - r * 1.28, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = helmet;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - r * 1.28, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();

  if (tag) {
    ctx.fillStyle = ink;
    ctx.font = `700 ${Math.floor(h * 0.038)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag, x, y - r * 0.15);
  }
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(1.6, h * 0.007);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.15, r * 1.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (last && ring) {
    ctx.fillStyle = ring;
    ctx.font = `600 ${Math.floor(h * 0.032)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(last, x, y + r * 1.25);
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
