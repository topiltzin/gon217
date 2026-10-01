/**
 * Super Jump: a tiny side-scroller. Pure functions over plain data so the
 * physics can be unit-tested; the React component only feeds input and draws.
 *
 * Level legend: '#' ground, 'B' brick, 'Q' question block (all solid),
 * 'o' coin, 'e' slime, 'P' player start, 'C' checkpoint, 'F' flag, '.' empty.
 *
 * Jumping into a brick from below smashes it (and squashes any slime on top);
 * a question block gives a coin once, then stays as a plain used block.
 * Moving platforms (defined beside the rows) slide back and forth or up and
 * down; you can stand on them from above and jump up through them.
 */

export const TILE = 16;
export const START_LIVES = 3;

const GRAVITY = 1100;
const MAX_FALL = 420;
const RUN_SPEED = 95;
const ACCEL = 900;
const FRICTION = 1100;
const JUMP_SPEED = 350;
const JUMP_CUT = 120;
const STOMP_BOUNCE = 240;
const ENEMY_SPEED = 28;
const INVULNERABLE_S = 1.2;
const PLAYER_W = 12;
const PLAYER_H = 14;
const ENEMY_W = 14;
const ENEMY_H = 12;

export type Point = { x: number; y: number };

/** A moving platform, in tiles: it starts at (x, y), is `width` tiles wide, and travels `range` tiles along `axis` (y: upward). */
export type PlatformSpec = { x: number; y: number; width: number; axis: "x" | "y"; range: number; speed: number };

export type Theme = "day" | "sunset" | "night";

export type Level = {
  width: number;
  height: number;
  platforms: PlatformSpec[];
  theme: Theme;
  /** solid[y][x] */
  solid: boolean[][];
  bricks: Point[];
  questions: Point[];
  start: Point;
  flag: Point;
  checkpoint: Point | null;
  coins: Point[];
  enemies: Point[];
};

export type Input = { left: boolean; right: boolean; jump: boolean };

type Body = { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean };

export type Player = Body & { facing: 1 | -1 };
export type Enemy = Body & { alive: boolean };
export type Coin = Point & { taken: boolean };
/** A platform in pixels; `offset` runs from 0 to `range` and back. `dx`/`dy` are this step's movement. */
export type Platform = PlatformSpec & { px: number; py: number; w: number; offset: number; dir: 1 | -1; dx: number; dy: number };
export const PLATFORM_H = 6;
/** Something that just happened to a block, for the drawing to animate. `at` is the game time. */
export type BlockEffect = Point & { kind: "smash" | "coin"; at: number };

/** How long block effects stay in the state for drawing. */
export const EFFECT_S = 0.8;

export type JumpState = {
  level: Level;
  player: Player;
  enemies: Enemy[];
  coins: Coin[];
  coinsCollected: number;
  lives: number;
  invulnerable: number;
  checkpointReached: boolean;
  jumpHeld: boolean;
  /** Question blocks already emptied, as "x,y". */
  usedBlocks: string[];
  effects: BlockEffect[];
  bricksSmashed: number;
  platforms: Platform[];
  /** Index of the platform the player is standing on, if any. */
  riding: number | null;
  status: "playing" | "won" | "lost";
  time: number;
};

export function parseLevel(rows: string[], platforms: PlatformSpec[] = [], theme: Theme = "day"): Level {
  const width = rows[0]?.length ?? 0;
  if (rows.some((r) => r.length !== width)) throw new Error("Level rows must all be the same length");
  const level: Level = {
    width,
    height: rows.length,
    platforms,
    theme,
    solid: rows.map((r) => [...r].map((c) => c === "#" || c === "B" || c === "Q")),
    bricks: [],
    questions: [],
    start: { x: -1, y: -1 },
    flag: { x: -1, y: -1 },
    checkpoint: null,
    coins: [],
    enemies: [],
  };
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "P") level.start = { x, y };
      else if (c === "F") level.flag = { x, y };
      else if (c === "C") level.checkpoint = { x, y };
      else if (c === "o") level.coins.push({ x, y });
      else if (c === "e") level.enemies.push({ x, y });
      else if (c === "B") level.bricks.push({ x, y });
      else if (c === "Q") level.questions.push({ x, y });
    }),
  );
  if (level.start.x < 0) throw new Error("Level needs a start (P)");
  if (level.flag.x < 0) throw new Error("Level needs a flag (F)");
  return level;
}

function spawnAt(tile: Point): Pick<Body, "x" | "y"> {
  return { x: tile.x * TILE + (TILE - PLAYER_W) / 2, y: tile.y * TILE + TILE - PLAYER_H };
}

