/**
 * Super Jump: a hero platformer starring Deku. Pure functions over plain data
 * so the physics can be unit-tested; the React component only feeds input and
 * draws.
 *
 * Level legend:
 *   '#' stone/ground   'B' brick   (solid)
 *   'Q' coin block     'U' Full Cowl block   'H' heart block   (solid, give an item once)
 *   'o' coin   'u' Full Cowl power-up   'h' heart
 *   'e' slime villain   'f' flying drone   'X' boss   '^' spikes
 *   'P' start   'C' checkpoint   'F' flag   '.' empty
 *
 * Deku can jump on villains, bump blocks from below, or press Smash to punch
 * what is in front of him (villains, bricks, blocks). A Full Cowl makes him
 * faster, a higher jumper and a harder hitter for a while. Moving platforms
 * (defined beside the rows) slide back and forth or up and down; you can stand
 * on them from above and jump up through them.
 */

export const TILE = 16;
export const START_LIVES = 3;
export const MAX_LIVES = 5;

const GRAVITY_UP = 1050;
const GRAVITY_DOWN = 1500;
const MAX_FALL = 460;
const RUN_SPEED = 105;
const ACCEL = 820;
const FRICTION = 980;
const AIR_CONTROL = 0.75;
const JUMP_SPEED = 349;
const JUMP_CUT = 110;
const STOMP_BOUNCE = 250;
const COYOTE_S = 0.1;
const BUFFER_S = 0.12;
const ENEMY_SPEED = 28;
const FLYER_SPEED = 24;
const FLYER_RANGE = 3 * TILE;
const INVULNERABLE_S = 1.4;
const PLAYER_W = 12;
const PLAYER_H = 15;
const ENEMY_W = 14;
const ENEMY_H = 12;
const FLYER_W = 14;
const FLYER_H = 10;
const BOSS_W = 26;
const BOSS_H = 26;
const BOSS_SPEED = 30;
const BOSS_LEASH = 7 * TILE;
const BOSS_HURT_S = 1;
export const BOSS_HP = 5;
const SMASH_S = 0.22;
const SMASH_COOLDOWN = 0.5;
const COWL_COOLDOWN = 0.3;
const SMASH_REACH = 20;
const COWL_REACH = 30;
export const COWL_S = 10;
const COWL_SPEED = 1.22;
const COWL_JUMP = 1.12;

export type Point = { x: number; y: number };

/** A moving platform, in tiles: it starts at (x, y), is `width` tiles wide, and travels `range` tiles along `axis` (y: upward). */
export type PlatformSpec = { x: number; y: number; width: number; axis: "x" | "y"; range: number; speed: number };

export type Theme = "day" | "sunset" | "night" | "storm";
export type EnemyKind = "walker" | "flyer" | "boss";
export type ItemKind = "coin" | "cowl" | "heart";

export type Level = {
  width: number;
  height: number;
  platforms: PlatformSpec[];
  theme: Theme;
  /** solid[y][x] */
  solid: boolean[][];
  bricks: Point[];
  questions: (Point & { item: ItemKind })[];
  start: Point;
  flag: Point;
  checkpoint: Point | null;
  coins: Point[];
  enemies: (Point & { kind: EnemyKind })[];
  spikes: Point[];
  items: (Point & { kind: "cowl" | "heart" })[];
};

export type Input = { left: boolean; right: boolean; jump: boolean; smash?: boolean };

type Body = { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean };

export type Player = Body & {
  facing: 1 | -1;
  /** Seconds left of the punch in progress. */
  smashT: number;
  smashCd: number;
  /** Grace time after leaving a ledge in which a jump still works. */
  coyote: number;
  /** A jump press waiting for the ground. */
  jumpBuf: number;
  /** Seconds left of Full Cowl. */
  cowl: number;
};
export type Enemy = Body & {
  alive: boolean;
  kind: EnemyKind;
  hp: number;
  /** Seconds of flashing after a boss hit. */
  hurt: number;
  /** Walkers: unused. Flyers: where they hover. Bosses: the hop timer. */
  baseY: number;
  phase: number;
  minX: number;
  maxX: number;
};
export type Coin = Point & { taken: boolean };
export type Item = Point & { kind: "cowl" | "heart"; taken: boolean };
/** A platform in pixels; `offset` runs from 0 to `range` and back. `dx`/`dy` are this step's movement. */
export type Platform = PlatformSpec & { px: number; py: number; w: number; offset: number; dir: 1 | -1; dx: number; dy: number };
export const PLATFORM_H = 6;
/** Something that just happened to a block, for the drawing to animate. `at` is the game time. */
export type BlockEffect = Point & { kind: "smash" | "coin" | "item"; at: number; item?: ItemKind };

