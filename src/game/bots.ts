export type GrokBot = {
  manager: string;
  short: string;
  jersey: import("./types").JerseyId;
  city: string;
  stadium: string;
  nfl: string;
  club: string;
  vibe: string;
  hello: string;
};

export const GROK_BOTS: GrokBot[] = [
  {
    manager: "Grok Zero",
    short: "ZRO",
    jersey: "harbor",
    city: "Seattle",
    stadium: "Elliott Field",
    nfl: "SEA",
    club: "Harbor Wolves",
    vibe: "Pays the star. Never sits a WR1. Talks like the board owes him.",
    hello: "Zero in. If he's a one, I'm paying.",
  },
  {
    manager: "Grok Fade",
    short: "FDE",
    jersey: "steel",
    city: "Pittsburgh",
    stadium: "The Point",
    nfl: "PIT",
    club: "Iron Ridge",
    vibe: "Last year's hero is this year's discount. Waits. Then pounces.",
    hello: "Fade. Your second-round crush is my week-6 add.",
  },
  {
    manager: "Grok Smash",
    short: "SMH",
    jersey: "ember",
    city: "Phoenix",
    stadium: "South Mountain",
    nfl: "ARI",
    club: "Dust Devils",
    vibe: "Running backs. Always. Will overpay Gibbs and not blink.",
    hello: "Smash. Give me the back. I'll empty the bag.",
  },
  {
    manager: "Grok Cold",
    short: "CLD",
    jersey: "midnight",
    city: "Buffalo",
    stadium: "The Falls",
    nfl: "BUF",
    club: "Lake Effect",
    vibe: "Weather, grass, night games. Benches your stud in December and is right.",
    hello: "Cold. If the wind's up, your WR is a ghost.",
  },
  {
    manager: "Grok Prime",
    short: "PRM",
    jersey: "ember",
    city: "Kansas City",
    stadium: "West Bottoms",
    nfl: "KC",
    club: "Redline",
    vibe: "The boring correct pick. Wins the table and never tweets about it.",
    hello: "Prime. I don't chase. I finish.",
  },
  {
    manager: "Grok Pack",
    short: "PCK",
    jersey: "pine",
    city: "Green Bay",
    stadium: "Titletown Field",
    nfl: "GB",
    club: "North Pine",
    vibe: "January or nothing. Holds injured names on IR like relics.",
    hello: "Pack. We play for January. Sit down.",
  },
  {
    manager: "Grok Wire",
    short: "WRE",
    jersey: "bone",
    city: "Chicago",
    stadium: "Grant Park",
    nfl: "CHI",
    club: "Metro Kings",
    vibe: "Lives on Sleeper trending. Knows the add before you do.",
    hello: "Wire. If he's trending, I already filed.",
  },
];

export function botByManager(name: string) {
  return GROK_BOTS.find((b) => b.manager === name);
}

export function botHelloLines() {
  return GROK_BOTS.slice(0, 6).map((b, i) => ({
    id: `hello-${i}`,
    name: b.manager,
    text: b.hello,
    at: Date.now() + i,
  }));
}
