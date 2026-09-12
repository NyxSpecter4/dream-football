import { useEffect, useState } from "react";

export type WireGame = {
  id: string;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number;
  awayScore: number;
  state: "live" | "final" | "soon";
  clock: string;
  detail: string;
};

export type WireNews = {
  title: string;
  blurb: string;
};

export type WireStat = {
  pts: number;
  line: string;
  done: boolean;
};

export type WirePayload = {
  season: number;
  week: number;
  games: WireGame[];
  news: WireNews[];
  stats: Record<string, WireStat>;
  updated: number;
};

export function useWire() {
  const [data, setData] = useState<WirePayload | null>(null);
  const [fail, setFail] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/nfl", { cache: "no-store" });
        if (!res.ok) throw new Error("wire");
        const json = (await res.json()) as WirePayload;
        if (!stop) {
          setData(json);
          setFail(false);
        }
      } catch {
        if (!stop) setFail(true);
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 45000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  return { data, fail };
}
