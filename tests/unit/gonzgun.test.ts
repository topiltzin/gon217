import { describe, expect, it } from "vitest";
import { CpuBrain, pathDirection } from "@/games/gonzgun/ai";
import {
  NO_INPUT,
  OBSTACLES,
  PICKUP_SPOTS,
  RULES,
  SPAWNS,
  createGame,
  lineOfSight,
  pointBlocked,
  soloScore,
  step,
  type GonzState,
  type Input,
} from "@/games/gonzgun/logic";

const DT = 1 / 60;

/** Deterministic pseudo-random numbers. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const run = (s: GonzState, inputs: [Input, Input], seconds: number, rng = () => 0.5) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(s, inputs, DT, rng);
  return s;
};

/** Puts the two fighters facing each other on an open row. */
function duel(distance = 6): GonzState {
  const s = createGame();
  const [a, b] = s.fighters;
  Object.assign(a, { x: -distance / 2, z: 1.8, aim: 0, invulnerable: 0 });
  Object.assign(b, { x: distance / 2, z: 1.8, aim: Math.PI, invulnerable: 0 });
  return s;
}

const fire: Input = { ...NO_INPUT, fire: true };

describe("Gonzgun arena", () => {
  it("keeps spawns and pickup spots out of the furniture", () => {
    for (const p of [...SPAWNS, ...PICKUP_SPOTS]) expect(pointBlocked(p.x, p.z, RULES.radius)).toBe(false);
  });

  it("obstacles block line of sight", () => {
    const pillar = OBSTACLES.find((o) => o.kind === "pillar")!;
    expect(lineOfSight(pillar.x - 3, pillar.z, pillar.x + 3, pillar.z)).toBe(false);
    expect(lineOfSight(-4, 1.8, 4, 1.8)).toBe(true);
  });

  it("finds a way around obstacles", () => {
    const crate = OBSTACLES.find((o) => o.kind === "crate" && o.x === 0)!;
    const dir = pathDirection(crate.x, crate.z - 1.2, crate.x, crate.z + 1.6)!;
    expect(dir).not.toBeNull();
    expect(Math.abs(dir.x)).toBeGreaterThan(0.3);
  });
});