function freshPlayer(tile: Point): Player {
  return { ...spawnAt(tile), w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, onGround: false, facing: 1 };
}

function makePlatform(spec: PlatformSpec): Platform {
  return { ...spec, px: spec.x * TILE, py: spec.y * TILE, w: spec.width * TILE, offset: 0, dir: 1, dx: 0, dy: 0 };
}

/** Starts a level. `carry` keeps coins, lives and smashed bricks from earlier levels. */
export function createGame(level: Level, carry?: { coins: number; lives: number; bricks: number }): JumpState {
  return {
    level,
    player: freshPlayer(level.start),
    enemies: level.enemies.map((e) => ({
      x: e.x * TILE + (TILE - ENEMY_W) / 2,
      y: e.y * TILE + TILE - ENEMY_H,
      w: ENEMY_W,
      h: ENEMY_H,
      vx: -ENEMY_SPEED,
      vy: 0,
      onGround: false,
      alive: true,
    })),
    coins: level.coins.map((c) => ({ ...c, taken: false })),
    coinsCollected: carry?.coins ?? 0,
    lives: carry?.lives ?? START_LIVES,
    invulnerable: 0,
    checkpointReached: false,
    jumpHeld: false,
    usedBlocks: [],
    effects: [],
    bricksSmashed: carry?.bricks ?? 0,
    platforms: level.platforms.map(makePlatform),
    riding: null,
    status: "playing",
    time: 0,
  };
}

/** Slides each platform along its track, ping-ponging at the ends. */
function movePlatforms(platforms: Platform[], dt: number): Platform[] {
  return platforms.map((pl) => {
    const range = pl.range * TILE;
    let offset = pl.offset + pl.dir * pl.speed * dt;
    let dir = pl.dir;
    if (offset >= range) {
      offset = range;
      dir = -1;
    } else if (offset <= 0) {
      offset = 0;
      dir = 1;
    }
    const delta = offset - pl.offset;
    const dx = pl.axis === "x" ? delta : 0;
    const dy = pl.axis === "y" ? -delta : 0;
    return { ...pl, offset, dir, dx, dy, px: pl.px + dx, py: pl.py + dy };
  });
}

/** Out of bounds: the sides are walls, above and below are open (so pits are deadly). */
function isSolid(level: Level, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= level.width) return true;
  if (ty < 0 || ty >= level.height) return false;
  return level.solid[ty][tx];
}

function tileRange(from: number, size: number): [number, number] {
  return [Math.floor(from / TILE), Math.floor((from + size - 0.001) / TILE)];
}

/** Moves a body along one axis and pushes it out of solid tiles. Returns true on a hit. */
function moveAxis(level: Level, b: Body, axis: "x" | "y", delta: number): boolean {
  if (delta === 0) return false;
  b[axis] += delta;
  const [x0, x1] = tileRange(b.x, b.w);
  const [y0, y1] = tileRange(b.y, b.h);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolid(level, tx, ty)) continue;
      if (axis === "x") b.x = delta > 0 ? tx * TILE - b.w : (tx + 1) * TILE;
      else b.y = delta > 0 ? ty * TILE - b.h : (ty + 1) * TILE;
      return true;
    }
  }
  return false;
}

function applyGravity(b: Body, dt: number) {
  b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
}

