import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./chrome";
import { JERSEYS } from "@/game/league";
import { useGame } from "@/game/store";
import type { JerseyId } from "@/game/types";
import { cn } from "@/lib/utils";
import { unlockAudio } from "@/game/audio";

export function SetupScreen() {
  const startSeason = useGame((s) => s.startSeason);
  const setScreen = useGame((s) => s.setScreen);
  const [name, setName] = useState("Night Hawks");
  const [short, setShort] = useState("NGT");
  const [jersey, setJersey] = useState<JerseyId>("pine");

  return (
    <Field>
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-28 pt-10">
        <button
          type="button"
          className="self-start text-sm text-muted hover:text-fg"
          onClick={() => setScreen("title")}
        >
          Back
        </button>
        <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">Name the club</h1>
        <p className="mt-2 text-sm text-muted">You walk into a $200 auction. Same board as everyone else.</p>

        <label className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Team name</label>
        <input
          value={name}
          maxLength={22}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-12 rounded-lg bg-surface px-4 text-base text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />

        <label className="mt-5 text-xs font-medium tracking-wide text-muted uppercase">Letters</label>
        <input
          value={short}
          maxLength={4}
          onChange={(e) => setShort(e.target.value.toUpperCase())}
          className="mt-2 h-12 w-28 rounded-lg bg-surface px-4 font-display text-xl tracking-wide text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />

        <p className="mt-6 text-xs font-medium tracking-wide text-muted uppercase">Jersey</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {JERSEYS.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setJersey(j.id)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm",
                jersey === j.id ? "bg-surface-2 shadow-[var(--shadow-border-hover)]" : "bg-surface shadow-[var(--shadow-border)]",
              )}
            >
              <span className={cn("size-3 rounded-full", `jersey-${j.id}`)} />
              {j.label}
            </button>
          ))}
        </div>

        <Button
          size="lg"
          className="mt-auto"
          onClick={() => {
            unlockAudio();
            startSeason(name, short, jersey);
          }}
        >
          Enter the auction
        </Button>
      </main>
    </Field>
  );
}