describe("Gonzgun rules", () => {
  it("walks with the stick and can't walk through walls", () => {
    const s = createGame();
    const x0 = s.fighters[0].x;
    run(s, [{ ...NO_INPUT, mx: 1 }, NO_INPUT], 0.5);
    expect(s.fighters[0].x).toBeCloseTo(x0 + RULES.speed * 0.5, 1);
    run(s, [{ ...NO_INPUT, mx: -1 }, NO_INPUT], 5);
    expect(s.fighters[0].x).toBeCloseTo(-10 + RULES.radius, 5);
  });

  it("a small push turns without walking", () => {
    const s = createGame();
    const { x, z } = s.fighters[0];
    run(s, [{ ...NO_INPUT, mz: 0.2 }, NO_INPUT], 0.5);
    expect(s.fighters[0].x).toBe(x);
    expect(s.fighters[0].z).toBe(z);
    expect(s.fighters[0].aim).toBeCloseTo(Math.PI / 2, 5);
  });

  it("a shot travels, hits, and takes damage", () => {
    const s = duel();
    step(s, [fire, NO_INPUT], DT, () => 0.5);
    expect(s.events.some((e) => e.type === "shot")).toBe(true);
    expect(s.bullets).toHaveLength(1);
    run(s, [NO_INPUT, NO_INPUT], 0.5);
    expect(s.fighters[1].hp).toBe(RULES.maxHp - RULES.damage);
    expect(s.bullets).toHaveLength(0);
  });

  it("aim assist bends a nearly-aimed shot onto the opponent", () => {
    const s = duel();
    s.fighters[0].aim = (15 * Math.PI) / 180;
    step(s, [fire, NO_INPUT], DT, () => 0.5);
    run(s, [NO_INPUT, NO_INPUT], 0.5);
    expect(s.fighters[1].hp).toBeLessThan(RULES.maxHp);
  });

  it("the spawn shield and a dash make you untouchable", () => {
    const s = duel();
    s.fighters[1].invulnerable = 1;
    step(s, [fire, NO_INPUT], DT, () => 0.5);
    run(s, [NO_INPUT, NO_INPUT], 0.4);
    expect(s.fighters[1].hp).toBe(RULES.maxHp);

    const d = duel(8);
    step(d, [fire, NO_INPUT], DT, () => 0.5);
    run(d, [NO_INPUT, NO_INPUT], 0.2);
    step(d, [NO_INPUT, { ...NO_INPUT, mz: -1, dash: true }], DT, () => 0.5);
    expect(d.events).toContainEqual({ type: "dash", fighter: 1 });
    run(d, [NO_INPUT, NO_INPUT], 0.5);
    expect(d.fighters[1].hp).toBe(RULES.maxHp);
  });

  it("five hits knock out, then the fighter respawns with full health", () => {
    const s = duel(3);
    const hitsToKo = RULES.maxHp / RULES.damage;
    let ko = false;
    for (let i = 0; i < 600 && !ko; i++) {
      step(s, [fire, NO_INPUT], DT, () => 0.5);
      ko = s.events.some((e) => e.type === "ko");
    }
    expect(ko).toBe(true);
    expect(s.hits[0]).toBe(hitsToKo);
    expect(s.fighters[0].kos).toBe(1);
    expect(s.fighters[1].alive).toBe(false);
    run(s, [NO_INPUT, NO_INPUT], RULES.respawnDelay + 0.1);
    expect(s.fighters[1]).toMatchObject({ alive: true, hp: RULES.maxHp, kos: 0 });
    expect(s.fighters[1].invulnerable).toBeGreaterThan(0);
  });

  it("the first to five KOs wins", () => {
    const s = duel(3);
    s.fighters[0].kos = RULES.kosToWin - 1;
    s.fighters[1].hp = RULES.damage;
    step(s, [fire, NO_INPUT], DT, () => 0.5);
    run(s, [NO_INPUT, NO_INPUT], 0.3);
    expect(s.status).toBe("over");
    expect(s.winner).toBe(0);
    expect(soloScore(s)).toBe(RULES.kosToWin * 100 + 300 + 200);
  });

  it("pickups heal and give triple shot", () => {
    const s = duel();
    s.fighters[0].hp = 30;
    const { x, z } = s.fighters[0];
    s.pickups = [
      { id: 90, kind: "health", x, z },
      { id: 91, kind: "triple", x, z },
    ];
    step(s, [NO_INPUT, NO_INPUT], DT, () => 0.5);
    expect(s.fighters[0].hp).toBe(30 + RULES.healthPack);
    expect(s.fighters[0].triple).toBeGreaterThan(0);
    expect(s.pickups).toHaveLength(0);
    step(s, [fire, NO_INPUT], DT, () => 0.5);
    expect(s.bullets).toHaveLength(3);
  });

  it("spawns pickups over time, at most two at once", () => {
    const s = createGame();
    run(s, [NO_INPUT, NO_INPUT], RULES.pickupEvery * 4, seeded(3));
    expect(s.pickups.length).toBe(RULES.maxPickups);
  });
});

describe("Gonzgun CPU", () => {
  it("hunts you down around the furniture and scores knockouts", () => {
    const s = createGame();
    const rng = seeded(7);
    const brain = new CpuBrain(1, rng);
    for (let i = 0; i < 60 * 60 && s.fighters[1].kos === 0; i++) step(s, [NO_INPUT, brain.input(s, DT)], DT, rng);
    expect(s.fighters[1].kos).toBeGreaterThan(0);
  });

  it("two CPUs finish a match", () => {
    const s = createGame();
    const rng = seeded(11);
    const a = new CpuBrain(0, rng);
    const b = new CpuBrain(1, rng);
    for (let i = 0; i < 60 * 60 * 5 && s.status === "playing"; i++) step(s, [a.input(s, DT), b.input(s, DT)], DT, rng);
    expect(s.status).toBe("over");
    expect(s.fighters[s.winner!].kos).toBe(RULES.kosToWin);
  });
});
