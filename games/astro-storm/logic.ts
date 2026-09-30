/**
 * Astro Storm: fly a ship, shoot the asteroids, survive the waves.
 * Plain data and functions (RNG injected) so the rules are unit-tested; the
 * component feeds input and draws. The field wraps around at every edge.
 */

export const FIELD_W = 960;
export const FIELD_H = 540;
export const START_LIVES = 3;

const TURN_SPEED = 4.2; // rad/s
const THRUST = 420; // px/s²
const DRAG = 0.55; // velocity kept per second, as a fraction
const MAX_SPEED = 420;
const SHIP_RADIUS = 13;
const FIRE_INTERVAL = 0.17;
const BULLET_SPEED = 720;
const BULLET_LIFE = 0.75;
const MAX_BULLETS = 24;
const RESPAWN_SHIELD = 2.5;
const WAVE_PAUSE = 1.6;
const TRIPLE_SHOT_TIME = 8;
const POWERUP_CHANCE = 0.08;
const POWERUP_LIFE = 9;
const POWERUP_RADIUS = 14;

/** Asteroid sizes: 3 = large, 2 = medium, 1 = small. */
export const ASTEROID_RADIUS: Record<1 | 2 | 3, number> = { 3: 50, 2: 28, 1: 15 };
export const ASTEROID_POINTS: Record<1 | 2 | 3, number> = { 3: 20, 2: 50, 1: 100 };

export type Rng = () => number;
export type Input = { left: boolean; right: boolean; thrust: boolean; fire: boolean };

export type Ship = { x: number; y: number; vx: number; vy: number; angle: number; shield: number; alive: boolean };
export type Bullet = { x: number; y: number; vx: number; vy: number; life: number };
export type Asteroid = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: 1 | 2 | 3;
  angle: number;
  spin: number;
  /** Radius multipliers around the outline, for a jagged rock shape. */
  shape: number[];
};
export type PowerUp = { x: number; y: number; vx: number; vy: number; life: number };

/** Things that happened this step, for the renderer's effects. */
export type GameEvent =
  | { type: "shot"; x: number; y: number }
  | { type: "explode"; x: number; y: number; size: 1 | 2 | 3 }
  | { type: "shipHit"; x: number; y: number }
  | { type: "wave"; wave: number }
  | { type: "powerUp"; x: number; y: number };

export type AstroState = {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  wave: number;
  fireCooldown: number;
  tripleShot: number;
  /** Seconds until the ship respawns after a hit. */
  respawn: number;
  /** Seconds until the next wave, once the field is clear. */
  nextWave: number;
  status: "playing" | "lost";
  events: GameEvent[];
};

export const wrap = (value: number, max: number) => ((value % max) + max) % max;

/** Shortest wrapped distance between two points on the torus field. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  let dx = Math.abs(ax - bx);
  let dy = Math.abs(ay - by);
  if (dx > FIELD_W / 2) dx = FIELD_W - dx;
  if (dy > FIELD_H / 2) dy = FIELD_H - dy;
  return Math.hypot(dx, dy);
}

function newShip(): Ship {
  return { x: FIELD_W / 2, y: FIELD_H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, shield: RESPAWN_SHIELD, alive: true };
}

export function makeAsteroid(rng: Rng, size: 1 | 2 | 3, x: number, y: number, speedScale = 1): Asteroid {
  const angle = rng() * Math.PI * 2;
  const speed = (40 + rng() * 50) * (4 - size) ** 0.5 * speedScale;
  const points = 9 + Math.floor(rng() * 4);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    angle: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 1.6,
    shape: Array.from({ length: points }, () => 0.72 + rng() * 0.38),
  };
}

/** Large asteroids around the edges, never on top of the ship. Faster each wave. */
export function spawnWave(state: AstroState, rng: Rng) {
  const count = Math.min(3 + state.wave, 10);
  const speedScale = 1 + (state.wave - 1) * 0.12;
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    do {
      x = rng() * FIELD_W;
      y = rng() * FIELD_H;
    } while (distance(x, y, state.ship.x, state.ship.y) < 190);
    state.asteroids.push(makeAsteroid(rng, 3, x, y, speedScale));
  }
  state.events.push({ type: "wave", wave: state.wave });
}

export function createGame(rng: Rng): AstroState {
  const state: AstroState = {
    ship: newShip(),
    bullets: [],
    asteroids: [],
    powerUps: [],
    score: 0,
    lives: START_LIVES,
    wave: 1,
    fireCooldown: 0,
    tripleShot: 0,
    respawn: 0,
    nextWave: 0,
    status: "playing",
    events: [],
  };
  spawnWave(state, rng);
  return state;
}

function moveWrapped(o: { x: number; y: number; vx: number; vy: number }, dt: number) {
  o.x = wrap(o.x + o.vx * dt, FIELD_W);
  o.y = wrap(o.y + o.vy * dt, FIELD_H);
}

