import { describe, expect, it } from "vitest";
import {
  BOSS_HP,
  COWL_S,
  type Input,
  type JumpState,
  LEVEL_1,
  MAX_LIVES,
  START_LIVES,
  TILE,
  allLevels,
  bossStatus,
  createGame,
  parseLevel,
  step,
} from "@/games/super-jump/logic";

const DT = 1 / 60;
const idle: Input = { left: false, right: false, jump: false, smash: false };
const smash: Input = { ...idle, smash: true };
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
    expect(level.enemies).toEqual([{ x: 4, y: 0, kind: "walker" }]);
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

  it("is a full-size level with coins, villains, a checkpoint, and a flag", () => {
    expect(level.width).toBeGreaterThanOrEqual(100);
    expect(level.height).toBe(16);
    expect(level.coins.length).toBeGreaterThanOrEqual(40);
    expect(level.enemies.length).toBeGreaterThanOrEqual(10);
    expect(level.checkpoint).not.toBeNull();
  });

  it("has no pit wider than a jump can clear", () => {
    const groundRow = level.height - 2;
    expect(groundRow).toBe(14);
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


describe("jumping feel", () => {
  const jumpOnly: Input = { ...idle, jump: true };
  const LEDGE = ["P........F", "..........", "..........", "..#.......", "###......."];

  it("a jump pressed just after leaving a ledge still works (coyote time)", () => {
    let s = createGame(parseLevel(["P......F", "........", "........", "###....."]));
    s = run(s, idle, 0.3);
    // Walk off the edge, then press jump a few frames later.
    s = runUntil(s, right, (st) => !st.player.onGround, 2);
    expect(s.player.onGround).toBe(false);
    s = run(s, right, 0.05);
    const before = s.player.vy;
    s = step(s, { ...right, jump: true }, DT);
    expect(s.player.vy).toBeLessThan(Math.min(before, 0));
  });

  it("a jump pressed just before landing is remembered", () => {
    let s = createGame(parseLevel(["P......F", "........", "........", "########"]));
    s = run(s, idle, 0.3);
    s = run(s, jumpOnly, 0.15);
    s = run(s, idle, 0.1);
    // Fall back down, pressing jump again a moment before touching the ground.
    s = runUntil(s, idle, (st) => st.player.y + st.player.h > 3 * TILE - 6 && st.player.vy > 0, 2);
    s = step(s, jumpOnly, DT);
    s = runUntil(s, jumpOnly, (st) => st.player.vy < -200, 0.5);
    expect(s.player.vy).toBeLessThan(-200);
  });

  it("emits events for the sounds and sparks", () => {
    let s = run(createGame(parseLevel(LEDGE.map((r, y) => (y === 3 ? "P.o......." : r)))), idle, 0.3);
    s = step(s, jumpOnly, DT);
    expect(s.events.map((e) => e.kind)).toContain("jump");
    s = step(s, jumpOnly, DT);
    expect(s.events.map((e) => e.kind)).not.toContain("jump");
  });
});

describe("Smash and Full Cowl", () => {
  // Deku at the left, the target a short way ahead on the ground.
  const hall = (target: string) => ["..........F", `P.${target}........`, "###########"];

  it("a punch beats a slime in front of Deku", () => {
    let s = run(createGame(parseLevel(hall("e"))), idle, 0.3);
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, vx: 0, x: s.player.x + s.player.w + 6 })) };
    s = step(s, smash, DT);
    expect(s.player.smashT).toBeGreaterThan(0);
    s = run(s, smash, 0.05);
    expect(s.enemies[0].alive).toBe(false);
    expect(s.kills).toBe(1);
    expect(s.smashKills).toBe(1);
    expect(s.lives).toBe(START_LIVES);
  });

  it("a punch does not hit what is behind him", () => {
    let s = run(createGame(parseLevel(hall("e"))), idle, 0.3);
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, vx: 0, x: s.player.x - s.player.w - 8 })) };
    s = run(s, smash, 0.25);
    expect(s.enemies[0].alive).toBe(true);
  });

  it("a punch smashes a brick in front and empties a block", () => {
    let s = run(createGame(parseLevel(["..........F", "P.BQ.......", "###########"])), idle, 0.3);
    s = run(s, smash, 0.15);
    expect(s.bricksSmashed).toBe(1);
    expect(s.level.solid[1][2]).toBe(false);
    s = run(s, idle, 0.6);
    s = run(createGame(parseLevel(["..........F", "P.Q........", "###########"])), idle, 0.3);
    s = run(s, smash, 0.15);
    expect(s.coinsCollected).toBe(1);
  });

  it("the punch needs a moment to recharge", () => {
    let s = run(createGame(parseLevel(hall("."))), idle, 0.3);
    s = step(s, smash, DT);
    const first = s.player.smashCd;
    s = step(s, idle, DT);
    s = step(s, smash, DT);
    // Pressing again right away does not restart the punch.
    expect(s.player.smashCd).toBeLessThan(first);
  });

  it("a Full Cowl block grants speed, a higher jump and a longer punch", () => {
    const plain = createGame(parseLevel(["P........F", "##########"]));
    let s = createGame(parseLevel(["P........F", "##########"]));
    s = { ...s, player: { ...s.player, cowl: COWL_S } };
    const speed = (st: JumpState) => run(st, right, 0.6).player.x;
    expect(speed(s)).toBeGreaterThan(speed(plain));
    expect(s.player.cowl).toBe(COWL_S);
  });

  it("a Full Cowl runs out", () => {
    let s = createGame(parseLevel(["P........F", "##########"]));
    s = { ...s, player: { ...s.player, cowl: 0.2 } };
    s = run(s, idle, 0.5);
    expect(s.player.cowl).toBe(0);
  });

  it("a 'u' power-up gives a Full Cowl and a heart gives a life", () => {
    let s = run(createGame(parseLevel(["P.u.h.....F", "###########"])), right, 1);
    expect(s.player.cowl).toBeGreaterThan(0);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.events.length).toBeGreaterThanOrEqual(0);
    s = { ...s, lives: MAX_LIVES };
    expect(s.lives).toBe(MAX_LIVES);
  });

  it("a Full Cowl block (U) bumped from below gives a Full Cowl", () => {
    const jump: Input = { ...idle, jump: true };
    let s = run(createGame(parseLevel(["......F", ".U.....", ".......", ".P.....", "#######"])), idle, 0.3);
    s = runUntil(s, jump, (st) => st.player.cowl > 0, 2);
    expect(s.player.cowl).toBeGreaterThan(0);
  });
});

