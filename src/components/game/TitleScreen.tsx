import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./chrome";
import { NightBroadcast } from "./Broadcast";
import { BoardGuide, GuideLink } from "./BoardGuide";
import { WireStrip, WireTicker } from "./Wire";
import { useGame } from "@/game/store";
import { unlockAudio, startBed, stopBed } from "@/game/audio";
import { teamOf } from "@/game/nfl";
import { pickWireFeatured, useWire, watchPool } from "@/game/wire";
import { RoundTable } from "./RoundTable";

export function TitleScreen() {
  const career = useGame((s) => s.career);
  const teams = useGame((s) => s.teams);
  const phase = useGame((s) => s.phase);
  const startSeason = useGame((s) => s.startSeason);
  const setScreen = useGame((s) => s.setScreen);
  const resetSeason = useGame((s) => s.resetSeason);
  const watchNight = useGame((s) => s.watchNight);
  const startWatchNight = useGame((s) => s.startWatchNight);
  const hasSave = teams.length > 0 && phase !== "complete";
  const { data } = useWire();
  const feat = pickWireFeatured(data?.games ?? []);
  const featHome = feat ? teamOf(feat.homeAbbr) : null;
  const featAway = feat ? teamOf(feat.awayAbbr) : null;

  if (watchNight) {
    return <WatchNightScreen />;
  }

  return (
    <Field>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <video
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/art/title-portrait.jpg"
          src="/art/field.mp4"
        />
        <div className="flood-sweep absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-black/40" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-16">
        <div className="stagger-in mb-10">
          <svg viewBox="0 0 48 32" className="mb-6 h-8 w-12 text-field" aria-hidden>
            <path
              d="M8 30 V10 H40 V30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M24 10 V4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="24" cy="3" r="1.6" fill="currentColor" />
          </svg>
          <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
            Fantasy manager
          </p>
          <h1 className="wordmark font-display text-6xl font-semibold tracking-tight text-fg sm:text-7xl">
            Dream Football
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted">
            Your club. The Sunday desk. Cindy if she shows.
          </p>
          <div className="mt-8">
            <RoundTable />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {hasSave && (
            <Button
              size="lg"
              className="min-h-14"
              onClick={() => {
                unlockAudio();
                startBed();
                setScreen(phase === "draft" ? "draft" : phase === "offseason" ? "offseason" : "home");
              }}
            >
              Continue
            </Button>
          )}
          <Button
            size="lg"
            className="min-h-14"
            variant={hasSave ? "secondary" : "primary"}
            onClick={() => {
              unlockAudio();
              startBed();
              if (hasSave) resetSeason();
              startSeason("Dream", "DRM", "midnight", "Dallas", "Trinity Field");
            }}
          >
            Start solo
          </Button>
          <Button
            size="lg"
            className="min-h-14"
            variant="secondary"
            onClick={() => {
              unlockAudio();
              startBed();
              setScreen("lobby");
            }}
          >
            Play with Cindy
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => {
              unlockAudio();
              stopBed();
              startWatchNight();
            }}
          >
            Watch NFL scores
          </Button>
        </div>

        <div className="stagger-in mt-8 pb-8">
          {feat && featAway && featHome && (
            <p className="overlay-chip overlay-chip-live mt-4">
              {feat.state === "live" && <span className="live-dot" />}
              {featAway.city}
              {feat.state === "soon" ? "" : ` ${feat.awayScore}`}
              <span className="text-muted"> · </span>
              {featHome.city}
              {feat.state === "soon" ? "" : ` ${feat.homeScore}`}
              <span className={feat.state === "final" ? "text-muted" : "text-live"}>
                {feat.state === "final" ? " Final" : ` ${feat.clock}`}
              </span>
            </p>
          )}
          <div className="mt-4">
            <WireTicker />
          </div>
        </div>

        {career.seasons > 0 && (
          <p className="mt-8 font-mono text-xs tabular-nums text-subtle">
            {career.seasons} season{career.seasons === 1 ? "" : "s"}
            {career.titles > 0 ? ` · ${career.titles} title${career.titles === 1 ? "" : "s"}` : ""}
            {career.bestFinish ? ` · best ${ordinal(career.bestFinish)}` : ""}
          </p>
        )}
      </main>
    </Field>
  );
}

function WatchNightScreen() {
  const night = useGame((s) => s.watchNight);
  const endWatchNight = useGame((s) => s.endWatchNight);
  const reshuffleWatchNight = useGame((s) => s.reshuffleWatchNight);
  const startSetup = useGame((s) => s.startSetup);
  const setScreen = useGame((s) => s.setScreen);
  const [done, setDone] = useState(false);
  const [cardI, setCardI] = useState(0);
  const [guide, setGuide] = useState(false);
  const { data, fail } = useWire();

  const pool = useMemo(() => (data ? watchPool(data.games) : []), [data]);
  const card = pool.length > 0 ? pool[cardI % pool.length]! : pickWireFeatured(data?.games ?? []);
  const home = card ? teamOf(card.homeAbbr) : null;
  const away = card ? teamOf(card.awayAbbr) : null;

  if (!night) return null;

  return (
    <Field>
      <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
          Week {data?.week ?? night.week}
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
          {away && home ? `${away.city} at ${home.city}` : "This week"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          This week's card. Real downs when they exist. Bid $301.2M for your own board.
        </p>
        <GuideLink onClick={() => setGuide(true)}>Help</GuideLink>

        <div className="mt-6">
          {card ? (
            <NightBroadcast
              key={`${night.seed}-${card.id}`}
              week={data?.week ?? night.week}
              seed={night.seed}
              homeName="Home"
              awayName="Away"
              homeJersey="pine"
              awayJersey="bone"
              homePts={{}}
              awayPts={{}}
              live={!done}
              board={false}
              card={card}
              onDone={() => setDone(true)}
            />
          ) : fail ? (
            <NightBroadcast
              key={`${night.seed}-${night.week}`}
              week={data?.week ?? night.week}
              seed={night.seed}
              homeName="Home"
              awayName="Away"
              homeJersey="pine"
              awayJersey="bone"
              homePts={{}}
              awayPts={{}}
              live={!done}
              board={false}
              onDone={() => setDone(true)}
            />
          ) : (
            <div className="mt-3 flex h-72 items-center justify-center rounded-xl bg-turf sm:h-96">
              <p className="font-mono text-[11px] text-subtle">Pulling this week's card…</p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <WireStrip compact />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {done && (
            <Button
              onClick={() => {
                setDone(false);
                setCardI((i) => i + 1);
                reshuffleWatchNight();
              }}
            >
              Next game
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              endWatchNight();
              startSetup();
            }}
          >
          Start a season
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              endWatchNight();
              setScreen("lobby");
            }}
          >
            Play with a friend
          </Button>
          <Button variant="ghost" onClick={() => endWatchNight()}>
            Back
          </Button>
        </div>
      </main>
      <BoardGuide open={guide} tab="grass" onClose={() => setGuide(false)} />
    </Field>
  );
}

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}
