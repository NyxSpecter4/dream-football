import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./chrome";
import { NightBroadcast } from "./Broadcast";
import { WireStrip, WireTicker } from "./Wire";
import { useGame } from "@/game/store";
import { unlockAudio } from "@/game/audio";
import { pickWireFeatured, useWire, watchPool } from "@/game/wire";

export function TitleScreen() {
  const career = useGame((s) => s.career);
  const teams = useGame((s) => s.teams);
  const phase = useGame((s) => s.phase);
  const startSetup = useGame((s) => s.startSetup);
  const setScreen = useGame((s) => s.setScreen);
  const resetSeason = useGame((s) => s.resetSeason);
  const watchNight = useGame((s) => s.watchNight);
  const startWatchNight = useGame((s) => s.startWatchNight);
  const hasSave = teams.length > 0 && phase !== "complete";

  if (watchNight) {
    return <WatchNightScreen />;
  }

  return (
    <Field>
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-16">
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
            On this week's NFL
          </p>
          <h1 className="font-display text-6xl font-semibold tracking-tight text-fg sm:text-7xl">
            Dream Football
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted">
            Live PPR on your names. A night you can sit when the game isn't on TV. Bid $200. Stake house chips.
          </p>
          <p className="mt-3 max-w-sm text-sm text-subtle">
            The board is real points from this NFL week. The field follows real downs when the card has them.
          </p>
          <div className="mt-5">
            <WireTicker />
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-8">
          <Button
            size="lg"
            onClick={() => {
              unlockAudio();
              startWatchNight();
            }}
          >
            Watch tonight
          </Button>
          {hasSave && (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                unlockAudio();
                setScreen(phase === "draft" ? "draft" : "home");
              }}
            >
              Continue season
            </Button>
          )}
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              unlockAudio();
              if (hasSave) resetSeason();
              startSetup();
            }}
          >
            New season
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => {
              unlockAudio();
              setScreen("lobby");
            }}
          >
            Play with friends
          </Button>
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
  const { data, fail } = useWire();

  const pool = useMemo(() => (data ? watchPool(data.games) : []), [data]);
  const card = pool.length > 0 ? pool[cardI % pool.length]! : pickWireFeatured(data?.games ?? []);

  if (!night) return null;

  return (
    <Field>
      <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
          Tonight · week {data?.week ?? night.week}
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">The night</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Real card. Real downs when they exist. Your league board sits on this week when you bid $200.
        </p>

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
            <p className="font-mono text-[11px] text-subtle">Pulling this week's card…</p>
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
              Another night
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              endWatchNight();
              startSetup();
            }}
          >
            Bid $200
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              endWatchNight();
              setScreen("lobby");
            }}
          >
            Play with friends
          </Button>
          <Button variant="ghost" onClick={() => endWatchNight()}>
            Back
          </Button>
        </div>
      </main>
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