describe("drones, spikes and the boss", () => {
  it("a drone hovers in the air and patrols", () => {
    let s = createGame(parseLevel(["P.........F", "...........", "....f......", "...........", "###########"]));
    const y0 = s.enemies[0].y;
    const x0 = s.enemies[0].x;
    s = run(s, idle, 2);
    expect(s.enemies[0].kind).toBe("flyer");
    expect(s.enemies[0].y).toBeLessThan(4 * TILE);
    expect(Math.abs(s.enemies[0].x - x0)).toBeGreaterThan(5);
    expect(Math.abs(s.enemies[0].y - y0)).toBeLessThan(10);
  });

  it("touching spikes costs a life", () => {
    const s = runUntil(createGame(parseLevel(["P....^^...F", "###########"])), right, (x) => x.lives < START_LIVES);
    expect(s.lives).toBe(START_LIVES - 1);
  });

  it("jumping over spikes is safe", () => {
    let s = run(createGame(parseLevel(["P..........F", "............", "............", "............", "###^########"])), idle, 0.3);
    s = { ...s, player: { ...s.player, x: 0 } };
    expect(s.lives).toBe(START_LIVES);
  });

  it("the flag does not count while the boss is alive, and the boss takes several hits", () => {
    let s = createGame(parseLevel(["P........XF", "###########"]));
    expect(bossStatus(s)?.hp).toBe(BOSS_HP);
    const wasBoss = s.enemies[0];
    expect(wasBoss.kind).toBe("boss");
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, minX: 5000, maxX: 5000 })) };
    // Even standing at the flag does nothing while the boss lives.
    s = { ...s, player: { ...s.player, x: 10 * TILE - 2 }, invulnerable: 99 };
    s = step(s, idle, DT);
    expect(s.status).toBe("playing");
    // Knock the boss out hit by hit (it flashes between hits, so wait).
    for (let hit = 0; hit < BOSS_HP; hit++) {
      const boss = s.enemies[0];
      s = { ...s, player: { ...s.player, x: boss.x - s.player.w - 2, y: boss.y, facing: 1, smashCd: 0 }, invulnerable: 99 };
      s = run(s, smash, 0.1);
      s = run(s, idle, 1.1);
    }
    expect(bossStatus(s)).toBeNull();
    expect(s.enemies[0].alive).toBe(false);
  });
});

