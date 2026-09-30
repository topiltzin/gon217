/**
 * Gonzgun rules: a top-down duel in a basement, simulated on the floor plane
 * (x across, z toward the camera). Pure and deterministic given the RNG, so the
 * Three.js view and the CPU player only read this state.
 *
 * `step` mutates the state it is given and returns it, and replaces
 * `state.events` with what happened during that step.
 */

export type Rng = () => number;
export type FighterId = 0 | 1;

export type Input = {
  /** Move/aim stick, each axis -1..1. A small push only turns; a bigger one also walks. */
  mx: number;
  mz: number;
  fire: boolean;
  dash: boolean;
};

export const NO_INPUT: Input = { mx: 0, mz: 0, fire: false, dash: false };

export type ObstacleKind = "crate" | "pillar" | "boiler" | "washer" | "shelf" | "barrel";
export type Obstacle = { kind: ObstacleKind; x: number; z: number; hw: number; hd: number };
export type PickupKind = "health" | "triple";

export type Fighter = {
  id: FighterId;
  x: number;
  z: number;
  /** Facing angle: direction (cos, sin) on the x/z plane. */
  aim: number;
  hp: number;
  alive: boolean;
  respawnIn: number;
  invulnerable: number;
  cooldown: number;
  dashTime: number;
  dashCooldown: number;
  dashX: number;
  dashZ: number;
  /** Seconds of triple shot left. */
  triple: number;
  kos: number;
  walking: boolean;
};

export type Bullet = { id: number; owner: FighterId; x: number; z: number; vx: number; vz: number; life: number };
export type Pickup = { id: number; kind: PickupKind; x: number; z: number };

export type GameEvent =
  | { type: "shot"; owner: FighterId; x: number; z: number; angle: number }
  | { type: "hit"; target: FighterId; x: number; z: number; angle: number }
  | { type: "ko"; target: FighterId; x: number; z: number; angle: number }
  | { type: "wall"; x: number; z: number }
  | { type: "spawn"; fighter: FighterId }
  | { type: "dash"; fighter: FighterId }
  | { type: "pickup"; fighter: FighterId; kind: PickupKind }
  | { type: "win"; winner: FighterId };

export type GonzState = {
  fighters: [Fighter, Fighter];
  bullets: Bullet[];
  pickups: Pickup[];
  pickupTimer: number;
  nextId: number;
  time: number;
  status: "playing" | "over";
  winner: FighterId | null;
  shots: [number, number];
  hits: [number, number];
  events: GameEvent[];
};

// Arena: the floor spans x -10..10 and z -6..6 (z = -6 is the back wall).
export const ARENA = { minX: -10, maxX: 10, minZ: -6, maxZ: 6 } as const;

export const OBSTACLES: readonly Obstacle[] = [
  { kind: "boiler", x: 0, z: -5.1, hw: 1.2, hd: 0.9 },
  { kind: "washer", x: -8.6, z: -5.2, hw: 0.8, hd: 0.8 },
  { kind: "shelf", x: 7.6, z: -5.4, hw: 1.6, hd: 0.6 },
  { kind: "pillar", x: -3, z: -0.6, hw: 0.45, hd: 0.45 },
  { kind: "pillar", x: 3, z: 0.6, hw: 0.45, hd: 0.45 },
  { kind: "crate", x: -6, z: -2.2, hw: 0.6, hd: 0.6 },
  { kind: "crate", x: 6, z: 2.2, hw: 0.6, hd: 0.6 },
  { kind: "crate", x: -5.4, z: 3.4, hw: 0.6, hd: 0.6 },
  { kind: "crate", x: 5.4, z: -3.4, hw: 0.6, hd: 0.6 },
  { kind: "crate", x: 0, z: 2.8, hw: 1.2, hd: 0.5 },
  { kind: "barrel", x: 8.8, z: 4.8, hw: 0.5, hd: 0.5 },
  { kind: "barrel", x: -8.8, z: 4.8, hw: 0.5, hd: 0.5 },
];

