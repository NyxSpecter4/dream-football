import { Button } from "@/components/ui/button";
import { Field } from "./chrome";
import { useGame } from "@/game/store";
import { unlockAudio } from "@/game/audio";

export function TitleScreen() {
  const career = useGame((s) => s.career);
  const teams = useGame((s) => s.teams);
  const phase = useGame((s) => s.phase);
  const startSetup = useGame((s) => s.startSetup);
  const setScreen = useGame((s) => s.setScreen);
  const resetSeason = useGame((s) => s.resetSeason);
  const hasSave = teams.length > 0 && phase !== "complete";

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
            Eight teams · $200 cap
          </p>
          <h1 className="font-display text-6xl font-semibold tracking-tight text-fg sm:text-7xl">
            Night League
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted">
            You and a friend bid $200 on a roster. Seven weeks. Then four teams play for the title.
          </p>
          <p className="mt-3 max-w-sm text-sm text-subtle">
            This chat is just a preview. Cindy needs the live link on her phone.
          </p>
        </div>

        <div className="flex flex-col gap-3 pb-8">
          {hasSave && (
            <Button
              size="lg"
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
            variant={hasSave ? "secondary" : "primary"}
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
            variant="secondary"
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

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}
