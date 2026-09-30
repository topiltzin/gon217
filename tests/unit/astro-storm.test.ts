import { describe, expect, it } from "vitest";
import {
  ASTEROID_POINTS,
  ASTEROID_RADIUS,
  FIELD_H,
  FIELD_W,
  START_LIVES,
  createGame,
  distance,
  makeAsteroid,
  step,
  wrap,
  type AstroState,
  type Input,
  type Rng,
} from "@/games/astro-storm/logic";

/** Deterministic RNG so every run is the same. */
function seeded(seed = 1): Rng {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const idle: Input = { left: false, right: false, thrust: false, fire: false };
const run = (state: AstroState, input: Input, seconds: number, rng: Rng) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(state, input, 1 / 60, rng);
  return state;
};

describe("Astro Storm", () => {
  it("starts with lives, wave 1, and large asteroids away from the ship", () => {
    const s = createGame(seeded());
    expect(s.lives).toBe(START_LIVES);
    expect(s.wave).toBe(1);
    expect(s.asteroids.length).toBe(4);
    for (const r of s.asteroids) {
      expect(r.size).toBe(3);
      expect(distance(r.x, r.y, s.ship.x, s.ship.y)).toBeGreaterThanOrEqual(190);
    }
  });

  it("wraps around the edges, and measures distance across them", () => {
    expect(wrap(-10, FIELD_W)).toBe(FIELD_W - 10);
    expect(wrap(FIELD_H + 5, FIELD_H)).toBe(5);
    expect(distance(5, 100, FIELD_W - 5, 100)).toBe(10);
  });

  it("turns, thrusts, and slows down by itself", () => {
    const rng = seeded();
    const s = createGame(rng);
    s.asteroids = [];
    s.nextWave = 99;
    const angle = s.ship.angle;
    run(s, { ...idle, right: true }, 0.5, rng);
    expect(s.ship.angle).toBeGreaterThan(angle);
    run(s, { ...idle, thrust: true }, 0.5, rng);
    const fast = Math.hypot(s.ship.vx, s.ship.vy);
    expect(fast).toBeGreaterThan(100);
    run(s, idle, 2, rng);
    expect(Math.hypot(s.ship.vx, s.ship.vy)).toBeLessThan(fast / 2);
  });

  it("fires at a limited rate, and bullets expire", () => {
    const rng = seeded();
    const s = createGame(rng);
    s.asteroids = [];
    s.nextWave = 99;
    let shots = 0;
    for (let i = 0; i < 60; i++) {
      step(s, { ...idle, fire: true }, 1 / 60, rng);
      shots += s.events.filter((e) => e.type === "shot").length;
    }
    expect(shots).toBeGreaterThanOrEqual(5);
    expect(shots).toBeLessThanOrEqual(7);
    expect(s.bullets.length).toBeGreaterThan(0);
    run(s, idle, 1, rng);
    expect(s.bullets.length).toBe(0);
  });

  it("a hit splits a big asteroid into two medium ones and scores", () => {
    const rng = seeded();
    const s = createGame(rng);
    const rock = makeAsteroid(rng, 3, s.ship.x + 120, s.ship.y, 0);
    rock.vx = rock.vy = 0;
    s.asteroids = [rock];
    s.ship.angle = 0; // facing the rock
    run(s, { ...idle, fire: true }, 0.4, rng);
    expect(s.score).toBeGreaterThanOrEqual(ASTEROID_POINTS[3]);
    expect(s.asteroids.filter((r) => r.size === 2).length).toBeGreaterThanOrEqual(1);
    expect(s.asteroids.some((r) => r.size === 3)).toBe(false);
  });

  it("small asteroids just vanish", () => {
    const rng = seeded();
    const s = createGame(rng);
    const rock = makeAsteroid(rng, 1, s.ship.x + 80, s.ship.y, 0);
    rock.vx = rock.vy = 0;
    s.asteroids = [rock, makeAsteroid(rng, 3, 20, 20, 0)];
    s.ship.angle = 0;
    run(s, { ...idle, fire: true }, 0.3, rng);
    expect(s.score).toBe(ASTEROID_POINTS[1]);
    expect(s.asteroids.every((r) => r.size === 3)).toBe(true);
  });

  it("the respawn shield protects the ship, then a collision costs a life", () => {
    const rng = seeded();
    const s = createGame(rng);
    const rock = makeAsteroid(rng, 3, s.ship.x, s.ship.y, 0);
    rock.vx = rock.vy = 0;
    s.asteroids = [rock];
    step(s, idle, 1 / 60, rng);
    expect(s.lives).toBe(START_LIVES); // still shielded
    s.ship.shield = 0;
    step(s, idle, 1 / 60, rng);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.ship.alive).toBe(false);
    expect(s.events.some((e) => e.type === "shipHit")).toBe(true);
    s.asteroids = [makeAsteroid(rng, 3, 20, 20, 0)];
    run(s, idle, 2, rng);
    expect(s.ship.alive).toBe(true);
    expect(s.ship.shield).toBeGreaterThan(0);
  });

  it("losing the last ship ends the game", () => {
    const rng = seeded();
    const s = createGame(rng);
    s.lives = 1;
    s.ship.shield = 0;
    const rock = makeAsteroid(rng, 2, s.ship.x, s.ship.y, 0);
    s.asteroids = [rock];
    step(s, idle, 1 / 60, rng);
    expect(s.status).toBe("lost");
    const frozen = s.score;
    run(s, { ...idle, fire: true }, 1, rng);
    expect(s.score).toBe(frozen);
  });

  it("clearing the field starts a bigger, faster wave after a short pause", () => {
    const rng = seeded();
    const s = createGame(rng);
    const firstSpeed = Math.max(...s.asteroids.map((r) => Math.hypot(r.vx, r.vy)));
    s.asteroids = [];
    run(s, idle, 1, rng);
    expect(s.wave).toBe(1);
    run(s, idle, 1, rng);
    expect(s.wave).toBe(2);
    expect(s.asteroids.length).toBe(5);
    expect(s.asteroids.every((r) => r.size === 3)).toBe(true);
    expect(Math.max(...s.asteroids.map((r) => Math.hypot(r.vx, r.vy)))).toBeGreaterThan(firstSpeed * 0.8);
  });

  it("collision radii get smaller with size", () => {
    expect(ASTEROID_RADIUS[3]).toBeGreaterThan(ASTEROID_RADIUS[2]);
    expect(ASTEROID_RADIUS[2]).toBeGreaterThan(ASTEROID_RADIUS[1]);
  });
});
