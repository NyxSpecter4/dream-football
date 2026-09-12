import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./chrome";
import { StadiumHero } from "./StadiumHero";
import { JERSEYS } from "@/game/league";
import { CITIES, filterCities } from "@/game/cities";
import { useGame } from "@/game/store";
import type { JerseyId } from "@/game/types";
import { cn } from "@/lib/utils";
import { sfxPick, startBed, unlockAudio } from "@/game/audio";

export function SetupScreen() {
  const startSeason = useGame((s) => s.startSeason);
  const setScreen = useGame((s) => s.setScreen);
  const [name, setName] = useState("Dream");
  const [short, setShort] = useState("DRM");
  const [jersey, setJersey] = useState<JerseyId>("midnight");
  const [city, setCity] = useState("Dallas");
  const [stadium, setStadium] = useState("Trinity Field");
  const [cityId, setCityId] = useState("dal");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => filterCities(query), [query]);

  const pickCity = (id: string) => {
    const row = CITIES.find((x) => x.id === id);
    if (!row) return;
    unlockAudio();
    startBed();
    sfxPick();
    setCityId(row.id);
    setCity(row.city);
    setStadium(row.stadium);
    setJersey(row.jersey);
    setQuery("");
  };

  return (
    <Field>
      <main className="mx-auto min-h-dvh max-w-lg px-5 pb-28 pt-10">
        <button
          type="button"
          className="self-start text-sm text-muted hover:text-fg"
          onClick={() => setScreen("title")}
        >
          Back
        </button>
        <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">Name your team</h1>
        <p className="mt-2 text-sm text-muted">Pick a city. Then you draft players with a $301.2M cap.</p>

        <div className="mt-6">
          <StadiumHero city={city} stadium={stadium} jersey={jersey} club={name} />
        </div>

        <label className="mt-6 text-xs font-medium tracking-wide text-muted uppercase">Team name</label>
        <input
          value={name}
          maxLength={22}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-12 w-full rounded-lg bg-surface px-4 text-base text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />

        <p className="mt-6 text-xs font-medium tracking-wide text-muted uppercase">City</p>
        <input
          value={query}
          maxLength={32}
          placeholder="Dallas, Green Bay, Kansas City…"
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 h-12 w-full rounded-lg bg-surface px-4 text-base text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
        />
        <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {shown.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => pickCity(row.id)}
              className={cn(
                "min-h-16 rounded-lg px-3 py-2 text-left shadow-[var(--shadow-border)] transition-transform active:scale-[0.98]",
                cityId === row.id ? "bg-surface-2 shadow-[var(--shadow-border-hover)]" : "bg-surface",
              )}
            >
              <span className="block font-display text-lg font-semibold leading-none">{row.city}</span>
              <span className="mt-1 block font-mono text-[10px] tracking-wide text-muted uppercase">{row.tag}</span>
            </button>
          ))}
          {query.trim() && shown.length === 0 && (
            <button
              type="button"
              className="col-span-2 min-h-16 rounded-lg bg-surface px-3 py-2 text-left sm:col-span-3"
              onClick={() => {
                const typed = query.trim();
                setCityId("custom");
                setCity(typed);
                setStadium(`${typed} Field`);
                sfxPick();
              }}
            >
              <span className="block font-display text-lg font-semibold">Use {query.trim()}</span>
              <span className="mt-1 block text-[11px] text-muted">U.S. city. Your field.</span>
            </button>
          )}
        </div>

        <label className="mt-5 text-xs font-medium tracking-wide text-muted uppercase">Stadium</label>
        <input
          value={stadium}
          maxLength={28}
          onChange={(e) => setStadium(e.target.value)}
          className="mt-2 h-12 w-full rounded-lg bg-surface px-4 text-base text-fg shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-accent/40"
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
              onClick={() => {
                sfxPick();
                setJersey(j.id);
              }}
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
          className="mt-10 w-full"
          onClick={() => {
            unlockAudio();
            startBed();
            startSeason(name, short, jersey, city, stadium);
          }}
        >
          Start the draft
        </Button>
      </main>
    </Field>
  );
}
