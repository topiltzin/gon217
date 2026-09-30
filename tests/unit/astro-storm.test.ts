import { describe, expect, it } from "vitest";
import {
  ASTEROID_POINTS,
  DRONE_POINTS,
  FIELD,
  MAX_LIVES,
  NO_INPUT,
  RULES,
  START_LIVES,
  createGame,
  segmentDistance,
  step,
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

const DT = 1 / 60;
const run = (s: AstroState, input: Input, seconds: number, rng: Rng = seeded()) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(s, input, DT, rng);
  return s;
};

/** A quiet sky: nothing spawns unless a test adds it. */
function calm(): AstroState {
  return { ...createGame(), toSpawn: 0, spawnIn: 999, ringIn: 999, droneIn: 999, waveBreak: 999 };
}

const rock = (s: AstroState, x: number, y: number, z: number, size: 1 | 2 | 3 = 3, vz = 0) =>
  s.asteroids.push({ id: s.nextId++, x, y, z, vx: 0, vy: 0, vz, size, hp: size });

describe("Astro Storm 3D", () => {
  it("starts in the middle with full lives at wave 1", () => {
    const s = createGame();
    expect(s.lives).toBe(START_LIVES);
    expect(s.wave).toBe(1);
    expect(s.ship).toMatchObject({ x: 0, y: 0 });
    expect(s.toSpawn).toBeGreaterThan(0);
  });

  it("steers within the flight window", () => {
    const s = run(calm(), { ...NO_INPUT, x: 1, y: 1 }, 3);
    expect(s.ship.x).toBe(FIELD.x);
    expect(s.ship.y).toBe(FIELD.y);
  });

  it("measures distance to a segment", () => {
    expect(segmentDistance(0, 0, 0, 0, 0, -10, 1, 0, -5)).toBeCloseTo(1);
    expect(segmentDistance(0, 0, 0, 0, 0, -10, 0, 0, 5)).toBeCloseTo(5);
  });

  it("fires twin lasers that break a big rock into two smaller ones", () => {
    const s = calm();
    rock(s, 0, 0, -60);
    step(s, { ...NO_INPUT, fire: true }, DT, seeded());
    expect(s.lasers).toHaveLength(2);
    expect(s.events).toContainEqual({ type: "shot", x: 0, y: 0 });
    run(s, { ...NO_INPUT, fire: true }, 1);
    expect(s.score).toBeGreaterThanOrEqual(ASTEROID_POINTS[3]);
    expect(s.asteroids.every((a) => a.size < 3)).toBe(true);
  });

  it("small rocks are worth the most", () => {
    const s = calm();
    rock(s, 0, 0, -40, 1);
    run(s, { ...NO_INPUT, fire: true }, 0.5);
    expect(s.score).toBe(ASTEROID_POINTS[1]);
    expect(s.asteroids).toHaveLength(0);
  });

  it("a rock hitting the ship costs a life, then the shield protects", () => {
    const s = calm();
    rock(s, 0, 0, -20, 3, 40);
    run(s, NO_INPUT, 1);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.ship.invulnerable).toBeGreaterThan(0);
    rock(s, s.ship.x, s.ship.y, -10, 3, 40);
    run(s, NO_INPUT, 0.5);
    expect(s.lives).toBe(START_LIVES - 1);
  });

  it("a barrel roll dodges sideways and smashes rocks for points", () => {
    const s = calm();
    step(s, { ...NO_INPUT, x: 1, roll: true }, DT, seeded());
    expect(s.events).toContainEqual({ type: "roll", dir: 1 });
    rock(s, s.ship.x + 1, 0, -3, 1, 40);
    run(s, NO_INPUT, 0.2);
    expect(s.lives).toBe(START_LIVES);
    expect(s.score).toBe(ASTEROID_POINTS[1]);
    expect(s.ship.x).toBeGreaterThan(2);
  });

  it("gold rings give triple shot and blue rings a life", () => {
    const s = calm();
    s.rings.push({ id: 90, x: 0, y: 0, z: -5, kind: "triple" }, { id: 91, x: 0, y: 0, z: -8, kind: "life" });
    run(s, NO_INPUT, 0.5);
    expect(s.ship.triple).toBeGreaterThan(0);
    expect(s.lives).toBe(START_LIVES + 1);
    step(s, { ...NO_INPUT, fire: true }, DT, seeded());
    expect(s.lasers).toHaveLength(4);
    s.lives = MAX_LIVES;
    s.rings.push({ id: 92, x: 0, y: 0, z: -5, kind: "life" });
    run(s, NO_INPUT, 0.5);
    expect(s.lives).toBe(MAX_LIVES);
  });

  it("drones hover, shoot plasma at the ship, and can be shot down", () => {
    const s = calm();
    s.drones.push({ id: 80, x: 0, y: 0, z: -50, baseX: 0, phase: 0, hp: 2, hover: RULES.droneHover, fireIn: 0.1 });
    run(s, NO_INPUT, 0.3);
    expect(s.plasma.length).toBeGreaterThan(0);
    // Hold the drone still in front of the guns (it normally weaves).
    for (let i = 0; i < 120 && s.drones.length; i++) {
      s.drones[0].phase = -DT * 1.6;
      step(s, { ...NO_INPUT, fire: true }, DT, seeded());
    }
    expect(s.drones).toHaveLength(0);
    expect(s.score).toBe(DRONE_POINTS);
  });

  it("losing every life ends the game", () => {
    const s = calm();
    s.lives = 1;
    rock(s, 0, 0, -10, 3, 40);
    run(s, NO_INPUT, 1);
    expect(s.status).toBe("over");
  });

  it("clears a wave and starts a faster one", () => {
    const s = createGame();
    const rng = seeded(4);
    const speed = s.speed;
    // Dodge nothing, just survive: the rocks fly past and the wave ends.
    for (let i = 0; i < 60 * 120 && s.wave === 1; i++) {
      s.ship.invulnerable = 1;
      step(s, NO_INPUT, DT, rng);
    }
    expect(s.wave).toBe(2);
    expect(s.speed).toBeGreaterThan(speed);
  });
});
