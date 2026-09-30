/**
 * Garden Guard: plant helpers in a 5×7 garden to stop hungry snails before
 * they reach the house. Pure functions over plain data, time in seconds,
 * positions in columns (0 = house side, COLS = where snails arrive).
 *
 * Sunflowers and the sky drop sunshine you can tap to collect (it collects
 * itself after a few seconds anyway). Each row has one lawn mower: the first
 * snail to reach the house in that row sets it off, and it clears the row.
 */

export type Rng = () => number;

export const ROWS = 5;
export const COLS = 7;
export const START_SUN = 150;
export const START_HEARTS = 3;

export type PlantKind = "sunflower" | "peashooter" | "wall" | "chili";

export const PLANTS: Record<PlantKind, { cost: number; hp: number }> = {
  sunflower: { cost: 50, hp: 4 },
  peashooter: { cost: 100, hp: 4 },
  wall: { cost: 50, hp: 24 },
  chili: { cost: 125, hp: 99 },
};

const SUN_EVERY = 7;
const FIRST_SUN = 4;
const SKY_SUN_EVERY = 9;
const SUN_AMOUNT = 25;
/** Uncollected sunshine collects itself after this long. */
export const SUN_LIFETIME = 5;
const SHOOT_EVERY = 1.4;
const PEA_SPEED = 4;
const MUNCH_DPS = 1;
const SNAIL_SPEED = 0.18;
const BIG_SNAIL_SPEED = 0.14;
const FAST_SNAIL_SPEED = 0.34;
const CHILI_FUSE = 0.7;
const MOWER_SPEED = 5;

export type Plant = { kind: PlantKind; hp: number; timer: number };

export type Snail = {
  id: number;
  row: number;
  x: number;
  hp: number;
  maxHp: number;
  big: boolean;
  fast: boolean;
  munching: boolean;
};

export type Pea = { id: number; row: number; x: number };

export type Spawn = { at: number; row: number; big: boolean; fast?: boolean };

export type SunDrop = { id: number; row: number; col: number; until: number; fromSky: boolean };

export type Mower = { state: "ready" | "running" | "used"; x: number };