function moveBody(level: Level, b: Body, dt: number): { hitX: boolean } {
  const hitX = moveAxis(level, b, "x", b.vx * dt);
  if (hitX) b.vx = 0;
  b.onGround = false;
  if (moveAxis(level, b, "y", b.vy * dt)) {
    if (b.vy > 0) b.onGround = true;
    b.vy = 0;
  }
  return { hitX };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loseLife(s: JumpState): JumpState {
  const lives = s.lives - 1;
  if (lives <= 0) return { ...s, lives: 0, status: "lost" };
  const respawn = s.checkpointReached && s.level.checkpoint ? s.level.checkpoint : s.level.start;
  return { ...s, lives, player: freshPlayer(respawn), riding: null, invulnerable: INVULNERABLE_S };
}

function approach(value: number, target: number, amount: number): number {
  return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

/** The solid tile a rising body's head just hit: the one under its centre, else the other one it touches. */
function ceilingTile(level: Level, b: Body): Point | null {
  const ty = Math.floor((b.y - 1) / TILE);
  const [x0, x1] = tileRange(b.x, b.w);
  const centre = Math.floor((b.x + b.w / 2) / TILE);
  const candidates = [centre, ...(x0 === x1 ? [] : [x0 === centre ? x1 : x0])];
  const tx = candidates.find((x) => x >= 0 && x < level.width && ty >= 0 && ty < level.height && level.solid[ty][x]);
  return tx === undefined ? null : { x: tx, y: ty };
}

/** A head bump from below: smash a brick, or empty a question block. */
function bumpBlock(s: JumpState, tile: Point): JumpState {
  const { level } = s;
  const key = `${tile.x},${tile.y}`;
  const isBrick = level.bricks.some((b) => b.x === tile.x && b.y === tile.y);
  const isQuestion = level.questions.some((q) => q.x === tile.x && q.y === tile.y) && !s.usedBlocks.includes(key);
  if (!isBrick && !isQuestion) return s;

  // Slimes standing on the block get knocked out.
  const top = { x: tile.x * TILE, y: tile.y * TILE - 4, w: TILE, h: 4 };
  const enemies = s.enemies.map((e) => (e.alive && overlaps(e, top) ? { ...e, alive: false } : e));

  if (isQuestion) {
    return {
      ...s,
      enemies,
      usedBlocks: [...s.usedBlocks, key],
      coinsCollected: s.coinsCollected + 1,
      effects: [...s.effects, { ...tile, kind: "coin", at: s.time }],
    };
  }
  const solid = level.solid.map((row, y) => (y === tile.y ? row.map((v, x) => (x === tile.x ? false : v)) : row));
  return {
    ...s,
    enemies,
    level: { ...level, solid, bricks: level.bricks.filter((b) => b.x !== tile.x || b.y !== tile.y) },
    bricksSmashed: s.bricksSmashed + 1,
    effects: [...s.effects, { ...tile, kind: "smash", at: s.time }],
  };
}

export function step(state: JumpState, input: Input, dt: number): JumpState {
  if (state.status !== "playing") return state;
  const { level } = state;
  const p: Player = { ...state.player };
  const platforms = movePlatforms(state.platforms, dt);

  // Ride along with the platform underfoot (walls still stop you).
  if (state.riding !== null) {
    const pl = platforms[state.riding];
    moveAxis(level, p, "x", pl.dx);
    p.y = pl.py - p.h;
  }

  // Run.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.vx = dir !== 0 ? approach(p.vx, dir * RUN_SPEED, ACCEL * dt) : approach(p.vx, 0, FRICTION * dt);
  if (dir !== 0) p.facing = dir as 1 | -1;

  // Jump on a fresh press; letting go early cuts the jump short.
  if (input.jump && !state.jumpHeld && p.onGround) p.vy = -JUMP_SPEED;
  if (!input.jump && p.vy < -JUMP_CUT) p.vy = -JUMP_CUT;

  applyGravity(p, dt);
  const prevBottom = p.y + p.h;
  const rising = p.vy < 0;
  moveBody(level, p, dt);
  const bumped = rising && p.vy === 0 ? ceilingTile(level, p) : null;

  // Land on a platform from above; from below you jump straight through.
  let riding: number | null = null;
  if (p.vy >= 0) {
    platforms.forEach((pl, i) => {
      if (riding !== null) return;
      const overX = p.x + p.w > pl.px + 1 && p.x < pl.px + pl.w - 1;
      if (overX && prevBottom <= pl.py + 1 && p.y + p.h >= pl.py) {
        p.y = pl.py - p.h;
        p.vy = 0;
        p.onGround = true;
        riding = i;
      }
    });
  }

  // Slimes patrol, turning at walls and ledges.
  const enemies = state.enemies.map((e) => {
    if (!e.alive) return e;
    const next = { ...e };
    applyGravity(next, dt);
    const { hitX } = moveBody(level, next, dt);
    const aheadX = next.vx < 0 ? next.x - 1 : next.x + next.w + 1;
    const ledge =
      next.onGround && !isSolid(level, Math.floor(aheadX / TILE), Math.floor((next.y + next.h + 1) / TILE));
    if (hitX || ledge) next.vx = (hitX ? -Math.sign(e.vx) : -Math.sign(next.vx)) * ENEMY_SPEED;
    return next;
  });

  let s: JumpState = {
    ...state,
    player: p,
    enemies,
    jumpHeld: input.jump,
    platforms,
    riding,
    time: state.time + dt,
    invulnerable: Math.max(0, state.invulnerable - dt),
    effects: state.effects.filter((e) => state.time - e.at < EFFECT_S),
  };
  if (bumped) s = bumpBlock(s, bumped);

  // Coins.
  let collected = 0;
  const coins = s.coins.map((c) => {
    if (c.taken || !overlaps(p, { x: c.x * TILE + 3, y: c.y * TILE + 3, w: 10, h: 10 })) return c;
    collected++;
    return { ...c, taken: true };
  });
  if (collected) s = { ...s, coins, coinsCollected: s.coinsCollected + collected };

  // Checkpoint and flag.
  const centerX = p.x + p.w / 2;
  if (level.checkpoint && !s.checkpointReached && centerX >= level.checkpoint.x * TILE) {
    s = { ...s, checkpointReached: true };
  }
  if (p.x + p.w >= level.flag.x * TILE + 4) return { ...s, status: "won" };

  // Slimes: land on top to squash, touch from the side to get hurt.
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive || !overlaps(p, e)) continue;
    if (p.vy > 0 && prevBottom <= e.y + 6) {
      const squashed = s.enemies.map((other, j) => (j === i ? { ...other, alive: false } : other));
      s = { ...s, enemies: squashed, player: { ...p, vy: -(input.jump ? JUMP_SPEED : STOMP_BOUNCE) } };
    } else if (s.invulnerable <= 0) {
      return loseLife(s);
    }
  }

  // Fell off the world.
  if (p.y > level.height * TILE + 2 * TILE) return loseLife(s);

  return s;
}

