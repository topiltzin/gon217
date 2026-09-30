import {
  ARENA,
  RULES,
  angleDiff,
  lineOfSight,
  pointBlocked,
  type Fighter,
  type GonzState,
  type Input,
  type Difficulty,
  type Rng,
} from "./logic";

/**
 * The CPU opponent. It plays by the same rules as a person: it only produces
 * an Input (stick, fire, dash), so it has to turn to face you before it can
 * shoot. Thinks a few times per second and reacts with a short delay.
 */

const CELL = 0.5;
const COLS = Math.round((ARENA.maxX - ARENA.minX) / CELL);
const ROWS = Math.round((ARENA.maxZ - ARENA.minZ) / CELL);
const THINK_EVERY = 0.2;

/** How sharp the CPU is: reaction time, how often it pulls the trigger when aimed, and how often it dodges. */
const LEVELS: Record<Difficulty, { reaction: number; trigger: number; dodge: number; speed: number }> = {
  easy: { reaction: 0.7, trigger: 0.3, dodge: 0.08, speed: 0.75 },
  normal: { reaction: 0.35, trigger: 0.6, dodge: 0.3, speed: 1 },
  hard: { reaction: 0.2, trigger: 0.85, dodge: 0.55, speed: 1 },
};

// Cells a fighter's centre can stand in (obstacles grown by the fighter's radius).
const WALKABLE: boolean[] = Array.from({ length: COLS * ROWS }, (_, i) => {
  const { x, z } = cellCentre(i);
  return !pointBlocked(x, z, RULES.radius);
});

function cellCentre(i: number) {
  return { x: ARENA.minX + ((i % COLS) + 0.5) * CELL, z: ARENA.minZ + (Math.floor(i / COLS) + 0.5) * CELL };
}

function cellOf(x: number, z: number): number {
  const c = Math.min(COLS - 1, Math.max(0, Math.floor((x - ARENA.minX) / CELL)));
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor((z - ARENA.minZ) / CELL)));
  return r * COLS + c;
}

/** Breadth-first distances from the goal over walkable cells (8-way). */
function distanceField(goal: number): Int32Array {
  const dist = new Int32Array(COLS * ROWS).fill(-1);
  const queue = [goal];
  dist[goal] = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc;
        const nr = r + dr;
        if ((!dc && !dr) || nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const n = nr * COLS + nc;
        // No corner cutting: both side cells must be open for a diagonal.
        if (dist[n] !== -1 || !WALKABLE[n] || (dc && dr && (!WALKABLE[r * COLS + nc] || !WALKABLE[nr * COLS + c]))) continue;
        dist[n] = dist[i] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

let cachedGoal = -1;
let cachedField: Int32Array | null = null;

/** Distance field for a goal cell; the last one is kept, since the goal rarely changes between frames. */
function fieldFor(goal: number): Int32Array {
  if (goal !== cachedGoal || !cachedField) {
    cachedField = distanceField(goal);
    cachedGoal = goal;
  }
  return cachedField;
}

/**
 * Direction (unit vector) to walk from (x, z) toward the goal, or null if
 * unreachable. Follows the distance field downhill a few cells and heads for
 * the farthest of them it can walk to in a straight line, so it doesn't zigzag.
 */
export function pathDirection(x: number, z: number, gx: number, gz: number): { x: number; z: number } | null {
  if (clearWalk(x, z, gx, gz)) return unit(gx - x, gz - z);
  const dist = fieldFor(cellOf(gx, gz));
  let here = cellOf(x, z);
  let target: { x: number; z: number } | null = null;
  for (let hop = 0; hop < 8; hop++) {
    const next = downhill(dist, here);
    if (next === -1) break;
    const centre = cellCentre(next);
    if (hop > 0 && !clearWalk(x, z, centre.x, centre.z)) break;
    target = centre;
    here = next;
    if (dist[next] === 0) break;
  }
  return target ? unit(target.x - x, target.z - z) : null;
}

function downhill(dist: Int32Array, i: number): number {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  let best = -1;
  let bestD = dist[i] === -1 ? Infinity : dist[i];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nc = c + dc;
      const nr = r + dr;
      if ((!dc && !dr) || nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const n = nr * COLS + nc;
      if (dist[n] !== -1 && dist[n] < bestD) {
        best = n;
        bestD = dist[n];
      }
    }
  }
  return best;
}

function clearWalk(ax: number, az: number, bx: number, bz: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (pointBlocked(ax + (bx - ax) * t, az + (bz - az) * t, RULES.radius)) return false;
  }
  return true;
}

function unit(x: number, z: number) {
  const d = Math.hypot(x, z) || 1;
  return { x: x / d, z: z / d };
}

export class CpuBrain {
  private thinkIn = 0;
  private seenFor = 0;
  private strafe = 1;
  private strafeIn = 1.5;
  private dodged = new Set<number>();
  private move = { x: 0, z: 0 };
  /** Where to walk, re-pathed every frame; null means use `move` as is. */
  private goal: { x: number; z: number } | null = null;
  private push = 1;
  private wantFire = false;