/** A one-step happening in world pixels, for sounds and particles. */
export type GameEvent = Point & {
  kind:
    | "jump"
    | "land"
    | "coin"
    | "brick"
    | "bump"
    | "stomp"
    | "punch"
    | "kill"
    | "hurt"
    | "power"
    | "heart"
    | "checkpoint"
    | "bossHit"
    | "bossDown";
};

/** How long block effects stay in the state for drawing. */
export const EFFECT_S = 0.8;

export type JumpState = {
  level: Level;
  player: Player;
  enemies: Enemy[];
  coins: Coin[];
  items: Item[];
  coinsCollected: number;
  lives: number;
  invulnerable: number;
  checkpointReached: boolean;
  jumpHeld: boolean;
  smashHeld: boolean;
  /** Question blocks already emptied, as "x,y". */
  usedBlocks: string[];
  effects: BlockEffect[];
  events: GameEvent[];
  bricksSmashed: number;
  /** Villains beaten this run, and how many of those with a punch. */
  kills: number;
  smashKills: number;
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
    solid: rows.map((r) => [...r].map((c) => "#BQUH".includes(c))),
    bricks: [],
    questions: [],
    start: { x: -1, y: -1 },
    flag: { x: -1, y: -1 },
    checkpoint: null,
    coins: [],
    enemies: [],
    spikes: [],
    items: [],
  };
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "P") level.start = { x, y };
      else if (c === "F") level.flag = { x, y };
      else if (c === "C") level.checkpoint = { x, y };
      else if (c === "o") level.coins.push({ x, y });
      else if (c === "e") level.enemies.push({ x, y, kind: "walker" });
      else if (c === "f") level.enemies.push({ x, y, kind: "flyer" });
      else if (c === "X") level.enemies.push({ x, y, kind: "boss" });
      else if (c === "^") level.spikes.push({ x, y });
      else if (c === "u") level.items.push({ x, y, kind: "cowl" });
      else if (c === "h") level.items.push({ x, y, kind: "heart" });
      else if (c === "B") level.bricks.push({ x, y });
      else if (c === "Q") level.questions.push({ x, y, item: "coin" });
      else if (c === "U") level.questions.push({ x, y, item: "cowl" });
      else if (c === "H") level.questions.push({ x, y, item: "heart" });
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
  return {
    ...spawnAt(tile),
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    smashT: 0,
    smashCd: 0,
    coyote: 0,
    jumpBuf: 0,
    cowl: 0,
  };
}

function makeEnemy(e: Point & { kind: EnemyKind }): Enemy {
  const size = e.kind === "boss" ? { w: BOSS_W, h: BOSS_H } : e.kind === "flyer" ? { w: FLYER_W, h: FLYER_H } : { w: ENEMY_W, h: ENEMY_H };
  const x = e.x * TILE + (TILE - size.w) / 2;
  const y = e.kind === "flyer" ? e.y * TILE + 3 : e.y * TILE + TILE - size.h;
  const leash = e.kind === "boss" ? BOSS_LEASH : FLYER_RANGE;
  return {
    x,
    y,
    ...size,
    vx: e.kind === "flyer" ? FLYER_SPEED : e.kind === "boss" ? 0 : -ENEMY_SPEED,
    vy: 0,
    onGround: false,
    alive: true,
    kind: e.kind,
    hp: e.kind === "boss" ? BOSS_HP : 1,
    hurt: 0,
    baseY: y,
    phase: e.kind === "boss" ? 1.5 : (e.x * 0.7) % (Math.PI * 2),
    minX: x - leash,
    maxX: x + leash,
  };
}

function makePlatform(spec: PlatformSpec): Platform {
  return { ...spec, px: spec.x * TILE, py: spec.y * TILE, w: spec.width * TILE, offset: 0, dir: 1, dx: 0, dy: 0 };
}

/** Starts a level. `carry` keeps coins, lives and counters from earlier levels. */
export function createGame(
  level: Level,
  carry?: { coins: number; lives: number; bricks: number; kills?: number; smashKills?: number },
): JumpState {
  return {
    level,
    player: freshPlayer(level.start),
    enemies: level.enemies.map(makeEnemy),
    coins: level.coins.map((c) => ({ ...c, taken: false })),
    items: level.items.map((i) => ({ ...i, taken: false })),
    coinsCollected: carry?.coins ?? 0,
    lives: carry?.lives ?? START_LIVES,
    invulnerable: 0,
    checkpointReached: false,
    jumpHeld: false,
    smashHeld: false,
    usedBlocks: [],
    effects: [],
    events: [],
    bricksSmashed: carry?.bricks ?? 0,
    kills: carry?.kills ?? 0,
    smashKills: carry?.smashKills ?? 0,
    platforms: level.platforms.map(makePlatform),
    riding: null,
    status: "playing",
    time: 0,
  };
}