/** Builds the first level programmatically so every row is the same length. */
function buildLevel1(): string[] {
  const W = 112;
  const H = 12;
  const g = Array.from({ length: H }, () => Array<string>(W).fill("."));
  const put = (x: number, y: number, c: string) => {
    g[y][x] = c;
  };
  const pits: [number, number][] = [
    [22, 24],
    [47, 49],
    [74, 76],
    [92, 93],
  ];
  for (let x = 0; x < W; x++) {
    if (pits.some(([a, b]) => x >= a && x <= b)) continue;
    put(x, 10, "#");
    put(x, 11, "#");
  }
  const bricks = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) put(x, y, "B");
  };
  const coins = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) put(x, y, "o");
  };
  const stairs = (x0: number, steps: number) => {
    for (let i = 0; i < steps; i++) for (let y = 9 - i; y <= 9; y++) put(x0 + i, y, "B");
  };

  put(2, 9, "P");
  coins(6, 8, 9);
  bricks(10, 13, 7);
  put(11, 7, "Q");
  coins(10, 13, 6);
  put(16, 9, "e");
  stairs(18, 2);
  put(22, 7, "o");
  put(23, 6, "o");
  put(24, 7, "o");
  bricks(28, 31, 7);
  put(29, 7, "Q");
  put(30, 6, "e");
  bricks(33, 36, 4);
  put(35, 4, "Q");
  coins(33, 36, 3);
  put(38, 9, "e");
  put(42, 9, "e");
  bricks(44, 44, 8);
  bricks(44, 44, 9);
  put(47, 7, "o");
  put(48, 6, "o");
  put(49, 7, "o");
  put(52, 9, "C");
  bricks(55, 58, 7);
  put(56, 7, "Q");
  put(57, 7, "Q");
  bricks(61, 64, 5);
  put(62, 5, "Q");
  bricks(78, 81, 6);
  put(80, 6, "Q");
  coins(61, 64, 4);
  put(57, 9, "e");
  put(65, 9, "e");
  stairs(68, 4);
  put(74, 5, "o");
  put(75, 4, "o");
  put(76, 5, "o");
  coins(80, 84, 9);
  put(86, 9, "e");
  put(89, 9, "e");
  put(92, 7, "o");
  put(93, 7, "o");
  stairs(98, 4);
  coins(99, 101, 4);
  put(106, 9, "F");
  return g.map((row) => row.join(""));
}

export const LEVEL_1 = buildLevel1();

/** A blank W×12 map with ground (rows 10–11) except in the pits, plus drawing helpers. */
function blank(W: number, pits: [number, number][]) {
  const H = 12;
  const g = Array.from({ length: H }, () => Array<string>(W).fill("."));
  for (let x = 0; x < W; x++) {
    if (pits.some(([a, b]) => x >= a && x <= b)) continue;
    g[10][x] = "#";
    g[11][x] = "#";
  }
  const put = (x: number, y: number, c: string) => {
    g[y][x] = c;
  };
  const row = (x0: number, x1: number, y: number, c: string) => {
    for (let x = x0; x <= x1; x++) put(x, y, c);
  };
  const stairs = (x0: number, steps: number, down = false) => {
    for (let i = 0; i < steps; i++) {
      const h = down ? steps - i : i + 1;
      for (let y = 10 - h; y <= 9; y++) put(x0 + i, y, "B");
    }
  };
  return { put, row, stairs, rows: () => g.map((r) => r.join("")) };
}