  private readonly level: (typeof LEVELS)[Difficulty];

  constructor(
    private readonly id: 0 | 1,
    private readonly rng: Rng,
    difficulty: Difficulty = "normal",
  ) {
    this.level = LEVELS[difficulty];
  }

  input(s: GonzState, dt: number): Input {
    const me = s.fighters[this.id];
    const foe = s.fighters[this.id === 0 ? 1 : 0];
    if (!me.alive || s.status !== "playing" || s.countdown > 0) {
      this.seenFor = 0;
      return { mx: 0, mz: 0, fire: false, dash: false };
    }

    const sees = foe.alive && lineOfSight(me.x, me.z, foe.x, foe.z);
    this.seenFor = sees ? this.seenFor + dt : 0;
    this.strafeIn -= dt;
    if (this.strafeIn <= 0) {
      this.strafe = -this.strafe;
      this.strafeIn = 0.9 + this.rng() * 1.4;
    }

    this.thinkIn -= dt;
    if (this.thinkIn <= 0) {
      this.thinkIn = THINK_EVERY;
      this.think(s, me, foe, sees);
    }

    if (this.goal) this.move = pathDirection(me.x, me.z, this.goal.x, this.goal.z) ?? { x: 0, z: 0 };
    const dash = this.shouldDodge(s, me);
    const aimedAt = foe.alive && Math.abs(angleDiff(me.aim, Math.atan2(foe.z - me.z, foe.x - me.x))) < RULES.assistCone * 0.8;
    const fire = this.wantFire && sees && aimedAt && this.seenFor >= this.level.reaction && this.rng() < this.level.trigger;
    const push = dash ? 1 : this.push * this.level.speed;
    return { mx: this.move.x * push, mz: this.move.z * push, fire, dash };
  }

  private think(s: GonzState, me: Fighter, foe: Fighter, sees: boolean) {
    this.wantFire = false;
    this.push = 1;
    this.goal = null;

    // Hurt and a health pack is out: go get it. Grab triple shot if it's closer to us.
    const health = s.pickups.find((p) => p.kind === "health");
    const triple = s.pickups.find((p) => p.kind === "triple");
    const near = (p: { x: number; z: number }) => Math.hypot(p.x - me.x, p.z - me.z);
    const goal =
      health && me.hp <= 40
        ? health
        : triple && me.triple === 0 && (!foe.alive || near(triple) < Math.hypot(triple.x - foe.x, triple.z - foe.z))
          ? triple
          : null;
    if (goal && !(sees && near(goal) > 6)) {
      this.walkTo(goal.x, goal.z);
      this.wantFire = sees;
      return;
    }

    if (!foe.alive) {
      // Wander toward the middle while waiting.
      this.walkTo(0, 0.5);
      if (Math.hypot(me.x, me.z) < 2) this.push = 0;
      return;
    }

    if (!sees) {
      this.walkTo(foe.x, foe.z);
      return;
    }

    // In sight: approach at an angle (strafing), or stand and turn to shoot when close.
    const toFoe = Math.atan2(foe.z - me.z, foe.x - me.x);
    const dist = Math.hypot(foe.x - me.x, foe.z - me.z);
    this.wantFire = true;
    if (dist < 4.5) {
      this.move = { x: Math.cos(toFoe), z: Math.sin(toFoe) };
      this.push = 0.25;
      return;
    }
    const heading = toFoe + this.strafe * RULES.assistCone * 0.6;
    const dir = { x: Math.cos(heading), z: Math.sin(heading) };
    if (pointBlocked(me.x + dir.x * 0.8, me.z + dir.z * 0.8, RULES.radius)) this.walkTo(foe.x, foe.z);
    else this.move = dir;
  }

  private walkTo(x: number, z: number) {
    this.goal = { x, z };
  }

  /** Dash sideways, now and then, when a bullet is about to hit. */
  private shouldDodge(s: GonzState, me: Fighter): boolean {
    if (me.dashCooldown > 0) return false;
    for (const b of s.bullets) {
      if (b.owner === this.id || this.dodged.has(b.id)) continue;
      const rx = me.x - b.x;
      const rz = me.z - b.z;
      const along = (rx * b.vx + rz * b.vz) / RULES.bulletSpeed;
      if (along < 0 || along > 3.5) continue;
      const miss = Math.abs(rx * b.vz - rz * b.vx) / RULES.bulletSpeed;
      if (miss > RULES.radius + 0.2) continue;
      this.dodged.add(b.id);
      if (this.dodged.size > 64) this.dodged = new Set([b.id]);
      if (this.rng() > this.level.dodge) continue;
      // Side-step perpendicular to the bullet.
      const side = this.rng() < 0.5 ? 1 : -1;
      const dx = (-b.vz / RULES.bulletSpeed) * side;
      const dz = (b.vx / RULES.bulletSpeed) * side;
      if (pointBlocked(me.x + dx * 2.5, me.z + dz * 2.5, RULES.radius)) return false;
      this.move = { x: dx, z: dz };
      this.goal = null;
      this.push = 1;
      return true;
    }
    return false;
  }
}