function fire(state: AstroState) {
  const { ship } = state;
  const angles = state.tripleShot > 0 ? [-0.18, 0, 0.18] : [0];
  for (const offset of angles) {
    if (state.bullets.length >= MAX_BULLETS) state.bullets.shift();
    const a = ship.angle + offset;
    const nose = SHIP_RADIUS + 2;
    state.bullets.push({
      x: wrap(ship.x + Math.cos(a) * nose, FIELD_W),
      y: wrap(ship.y + Math.sin(a) * nose, FIELD_H),
      vx: ship.vx + Math.cos(a) * BULLET_SPEED,
      vy: ship.vy + Math.sin(a) * BULLET_SPEED,
      life: BULLET_LIFE,
    });
  }
  state.fireCooldown = FIRE_INTERVAL;
  state.events.push({ type: "shot", x: ship.x, y: ship.y });
}

function breakAsteroid(state: AstroState, index: number, rng: Rng) {
  const rock = state.asteroids[index];
  state.asteroids.splice(index, 1);
  state.score += ASTEROID_POINTS[rock.size];
  state.events.push({ type: "explode", x: rock.x, y: rock.y, size: rock.size });
  if (rock.size > 1) {
    const smaller = (rock.size - 1) as 1 | 2;
    const speedScale = 1 + (state.wave - 1) * 0.12;
    for (let i = 0; i < 2; i++) state.asteroids.push(makeAsteroid(rng, smaller, rock.x, rock.y, speedScale * 1.15));
  }
  if (rock.size < 3 && rng() < POWERUP_CHANCE) {
    const a = rng() * Math.PI * 2;
    state.powerUps.push({ x: rock.x, y: rock.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, life: POWERUP_LIFE });
  }
}

/** Advances the game by dt seconds. Clears and refills state.events. */
export function step(state: AstroState, input: Input, dt: number, rng: Rng): AstroState {
  state.events = [];
  if (state.status !== "playing") return state;
  const { ship } = state;

  // Ship
  if (ship.alive) {
    const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    ship.angle += turn * TURN_SPEED * dt;
    if (input.thrust) {
      ship.vx += Math.cos(ship.angle) * THRUST * dt;
      ship.vy += Math.sin(ship.angle) * THRUST * dt;
    }
    const keep = DRAG ** dt;
    ship.vx *= keep;
    ship.vy *= keep;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > MAX_SPEED) {
      ship.vx *= MAX_SPEED / speed;
      ship.vy *= MAX_SPEED / speed;
    }
    moveWrapped(ship, dt);
    ship.shield = Math.max(0, ship.shield - dt);
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    state.tripleShot = Math.max(0, state.tripleShot - dt);
    if (input.fire && state.fireCooldown === 0) fire(state);
  }

  // Bullets
  for (const b of state.bullets) {
    moveWrapped(b, dt);
    b.life -= dt;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  // Asteroids
  for (const rock of state.asteroids) {
    moveWrapped(rock, dt);
    rock.angle += rock.spin * dt;
  }

  // Bullet hits
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    const hit = state.asteroids.findIndex((r) => distance(b.x, b.y, r.x, r.y) < ASTEROID_RADIUS[r.size]);
    if (hit >= 0) {
      state.bullets.splice(i, 1);
      breakAsteroid(state, hit, rng);
    }
  }

  // Power-ups drift and fade; flying into one gives triple shot.
  for (const p of state.powerUps) {
    moveWrapped(p, dt);
    p.life -= dt;
    if (ship.alive && distance(p.x, p.y, ship.x, ship.y) < POWERUP_RADIUS + SHIP_RADIUS) {
      p.life = 0;
      state.tripleShot = TRIPLE_SHOT_TIME;
      state.events.push({ type: "powerUp", x: p.x, y: p.y });
    }
  }
  state.powerUps = state.powerUps.filter((p) => p.life > 0);

  // Ship collisions (the shield makes it briefly safe after respawning)
  if (ship.alive && ship.shield === 0) {
    const hit = state.asteroids.findIndex((r) => distance(ship.x, ship.y, r.x, r.y) < ASTEROID_RADIUS[r.size] * 0.85 + SHIP_RADIUS);
    if (hit >= 0) {
      ship.alive = false;
      state.lives -= 1;
      state.events.push({ type: "shipHit", x: ship.x, y: ship.y });
      breakAsteroid(state, hit, rng);
      if (state.lives <= 0) state.status = "lost";
      else state.respawn = 1.5;
    }
  }

  // Respawn once the pause is over
  if (!ship.alive && state.status === "playing") {
    state.respawn -= dt;
    if (state.respawn <= 0) state.ship = newShip();
  }

  // Next wave
  if (state.asteroids.length === 0 && state.status === "playing") {
    if (state.nextWave === 0) state.nextWave = WAVE_PAUSE;
    state.nextWave = Math.max(0, state.nextWave - dt);
    if (state.nextWave === 0) {
      state.wave += 1;
      spawnWave(state, rng);
    }
  }
  return state;
}
