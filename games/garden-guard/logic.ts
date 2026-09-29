/**
 * Garden Guard: plant helpers in a 5×7 garden to stop hungry snails before
 * they reach the house. Pure functions over plain data, time in seconds,
 * positions in columns (0 = house side, COLS = where snails arrive).
 */

export type Rng = () => number;

export const ROWS = 5;
export const COLS = 7;
export const START_SUN = 150;
export const START_HEARTS = 3;

export type PlantKind = "sunflower" | "peashooter" | "wall";

export const PLANTS: Record<PlantKind, { cost: number; hp: number }> = {
  sunflower: { cost: 50, hp: 4 },
  peashooter: { cost: 100, hp: 4 },
  wall: { cost: 50, hp: 24 },
};

const SUN_EVERY = 7;
const FIRST_SUN = 4;
const SKY_SUN_EVERY = 9;
const SUN_AMOUNT = 25;
const SHOOT_EVERY = 1.4;
const PEA_SPEED = 4;
const MUNCH_DPS = 1;
const SNAIL_SPEED = 0.18;
const BIG_SNAIL_SPEED = 0.14;

export type Plant = { kind: PlantKind; hp: number; timer: number };

export type Snail = {
  id: number;
  row: number;
  x: number;
  hp: number;
  maxHp: number;
  big: boolean;
  munching: boolean;
};

export type Pea = { id: number; row: number; x: number };

export type Spawn = { at: number; row: number; big: boolean };

export type GardenState = {
  /** plants[row][col] */
  plants: (Plant | null)[][];
  snails: Snail[];
  peas: Pea[];
  /** Short-lived "poof" markers for shooed snails, for drawing. */
  poofs: { id: number; row: number; x: number; until: number }[];
  schedule: Spawn[];
  nextSpawn: number;
  sun: number;
  skySunTimer: number;
  hearts: number;
  shooed: number;
  time: number;
  nextId: number;
  status: "playing" | "won" | "lost";
};

/** 18 snails in three waves that arrive faster and bigger as the round goes on. */
export function makeSchedule(rng: Rng): Spawn[] {
  const spawns: Spawn[] = [];
  let at = 12;
  for (let i = 0; i < 18; i++) {
    const wave = i < 5 ? 0 : i < 11 ? 1 : 2;
    spawns.push({ at, row: Math.min(ROWS - 1, Math.floor(rng() * ROWS)), big: wave === 2 && i % 3 === 0 });
    at += [9, 5.5, 3.5][wave];
  }
  return spawns;
}

export function createGame(rng: Rng): GardenState {
  return {
    plants: Array.from({ length: ROWS }, () => Array<Plant | null>(COLS).fill(null)),
    snails: [],
    peas: [],
    poofs: [],
    schedule: makeSchedule(rng),
    nextSpawn: 0,
    sun: START_SUN,
    skySunTimer: SKY_SUN_EVERY,
    hearts: START_HEARTS,
    shooed: 0,
    time: 0,
    nextId: 1,
    status: "playing",
  };
}

export function canPlace(state: GardenState, row: number, col: number, kind: PlantKind): boolean {
  return (
    state.status === "playing" &&
    row >= 0 &&
    row < ROWS &&
    col >= 0 &&
    col < COLS &&
    state.plants[row][col] === null &&
    state.sun >= PLANTS[kind].cost
  );
}

export function place(state: GardenState, row: number, col: number, kind: PlantKind): GardenState {
  if (!canPlace(state, row, col, kind)) return state;
  const plants = state.plants.map((r) => [...r]);
  plants[row][col] = { kind, hp: PLANTS[kind].hp, timer: kind === "sunflower" ? FIRST_SUN : 0.5 };
  return { ...state, plants, sun: state.sun - PLANTS[kind].cost };
}

export function wave(state: GardenState): number {
  return state.nextSpawn < 5 ? 1 : state.nextSpawn < 11 ? 2 : 3;
}

export function step(state: GardenState, dt: number): GardenState {
  if (state.status !== "playing") return state;
  const time = state.time + dt;
  let { sun, nextId, nextSpawn, hearts, shooed } = state;

  // Sunshine falls from the sky now and then.
  let skySunTimer = state.skySunTimer - dt;
  if (skySunTimer <= 0) {
    sun += SUN_AMOUNT;
    skySunTimer += SKY_SUN_EVERY;
  }

  // New snails.
  const snails = state.snails.map((s) => ({ ...s }));
  while (nextSpawn < state.schedule.length && state.schedule[nextSpawn].at <= time) {
    const spawn = state.schedule[nextSpawn++];
    const hp = spawn.big ? 10 : 5;
    snails.push({ id: nextId++, row: spawn.row, x: COLS, hp, maxHp: hp, big: spawn.big, munching: false });
  }

  // Plants: sunflowers make sunshine, pea shooters fire when a snail is ahead in their row.
  const plants = state.plants.map((r) => r.map((p) => (p ? { ...p } : null)));
  const peas = state.peas.map((p) => ({ ...p }));
  plants.forEach((row, r) =>
    row.forEach((plant, c) => {
      if (!plant) return;
      plant.timer -= dt;
      if (plant.timer > 0) return;
      if (plant.kind === "sunflower") {
        sun += SUN_AMOUNT;
        plant.timer += SUN_EVERY;
      } else if (plant.kind === "peashooter") {
        if (snails.some((s) => s.row === r && s.x > c && s.x <= COLS)) {
          peas.push({ id: nextId++, row: r, x: c + 0.7 });
          plant.timer += SHOOT_EVERY;
        } else {
          plant.timer = 0;
        }
      } else {
        plant.timer = 0;
      }
    }),
  );

  // Peas fly right and hit the first snail they reach.
  const flying: Pea[] = [];
  for (const pea of peas) {
    pea.x += PEA_SPEED * dt;
    const target = snails
      .filter((s) => s.row === pea.row && s.hp > 0 && pea.x >= s.x && pea.x <= s.x + 0.8)
      .sort((a, b) => a.x - b.x)[0];
    if (target) target.hp -= 1;
    else if (pea.x < COLS + 0.5) flying.push(pea);
  }

  // Snails crawl left, stopping to munch the first plant in their way.
  const poofs = state.poofs.filter((p) => p.until > time);
  const remaining: Snail[] = [];
  for (const snail of snails) {
    if (snail.hp <= 0) {
      shooed++;
      poofs.push({ id: nextId++, row: snail.row, x: snail.x, until: time + 0.6 });
      continue;
    }
    const col = Math.floor(snail.x);
    const plant = col >= 0 && col < COLS && snail.x - col < 0.95 ? plants[snail.row][col] : null;
    if (plant) {
      snail.munching = true;
      plant.hp -= MUNCH_DPS * dt;
      if (plant.hp <= 0) plants[snail.row][col] = null;
    } else {
      snail.munching = false;
      snail.x -= (snail.big ? BIG_SNAIL_SPEED : SNAIL_SPEED) * dt;
    }
    if (snail.x < -0.3) {
      hearts--;
      continue;
    }
    remaining.push(snail);
  }

  let status: GardenState["status"] = "playing";
  if (hearts <= 0) status = "lost";
  else if (nextSpawn >= state.schedule.length && remaining.length === 0) status = "won";

  return {
    ...state,
    plants,
    snails: remaining,
    peas: flying,
    poofs,
    nextSpawn,
    sun,
    skySunTimer,
    hearts: Math.max(0, hearts),
    shooed,
    time,
    nextId,
    status,
  };
}