export const SPAWNS: readonly { x: number; z: number }[] = [
  { x: -8.4, z: 0 },
  { x: 8.4, z: 0 },
  { x: -8, z: -3.6 },
  { x: 8, z: 3.4 },
  { x: -2.5, z: 4.8 },
  { x: 2.5, z: -3.4 },
];

export const PICKUP_SPOTS: readonly { x: number; z: number }[] = [
  { x: 0, z: 0 },
  { x: -7.8, z: 2 },
  { x: 7.8, z: -2 },
  { x: 0, z: 4.9 },
];

export const RULES = {
  radius: 0.45,
  speed: 5.4,
  turnSpeed: 14,
  walkThreshold: 0.35,
  aimThreshold: 0.1,
  maxHp: 100,
  damage: 20,
  fireCooldown: 0.28,
  bulletSpeed: 21,
  bulletLife: 1.4,
  bulletRadius: 0.12,
  /** Shots snap onto a visible opponent within this angle of the facing. */
  assistCone: (24 * Math.PI) / 180,
  spread: (2 * Math.PI) / 180,
  tripleSpread: (10 * Math.PI) / 180,
  tripleTime: 8,
  healthPack: 40,
  dashTime: 0.18,
  dashSpeed: 17,
  dashCooldown: 1.5,
  respawnDelay: 1.6,
  spawnShield: 1.4,
  pickupEvery: 7,
  maxPickups: 2,
  kosToWin: 5,
} as const;

function makeFighter(id: FighterId, spawn: { x: number; z: number }): Fighter {
  return {
    id,
    x: spawn.x,
    z: spawn.z,
    aim: spawn.x < 0 ? 0 : Math.PI,
    hp: RULES.maxHp,
    alive: true,
    respawnIn: 0,
    invulnerable: RULES.spawnShield,
    cooldown: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashX: 0,
    dashZ: 0,
    triple: 0,
    kos: 0,
    walking: false,
  };
}

export function createGame(): GonzState {
  return {
    fighters: [makeFighter(0, SPAWNS[0]), makeFighter(1, SPAWNS[1])],
    bullets: [],
    pickups: [],
    pickupTimer: RULES.pickupEvery / 2,
    nextId: 1,
    time: 0,
    status: "playing",
    winner: null,
    shots: [0, 0],
    hits: [0, 0],
    events: [],
  };
}

/* ---------- Geometry helpers (also used by the CPU player) ---------- */

export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export function pointBlocked(x: number, z: number, pad = 0): boolean {
  if (x < ARENA.minX + pad || x > ARENA.maxX - pad || z < ARENA.minZ + pad || z > ARENA.maxZ - pad) return true;
  return OBSTACLES.some((o) => Math.abs(x - o.x) < o.hw + pad && Math.abs(z - o.z) < o.hd + pad);
}

/** True when a straight shot from a to b would not hit an obstacle. */
export function lineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(dist / 0.15);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/** Pushes a circle out of the walls and obstacles. */
function resolve(f: Fighter) {
  const r = RULES.radius;
  f.x = Math.min(ARENA.maxX - r, Math.max(ARENA.minX + r, f.x));
  f.z = Math.min(ARENA.maxZ - r, Math.max(ARENA.minZ + r, f.z));
  for (const o of OBSTACLES) {
    const cx = Math.max(o.x - o.hw, Math.min(f.x, o.x + o.hw));
    const cz = Math.max(o.z - o.hd, Math.min(f.z, o.z + o.hd));
    const dx = f.x - cx;
    const dz = f.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      f.x = cx + (dx / d) * r;
      f.z = cz + (dz / d) * r;
    } else {
      // Centre inside the box: leave by the nearest side.
      const left = f.x - (o.x - o.hw);
      const right = o.x + o.hw - f.x;
      const back = f.z - (o.z - o.hd);
      const front = o.z + o.hd - f.z;
      const m = Math.min(left, right, back, front);
      if (m === left) f.x = o.x - o.hw - r;
      else if (m === right) f.x = o.x + o.hw + r;
      else if (m === back) f.z = o.z - o.hd - r;
      else f.z = o.z + o.hd + r;
    }
  }
}

