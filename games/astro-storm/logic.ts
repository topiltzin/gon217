/**
 * Astro Storm 3D: a forward-flying space shooter. The ship stays near z = 0 and
 * slides around a flight window (x across, y up); asteroids, enemy drones and
 * bonus rings come at it from far ahead (negative z). Pure and deterministic
 * given the RNG; the Three.js view only reads the state and its per-step events.
 *
 * `step` mutates the state it is given, returns it, and replaces `state.events`.
 */

export type Rng = () => number;

export type Input = {
  /** Steering stick, each axis -1..1 (y up). */
  x: number;
  y: number;
  fire: boolean;
  /** Barrel roll: a quick sideways dodge that shrugs off hits. */
  roll: boolean;
};

export const NO_INPUT: Input = { x: 0, y: 0, fire: false, roll: false };

export type Size = 1 | 2 | 3;

export type Ship = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  cooldown: number;
  invulnerable: number;
  /** Seconds of barrel roll left, and which way it goes. */
  roll: number;
  rollDir: 1 | -1;
  rollCooldown: number;
  /** Seconds of triple shot left. */
  triple: number;
};

export type Asteroid = { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; size: Size; hp: number };
export type Laser = { id: number; x: number; y: number; z: number; vx: number; vz: number; life: number };
export type Drone = { id: number; x: number; y: number; z: number; baseX: number; phase: number; hp: number; hover: number; fireIn: number };
export type Plasma = { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number };
export type RingKind = "triple" | "life";
export type Ring = { id: number; x: number; y: number; z: number; kind: RingKind };

export type AstroEvent =
  | { type: "shot"; x: number; y: number }
  | { type: "hit"; x: number; y: number; z: number }
  | { type: "boom"; x: number; y: number; z: number; size: number }
  | { type: "crash"; x: number; y: number }
  | { type: "roll"; dir: 1 | -1 }
  | { type: "ring"; kind: RingKind }
  | { type: "wave"; wave: number }
  | { type: "enemyShot"; x: number; y: number; z: number }
  | { type: "over" };

export type AstroState = {
  ship: Ship;
  asteroids: Asteroid[];
  lasers: Laser[];
  drones: Drone[];
  plasma: Plasma[];
  rings: Ring[];
  score: number;
  lives: number;
  wave: number;
  /** Asteroids still to come this wave. */
  toSpawn: number;
  spawnIn: number;
  droneIn: number;
  ringIn: number;
  /** Short breather between waves. */
  waveBreak: number;
  /** How fast the storm flies at the ship (units per second). */
  speed: number;
  time: number;
  nextId: number;
  status: "playing" | "over";
  events: AstroEvent[];
};

/** Half-size of the window the ship can fly in. */
export const FIELD = { x: 18, y: 10 } as const;
export const SPAWN_Z = -240;
const DESPAWN_Z = 14;
export const START_LIVES = 3;
export const MAX_LIVES = 5;

export const RULES = {
  shipSpeed: 21,
  shipAccel: 110,
  shipRadius: 1,
  fireCooldown: 0.14,
  laserSpeed: 200,
  laserLife: 1.4,
  gunOffset: 0.95,
  tripleAngle: 0.18,
  tripleTime: 10,
  rollTime: 0.55,
  rollSpeed: 24,
  rollCooldown: 1.2,
  crashShield: 2,
  droneHover: 6,
  droneFireEvery: 1.7,
  plasmaSpeed: 55,
  ringRadius: 2.6,
} as const;

export const ASTEROID_RADIUS: Record<Size, number> = { 1: 1.1, 2: 2, 3: 3 };
export const ASTEROID_POINTS: Record<Size, number> = { 3: 20, 2: 50, 1: 100 };
export const DRONE_POINTS = 150;
const DRONE_RADIUS = 1.5;

const asteroidsInWave = (wave: number) => 10 + wave * 5;
const spawnEvery = (wave: number) => Math.max(0.35, 1.3 - wave * 0.12);
const speedFor = (wave: number) => 42 + wave * 6;

