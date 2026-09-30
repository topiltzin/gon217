/**
 * The one level, as a tile map. Each character is a 4×4 m cell:
 *
 *   walls   #  brick   =  metal panels   %  stone   !  warning stripes   (space) solid void
 *   floors  .  tiles   ,  metal grate
 *   doors   D  opens when you walk up   L  needs the red key   $  secret wall (shoot it)
 *   marks   P  start   X  exit   *  lamp   o  crate
 *   enemies g  husk (melee)   s  gloom (spits fireballs)
 *   pickups h  health   a  armor   b  bullets   c  shells   W  shotgun   K  red key
 *
 * Route: start room → main corridor → combat room (shotgun) → side corridor
 * (secret stash behind the cracked wall) → arena (red key) → locked final room → exit.
 */
export const LEVEL_MAP = `
 #######
 #h....#
 #.*...#
 #..P..#
 #....b#
 ###D###
   #,#        =============
   #,#        =...........=
   #*#        =.....W...o.=
   #,#        =..o....g...=
   #,##########...........=
   #,,,,,g,,b,D.....*....c=
   ############...........=
              =..s.....o..=
              =...o.....g.=
              =.h.........=
              ======D======
                   #,#
   #######         #,#
   #.....#         #g#
   #.a.c.###########,#
   #..*..$.,b,,*,,,,,#
   #.h.c.###########,#
   #.....#         #,#
   #######  %%%%%%%%D#%%%%%%%%%%%%%
            %.h...................%
            %..*......o.........s.%!!!!!!!!
            %..........s.......g..%!......!
            %....%...........%....%!.h.s..!
            %..g.................b%!......!
            %..........*..........L...*.X.!
            %..........o...g...K..%!......!
            %c....................%!.c.g..!
            %....%...........%..g.%!......!
            %............s........%!!!!!!!!
            %.s....g.c....o....*..%
            %....................a%
            %%%%%%%%%%%%%%%%%%%%%%%`;

export const TILE = 4;
export const WALL_HEIGHT = 4;

export type WallKind = "brick" | "metal" | "stone" | "stripes";
export type FloorKind = "tiles" | "grate";
export type DoorKind = "auto" | "locked" | "secret";
export type EnemyKind = "husk" | "gloom";
export type PickupKind = "health" | "armor" | "bullets" | "shells" | "shotgun" | "key";

export type Cell =
  | { type: "void" }
  | { type: "wall"; wall: WallKind }
  | { type: "floor"; floor: FloorKind }
  | { type: "door"; door: DoorKind; wall: WallKind };

export type Spawn<K> = { kind: K; col: number; row: number };

export type Level = {
  cols: number;
  rows: number;
  cells: Cell[];
  start: { col: number; row: number };
  exit: { col: number; row: number };
  lamps: { col: number; row: number }[];
  crates: { col: number; row: number }[];
  enemies: Spawn<EnemyKind>[];
  pickups: Spawn<PickupKind>[];
};

const WALLS: Record<string, WallKind> = { "#": "brick", "=": "metal", "%": "stone", "!": "stripes" };
const ENEMIES: Record<string, EnemyKind> = { g: "husk", s: "gloom" };
const PICKUPS: Record<string, PickupKind> = {
  h: "health",
  a: "armor",
  b: "bullets",
  c: "shells",
  W: "shotgun",
  K: "key",
};

export function parseLevel(map: string = LEVEL_MAP): Level {
  const lines = map.replace(/^\n/, "").split("\n");
  const rows = lines.length;
  const cols = Math.max(...lines.map((l) => l.length));
  const charAt = (col: number, row: number) => lines[row]?.[col] ?? " ";
  const cells: Cell[] = [];
  const level: Level = {
    cols,
    rows,
    cells,
    start: { col: -1, row: -1 },
    exit: { col: -1, row: -1 },
    lamps: [],
    crates: [],
    enemies: [],
    pickups: [],
  };

  // A door or marker takes its look from the walls/floors around it.
  const neighbourWall = (col: number, row: number): WallKind => {
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const kind = WALLS[charAt(col + dc, row + dr)];
      if (kind) return kind;
    }
    return "brick";
  };
  const neighbourFloor = (col: number, row: number): FloorKind =>
    [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => charAt(col + dc, row + dr) === ",") ? "grate" : "tiles";

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = charAt(col, row);
      if (ch === " ") cells.push({ type: "void" });
      else if (WALLS[ch]) cells.push({ type: "wall", wall: WALLS[ch] });
      else if (ch === "D" || ch === "L" || ch === "$")
        cells.push({
          type: "door",
          door: ch === "D" ? "auto" : ch === "L" ? "locked" : "secret",
          wall: ch === "$" ? "brick" : neighbourWall(col, row),
        });
      else {
        cells.push({ type: "floor", floor: ch === "," ? "grate" : ch === "." ? "tiles" : neighbourFloor(col, row) });
        if (ch === "P") level.start = { col, row };
        else if (ch === "X") level.exit = { col, row };
        else if (ch === "*") level.lamps.push({ col, row });
        else if (ch === "o") level.crates.push({ col, row });
        else if (ENEMIES[ch]) level.enemies.push({ kind: ENEMIES[ch], col, row });
        else if (PICKUPS[ch]) level.pickups.push({ kind: PICKUPS[ch], col, row });
        else if (ch !== "." && ch !== ",") throw new Error(`Unknown level tile "${ch}" at ${col},${row}`);
      }
    }
  }
  if (level.start.col < 0 || level.exit.col < 0) throw new Error("Level needs a start (P) and an exit (X)");
  return level;
}

export const cellAt = (level: Level, col: number, row: number): Cell =>
  col < 0 || row < 0 || col >= level.cols || row >= level.rows ? { type: "void" } : level.cells[row * level.cols + col];

/** World-space centre of a cell (x, z). */
export const cellCenter = (col: number, row: number) => ({ x: (col + 0.5) * TILE, z: (row + 0.5) * TILE });
