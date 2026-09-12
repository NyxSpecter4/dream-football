import type { JerseyId } from "./types";

export type CityVibe = "coast" | "pines" | "mesa" | "metro" | "forge" | "lake";

export type CityPick = {
  id: string;
  city: string;
  stadium: string;
  vibe: CityVibe;
  jersey: JerseyId;
  tag: string;
  sky: [string, string];
};

function c(
  id: string,
  city: string,
  stadium: string,
  vibe: CityVibe,
  jersey: JerseyId,
  tag: string,
  sky: [string, string],
): CityPick {
  return { id, city, stadium, vibe, jersey, tag, sky };
}

const COAST: [string, string] = ["#0a1820", "#163848"];
const METRO: [string, string] = ["#121418", "#2a3038"];
const PINES: [string, string] = ["#0c1a12", "#1a3a28"];
const MESA: [string, string] = ["#1a1610", "#3a3224"];
const FORGE: [string, string] = ["#10141a", "#2a3540"];
const LAKE: [string, string] = ["#0c1018", "#1c2838"];
const HEAT: [string, string] = ["#1a0e0e", "#3a1c18"];

/** 32 NFL homes. NY and LA are the duals. America only. */
export const CITIES: CityPick[] = [
  c("ari", "Phoenix", "South Mountain", "mesa", "ember", "ARI", MESA),
  c("atl", "Atlanta", "Peach Field", "metro", "ember", "ATL", PINES),
  c("bal", "Baltimore", "Inner Harbor", "coast", "harbor", "BAL", COAST),
  c("buf", "Buffalo", "The Falls", "lake", "midnight", "BUF", LAKE),
  c("car", "Charlotte", "Uptown Field", "metro", "midnight", "CAR", METRO),
  c("chi", "Chicago", "Grant Park", "metro", "midnight", "CHI", LAKE),
  c("cin", "Cincinnati", "Riverfront", "metro", "ember", "CIN", HEAT),
  c("cle", "Cleveland", "Erie Field", "lake", "midnight", "CLE", LAKE),
  c("dal", "Dallas", "Trinity Field", "metro", "midnight", "DAL", MESA),
  c("den", "Denver", "High Line Field", "mesa", "ember", "DEN", FORGE),
  c("det", "Detroit", "Riverfront", "forge", "steel", "DET", FORGE),
  c("gb", "Green Bay", "Titletown Field", "pines", "pine", "GB", PINES),
  c("hou", "Houston", "Buffalo Bayou", "metro", "ember", "HOU", HEAT),
  c("ind", "Indianapolis", "Canal Field", "metro", "midnight", "IND", METRO),
  c("jax", "Jacksonville", "The Landing", "coast", "harbor", "JAX", COAST),
  c("kc", "Kansas City", "West Bottoms", "metro", "ember", "KC", METRO),
  c("lv", "Las Vegas", "The Strip Bowl", "mesa", "bone", "LV", MESA),
  c("lar", "Los Angeles", "Exposition Park", "metro", "bone", "LAR", MESA),
  c("lac", "Inglewood", "West Bowl", "metro", "harbor", "LAC", MESA),
  c("mia", "Miami", "Bayfront Field", "coast", "harbor", "MIA", COAST),
  c("min", "Minneapolis", "Falls Field", "lake", "pine", "MIN", LAKE),
  c("ne", "Foxborough", "The Fens", "pines", "pine", "NE", PINES),
  c("no", "New Orleans", "Crescent Field", "coast", "ember", "NO", HEAT),
  c("nyg", "New York", "Hudson Field", "metro", "midnight", "NYG", METRO),
  c("nyj", "East Rutherford", "Meadowlands", "metro", "pine", "NYJ", METRO),
  c("phi", "Philadelphia", "Schuylkill Field", "metro", "midnight", "PHI", METRO),
  c("pit", "Pittsburgh", "The Point", "forge", "steel", "PIT", FORGE),
  c("sf", "San Francisco", "The Presidio", "coast", "harbor", "SF", COAST),
  c("sea", "Seattle", "Elliott Field", "coast", "harbor", "SEA", COAST),
  c("tb", "Tampa", "Bay Field", "coast", "ember", "TB", COAST),
  c("ten", "Nashville", "Riverfront Park", "metro", "bone", "TEN", METRO),
  c("was", "Washington", "The Mall", "metro", "ember", "WAS", METRO),
];

export function cityByName(name: string): CityPick | undefined {
  const n = name.trim().toLowerCase();
  return CITIES.find((x) => x.city.toLowerCase() === n);
}

export function filterCities(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return CITIES;
  return CITIES.filter(
    (x) =>
      x.city.toLowerCase().includes(s) ||
      x.stadium.toLowerCase().includes(s) ||
      x.tag.toLowerCase().includes(s),
  );
}

const AFC = new Set([
  "BAL", "BUF", "CIN", "CLE", "DEN", "HOU", "IND", "JAX", "KC", "LV", "LAC", "MIA", "NE", "NYJ", "PIT", "TEN",
]);

export function conferenceOf(tag: string): "AFC" | "NFC" {
  return AFC.has(tag) ? "AFC" : "NFC";
}

export function twinOf(city: string): CityPick | undefined {
  return cityByName(city);
}

export function cityOrCustom(city: string, stadium: string, jersey: JerseyId): CityPick {
  return (
    cityByName(city) ?? {
      id: "custom",
      city: city.trim() || "Dallas",
      stadium: stadium.trim() || `${city.trim() || "Home"} Field`,
      vibe: "metro",
      jersey,
      tag: "US",
      sky: METRO,
    }
  );
}