/** The boss's remaining and total hit points, while one is alive. */
export function bossStatus(s: JumpState): { hp: number; max: number; x: number } | null {
  const boss = s.enemies.find((e) => e.kind === "boss" && e.alive);
  return boss ? { hp: boss.hp, max: BOSS_HP, x: boss.x } : null;
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

function applyGravity(b: Body, dt: number, g = GRAVITY_DOWN) {
  b.vy = Math.min(b.vy + g * dt, MAX_FALL);
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

type Box = { x: number; y: number; w: number; h: number };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loseLife(s: JumpState): JumpState {
  const lives = s.lives - 1;
  const hurt: GameEvent = { kind: "hurt", x: s.player.x + s.player.w / 2, y: s.player.y + s.player.h / 2 };
  if (lives <= 0) return { ...s, lives: 0, status: "lost", events: [...s.events, hurt] };
  const respawn = s.checkpointReached && s.level.checkpoint ? s.level.checkpoint : s.level.start;
  return { ...s, lives, player: freshPlayer(respawn), riding: null, invulnerable: INVULNERABLE_S, events: [...s.events, hurt] };
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

/** A villain is beaten (a boss only loses a hit point). */
function defeat(s: JumpState, e: Enemy, how: "stomp" | "smash" | "block") {
  const at = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  if (e.kind === "boss") {
    if (e.hurt > 0) return;
    e.hp -= 1;
    e.hurt = BOSS_HURT_S;
    if (e.hp <= 0) {
      e.alive = false;
      s.kills++;
      if (how === "smash") s.smashKills++;
      s.events.push({ kind: "bossDown", ...at });
    } else s.events.push({ kind: "bossHit", ...at });
    return;
  }
  e.alive = false;
  s.kills++;
  if (how === "smash") s.smashKills++;
  s.events.push({ kind: how === "stomp" ? "stomp" : "kill", ...at });
}

function giveItem(s: JumpState, item: ItemKind, at: Point) {
  if (item === "coin") {
    s.coinsCollected += 1;
    s.events.push({ kind: "coin", ...at });
  } else if (item === "cowl") {
    s.player.cowl = COWL_S;
    s.events.push({ kind: "power", ...at });
  } else {
    s.lives = Math.min(MAX_LIVES, s.lives + 1);
    s.events.push({ kind: "heart", ...at });
  }
}

/** A head bump from below or a punch from the side: smash a brick, or empty a block. Mutates `s`. */
function bumpBlock(s: JumpState, tile: Point, how: "bump" | "smash") {
  const { level } = s;
  const key = `${tile.x},${tile.y}`;
  const isBrick = level.bricks.some((b) => b.x === tile.x && b.y === tile.y);
  const question = level.questions.find((q) => q.x === tile.x && q.y === tile.y);
  const isQuestion = !!question && !s.usedBlocks.includes(key);
  if (!isBrick && !isQuestion) return;
  const centre = { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 };

  // Villains standing on the block get knocked out.
  const top = { x: tile.x * TILE, y: tile.y * TILE - 4, w: TILE, h: 4 };
  for (const e of s.enemies) if (e.alive && e.kind !== "flyer" && overlaps(e, top)) defeat(s, e, "block");

  if (isQuestion && question) {
    s.usedBlocks = [...s.usedBlocks, key];
    giveItem(s, question.item, { x: centre.x, y: centre.y - TILE });
    s.effects = [...s.effects, { ...tile, kind: question.item === "coin" ? "coin" : "item", item: question.item, at: s.time }];
    if (how === "bump") s.events.push({ kind: "bump", ...centre });
    return;
  }
  const solid = level.solid.map((row, y) => (y === tile.y ? row.map((v, x) => (x === tile.x ? false : v)) : row));
  s.level = { ...level, solid, bricks: level.bricks.filter((b) => b.x !== tile.x || b.y !== tile.y) };
  s.bricksSmashed++;
  s.effects = [...s.effects, { ...tile, kind: "smash", at: s.time }];
  s.events.push({ kind: "brick", ...centre });
}

export function smashBox(p: Player): Box {
  const reach = p.cowl > 0 ? COWL_REACH : SMASH_REACH;
  return { x: p.facing > 0 ? p.x + p.w : p.x - reach, y: p.y - 2, w: reach, h: p.h + 4 };
}

export function step(state: JumpState, input: Input, dt: number): JumpState {
  if (state.status !== "playing") return state;
  const { level } = state;
  const events: GameEvent[] = [];
  const p: Player = { ...state.player };
  const platforms = movePlatforms(state.platforms, dt);
  const cowl = p.cowl > 0;

  // Ride along with the platform underfoot (walls still stop you).
  if (state.riding !== null) {
    const pl = platforms[state.riding];
    moveAxis(level, p, "x", pl.dx);
    p.y = pl.py - p.h;
  }

  // Run: a little heavier in the air, and a quick skid when turning around.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const grip = p.onGround ? 1 : AIR_CONTROL;
  const topSpeed = RUN_SPEED * (cowl ? COWL_SPEED : 1);
  if (dir !== 0) {
    const turning = Math.sign(p.vx) === -dir;
    p.vx = approach(p.vx, dir * topSpeed, ACCEL * grip * (turning ? 1.6 : 1) * dt);
    p.facing = dir as 1 | -1;
  } else p.vx = approach(p.vx, 0, FRICTION * (p.onGround ? 1 : 0.3) * dt);

  // Timers.
  p.cowl = Math.max(0, p.cowl - dt);
  p.smashT = Math.max(0, p.smashT - dt);
  p.smashCd = Math.max(0, p.smashCd - dt);
  p.coyote = p.onGround ? COYOTE_S : Math.max(0, p.coyote - dt);
  p.jumpBuf = input.jump && !state.jumpHeld ? BUFFER_S : Math.max(0, p.jumpBuf - dt);

  // Jump on a fresh press (a press just before landing or just after a ledge still counts).
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -JUMP_SPEED * (cowl ? COWL_JUMP : 1);
    p.jumpBuf = 0;
    p.coyote = 0;
    p.onGround = false;
    events.push({ kind: "jump", x: p.x + p.w / 2, y: p.y + p.h });
  }
  // Letting go early cuts the jump short.
  if (!input.jump && p.vy < -JUMP_CUT) p.vy = -JUMP_CUT;

  // Punch.
  if (input.smash && !state.smashHeld && p.smashCd <= 0) {
    p.smashT = SMASH_S;
    p.smashCd = cowl ? COWL_COOLDOWN : SMASH_COOLDOWN;
    events.push({ kind: "punch", x: p.x + p.w / 2 + p.facing * 10, y: p.y + p.h / 2 });
  }

  applyGravity(p, dt, p.vy < 0 && input.jump ? GRAVITY_UP : GRAVITY_DOWN);
  const prevBottom = p.y + p.h;
  const prevVy = p.vy;
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
  if (p.onGround && !state.player.onGround && prevVy > 140) events.push({ kind: "land", x: p.x + p.w / 2, y: p.y + p.h });

  const time = state.time + dt;
  const enemies = state.enemies.map((e) => ({ ...e }));
  const s: JumpState = {
    ...state,
    player: p,
    enemies,
    jumpHeld: input.jump,
    smashHeld: !!input.smash,
    platforms,
    riding,
    events,
    time,
    invulnerable: Math.max(0, state.invulnerable - dt),
    effects: state.effects.filter((e) => state.time - e.at < EFFECT_S),
  };
  if (bumped) bumpBlock(s, bumped, "bump");

  // Punch: hits villains and blocks in front of Deku.
  if (p.smashT > 0) {
    const box = smashBox(p);
    for (const e of enemies) if (e.alive && overlaps(box, e)) defeat(s, e, "smash");
    const [x0, x1] = tileRange(box.x, box.w);
    const [y0, y1] = tileRange(box.y, box.h);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(level, tx, ty)) bumpBlock(s, { x: tx, y: ty }, "smash");
  }

  // Villains: slimes patrol (turning at walls and ledges), drones hover, the boss chases.
  for (const e of enemies) {
    if (!e.alive) continue;
    e.hurt = Math.max(0, e.hurt - dt);
    if (e.kind === "flyer") {
      if (e.x <= e.minX) e.vx = FLYER_SPEED;
      else if (e.x >= e.maxX) e.vx = -FLYER_SPEED;
      e.x += e.vx * dt;
      e.y = e.baseY + Math.sin(time * 2.4 + e.phase) * 8;
      continue;
    }
    if (e.kind === "boss") {
      const speed = BOSS_SPEED + (BOSS_HP - e.hp) * 7;
      let vx = e.hurt > 0 ? 0 : (p.x < e.x ? -1 : 1) * speed;
      if ((e.x <= e.minX && vx < 0) || (e.x >= e.maxX && vx > 0)) vx = 0;
      e.vx = vx;
      e.phase -= dt;
      if (e.onGround && e.phase <= 0 && e.hurt <= 0) {
        e.vy = -230;
        e.phase = 2.4 - (BOSS_HP - e.hp) * 0.25;
      }
      applyGravity(e, dt);
      moveBody(level, e, dt);
      continue;
    }
    const before = e.vx;
    applyGravity(e, dt);
    const { hitX } = moveBody(level, e, dt);
    const aheadX = e.vx < 0 ? e.x - 1 : e.x + e.w + 1;
    const ledge = e.onGround && !isSolid(level, Math.floor(aheadX / TILE), Math.floor((e.y + e.h + 1) / TILE));
    if (hitX || ledge) e.vx = (hitX ? -Math.sign(before) : -Math.sign(e.vx)) * ENEMY_SPEED;
  }

  // Coins and power-ups.
  const mid = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  let collected = 0;
  const coins = s.coins.map((c) => {
    if (c.taken || !overlaps(p, { x: c.x * TILE + 3, y: c.y * TILE + 3, w: 10, h: 10 })) return c;
    collected++;
    return { ...c, taken: true };
  });
  if (collected) {
    s.coins = coins;
    s.coinsCollected += collected;
    events.push({ kind: "coin", ...mid(p) });
  }
  s.items = s.items.map((it) => {
    if (it.taken || !overlaps(p, { x: it.x * TILE + 2, y: it.y * TILE + 2, w: 12, h: 12 })) return it;
    giveItem(s, it.kind, { x: it.x * TILE + 8, y: it.y * TILE + 8 });
    return { ...it, taken: true };
  });

  // Checkpoint and flag (a boss, if there is one, has to be beaten first).
  const centerX = p.x + p.w / 2;
  if (level.checkpoint && !s.checkpointReached && centerX >= level.checkpoint.x * TILE) {
    s.checkpointReached = true;
    events.push({ kind: "checkpoint", x: level.checkpoint.x * TILE + 8, y: level.checkpoint.y * TILE });
  }
  if (p.x + p.w >= level.flag.x * TILE + 4 && !bossStatus(s)) return { ...s, status: "won" };

  // Villains: land on top to beat them, touch from the side to get hurt.
  for (const e of enemies) {
    if (!e.alive || !overlaps(p, e)) continue;
    if (e.kind === "boss" && e.hurt > 0) continue;
    const topMargin = e.kind === "boss" ? 10 : 6;
    if (p.vy > 0 && prevBottom <= e.y + topMargin) {
      defeat(s, e, "stomp");
      p.vy = -(input.jump ? JUMP_SPEED : STOMP_BOUNCE);
    } else if (s.invulnerable <= 0) return loseLife(s);
  }

  // Spikes.
  if (s.invulnerable <= 0 && level.spikes.some((sp) => overlaps(p, { x: sp.x * TILE + 2, y: sp.y * TILE + 8, w: 12, h: 8 }))) {
    return loseLife(s);
  }

  // Fell off the world.
  if (p.y > level.height * TILE + 2 * TILE) return loseLife(s);

  return s;
}

/** A blank 16-row map with ground (rows 14–15), plus drawing helpers. */
export const LEVEL_ROWS = 16;
export const GROUND = LEVEL_ROWS - 2;

function blank(W: number) {
  const g = Array.from({ length: LEVEL_ROWS }, () => Array<string>(W).fill("."));
  for (let x = 0; x < W; x++) {
    g[GROUND][x] = "#";
    g[GROUND + 1][x] = "#";
  }
  const put = (x: number, y: number, c: string) => {
    g[y][x] = c;
  };
  const row = (x0: number, x1: number, y: number, c: string) => {
    for (let x = x0; x <= x1; x++) put(x, y, c);
  };
  const pit = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x++) {
      g[GROUND][x] = ".";
      g[GROUND + 1][x] = ".";
    }
  };
  /** Brick steps climbing to `steps` tiles high (or descending). */
  const stairs = (x0: number, steps: number, down = false) => {
    for (let i = 0; i < steps; i++) {
      const h = down ? steps - i : i + 1;
      for (let y = GROUND - h; y < GROUND; y++) put(x0 + i, y, "B");
    }
  };
  /** A solid block of bricks from `top` down to the ground. */
  const wall = (x0: number, x1: number, top: number) => {
    for (let x = x0; x <= x1; x++) for (let y = top; y < GROUND; y++) put(x, y, "B");
  };
  /** A floating stone island: one row of stone. */
  const island = (x0: number, x1: number, y: number) => row(x0, x1, y, "#");
  /** Coins along a hump: `n` coins from x0, rising `peak` tiles above `y`. */
  const arc = (x0: number, n: number, y: number, peak: number) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      put(x0 + i, y - Math.round(Math.sin(t * Math.PI) * peak), "o");
    }
  };
  return { put, row, pit, stairs, wall, island, arc, rows: () => g.map((r) => r.join("")) };
}

