import type { Position } from "./types";

export type StatBox = {
  passYd: number;
  passTd: number;
  ints: number;
  rushAtt: number;
  rushYd: number;
  rushTd: number;
  tgt: number;
  rec: number;
  recYd: number;
  recTd: number;
  fum: number;
  fg: number;
  xp: number;
  sack: number;
  pa: number;
  actual: boolean;
};

const empty: StatBox = {
  passYd: 0,
  passTd: 0,
  ints: 0,
  rushAtt: 0,
  rushYd: 0,
  rushTd: 0,
  tgt: 0,
  rec: 0,
  recYd: 0,
  recTd: 0,
  fum: 0,
  fg: 0,
  xp: 0,
  sack: 0,
  pa: 0,
  actual: false,
};

function n(v: unknown) {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(x) ? x : 0;
}

export function readBox(
  live: Record<string, unknown> | undefined,
  proj: Record<string, unknown> | undefined,
  actual: boolean,
): StatBox {
  const src = actual && live && Object.keys(live).length ? live : (proj ?? live ?? {});
  return {
    passYd: n(src.pass_yd),
    passTd: n(src.pass_td),
    ints: n(src.pass_int) || n(src.int),
    rushAtt: n(src.rush_att),
    rushYd: n(src.rush_yd),
    rushTd: n(src.rush_td),
    tgt: n(src.rec_tgt) || n(src.tgt),
    rec: n(src.rec),
    recYd: n(src.rec_yd),
    recTd: n(src.rec_td),
    fum: n(src.fum_lost) || n(src.fum),
    fg: n(src.fgm),
    xp: n(src.xpm),
    sack: n(src.sack),
    pa: n(src.pts_allow),
    actual,
  };
}

export function boxChips(box: StatBox, pos: Position): Array<{ k: string; v: string }> {
  const out: Array<{ k: string; v: string }> = [];
  const add = (k: string, v: string) => out.push({ k, v });
  if (pos === "QB") {
    if (box.passYd || box.passTd) add("PASS", `${Math.round(box.passYd)} yd · ${box.passTd} TD`);
    if (box.ints) add("INT", String(box.ints));
    if (box.rushYd || box.rushTd) add("RUSH", `${Math.round(box.rushYd)} yd${box.rushTd ? ` · ${box.rushTd} TD` : ""}`);
  } else if (pos === "RB") {
    if (box.rushAtt || box.rushYd) add("RUSH", `${box.rushAtt}–${Math.round(box.rushYd)}${box.rushTd ? ` · ${box.rushTd} TD` : ""}`);
    if (box.rec || box.recYd) add("REC", `${box.rec}–${Math.round(box.recYd)}${box.recTd ? ` · ${box.recTd} TD` : ""}`);
  } else if (pos === "WR" || pos === "TE") {
    if (box.rec || box.tgt || box.recYd)
      add("REC", `${box.rec}/${box.tgt || box.rec} · ${Math.round(box.recYd)} yd${box.recTd ? ` · ${box.recTd} TD` : ""}`);
    if (box.rushYd) add("RUSH", `${Math.round(box.rushYd)} yd`);
  } else if (pos === "K") {
    if (box.fg) add("FG", String(box.fg));
    if (box.xp) add("XP", String(box.xp));
  } else if (pos === "DST") {
    if (box.sack) add("SACK", String(box.sack));
    if (box.ints) add("INT", String(box.ints));
    add("PA", String(box.pa));
  }
  if (box.fum) add("FUM", String(box.fum));
  return out;
}

export const EMPTY_BOX = empty;
