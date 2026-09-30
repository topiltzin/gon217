import { describe, expect, it } from "vitest";
import {
  COLS,
  type GardenState,
  PLANTS,
  ROWS,
  START_HEARTS,
  START_SUN,
  SUN_LIFETIME,
  canPlace,
  collect,
  collectAll,
  createGame,
  makeSchedule,
  place,
  step,
  wave,
} from "@/games/garden-guard/logic";

const DT = 1 / 30;
const rng = () => 0.5;

function run(state: GardenState, seconds: number): GardenState {
  for (let t = 0; t < seconds; t += DT) state = step(state, DT);
  return state;
}

/** A game whose snails all come down one row at the given times. */
function withSchedule(times: number[], row = 2, big = false, fast = false): GardenState {
  return { ...createGame(rng), schedule: times.map((at) => ({ at, row, big, fast })) };
}

/** The same, with every lawn mower already used up. */
function noMowers(state: GardenState): GardenState {
  return { ...state, mowers: state.mowers.map((m) => ({ ...m, state: "used" as const })) };
}

describe("setup", () => {
  it("starts with an empty garden, some sunshine, and full hearts", () => {
    const s = createGame(rng);
    expect(s.plants).toHaveLength(ROWS);
    expect(s.plants.every((r) => r.length === COLS && r.every((p) => p === null))).toBe(true);
    expect(s.sun).toBe(START_SUN);
    expect(s.hearts).toBe(START_HEARTS);
    expect(s.status).toBe("playing");
  });

  it("schedules 18 snails in three waves, getting faster, with big snails at the end", () => {
    const schedule = makeSchedule(Math.random);
    expect(schedule).toHaveLength(18);
    expect(schedule.every((s) => s.row >= 0 && s.row < ROWS)).toBe(true);
    const gaps = schedule.slice(1).map((s, i) => s.at - schedule[i].at);
    expect(gaps[0]).toBeGreaterThan(gaps[gaps.length - 1]);
    expect(schedule.slice(0, 11).some((s) => s.big)).toBe(false);
    expect(schedule.slice(11).some((s) => s.big)).toBe(true);
    expect(schedule.slice(0, 5).some((s) => s.fast)).toBe(false);
    expect(schedule.slice(5).some((s) => s.fast)).toBe(true);
  });
});

describe("planting", () => {
  it("costs sunshine and fills the cell", () => {
    const s = place(createGame(rng), 1, 2, "peashooter");
    expect(s.plants[1][2]?.kind).toBe("peashooter");
    expect(s.sun).toBe(START_SUN - PLANTS.peashooter.cost);
  });

  it("refuses occupied cells, cells off the board, and plants you can't afford", () => {
    let s = place(createGame(rng), 1, 2, "wall");
    expect(place(s, 1, 2, "sunflower")).toBe(s);
    expect(place(s, -1, 0, "wall")).toBe(s);
    expect(place(s, 0, COLS, "wall")).toBe(s);
    s = { ...s, sun: 40 };
    expect(canPlace(s, 0, 0, "sunflower")).toBe(false);
    expect(place(s, 0, 0, "sunflower")).toBe(s);
  });
});

describe("sunshine", () => {
  it("falls from the sky, and tapping picks it up", () => {
    const s = run(withSchedule([999]), 10);
    expect(s.suns).toHaveLength(1);
    expect(s.suns[0].fromSky).toBe(true);
    const picked = collect(s, s.suns[0].id);
    expect(picked.sun).toBe(s.sun + 25);
    expect(picked.suns).toHaveLength(0);
    expect(collect(picked, s.suns[0].id)).toBe(picked);
  });

  it("collects itself if nobody taps it", () => {
    const s = run(withSchedule([999]), 10 + SUN_LIFETIME);
    expect(s.sun).toBe(START_SUN + 25);
  });

  it("sunflowers make extra", () => {
    const plain = collectAll(run(withSchedule([999]), 12));
    const flowered = collectAll(run(place(withSchedule([999]), 0, 0, "sunflower"), 12));
    expect(flowered.sun - (plain.sun - PLANTS.sunflower.cost)).toBeGreaterThanOrEqual(50);
  });
});