/** A platform that shuttles across a pit at ground height, touching both edges. */
const ferry = (pitStart: number, pitEnd: number, speed = 34, width = 3): PlatformSpec => ({
  x: pitStart - 1,
  y: GROUND,
  width,
  axis: "x",
  range: pitEnd - pitStart + 3 - width,
  speed,
});

/** A lift that rises from the ground (or from `y`) by `range` tiles. */
const lift = (x: number, range: number, speed = 30, y = GROUND, width = 3): PlatformSpec => ({ x, y, width, axis: "y", range, speed });

/** Level 1, "Training Grounds": a bright run that teaches jumping, bumping and punching. */
function buildLevel1() {
  const m = blank(168);
  m.put(2, GROUND - 1, "P");
  m.row(6, 8, GROUND - 1, "o");
  // First blocks: a coin block, and a Full Cowl to try out.
  m.row(11, 14, 11, "B");
  m.put(12, 11, "Q");
  m.put(13, 11, "U");
  m.row(11, 14, 10, "o");
  m.put(16, GROUND - 1, "e");
  // The first gap, then a low wall to hop (or punch through).
  m.pit(25, 27);
  m.arc(25, 3, 11, 2);
  m.wall(31, 32, 12);
  m.row(33, 34, GROUND - 1, "o");
  m.put(38, GROUND - 1, "e");
  m.row(36, 40, 11, "B");
  m.put(38, 11, "Q");
  m.put(39, 8, "f");
  m.put(46, GROUND - 1, "^");
  m.put(47, GROUND - 1, "^");
  m.arc(45, 4, 11, 2);
  // Hill with an island route over the top.
  m.stairs(52, 4);
  m.island(56, 62, 10);
  m.row(57, 61, 9, "o");
  m.put(60, 9, "e");
  m.put(60, 10, "#");
  m.stairs(63, 4, true);
  m.put(70, GROUND - 1, "C");
  m.put(74, GROUND - 1, "e");
  m.put(77, GROUND - 1, "e");
  m.pit(82, 84);
  m.island(81, 85, 11);
  m.row(82, 84, 10, "o");
  m.row(90, 96, 11, "B");
  m.put(93, 11, "H");
  m.put(91, 8, "f");
  m.put(95, 8, "f");
  m.put(99, GROUND - 1, "e");
  m.put(101, GROUND - 1, "^");
  m.put(102, GROUND - 1, "^");
  m.arc(100, 4, 11, 2);
  // Ruined tower: climb it for a coin stash, or run past.
  m.stairs(106, 3);
  m.wall(109, 112, 11);
  m.row(109, 112, 10, "o");
  m.stairs(113, 3, true);
  m.put(118, GROUND - 1, "f");
  m.pit(121, 123);
  m.pit(127, 129);
  m.island(124, 126, GROUND);
  m.put(125, GROUND - 1, "o");
  m.put(133, GROUND - 1, "e");
  m.put(136, GROUND - 1, "e");
  // Bonus sky route: bricks lead up to coins and a Full Cowl.
  m.row(138, 140, 11, "B");
  m.island(142, 145, 8);
  m.row(142, 145, 7, "o");
  m.island(147, 151, 5);
  m.row(147, 151, 4, "o");
  m.put(149, 4, "u");
  m.stairs(153, 5);
  m.stairs(158, 5, true);
  m.put(164, GROUND - 1, "F");
  return { rows: m.rows(), platforms: [] as PlatformSpec[] };
}