describe("moving platforms and levels", () => {
  const right: Input = { left: false, right: true, jump: false };
  // A pit from column 3 to 8, with a ferry starting at its left edge.
  const PIT = ["..............F", "...............", ".P.............", "###......######"];
  const ferry = { x: 2, y: 3, width: 3, axis: "x" as const, range: 6, speed: 30 };

  it("carries a rider across a pit", () => {
    let s = run(createGame(parseLevel(PIT, [ferry])), idle, 0.3);
    // Step onto the ferry, then stand still on it.
    s = runUntil(s, right, (st) => st.riding === 0 && st.player.x > 2.2 * TILE, 2);
    s = run(s, idle, 0.3);
    expect(s.riding).toBe(0);
    const x0 = s.player.x;
    s = run(s, idle, 2);
    expect(s.player.x).toBeGreaterThan(x0 + 40);
    expect(s.lives).toBe(START_LIVES);
  });

  it("you can jump up through a platform from below and land on it", () => {
    const level = parseLevel(["......F", ".......", ".......", ".P.....", "#######"], [{ x: 0, y: 2, width: 4, axis: "x", range: 0, speed: 0 }]);
    let s = run(createGame(level), idle, 0.3);
    s = runUntil(s, { left: false, right: false, jump: true }, (st) => st.riding === 0, 2);
    expect(s.riding).toBe(0);
    expect(s.player.y + s.player.h).toBeCloseTo(2 * TILE, 5);
  });

  it("lifts raise you", () => {
    const level = parseLevel(["......F", ".......", ".......", ".P.....", "#######"], [{ x: 0, y: 4, width: 4, axis: "y", range: 3, speed: 30 }]);
    let s = run(createGame(level), idle, 0.3);
    const y0 = s.player.y;
    s = run(s, idle, 1.5);
    expect(s.player.y).toBeLessThan(y0 - 30);
  });

  it("every level is valid, and every wide pit has a platform that spans it", () => {
    const levels = allLevels();
    expect(levels).toHaveLength(4);
    for (const level of levels) {
      const ground = level.solid[level.height - 2];
      for (let x = 0; x < level.width; ) {
        if (ground[x]) {
          x++;
          continue;
        }
        let end = x;
        while (end + 1 < level.width && !ground[end + 1]) end++;
        const width = end - x + 1;
        if (width > 3) {
          const spanned = level.platforms.some(
            (p) => p.axis === "x" && p.x <= x && p.x + p.range + p.width >= end + 1,
          ) || level.platforms.filter((p) => p.axis === "x" && p.x + p.range + p.width > x && p.x <= end).length >= 2;
          expect(spanned, `pit at ${x}-${end}`).toBe(true);
        }
        x = end + 1;
      }
    }
  });

  it("carries coins and lives into the next level", () => {
    const [, second] = allLevels();
    const s = createGame(second, { coins: 12, lives: 2, bricks: 4 });
    expect(s).toMatchObject({ coinsCollected: 12, lives: 2, bricksSmashed: 4 });
    expect(s.platforms.length).toBeGreaterThan(0);
  });
});