/** A platform that shuttles across a pit at ground height, touching both edges. */
const ferry = (pitStart: number, pitEnd: number, speed = 34, width = 3): PlatformSpec => ({
  x: pitStart - 1,
  y: 10,
  width,
  axis: "x",
  range: pitEnd - pitStart + 3 - width,
  speed,
});

/** Level 2, "Sky Bridges": wide gaps you cross on moving platforms. */
function buildLevel2() {
  const pits: [number, number][] = [
    [14, 19],
    [34, 36],
    [44, 53],
    [70, 76],
    [86, 88],
    [100, 105],
  ];
  const m = blank(124, pits);
  m.put(2, 9, "P");
  m.row(6, 9, 9, "o");
  m.put(11, 9, "e");
  m.row(15, 18, 7, "o");
  m.row(23, 27, 6, "B");
  m.put(25, 6, "Q");
  m.row(23, 27, 5, "o");
  m.put(29, 9, "e");
  m.put(35, 7, "o");
  m.row(38, 41, 6, "B");
  m.put(39, 6, "Q");
  m.row(46, 51, 6, "o");
  m.put(58, 9, "C");
  m.stairs(61, 3);
  m.put(66, 9, "e");
  m.row(71, 75, 6, "o");
  m.row(79, 83, 6, "B");
  m.put(81, 6, "Q");
  m.put(82, 9, "e");
  m.put(87, 7, "o");
  m.put(92, 9, "e");
  m.put(95, 9, "e");
  m.row(101, 104, 6, "o");
  m.stairs(108, 4);
  m.row(109, 111, 4, "o");
  m.put(118, 9, "F");
  const platforms: PlatformSpec[] = [
    ferry(14, 19),
    // Two ferries over the big gap: hop from one to the other in the middle.
    { x: 43, y: 10, width: 3, axis: "x", range: 4, speed: 30 },
    { x: 49, y: 10, width: 3, axis: "x", range: 3, speed: 38 },
    ferry(70, 76, 40),
    ferry(100, 105, 44),
  ];
  return { rows: m.rows(), platforms };
}

/** Level 3, "Night Castle": tall walls you ride lifts up, quick slimes, and the longest gaps. */
function buildLevel3() {
  const pits: [number, number][] = [
    [20, 26],
    [50, 52],
    [64, 72],
    [92, 98],
  ];
  const m = blank(132, pits);
  const wall = (x0: number, x1: number, top: number) => {
    for (let x = x0; x <= x1; x++) for (let y = top; y <= 9; y++) m.put(x, y, "B");
  };
  m.put(2, 9, "P");
  m.row(5, 8, 9, "o");
  m.row(9, 12, 6, "B");
  m.put(10, 6, "Q");
  m.put(11, 6, "Q");
  m.put(14, 9, "e");
  m.row(21, 25, 7, "o");
  // Castle wall #1, taller than any jump: ride the lift up.
  wall(33, 35, 4);
  m.row(33, 35, 3, "o");
  m.put(41, 9, "e");
  m.put(44, 9, "e");
  m.put(51, 7, "o");
  m.put(56, 9, "C");
  m.row(58, 61, 6, "B");
  m.put(59, 6, "Q");
  m.row(65, 71, 6, "o");
  m.put(76, 9, "e");
  m.put(78, 9, "e");
  m.put(80, 9, "e");
  // Castle wall #2.
  wall(85, 87, 3);
  m.row(85, 87, 2, "o");
  m.row(93, 97, 6, "o");
  m.row(102, 106, 6, "B");
  m.put(104, 6, "Q");
  m.put(108, 9, "e");
  m.stairs(112, 4);
  m.stairs(116, 4, true);
  m.put(126, 9, "F");
  const platforms: PlatformSpec[] = [
    ferry(20, 26, 40),
    { x: 29, y: 10, width: 3, axis: "y", range: 5, speed: 30 },
    ferry(64, 72, 46, 3),
    { x: 81, y: 10, width: 3, axis: "y", range: 6, speed: 32 },
    ferry(92, 98, 50),
  ];
  return { rows: m.rows(), platforms };
}

const LEVEL_2 = buildLevel2();
const LEVEL_3 = buildLevel3();

/** Every level in order, ready to play. */
export function allLevels(): Level[] {
  return [
    parseLevel(LEVEL_1, [], "day"),
    parseLevel(LEVEL_2.rows, LEVEL_2.platforms, "sunset"),
    parseLevel(LEVEL_3.rows, LEVEL_3.platforms, "night"),
  ];
}