export type GardenState = {
  /** plants[row][col] */
  plants: (Plant | null)[][];
  snails: Snail[];
  peas: Pea[];
  suns: SunDrop[];
  mowers: Mower[];
  /** Short-lived "poof" markers for shooed snails, for drawing. */
  poofs: { id: number; row: number; x: number; until: number }[];
  /** Chili explosions, for drawing. */
  booms: { id: number; row: number; col: number; until: number }[];
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

/** 18 snails in three waves that arrive faster as the round goes on: quick snails from wave 2, big ones in wave 3. */
export function makeSchedule(rng: Rng): Spawn[] {
  const spawns: Spawn[] = [];
  let at = 12;
  for (let i = 0; i < 18; i++) {
    const wave = i < 5 ? 0 : i < 11 ? 1 : 2;
    const big = wave === 2 && i % 3 === 0;
    const fast = !big && wave > 0 && i % 4 === 1;
    spawns.push({ at, row: Math.min(ROWS - 1, Math.floor(rng() * ROWS)), big, fast });
    at += [9, 5.5, 3.5][wave];
  }
  return spawns;
}

export function createGame(rng: Rng): GardenState {
  return {
    plants: Array.from({ length: ROWS }, () => Array<Plant | null>(COLS).fill(null)),
    snails: [],
    peas: [],
    suns: [],
    mowers: Array.from({ length: ROWS }, () => ({ state: "ready" as const, x: -0.6 })),
    poofs: [],
    booms: [],
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
  const timer = kind === "sunflower" ? FIRST_SUN : kind === "chili" ? CHILI_FUSE : 0.5;
  plants[row][col] = { kind, hp: PLANTS[kind].hp, timer };
  return { ...state, plants, sun: state.sun - PLANTS[kind].cost };
}

/** Picks up one sunshine drop. */
export function collect(state: GardenState, id: number): GardenState {
  if (!state.suns.some((s) => s.id === id)) return state;
  return { ...state, suns: state.suns.filter((s) => s.id !== id), sun: state.sun + SUN_AMOUNT };
}

/** Picks up every sunshine drop on the lawn. */
export function collectAll(state: GardenState): GardenState {
  if (state.suns.length === 0) return state;
  return { ...state, suns: [], sun: state.sun + SUN_AMOUNT * state.suns.length };
}

export function wave(state: GardenState): number {
  return state.nextSpawn < 5 ? 1 : state.nextSpawn < 11 ? 2 : 3;
}

function snailSpeed(s: Snail) {
  return s.big ? BIG_SNAIL_SPEED : s.fast ? FAST_SNAIL_SPEED : SNAIL_SPEED;
}

export function step(state: GardenState, dt: number): GardenState {
  if (state.status !== "playing") return state;
  const time = state.time + dt;
  let { sun, nextId, nextSpawn, hearts, shooed } = state;

  // Sunshine drops: ones left alone collect themselves.
  const suns: SunDrop[] = [];
  for (const drop of state.suns) {
    if (drop.until <= time) sun += SUN_AMOUNT;
    else suns.push(drop);
  }
  let skySunTimer = state.skySunTimer - dt;
  if (skySunTimer <= 0) {
    const n = nextId++;
    suns.push({ id: n, row: n % ROWS, col: (n * 3) % COLS, until: time + SUN_LIFETIME, fromSky: true });
    skySunTimer += SKY_SUN_EVERY;
  }

  // New snails.
  const snails = state.snails.map((s) => ({ ...s }));
  while (nextSpawn < state.schedule.length && state.schedule[nextSpawn].at <= time) {
    const spawn = state.schedule[nextSpawn++];
    const fast = !spawn.big && !!spawn.fast;
    const hp = spawn.big ? 10 : fast ? 3 : 5;
    snails.push({ id: nextId++, row: spawn.row, x: COLS, hp, maxHp: hp, big: spawn.big, fast, munching: false });
  }

  // Plants: sunflowers drop sunshine, pea shooters fire when a snail is ahead in their row, chilies explode.
  const plants = state.plants.map((r) => r.map((p) => (p ? { ...p } : null)));
  const peas = state.peas.map((p) => ({ ...p }));
  const booms = state.booms.filter((b) => b.until > time);
  plants.forEach((row, r) =>
    row.forEach((plant, c) => {
      if (!plant) return;
      plant.timer -= dt;
      if (plant.timer > 0) return;
      if (plant.kind === "sunflower") {
        suns.push({ id: nextId++, row: r, col: c, until: time + SUN_LIFETIME, fromSky: false });
        plant.timer += SUN_EVERY;
      } else if (plant.kind === "peashooter") {
        if (snails.some((s) => s.row === r && s.x > c && s.x <= COLS)) {
          peas.push({ id: nextId++, row: r, x: c + 0.7 });
          plant.timer += SHOOT_EVERY;
        } else {
          plant.timer = 0;
        }
      } else if (plant.kind === "chili") {
        // Boom: every snail in the 3×3 around the chili is shooed.
        for (const s of snails) if (Math.abs(s.row - r) <= 1 && s.x >= c - 1 && s.x < c + 2) s.hp = 0;
        booms.push({ id: nextId++, row: r, col: c, until: time + 0.6 });
        row[c] = null;
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

  // Running mowers roll across their row and shoo every snail they reach.
  const mowers = state.mowers.map((m) => ({ ...m }));
  mowers.forEach((m, r) => {
    if (m.state !== "running") return;
    m.x += MOWER_SPEED * dt;
    for (const s of snails) if (s.row === r && s.hp > 0 && s.x <= m.x + 0.5) s.hp = 0;
    if (m.x > COLS + 1) m.state = "used";
  });

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
    if (plant && plant.kind !== "chili") {
      snail.munching = true;
      plant.hp -= MUNCH_DPS * dt;
      if (plant.hp <= 0) plants[snail.row][col] = null;
    } else {
      snail.munching = false;
      snail.x -= snailSpeed(snail) * dt;
    }
    if (snail.x < -0.3) {
      const mower = mowers[snail.row];
      if (mower.state === "ready") {
        // The mower saves the house this time, and takes this snail with it.
        mower.state = "running";
        shooed++;
        poofs.push({ id: nextId++, row: snail.row, x: 0, until: time + 0.6 });
      } else {
        hearts--;
      }
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
    suns,
    mowers,
    poofs,
    booms,
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
