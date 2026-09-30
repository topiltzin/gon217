import { describe, expect, it } from "vitest";
import {
  type Input,
  type JumpState,
  LEVEL_1,
  START_LIVES,
  TILE,
  createGame,
  parseLevel,
  step,
} from "@/games/super-jump/logic";

const DT = 1 / 60;
const idle: Input = { left: false, right: false, jump: false };
const right: Input = { left: false, right: true, jump: false };

function run(state: JumpState, input: Input, seconds: number): JumpState {
  for (let t = 0; t < seconds; t += DT) state = step(state, input, DT);
  return state;
}

/** Steps until `done` is true (or the time limit passes) and returns that state. */
function runUntil(state: JumpState, input: Input, done: (s: JumpState) => boolean, seconds = 5): JumpState {
  for (let t = 0; t < seconds && !done(state); t += DT) state = step(state, input, DT);
  return state;
}

// Flat ground on the bottom row, start on the left, flag far right.
const FLAT = ["P..........F", "############"];

describe("parseLevel", () => {
  it("reads start, flag, coins, enemies, checkpoint, and solid tiles", () => {
    const level = parseLevel(["P.o.e..C..F.", "#####B######"]);
    expect(level.width).toBe(12);
    expect(level.height).toBe(2);
    expect(level.start).toEqual({ x: 0, y: 0 });
    expect(level.coins).toEqual([{ x: 2, y: 0 }]);
    expect(level.enemies).toEqual([{ x: 4, y: 0 }]);
    expect(level.checkpoint).toEqual({ x: 7, y: 0 });
    expect(level.flag).toEqual({ x: 10, y: 0 });
    expect(level.solid[1][5]).toBe(true);
    expect(level.solid[0][5]).toBe(false);
  });

  it("rejects levels without a start or flag, or with ragged rows", () => {
    expect(() => parseLevel(["....F", "#####"])).toThrow(/start/i);
    expect(() => parseLevel(["P....", "#####"])).toThrow(/flag/i);
    expect(() => parseLevel(["P..F", "#####"])).toThrow(/same length/i);
  });
});

describe("movement", () => {
  it("falls onto the ground and stands still", () => {
    const s = run(createGame(parseLevel(["P....F", "......", "......", "######"])), idle, 1);
    expect(s.player.onGround).toBe(true);
    expect(s.player.y + s.player.h).toBeCloseTo(3 * TILE, 5);
    expect(s.player.vx).toBe(0);
  });

  it("runs right when right is held", () => {
    const start = createGame(parseLevel(FLAT));
    const s = run(start, right, 0.5);
    expect(s.player.x).toBeGreaterThan(start.player.x + 20);
    expect(s.player.facing).toBe(1);
  });

  it("stops at walls", () => {
    const s = run(createGame(parseLevel(["......", "P.#..F", "######"])), right, 1);
    expect(s.player.x + s.player.w).toBeLessThanOrEqual(2 * TILE + 0.001);
  });

  it("cannot walk off the left edge", () => {
    const s = run(createGame(parseLevel(FLAT)), { ...idle, left: true }, 1);
    expect(s.player.x).toBeGreaterThanOrEqual(0);
    expect(s.player.facing).toBe(-1);
  });

  it("jumps once per press and lands again", () => {
    let s = run(createGame(parseLevel(["P..........F", "............", "............", "############"])), idle, 0.5);
    const groundY = s.player.y;
    s = step(s, { ...idle, jump: true }, DT);
    expect(s.player.vy).toBeLessThan(0);
    s = run(s, { ...idle, jump: true }, 0.25);
    expect(s.player.y).toBeLessThan(groundY - 2 * TILE);
    // Holding jump does not bounce again after landing.
    s = run(s, { ...idle, jump: true }, 1.5);
    expect(s.player.onGround).toBe(true);
    expect(s.player.y).toBeCloseTo(groundY, 5);
  });

  it("releasing jump early makes a shorter hop", () => {
    const base = run(createGame(parseLevel(["P..........F", "............", "............", "############"])), idle, 0.5);
    const peak = (hold: number) => {
      let s = base;
      let top = s.player.y;
      for (let t = 0; t < 1; t += DT) {
        s = step(s, { ...idle, jump: t < hold }, DT);
        top = Math.min(top, s.player.y);
      }
      return top;
    };
    expect(peak(0.05)).toBeGreaterThan(peak(0.5));
  });
});

