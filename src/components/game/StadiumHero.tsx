import { cityOrCustom, type CityPick } from "@/game/cities";
import type { JerseyId } from "@/game/types";
import { cn } from "@/lib/utils";

const JERSEY_HEX: Record<JerseyId, string> = {
  pine: "#2f5a43",
  steel: "#4a5c6a",
  ember: "#8f3d3d",
  midnight: "#2a3344",
  bone: "#d7d2c8",
  harbor: "#3d5c5a",
};

export function StadiumHero({
  city,
  stadium,
  jersey,
  club,
  compact,
}: {
  city: string;
  stadium: string;
  jersey: JerseyId;
  club?: string;
  compact?: boolean;
}) {
  const pick = cityOrCustom(city, stadium, jersey);
  const ink = JERSEY_HEX[jersey];
  return (
    <div
      key={pick.city + pick.stadium}
      className={cn("pop-in relative overflow-hidden rounded-xl", compact ? "h-28" : "h-48 sm:h-56")}
      style={{
        background: `linear-gradient(180deg, ${pick.sky[0]}, ${pick.sky[1]} 52%, #102016 100%)`,
      }}
    >
      <Skyline vibe={pick.vibe} />
      <div className="flood-pulse pointer-events-none absolute inset-x-6 top-0 h-20 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,212,77,0.22),transparent_70%)]" />
      <svg viewBox="0 0 400 120" className="absolute inset-x-0 bottom-0 h-[72%] w-full" aria-hidden>
        <path d="M0 70 L40 48 H360 L400 70 V120 H0 Z" fill="#1a231c" />
        <path d="M48 52 H352 L368 70 H32 Z" fill="#121812" />
        <rect x="70" y="72" width="260" height="48" rx="2" fill="#163322" />
        <path d="M70 86 H330" stroke="#3f8a58" strokeWidth="1.2" opacity="0.75" />
        <path d="M200 72 V120" stroke="#eef2ec" strokeWidth="1" opacity="0.4" />
        <rect x="70" y="72" width="260" height="6" fill={ink} opacity="0.85" />
        <circle cx="78" cy="42" r="3.5" className="flood-pulse" fill="#e8d44d" />
        <circle cx="322" cy="42" r="3.5" className="flood-pulse" fill="#e8d44d" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-display text-2xl font-semibold tracking-tight leading-none sm:text-3xl">
          {club ?? pick.city}
        </p>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-muted uppercase">
          {pick.city} · {pick.stadium}
        </p>
      </div>
    </div>
  );
}

function Skyline({ vibe }: { vibe: CityPick["vibe"] }) {
  if (vibe === "coast") {
    return <div className="absolute inset-x-0 bottom-[38%] h-10 bg-gradient-to-t from-[#1a4a55]/85 to-transparent" />;
  }
  if (vibe === "mesa") {
    return (
      <>
        <div className="absolute bottom-[40%] left-[6%] h-12 w-[38%] rounded-t-[40%] bg-[#3a2a1c]/85" />
        <div className="absolute bottom-[40%] right-[12%] h-8 w-[28%] rounded-t-[40%] bg-[#2a2014]/70" />
      </>
    );
  }
  if (vibe === "pines") {
    return (
      <div className="absolute bottom-[42%] left-0 right-0 flex justify-around opacity-80">
        {[14, 22, 16, 26, 13, 20, 15].map((h, i) => (
          <span key={i} className="w-3 bg-[#1a3324]" style={{ height: h }} />
        ))}
      </div>
    );
  }
  if (vibe === "metro") {
    return (
      <div className="absolute bottom-[40%] left-[8%] right-[8%] flex items-end gap-1 opacity-85">
        {[24, 38, 20, 44, 28, 36, 18, 30].map((h, i) => (
          <span key={i} className="flex-1 bg-[#2a3038]" style={{ height: h }} />
        ))}
      </div>
    );
  }
  if (vibe === "lake") {
    return <div className="absolute inset-x-0 bottom-[38%] h-9 bg-gradient-to-t from-[#1a3048]/80 to-transparent" />;
  }
  return <div className="absolute bottom-[42%] left-1/5 h-14 w-1/2 bg-[#2a3540]/75" />;
}