export const LEVEL_1 = buildLevel1().rows;

/** Level 2, "Harbor Sunset": long gaps crossed on ferries, drones overhead. */
function buildLevel2() {
  const m = blank(188);
  m.put(2, GROUND - 1, "P");
  m.row(6, 9, GROUND - 1, "o");
  m.put(13, GROUND - 1, "e");
  m.pit(17, 22);
  m.row(18, 21, 10, "o");
  m.row(25, 29, 11, "B");
  m.put(27, 11, "Q");
  m.row(25, 29, 10, "o");
  m.put(32, GROUND - 1, "e");
  m.put(36, 9, "f");
  m.pit(40, 42);
  m.put(41, 11, "o");
  m.put(45, GROUND - 1, "^");
  m.put(46, GROUND - 1, "^");
  m.row(48, 51, 11, "B");
  m.put(49, 11, "U");
  m.pit(54, 63);
  m.row(55, 62, 10, "o");
  m.put(68, GROUND - 1, "C");
  m.stairs(71, 3);
  m.stairs(74, 3, true);
  m.put(79, GROUND - 1, "e");
  m.put(82, GROUND - 1, "e");
  m.put(86, 9, "f");
  m.pit(90, 96);
  m.row(91, 95, 10, "o");
  m.row(100, 104, 11, "B");
  m.put(102, 11, "H");
  // Crates: a tower to climb with a high coin trail.
  m.wall(108, 109, 12);
  m.wall(110, 111, 10);
  m.island(113, 117, 8);
  m.row(113, 117, 7, "o");
  m.put(115, 7, "u");
  m.put(120, GROUND - 1, "e");
  m.put(123, GROUND - 1, "e");
  m.put(126, GROUND - 1, "^");
  m.put(127, GROUND - 1, "^");
  m.put(128, GROUND - 1, "^");
  m.arc(125, 5, 11, 2);
  m.pit(132, 134);
  m.pit(138, 148);
  m.row(139, 147, 10, "o");
  m.put(153, 9, "f");
  m.put(157, 9, "f");
  m.put(154, GROUND - 1, "e");
  m.row(160, 164, 11, "B");
  m.put(162, 11, "Q");
  m.pit(168, 170);
  m.stairs(173, 4);
  m.stairs(177, 4, true);
  m.put(184, GROUND - 1, "F");
  const platforms: PlatformSpec[] = [
    ferry(17, 22),
    // Two ferries over the big gap: hop from one to the other in the middle.
    { x: 53, y: GROUND, width: 3, axis: "x", range: 5, speed: 32 },
    { x: 59, y: GROUND, width: 3, axis: "x", range: 3, speed: 38 },
    ferry(90, 96, 40),
    ferry(138, 148, 44, 3),
    { x: 144, y: GROUND, width: 3, axis: "x", range: 2, speed: 36 },
  ];
  return { rows: m.rows(), platforms };
}