export function createGame(): AstroState {
  return {
    ship: { x: 0, y: 0, vx: 0, vy: 0, cooldown: 0, invulnerable: 0, roll: 0, rollDir: 1, rollCooldown: 0, triple: 0 },
    asteroids: [],
    lasers: [],
    drones: [],
    plasma: [],
    rings: [],
    score: 0,
    lives: START_LIVES,
    wave: 1,
    toSpawn: asteroidsInWave(1),
    spawnIn: 1.5,
    droneIn: 999,
    ringIn: 8,
    waveBreak: 0,
    speed: speedFor(1),
    time: 0,
    nextId: 1,
    status: "playing",
    events: [],
  };
}

/** Distance from point p to the segment a→b (all 3D). */
export function segmentDistance(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  px: number, py: number, pz: number,
): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / len2)) : 0;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py, az + dz * t - pz);
}

export function makeAsteroid(s: AstroState, rng: Rng, size: Size = 3): Asteroid {
  // Aim loosely at where the ship is, so the storm keeps coming at you.
  const x = s.ship.x * 0.6 + (rng() * 2 - 1) * FIELD.x * 1.1;
  const y = s.ship.y * 0.6 + (rng() * 2 - 1) * FIELD.y * 1.1;
  return {
    id: s.nextId++,
    x,
    y,
    z: SPAWN_Z,
    vx: (rng() * 2 - 1) * 1.5,
    vy: (rng() * 2 - 1) * 1.2,
    vz: s.speed * (0.8 + rng() * 0.4),
    size,
    hp: size,
  };
}

function moveShip(s: AstroState, input: Input, dt: number) {
  const ship = s.ship;
  ship.cooldown = Math.max(0, ship.cooldown - dt);
  ship.invulnerable = Math.max(0, ship.invulnerable - dt);
  ship.rollCooldown = Math.max(0, ship.rollCooldown - dt);
  ship.triple = Math.max(0, ship.triple - dt);

  if (input.roll && ship.roll === 0 && ship.rollCooldown === 0) {
    ship.rollDir = input.x < -0.2 ? -1 : input.x > 0.2 ? 1 : ship.vx < 0 ? -1 : 1;
    ship.roll = RULES.rollTime;
    ship.rollCooldown = RULES.rollCooldown;
    s.events.push({ type: "roll", dir: ship.rollDir });
  }

  const mag = Math.min(1, Math.hypot(input.x, input.y));
  const k = mag > 1e-6 ? mag / Math.hypot(input.x, input.y) : 0;
  const tx = input.x * k * RULES.shipSpeed;
  const ty = input.y * k * RULES.shipSpeed;
  const a = RULES.shipAccel * dt;
  ship.vx += Math.max(-a, Math.min(a, tx - ship.vx));
  ship.vy += Math.max(-a, Math.min(a, ty - ship.vy));
  let vx = ship.vx;
  if (ship.roll > 0) {
    vx += ship.rollDir * RULES.rollSpeed;
    ship.roll = Math.max(0, ship.roll - dt);
  }
  ship.x = Math.max(-FIELD.x, Math.min(FIELD.x, ship.x + vx * dt));
  ship.y = Math.max(-FIELD.y, Math.min(FIELD.y, ship.y + ship.vy * dt));
}

function fire(s: AstroState) {
  const ship = s.ship;
  const shots: [number, number][] = [
    [-RULES.gunOffset, 0],
    [RULES.gunOffset, 0],
  ];
  if (ship.triple > 0) shots.push([-RULES.gunOffset, -RULES.tripleAngle], [RULES.gunOffset, RULES.tripleAngle]);
  for (const [dx, angle] of shots) {
    s.lasers.push({
      id: s.nextId++,
      x: ship.x + dx,
      y: ship.y - 0.1,
      z: -1.5,
      vx: Math.sin(angle) * RULES.laserSpeed,
      vz: -Math.cos(angle) * RULES.laserSpeed,
      life: RULES.laserLife,
    });
  }
  ship.cooldown = RULES.fireCooldown;
  s.events.push({ type: "shot", x: ship.x, y: ship.y });
}

