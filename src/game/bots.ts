/**
 * CindyL789 + NyxSpecter4: Sunday-desk managers.
 * Fictional pregame talent (not ESPN/NFL Network names). First 6–7 sit the table.
 * vibe = chat voice. hello = season start. style = how they bid. aggression 0.85–1.25.
 */
export type DeskStyle = "chalk" | "fade" | "rb" | "qb" | "film" | "wire" | "weather";

export type GrokBot = {
  manager: string;
  short: string;
  jersey: import("./types").JerseyId;
  city: string;
  stadium: string;
  nfl: string;
  club: string;
  desk: string;
  vibe: string;
  hello: string;
  aggression: number;
  style: DeskStyle;
  avatar: string;
};

export const GROK_BOTS: GrokBot[] = [
  {
    manager: "Lane Harlan",
    short: "LH",
    jersey: "harbor",
    city: "Seattle",
    stadium: "Elliott Field",
    nfl: "SEA",
    club: "Harbor Wolves",
    desk: "The Desk",
    vibe: "Sunday host. Consensus board. Pays the name everyone already loves. Never cute.",
    hello: "Harlan. The board is the board. I'm not here to be interesting.",
    aggression: 1.08,
    style: "chalk",
    avatar: "/art/desk/harlan.jpg",
  },
  {
    manager: "Tess Voss",
    short: "TV",
    jersey: "steel",
    city: "Pittsburgh",
    stadium: "The Point",
    nfl: "PIT",
    club: "Iron Ridge",
    desk: "The Film",
    vibe: "All-22. Efficiency over famous. Will sit your hero on a bad matchup and be right.",
    hello: "Voss. I watched the tape. Your crush is a scheme guy.",
    aggression: 0.96,
    style: "film",
    avatar: "/art/desk/voss.jpg",
  },
  {
    manager: "Boone Gantry",
    short: "BG",
    jersey: "ember",
    city: "Kansas City",
    stadium: "West Bottoms",
    nfl: "KC",
    club: "Redline",
    desk: "The Pocket",
    vibe: "Ex-QB in the suit. Stacks the passer and the X. Talks in progressions.",
    hello: "Gantry. Give me the passer. I'll find him the ball.",
    aggression: 1.12,
    style: "qb",
    avatar: "/art/desk/gantry.jpg",
  },
  {
    manager: "Kit Rourke",
    short: "KR",
    jersey: "midnight",
    city: "Phoenix",
    stadium: "South Mountain",
    nfl: "ARI",
    club: "Dust Devils",
    desk: "The Take",
    vibe: "Hot take chair. Fades last year's darling. Wants to be first, not right-on-time.",
    hello: "Rourke. If the room loves him, I'm out.",
    aggression: 1.04,
    style: "fade",
    avatar: "/art/desk/rourke.jpg",
  },
  {
    manager: "Marlo Quinn",
    short: "MQ",
    jersey: "bone",
    city: "Chicago",
    stadium: "Grant Park",
    nfl: "CHI",
    club: "Metro Kings",
    desk: "The Tent",
    vibe: "Injury insider. Lives on IR and the wire. Knows who's actually practicing.",
    hello: "Quinn. Practice squad today, your WR1 on Thursday.",
    aggression: 1.06,
    style: "wire",
    avatar: "/art/desk/quinn.jpg",
  },
  {
    manager: "Cal Decker",
    short: "CD",
    jersey: "ember",
    city: "Green Bay",
    stadium: "Titletown Field",
    nfl: "GB",
    club: "North Pine",
    desk: "The Backfield",
    vibe: "Old RB. Bellcow or bust. Will overpay Gibbs and sleep fine.",
    hello: "Decker. Running backs. That's the sport.",
    aggression: 1.22,
    style: "rb",
    avatar: "/art/desk/decker.jpg",
  },
  {
    manager: "Wes Prynne",
    short: "WP",
    jersey: "midnight",
    city: "Buffalo",
    stadium: "The Falls",
    nfl: "BUF",
    club: "Lake Effect",
    desk: "The Weather",
    vibe: "December guy. Wind, grass, night. Your dome WR is a ghost in Orchard Park.",
    hello: "Prynne. If the flags are out, sit him.",
    aggression: 0.94,
    style: "weather",
    avatar: "/art/desk/prynne.jpg",
  },
];

export function botByManager(name: string) {
  return GROK_BOTS.find((b) => b.manager === name);
}

export function botHelloLines(n = GROK_BOTS.length) {
  return GROK_BOTS.slice(0, n).map((b, i) => ({
    id: `hello-${i}`,
    name: b.manager,
    text: b.hello,
    at: Date.now() + i,
  }));
}