/** Level 3, "Midnight City": rooftops, lifts up tall towers, and quick drones. */
function buildLevel3() {
  const m = blank(200);
  m.put(2, GROUND - 1, "P");
  m.row(5, 8, GROUND - 1, "o");
  m.row(10, 13, 11, "B");
  m.put(11, 11, "Q");
  m.put(12, 11, "Q");
  m.put(16, GROUND - 1, "e");
  m.put(19, 9, "f");
  m.pit(22, 28);
  m.row(23, 27, 10, "o");
  // Tower #1, taller than any jump: ride the lift up.
  m.wall(36, 39, 6);
  m.row(36, 39, 5, "o");
  m.put(43, GROUND - 1, "e");
  m.put(46, GROUND - 1, "e");
  m.put(50, GROUND - 1, "^");
  m.put(51, GROUND - 1, "^");
  m.pit(55, 57);
  m.put(56, 11, "o");
  m.put(61, GROUND - 1, "C");
  m.row(63, 66, 11, "B");
  m.put(64, 11, "H");
  m.put(65, 8, "f");
  m.pit(70, 78);
  m.row(71, 77, 10, "o");
  m.put(83, GROUND - 1, "e");
  m.put(85, GROUND - 1, "e");
  m.put(87, GROUND - 1, "e");
  // Rooftop hop: islands at different heights.
  m.island(91, 94, 11);
  m.island(97, 100, 8);
  m.island(103, 106, 11);
  m.row(98, 99, 7, "o");
  m.pit(90, 107);
  m.put(95, 10, "o");
  m.put(104, 10, "u");
  // Tower #2.
  m.wall(112, 115, 5);
  m.row(112, 115, 4, "o");
  m.put(119, GROUND - 1, "e");
  m.put(122, GROUND - 1, "f");
  m.put(125, GROUND - 1, "^");
  m.put(126, GROUND - 1, "^");
  m.put(127, GROUND - 1, "^");
  m.arc(124, 6, 11, 2);
  m.pit(132, 140);
  m.row(133, 139, 10, "o");
  m.row(144, 148, 11, "B");
  m.put(146, 11, "U");
  m.put(145, 8, "f");
  m.put(147, 8, "f");
  m.put(152, GROUND - 1, "e");
  m.put(155, GROUND - 1, "e");
  m.pit(160, 162);
  m.pit(166, 168);
  m.island(163, 165, GROUND);
  m.put(164, GROUND - 1, "o");
  m.stairs(172, 4);
  m.stairs(176, 4, true);
  m.put(182, GROUND - 1, "e");
  m.put(185, GROUND - 1, "f");
  m.put(195, GROUND - 1, "F");
  const platforms: PlatformSpec[] = [
    ferry(22, 28, 40),
    lift(32, 8, 32),
    ferry(55, 57, 30),
    ferry(70, 78, 46, 3),
    ferry(90, 107, 38, 3),
    lift(108, 9, 34),
    ferry(132, 140, 50, 3),
  ];
  return { rows: m.rows(), platforms };
}