function shipHit(s: AstroState): boolean {
  const ship = s.ship;
  if (ship.invulnerable > 0 || ship.roll > 0) return false;
  s.lives--;
  ship.invulnerable = RULES.crashShield;
  s.events.push({ type: "crash", x: ship.x, y: ship.y });
  if (s.lives <= 0) {
    s.status = "over";
    s.events.push({ type: "over" });
  }
  return true;
}

function destroyAsteroid(s: AstroState, a: Asteroid, rng: Rng, points: boolean, born: Asteroid[]) {
  if (points) s.score += ASTEROID_POINTS[a.size];
  s.events.push({ type: "boom", x: a.x, y: a.y, z: a.z, size: a.size });
  if (a.size === 1 || !points) return;
  const size = (a.size - 1) as Size;
  for (const side of [-1, 1]) {
    born.push({
      id: s.nextId++,
      x: a.x + side * ASTEROID_RADIUS[size],
      y: a.y,
      z: a.z,
      vx: side * (4 + rng() * 3),
      vy: (rng() * 2 - 1) * 3,
      vz: a.vz * 0.9,
      size,
      hp: size,
    });
  }
}

function spawn(s: AstroState, dt: number, rng: Rng) {
  if (s.waveBreak > 0) {
    s.waveBreak -= dt;
    return;
  }
  s.spawnIn -= dt;
  if (s.toSpawn > 0 && s.spawnIn <= 0) {
    s.asteroids.push(makeAsteroid(s, rng, rng() < 0.2 ? 2 : 3));
    s.toSpawn--;
    s.spawnIn = spawnEvery(s.wave) * (0.6 + rng() * 0.8);
  }
  s.droneIn -= dt;
  if (s.wave >= 2 && s.toSpawn > 0 && s.droneIn <= 0) {
    const x = (rng() * 2 - 1) * FIELD.x * 0.8;
    s.drones.push({
      id: s.nextId++,
      x,
      y: (rng() * 2 - 1) * FIELD.y * 0.7,
      z: SPAWN_Z,
      baseX: x,
      phase: rng() * Math.PI * 2,
      hp: 2,
      hover: RULES.droneHover,
      fireIn: 1,
    });
    s.droneIn = Math.max(4, 9 - s.wave);
  }
  s.ringIn -= dt;
  if (s.ringIn <= 0) {
    s.rings.push({
      id: s.nextId++,
      x: (rng() * 2 - 1) * FIELD.x * 0.7,
      y: (rng() * 2 - 1) * FIELD.y * 0.7,
      z: SPAWN_Z,
      kind: rng() < 0.2 ? "life" : "triple",
    });
    s.ringIn = 12 + rng() * 6;
  }
}