describe("snails", () => {
  it("crawl toward the house and cost a heart when they get there", () => {
    const s = run(noMowers(withSchedule([0])), 45);
    expect(s.hearts).toBe(START_HEARTS - 1);
  });

  it("the first snail at the house sets off that row's mower, which clears the row", () => {
    let s = run(withSchedule([0, 3, 90]), 42);
    expect(s.hearts).toBe(START_HEARTS);
    expect(s.mowers[2].state).not.toBe("ready");
    expect(s.mowers[0].state).toBe("ready");
    s = run(s, 5);
    expect(s.shooed).toBe(2);
    expect(s.mowers[2].state).toBe("used");
  });

  it("fast snails zoom in and need fewer peas", () => {
    const slow = run(withSchedule([0]), 10);
    const fast = run(withSchedule([0], 2, false, true), 10);
    expect(fast.snails[0].x).toBeLessThan(slow.snails[0].x - 1);
    expect(fast.snails[0].maxHp).toBeLessThan(slow.snails[0].maxHp);
  });

  it("a chili blows up every snail around it", () => {
    let s = { ...withSchedule([0, 0]), sun: 500 };
    s.schedule[1] = { at: 0, row: 3, big: true };
    s = run(s, 10);
    const x = Math.floor(s.snails[0].x);
    s = place(s, 2, x, "chili");
    s = run(s, 1);
    expect(s.snails).toHaveLength(0);
    expect(s.shooed).toBe(2);
    expect(s.plants[2][x]).toBeNull();
  });

  it("pea shooters shoo snails in their row", () => {
    const s = run(place(withSchedule([0]), 2, 0, "peashooter"), 25);
    expect(s.shooed).toBe(1);
    expect(s.hearts).toBe(START_HEARTS);
    expect(s.status).toBe("won");
  });

  it("pea shooters don't fire at snails in other rows", () => {
    const s = run(place(withSchedule([0], 4), 2, 0, "peashooter"), 5);
    expect(s.peas).toHaveLength(0);
  });

  it("stop to munch plants, and walls hold them up", () => {
    let s = place(withSchedule([0]), 2, 5, "wall");
    s = run(s, 15);
    expect(s.snails[0].munching).toBe(true);
    expect(s.snails[0].x).toBeGreaterThan(5);
    expect(s.plants[2][5]).not.toBeNull();
  });

  it("eat unprotected plants eventually", () => {
    const s = run(place(withSchedule([0]), 2, 6, "sunflower"), 20);
    expect(s.plants[2][6]).toBeNull();
  });

  it("big snails take twice as many peas", () => {
    const small = run(place(withSchedule([0]), 2, 0, "peashooter"), 12);
    const big = run(place(withSchedule([0], 2, true), 2, 0, "peashooter"), 12);
    expect(small.shooed).toBe(1);
    expect(big.shooed).toBe(0);
  });
});

describe("winning and losing", () => {
  it("wins once every snail has come and gone", () => {
    let s = withSchedule([0, 2]);
    s = place(place(s, 2, 0, "peashooter"), 2, 1, "peashooter");
    s = run(s, 30);
    expect(s.status).toBe("won");
    expect(s.shooed).toBe(2);
  });

  it("loses when snails reach the house three times", () => {
    const s = run(noMowers(withSchedule([0, 1, 2])), 60);
    expect(s.hearts).toBe(0);
    expect(s.status).toBe("lost");
    expect(step(s, DT)).toBe(s);
  });

  it("reports the wave number", () => {
    const s = createGame(rng);
    expect(wave(s)).toBe(1);
    expect(wave({ ...s, nextSpawn: 6 })).toBe(2);
    expect(wave({ ...s, nextSpawn: 12 })).toBe(3);
  });
});