/** Level 4, "Villain Lair": a stormy gauntlet that ends with a boss fight. */
function buildLevel4() {
  const m = blank(210);
  m.put(2, GROUND - 1, "P");
  m.row(5, 7, GROUND - 1, "o");
  m.put(12, GROUND - 1, "e");
  m.put(15, GROUND - 1, "e");
  m.put(18, 9, "f");
  m.put(22, GROUND - 1, "^");
  m.put(23, GROUND - 1, "^");
  m.arc(21, 5, 11, 2);
  m.pit(28, 30);
  m.row(32, 36, 11, "B");
  m.put(34, 11, "U");
  m.put(35, 8, "f");
  m.put(41, GROUND - 1, "e");
  m.put(44, GROUND - 1, "e");
  m.pit(48, 56);
  m.row(49, 55, 10, "o");
  m.stairs(60, 3);
  m.put(64, 8, "f");
  m.stairs(65, 3, true);
  m.put(70, GROUND - 1, "C");
  m.wall(74, 77, 11);
  m.row(74, 77, 10, "o");
  m.put(82, GROUND - 1, "e");
  m.put(85, GROUND - 1, "e");
  m.put(88, GROUND - 1, "^");
  m.put(89, GROUND - 1, "^");
  m.pit(94, 104);
  m.row(95, 103, 10, "o");
  m.put(106, GROUND - 1, "f");
  m.put(108, GROUND - 1, "e");
  m.row(112, 116, 11, "B");
  m.put(113, 11, "H");
  m.put(115, 11, "Q");
  m.pit(120, 128);
  m.row(121, 127, 10, "o");
  m.put(133, GROUND - 1, "e");
  m.put(136, GROUND - 1, "e");
  m.put(139, GROUND - 1, "e");
  m.put(142, 9, "f");
  m.put(145, 9, "f");
  m.pit(150, 152);
  m.pit(156, 158);
  m.island(153, 155, GROUND);
  m.put(154, GROUND - 1, "o");
  m.stairs(162, 4);
  m.row(166, 168, 10, "B");
  m.stairs(169, 4, true);
  m.put(168, 9, "u");
  m.put(176, GROUND - 1, "C");
  // Boss arena: walls on both sides, a heart block in reach, and the flag behind the boss.
  m.wall(180, 181, 12);
  m.row(184, 186, 11, "B");
  m.put(185, 11, "H");
  m.put(190, GROUND - 1, "u");
  m.put(196, GROUND - 1, "X");
  m.wall(207, 208, 8);
  m.put(204, GROUND - 1, "F");
  m.put(182, GROUND - 1, "o");
  m.put(183, GROUND - 1, "o");
  const platforms: PlatformSpec[] = [
    ferry(28, 30, 28),
    ferry(48, 56, 42),
    // Two ferries over the wide gap: hop from one to the other in the middle.
    { x: 93, y: GROUND, width: 3, axis: "x", range: 5, speed: 32 },
    { x: 99, y: GROUND, width: 3, axis: "x", range: 5, speed: 38 },
    ferry(120, 128, 48),
    ferry(150, 152, 26),
    ferry(156, 158, 26),
  ];
  return { rows: m.rows(), platforms };
}

const LEVEL_2 = buildLevel2();
const LEVEL_3 = buildLevel3();
const LEVEL_4 = buildLevel4();

/** Every level in order, ready to play. */
export function allLevels(): Level[] {
  return [
    parseLevel(LEVEL_1, [], "day"),
    parseLevel(LEVEL_2.rows, LEVEL_2.platforms, "sunset"),
    parseLevel(LEVEL_3.rows, LEVEL_3.platforms, "night"),
    parseLevel(LEVEL_4.rows, LEVEL_4.platforms, "storm"),
  ];
}
