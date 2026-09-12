import type { Player, Position } from "./types";

function p(
  id: string,
  name: string,
  pos: Position,
  nfl: string,
  bye: number,
  ovr: number,
  boom: number,
  durability: number,
): Player {
  return { id, name, pos, nfl, bye, ovr, boom, durability };
}

export const PLAYERS: Player[] = [
  // Quarterbacks
  p("qb-voss", "Kane Voss", "QB", "BUF", 5, 97, 0.22, 0.92),
  p("qb-hale", "Dorian Hale", "QB", "KC", 4, 96, 0.28, 0.88),
  p("qb-drake", "Milo Drake", "QB", "PHI", 3, 93, 0.3, 0.86),
  p("qb-brennan", "Cole Brennan", "QB", "DET", 2, 91, 0.26, 0.9),
  p("qb-calder", "Nash Calder", "QB", "CIN", 6, 89, 0.34, 0.82),
  p("qb-holloway", "Reid Holloway", "QB", "DAL", 5, 87, 0.24, 0.91),
  p("qb-marlowe", "Jett Marlowe", "QB", "BAL", 4, 86, 0.2, 0.94),
  p("qb-quinn", "Silas Quinn", "QB", "SF", 3, 84, 0.32, 0.8),
  p("qb-pike", "Arlo Pike", "QB", "MIA", 6, 82, 0.36, 0.78),
  p("qb-rourke", "Vance Rourke", "QB", "GB", 2, 80, 0.25, 0.87),
  p("qb-fitch", "Omar Fitch", "QB", "HOU", 5, 78, 0.3, 0.84),
  p("qb-lang", "Trey Lang", "QB", "ATL", 4, 76, 0.28, 0.86),
  p("qb-stowe", "Levi Stowe", "QB", "LAC", 3, 74, 0.22, 0.9),
  p("qb-harlan", "Finn Harlan", "QB", "MIN", 6, 72, 0.27, 0.83),
  p("qb-wren", "Ellis Wren", "QB", "NYJ", 2, 70, 0.4, 0.75),
  p("qb-noll", "Brooks Noll", "QB", "CAR", 5, 68, 0.24, 0.88),

  // Running backs
  p("rb-nolan", "Dex Nolan", "RB", "SF", 3, 96, 0.3, 0.8),
  p("rb-vane", "Kade Vane", "RB", "BAL", 4, 94, 0.26, 0.86),
  p("rb-mercer", "Tate Mercer", "RB", "ATL", 5, 92, 0.34, 0.78),
  p("rb-cole", "Rio Cole", "RB", "DET", 2, 90, 0.28, 0.82),
  p("rb-ash", "Lane Ash", "RB", "MIA", 6, 88, 0.38, 0.74),
  p("rb-briggs", "Holt Briggs", "RB", "BUF", 5, 87, 0.22, 0.88),
  p("rb-orion", "Nico Orion", "RB", "PHI", 3, 85, 0.32, 0.8),
  p("rb-reed", "Cal Reed", "RB", "GB", 2, 84, 0.24, 0.85),
  p("rb-solis", "Marco Solis", "RB", "LAC", 4, 83, 0.3, 0.81),
  p("rb-pratt", "Joss Pratt", "RB", "KC", 6, 82, 0.36, 0.76),
  p("rb-hayes", "Ellis Hayes", "RB", "CIN", 5, 80, 0.28, 0.83),
  p("rb-drake", "Bo Drake", "RB", "DAL", 3, 79, 0.33, 0.79),
  p("rb-west", "Shay West", "RB", "MIN", 4, 77, 0.25, 0.87),
  p("rb-crow", "Ike Crow", "RB", "HOU", 2, 76, 0.31, 0.8),
  p("rb-vale", "Odin Vale", "RB", "SEA", 6, 75, 0.29, 0.82),
  p("rb-knox", "Perry Knox", "RB", "TB", 5, 74, 0.27, 0.84),
  p("rb-flint", "Ram Flint", "RB", "NO", 3, 73, 0.35, 0.72),
  p("rb-grove", "Ned Grove", "RB", "CHI", 4, 72, 0.23, 0.86),
  p("rb-pike", "Wynn Pike", "RB", "NYJ", 2, 70, 0.4, 0.7),
  p("rb-lowell", "Asa Lowell", "RB", "NE", 6, 69, 0.22, 0.88),
  p("rb-cho", "Kenji Cho", "RB", "LAR", 5, 68, 0.3, 0.81),
  p("rb-barnes", "Trey Barnes", "RB", "IND", 4, 67, 0.26, 0.85),
  p("rb-moss", "Quill Moss", "RB", "DEN", 3, 66, 0.28, 0.83),
  p("rb-hart", "Boaz Hart", "RB", "WAS", 2, 65, 0.24, 0.87),

  // Wide receivers
  p("wr-vale", "Aric Vale", "WR", "MIA", 6, 97, 0.32, 0.86),
  p("wr-soren", "Jax Soren", "WR", "CIN", 5, 95, 0.28, 0.88),
  p("wr-nunez", "Cruz Nunez", "WR", "MIN", 4, 93, 0.3, 0.84),
  p("wr-bell", "Rowan Bell", "WR", "DAL", 3, 91, 0.26, 0.9),
  p("wr-kim", "Niko Kim", "WR", "SF", 2, 90, 0.34, 0.8),
  p("wr-hale", "Ellis Hale", "WR", "PHI", 5, 88, 0.24, 0.89),
  p("wr-drake", "Pax Drake", "WR", "DET", 6, 87, 0.36, 0.78),
  p("wr-frost", "Ivy Frost", "WR", "BUF", 4, 86, 0.22, 0.91),
  p("wr-cole", "Zane Cole", "WR", "KC", 3, 85, 0.33, 0.81),
  p("wr-rowan", "Micah Rowan", "WR", "GB", 2, 84, 0.27, 0.85),
  p("wr-sol", "Ander Sol", "WR", "LAC", 5, 83, 0.31, 0.82),
  p("wr-beck", "Theo Beck", "WR", "BAL", 6, 82, 0.25, 0.87),
  p("wr-quinn", "Lark Quinn", "WR", "HOU", 4, 81, 0.29, 0.83),
  p("wr-nash", "Remy Nash", "WR", "ATL", 3, 80, 0.35, 0.76),
  p("wr-orin", "Silas Orin", "WR", "SEA", 2, 79, 0.28, 0.84),
  p("wr-wade", "Colt Wade", "WR", "TB", 5, 78, 0.3, 0.8),
  p("wr-james", "Eden James", "WR", "NO", 6, 77, 0.23, 0.88),
  p("wr-park", "Jun Park", "WR", "CHI", 4, 76, 0.27, 0.85),
  p("wr-reed", "Ari Reed", "WR", "NYJ", 3, 75, 0.38, 0.74),
  p("wr-vale2", "Otis Vale", "WR", "LAR", 2, 74, 0.26, 0.86),
  p("wr-brook", "Ned Brook", "WR", "IND", 5, 73, 0.24, 0.87),
  p("wr-kane", "Wren Kane", "WR", "DEN", 6, 72, 0.32, 0.79),
  p("wr-holt", "Cale Holt", "WR", "WAS", 4, 71, 0.28, 0.82),
  p("wr-moss", "Finn Moss", "WR", "NE", 3, 70, 0.22, 0.9),
  p("wr-ash", "Rory Ash", "WR", "CAR", 2, 69, 0.3, 0.81),
  p("wr-pike", "Shay Pike", "WR", "TEN", 5, 68, 0.25, 0.84),
  p("wr-low", "Bo Low", "WR", "JAX", 6, 67, 0.33, 0.77),
  p("wr-gray", "Nash Gray", "WR", "CLE", 4, 66, 0.21, 0.89),

  // Tight ends
  p("te-voss", "Hart Voss", "TE", "KC", 4, 93, 0.28, 0.88),
  p("te-briggs", "Olin Briggs", "TE", "SF", 3, 90, 0.24, 0.9),
  p("te-cole", "Remy Cole", "TE", "BAL", 5, 87, 0.3, 0.84),
  p("te-nolan", "Asher Nolan", "TE", "DET", 2, 84, 0.26, 0.86),
  p("te-hale", "Jude Hale", "TE", "PHI", 6, 82, 0.32, 0.8),
  p("te-wren", "Cade Wren", "TE", "BUF", 4, 80, 0.22, 0.89),
  p("te-solis", "Mateo Solis", "TE", "DAL", 3, 78, 0.27, 0.85),
  p("te-beck", "Ivo Beck", "TE", "GB", 5, 76, 0.25, 0.87),
  p("te-orin", "Nils Orin", "TE", "MIA", 2, 74, 0.33, 0.78),
  p("te-ash", "Pax Ash", "TE", "CIN", 6, 73, 0.29, 0.82),
  p("te-grove", "Eli Grove", "TE", "MIN", 4, 71, 0.23, 0.88),
  p("te-quinn", "Rook Quinn", "TE", "LAC", 3, 70, 0.31, 0.8),
  p("te-flint", "Gray Flint", "TE", "ATL", 5, 68, 0.26, 0.84),
  p("te-west", "Cal West", "TE", "HOU", 2, 67, 0.24, 0.86),
  p("te-pike", "Ned Pike", "TE", "SEA", 6, 66, 0.28, 0.83),
  p("te-moss", "Bo Moss", "TE", "CHI", 4, 65, 0.22, 0.89),

  // Kickers
  p("k-vale", "Anders Vale", "K", "BAL", 4, 88, 0.18, 0.95),
  p("k-nunez", "Rafa Nunez", "K", "KC", 5, 86, 0.2, 0.94),
  p("k-holt", "Erik Holt", "K", "SF", 3, 84, 0.16, 0.96),
  p("k-cho", "Min Cho", "K", "BUF", 2, 82, 0.22, 0.93),
  p("k-reed", "Lars Reed", "K", "DAL", 6, 80, 0.19, 0.94),
  p("k-ash", "Nico Ash", "K", "DET", 4, 78, 0.24, 0.9),
  p("k-grove", "Owen Grove", "K", "PHI", 5, 76, 0.17, 0.95),
  p("k-wren", "Ivo Wren", "K", "MIA", 3, 74, 0.21, 0.92),
  p("k-beck", "Tomas Beck", "K", "GB", 2, 72, 0.2, 0.93),
  p("k-sol", "Arlo Sol", "K", "CIN", 6, 70, 0.23, 0.91),
  p("k-pike", "Ned Pike", "K", "MIN", 4, 68, 0.18, 0.94),
  p("k-low", "Cal Low", "K", "LAC", 5, 66, 0.22, 0.9),

  // Team defenses
  p("dst-bal", "Ravens D/ST", "DST", "BAL", 4, 92, 0.3, 0.95),
  p("dst-sf", "49ers D/ST", "DST", "SF", 3, 90, 0.28, 0.94),
  p("dst-buf", "Bills D/ST", "DST", "BUF", 5, 88, 0.32, 0.93),
  p("dst-dal", "Cowboys D/ST", "DST", "DAL", 2, 86, 0.26, 0.94),
  p("dst-cle", "Browns D/ST", "DST", "CLE", 6, 84, 0.34, 0.9),
  p("dst-pit", "Steelers D/ST", "DST", "PIT", 4, 83, 0.24, 0.95),
  p("dst-phi", "Eagles D/ST", "DST", "PHI", 3, 82, 0.29, 0.92),
  p("dst-kc", "Chiefs D/ST", "DST", "KC", 5, 80, 0.27, 0.93),
  p("dst-mia", "Dolphins D/ST", "DST", "MIA", 2, 78, 0.33, 0.9),
  p("dst-det", "Lions D/ST", "DST", "DET", 6, 76, 0.25, 0.92),
  p("dst-gb", "Packers D/ST", "DST", "GB", 4, 74, 0.28, 0.91),
  p("dst-nyj", "Jets D/ST", "DST", "NYJ", 3, 72, 0.31, 0.89),
];

export const PLAYER_BY_ID: Record<string, Player> = Object.fromEntries(
  PLAYERS.map((pl) => [pl.id, pl]),
);

export function getPlayer(id: string): Player {
  const found = PLAYER_BY_ID[id];
  if (!found) throw new Error(`Unknown player ${id}`);
  return found;
}

export function playersByPos(pos: Position): Player[] {
  return PLAYERS.filter((pl) => pl.pos === pos).sort((a, b) => b.ovr - a.ovr);
}