function pickSpawn(other: Fighter): { x: number; z: number } {
  let best = SPAWNS[0];
  let bestD = -1;
  for (const s of SPAWNS) {
    const d = other.alive ? Math.hypot(s.x - other.x, s.z - other.z) : 0;
    if (d > bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/* ---------- Step ---------- */

function moveFighter(s: GonzState, f: Fighter, input: Input, dt: number) {
  f.cooldown = Math.max(0, f.cooldown - dt);
  f.dashCooldown = Math.max(0, f.dashCooldown - dt);
  f.invulnerable = Math.max(0, f.invulnerable - dt);
  f.triple = Math.max(0, f.triple - dt);

  const mag = Math.min(1, Math.hypot(input.mx, input.mz));
  if (mag > RULES.aimThreshold) {
    const target = Math.atan2(input.mz, input.mx);
    const d = angleDiff(f.aim, target);
    const turn = RULES.turnSpeed * dt;
    f.aim += Math.abs(d) <= turn ? d : Math.sign(d) * turn;
  }

  if (input.dash && f.dashCooldown === 0 && f.dashTime === 0) {
    const dir = mag > RULES.aimThreshold ? Math.atan2(input.mz, input.mx) : f.aim;
    f.dashX = Math.cos(dir);
    f.dashZ = Math.sin(dir);
    f.dashTime = RULES.dashTime;
    f.dashCooldown = RULES.dashCooldown;
    s.events.push({ type: "dash", fighter: f.id });
  }

  if (f.dashTime > 0) {
    const t = Math.min(dt, f.dashTime);
    f.x += f.dashX * RULES.dashSpeed * t;
    f.z += f.dashZ * RULES.dashSpeed * t;
    f.dashTime = Math.max(0, f.dashTime - dt);
    f.walking = true;
  } else if (mag >= RULES.walkThreshold) {
    const k = (RULES.speed * mag * dt) / Math.hypot(input.mx, input.mz);
    f.x += input.mx * k;
    f.z += input.mz * k;
    f.walking = true;
  } else {
    f.walking = false;
  }
  resolve(f);
}

function fire(s: GonzState, f: Fighter, other: Fighter, rng: Rng) {
  let angle = f.aim;
  if (other.alive) {
    const toOther = Math.atan2(other.z - f.z, other.x - f.x);
    if (Math.abs(angleDiff(f.aim, toOther)) <= RULES.assistCone && lineOfSight(f.x, f.z, other.x, other.z)) {
      angle = toOther;
    }
  }
  angle += (rng() * 2 - 1) * RULES.spread;
  const angles = f.triple > 0 ? [angle - RULES.tripleSpread, angle, angle + RULES.tripleSpread] : [angle];
  const muzzle = RULES.radius + 0.25;
  for (const a of angles) {
    s.bullets.push({
      id: s.nextId++,
      owner: f.id,
      x: f.x + Math.cos(a) * muzzle,
      z: f.z + Math.sin(a) * muzzle,
      vx: Math.cos(a) * RULES.bulletSpeed,
      vz: Math.sin(a) * RULES.bulletSpeed,
      life: RULES.bulletLife,
    });
  }
  s.shots[f.id]++;
  f.cooldown = RULES.fireCooldown;
  s.events.push({ type: "shot", owner: f.id, x: f.x, z: f.z, angle });
}

function stepBullets(s: GonzState, dt: number) {
  const hitR = RULES.radius + RULES.bulletRadius;
  const kept: Bullet[] = [];
  for (const b of s.bullets) {
    // Sub-step so fast bullets can't tunnel through thin obstacles or fighters.
    const n = Math.max(1, Math.ceil((RULES.bulletSpeed * dt) / 0.15));
    let alive = true;
    for (let i = 0; i < n && alive; i++) {
      b.x += (b.vx * dt) / n;
      b.z += (b.vz * dt) / n;
      const target = s.fighters[b.owner === 0 ? 1 : 0];
      if (target.alive && Math.hypot(target.x - b.x, target.z - b.z) < hitR) {
        alive = false;
        if (target.invulnerable === 0 && target.dashTime === 0) damage(s, target, b);
        else s.events.push({ type: "wall", x: b.x, z: b.z });
      } else if (pointBlocked(b.x, b.z)) {
        alive = false;
        s.events.push({ type: "wall", x: b.x, z: b.z });
      }
    }
    b.life -= dt;
    if (alive && b.life > 0) kept.push(b);
  }
  s.bullets = kept;
}

function damage(s: GonzState, target: Fighter, b: Bullet) {
  const angle = Math.atan2(b.vz, b.vx);
  const shooter = s.fighters[b.owner];
  s.hits[b.owner]++;
  target.hp = Math.max(0, target.hp - RULES.damage);
  if (target.hp > 0) {
    s.events.push({ type: "hit", target: target.id, x: target.x, z: target.z, angle });
    return;
  }
  target.alive = false;
  target.respawnIn = RULES.respawnDelay;
  target.dashTime = 0;
  target.walking = false;
  shooter.kos++;
  s.events.push({ type: "ko", target: target.id, x: target.x, z: target.z, angle });
  if (shooter.kos >= RULES.kosToWin) {
    s.status = "over";
    s.winner = shooter.id;
    s.events.push({ type: "win", winner: shooter.id });
  }
}

function stepPickups(s: GonzState, dt: number, rng: Rng) {
  for (const f of s.fighters) {
    if (!f.alive) continue;
    s.pickups = s.pickups.filter((p) => {
      if (Math.hypot(p.x - f.x, p.z - f.z) > RULES.radius + 0.45) return true;
      if (p.kind === "health") {
        if (f.hp >= RULES.maxHp) return true;
        f.hp = Math.min(RULES.maxHp, f.hp + RULES.healthPack);
      } else {
        f.triple = RULES.tripleTime;
      }
      s.events.push({ type: "pickup", fighter: f.id, kind: p.kind });
      return false;
    });
  }
  s.pickupTimer -= dt;
  if (s.pickupTimer > 0) return;
  s.pickupTimer = RULES.pickupEvery;
  if (s.pickups.length >= RULES.maxPickups) return;
  const free = PICKUP_SPOTS.filter((p) => !s.pickups.some((q) => q.x === p.x && q.z === p.z));
  const spot = free[Math.floor(rng() * free.length)];
  if (!spot) return;
  s.pickups.push({ id: s.nextId++, kind: rng() < 0.5 ? "health" : "triple", x: spot.x, z: spot.z });
}

export function step(s: GonzState, inputs: [Input, Input], dt: number, rng: Rng): GonzState {
  s.events = [];
  s.time += dt;
  if (s.status === "over") {
    stepBullets(s, dt);
    return s;
  }
  for (const f of s.fighters) {
    const other = s.fighters[f.id === 0 ? 1 : 0];
    if (!f.alive) {
      f.respawnIn -= dt;
      if (f.respawnIn <= 0) {
        const spawn = pickSpawn(other);
        Object.assign(f, makeFighter(f.id, spawn), { kos: f.kos });
        f.aim = Math.atan2(other.z - f.z, other.x - f.x);
        s.events.push({ type: "spawn", fighter: f.id });
      }
      continue;
    }
    const input = inputs[f.id];
    moveFighter(s, f, input, dt);
    if (input.fire && f.cooldown === 0 && f.dashTime === 0) fire(s, f, other, rng);
  }
  stepBullets(s, dt);
  stepPickups(s, dt, rng);
  return s;
}

/** Points for a solo match against the CPU: 100 per KO, 300 for winning, plus up to 200 for accuracy. */
export function soloScore(s: GonzState): number {
  const me = s.fighters[0];
  const accuracy = s.shots[0] ? Math.min(1, s.hits[0] / s.shots[0]) : 0;
  return me.kos * 100 + (s.winner === 0 ? 300 : 0) + Math.round(accuracy * 200);
}