export function step(s: AstroState, input: Input, dt: number, rng: Rng): AstroState {
  s.events = [];
  s.time += dt;
  const ship = s.ship;

  if (s.status === "playing") {
    moveShip(s, input, dt);
    if (input.fire && ship.cooldown === 0) fire(s);
    spawn(s, dt, rng);
  }

  // Lasers: sweep each step's path so fast beams can't skip past a rock.
  const born: Asteroid[] = [];
  const keptLasers: Laser[] = [];
  for (const l of s.lasers) {
    const ox = l.x, oz = l.z;
    l.x += l.vx * dt;
    l.z += l.vz * dt;
    l.life -= dt;
    let used = false;
    for (const a of s.asteroids) {
      if (a.hp <= 0 || segmentDistance(ox, l.y, oz, l.x, l.y, l.z, a.x, a.y, a.z) > ASTEROID_RADIUS[a.size]) continue;
      used = true;
      a.hp--;
      if (a.hp <= 0) destroyAsteroid(s, a, rng, true, born);
      else s.events.push({ type: "hit", x: l.x, y: l.y, z: a.z + ASTEROID_RADIUS[a.size] });
      break;
    }
    if (!used) {
      for (const d of s.drones) {
        if (d.hp <= 0 || segmentDistance(ox, l.y, oz, l.x, l.y, l.z, d.x, d.y, d.z) > DRONE_RADIUS) continue;
        used = true;
        d.hp--;
        if (d.hp <= 0) {
          s.score += DRONE_POINTS;
          s.events.push({ type: "boom", x: d.x, y: d.y, z: d.z, size: 2 });
        } else s.events.push({ type: "hit", x: d.x, y: d.y, z: d.z });
        break;
      }
    }
    if (!used && l.life > 0) keptLasers.push(l);
  }
  s.lasers = keptLasers;

  // Asteroids fly at the ship; hitting it costs a life (a roll or the crash shield protects).
  const flying: Asteroid[] = [];
  for (const a of s.asteroids) {
    if (a.hp <= 0) continue;
    const oz = a.z;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.z += a.vz * dt;
    const r = ASTEROID_RADIUS[a.size] + RULES.shipRadius;
    if (s.status === "playing" && oz <= r && a.z >= -r && Math.hypot(a.x - ship.x, a.y - ship.y) < r) {
      if (shipHit(s) || ship.roll > 0) {
        destroyAsteroid(s, a, rng, ship.roll > 0, born);
        continue;
      }
    }
    if (a.z < DESPAWN_Z) flying.push(a);
  }
  s.asteroids = [...flying, ...born];

  // Drones swoop in, hover weaving and shooting plasma, then leave.
  const drones: Drone[] = [];
  for (const d of s.drones) {
    if (d.hp <= 0) continue;
    d.phase += dt * 1.6;
    d.x = d.baseX + Math.sin(d.phase) * 4;
    if (d.z < -55) d.z += s.speed * 0.8 * dt;
    else if (d.hover > 0) {
      d.hover -= dt;
      d.fireIn -= dt;
      if (d.fireIn <= 0 && s.status === "playing") {
        d.fireIn = RULES.droneFireEvery;
        const dx = ship.x - d.x, dy = ship.y - d.y, dz = -d.z;
        const len = Math.hypot(dx, dy, dz);
        s.plasma.push({
          id: s.nextId++,
          x: d.x,
          y: d.y,
          z: d.z,
          vx: (dx / len) * RULES.plasmaSpeed,
          vy: (dy / len) * RULES.plasmaSpeed,
          vz: (dz / len) * RULES.plasmaSpeed,
        });
        s.events.push({ type: "enemyShot", x: d.x, y: d.y, z: d.z });
      }
    } else d.z += s.speed * 1.5 * dt;
    if (d.z < DESPAWN_Z) drones.push(d);
  }
  s.drones = drones;

  const plasma: Plasma[] = [];
  for (const p of s.plasma) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (s.status === "playing" && Math.abs(p.z) < 1 && Math.hypot(p.x - ship.x, p.y - ship.y) < RULES.shipRadius + 0.4) {
      shipHit(s);
      continue;
    }
    if (p.z < DESPAWN_Z) plasma.push(p);
  }
  s.plasma = plasma;

  // Fly through a ring for a bonus.
  const rings: Ring[] = [];
  for (const ring of s.rings) {
    const oz = ring.z;
    ring.z += s.speed * dt;
    if (s.status === "playing" && oz <= 0 && ring.z >= 0 && Math.hypot(ring.x - ship.x, ring.y - ship.y) < RULES.ringRadius) {
      if (ring.kind === "triple") ship.triple = RULES.tripleTime;
      else s.lives = Math.min(MAX_LIVES, s.lives + 1);
      s.events.push({ type: "ring", kind: ring.kind });
      continue;
    }
    if (ring.z < DESPAWN_Z) rings.push(ring);
  }
  s.rings = rings;

  // Next wave once this one has come and gone.
  if (s.status === "playing" && s.toSpawn === 0 && s.asteroids.length === 0 && s.drones.length === 0 && s.waveBreak <= 0) {
    s.wave++;
    s.toSpawn = asteroidsInWave(s.wave);
    s.speed = speedFor(s.wave);
    s.waveBreak = 2;
    s.spawnIn = 0.5;
    s.droneIn = 3;
    s.events.push({ type: "wave", wave: s.wave });
  }
  return s;
}