describe("pickups, enemies, and goals", () => {
  it("collects coins by touching them", () => {
    const s = run(createGame(parseLevel(["P.oo.....F", "##########"])), right, 1);
    expect(s.coins.filter((c) => c.taken)).toHaveLength(2);
    expect(s.coinsCollected).toBe(2);
  });

  it("walking into a slime costs a life and respawns at the start", () => {
    const s = runUntil(createGame(parseLevel(["P....e.....F", "############"])), right, (x) => x.lives < START_LIVES);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.player.x).toBeLessThan(TILE);
    expect(s.invulnerable).toBeGreaterThan(0);
  });

  it("landing on a slime squashes it and bounces", () => {
    let s = createGame(parseLevel(["P.......F", ".........", "..e......", "#########"]));
    s = { ...s, player: { ...s.player, x: s.enemies[0].x, y: s.enemies[0].y - 3 * TILE } };
    s = runUntil(s, idle, (x) => !x.enemies[0].alive, 2);
    expect(s.enemies[0].alive).toBe(false);
    expect(s.player.vy).toBeLessThan(0);
    expect(s.lives).toBe(START_LIVES);
  });

  it("slimes turn around at walls", () => {
    const s = createGame(parseLevel(["P.......F", "#.e.#....", "#########"]));
    const vx0 = s.enemies[0].vx;
    const turned = runUntil(s, idle, (x) => Math.sign(x.enemies[0].vx) !== Math.sign(vx0), 4);
    expect(Math.sign(turned.enemies[0].vx)).not.toBe(Math.sign(vx0));
    expect(turned.enemies[0].x).toBeGreaterThanOrEqual(TILE);
  });

  it("slimes turn around at ledges instead of walking off", () => {
    const s = createGame(parseLevel(["P.........F", "...........", "....e......", "...###.....", "###########"]));
    const turned = runUntil(s, idle, (x) => x.enemies[0].vx > 0, 4);
    expect(turned.enemies[0].vx).toBeGreaterThan(0);
    expect(turned.enemies[0].y).toBeLessThan(3 * TILE);
  });

  it("falling into a pit costs a life", () => {
    const s = runUntil(createGame(parseLevel(["P.........F", "###....####"])), right, (x) => x.lives < START_LIVES);
    expect(s.lives).toBe(START_LIVES - 1);
  });

  it("respawns at a reached checkpoint", () => {
    let s = createGame(parseLevel(["P.C..........F", "######....####"]));
    s = runUntil(s, right, (x) => x.checkpointReached, 2);
    expect(s.checkpointReached).toBe(true);
    s = runUntil(s, right, (x) => x.lives < START_LIVES);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.player.x).toBeGreaterThanOrEqual(2 * TILE - 8);
    expect(s.player.x).toBeLessThan(3 * TILE);
  });

  it("losing every life ends the game", () => {
    const s = run(createGame(parseLevel(["P.....F", "#......"])), right, 12);
    expect(s.lives).toBe(0);
    expect(s.status).toBe("lost");
    expect(step(s, right, DT)).toBe(s);
  });

  it("touching the flag wins", () => {
    const s = run(createGame(parseLevel(["P...F", "#####"])), right, 2);
    expect(s.status).toBe("won");
  });
});

describe("level 1", () => {
  const level = parseLevel(LEVEL_1);

  it("is a full-size level with coins, slimes, a checkpoint, and a flag", () => {
    expect(level.width).toBeGreaterThanOrEqual(100);
    expect(level.height).toBe(12);
    expect(level.coins.length).toBeGreaterThanOrEqual(25);
    expect(level.enemies.length).toBeGreaterThanOrEqual(6);
    expect(level.checkpoint).not.toBeNull();
  });

  it("has no pit wider than a jump can clear", () => {
    const groundRow = level.height - 2;
    let gap = 0;
    for (let x = 0; x < level.width; x++) {
      gap = level.solid[groundRow][x] ? 0 : gap + 1;
      expect(gap).toBeLessThanOrEqual(3);
    }
  });
});

describe("bricks and question blocks", () => {
  const jump: Input = { left: false, right: false, jump: true };
  // The player starts right under a brick (x=1) next to a question block (x=3).
  const ROOM = ["......F", ".B.Q...", ".......", ".P.....", "#######"];

  it("smashes a brick with a head bump", () => {
    const s = runUntil(run(createGame(parseLevel(ROOM)), idle, 0.3), jump, (st) => st.bricksSmashed > 0, 2);
    expect(s.bricksSmashed).toBe(1);
    expect(s.level.solid[1][1]).toBe(false);
    expect(s.level.bricks).toHaveLength(0);
    expect(s.effects).toContainEqual(expect.objectContaining({ kind: "smash", x: 1, y: 1 }));
  });

  it("a question block gives one coin, then is used up", () => {
    let s = run(createGame(parseLevel(ROOM.map((r, y) => (y === 3 ? "...P..." : r)))), idle, 0.3);
    s = runUntil(s, jump, (st) => st.coinsCollected > 0, 2);
    expect(s.coinsCollected).toBe(1);
    expect(s.usedBlocks).toEqual(["3,1"]);
    expect(s.level.solid[1][3]).toBe(true);
    s = run(s, idle, 1);
    s = run(s, jump, 1);
    expect(s.coinsCollected).toBe(1);
  });

  it("knocks out a slime standing on the bumped brick", () => {
    const level = parseLevel(["......F", ".e.....", ".B.....", ".......", ".P.....", "#######"]);
    let s = run(createGame(level), idle, 0.3);
    expect(s.enemies[0].alive).toBe(true);
    s = runUntil(s, jump, (st) => st.bricksSmashed > 0, 2);
    expect(s.enemies[0].alive).toBe(false);
  });

  it("level 1 has question blocks", () => {
    expect(parseLevel(LEVEL_1).questions.length).toBeGreaterThan(3);
  });
});

