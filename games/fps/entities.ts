import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  type Scene,
} from "three";
import { ENEMY_DEFS, nextAiState, type AiState, type EnemyDef } from "./ai";
import type { EffectArt, EnemyArt, EnemyFrame } from "./art";
import { cellCenter, TILE, type EnemyKind, type PickupKind, type Spawn } from "./level";
import type { World } from "./world";

/* ---------- Particles ---------- */

const MAX_PARTICLES = 384;

/** One pooled Points cloud for blood, sparks and dust: a single draw call. */
export class Particles {
  readonly points: Points;
  private readonly pos = new Float32Array(MAX_PARTICLES * 3);
  private readonly col = new Float32Array(MAX_PARTICLES * 3);
  private readonly vel = new Float32Array(MAX_PARTICLES * 3);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly gravity = new Float32Array(MAX_PARTICLES);
  private next = 0;
  readonly material: PointsMaterial;

  constructor(scene: Scene) {
    const geometry = new BufferGeometry();
    this.pos.fill(-1000);
    geometry.setAttribute("position", new BufferAttribute(this.pos, 3));
    geometry.setAttribute("color", new BufferAttribute(this.col, 3));
    this.material = new PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x: number, y: number, z: number, count: number, rgb: number, speed: number, gravity: number, life = 0.6) {
    const r = ((rgb >> 16) & 255) / 255;
    const g = ((rgb >> 8) & 255) / 255;
    const b = (rgb & 255) / 255;
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      const k = i * 3;
      this.pos[k] = x;
      this.pos[k + 1] = y;
      this.pos[k + 2] = z;
      const shade = 0.7 + Math.random() * 0.3;
      this.col[k] = r * shade;
      this.col[k + 1] = g * shade;
      this.col[k + 2] = b * shade;
      this.vel[k] = (Math.random() - 0.5) * 2 * speed;
      this.vel[k + 1] = Math.random() * speed * 1.2;
      this.vel[k + 2] = (Math.random() - 0.5) * 2 * speed;
      this.life[i] = life * (0.6 + Math.random() * 0.6);
      this.gravity[i] = gravity;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[k + 1] = -1000;
        continue;
      }
      this.vel[k + 1] -= this.gravity[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.02) {
        this.pos[k + 1] = 0.02;
        this.vel[k] *= 0.5;
        this.vel[k + 2] *= 0.5;
        this.vel[k + 1] = 0;
      }
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/* ---------- Enemies ---------- */

/** What enemies need from the rest of the game each frame. */
export type EnemyContext = {
  world: World;
  player: { x: number; z: number; eyeY: number };
  enemies: Enemy[];
  particles: Particles;
  hurtPlayer: (amount: number) => void;
  spit: (from: Enemy) => void;
  sound: (name: "enemyAttack" | "spit") => void;
};

export class Enemy {
  readonly def: EnemyDef;
  readonly sprite: Sprite;
  private readonly material: SpriteMaterial;
  x: number;
  z: number;
  health: number;
  state: AiState = "IDLE";
  private stateTime = Math.random() * 1.5;
  private cooldown = 0;
  private sinceSeen = 99;
  private canSee = false;
  private losTimer = Math.random() * 0.3;
  private provoked = 0;
  private flash = 0;
  private anim = Math.random();
  private attackDone = false;
  private moving = false;
  private readonly home: { x: number; z: number };
  private readonly target = { x: 0, z: 0 };
  private readonly lastSeen = { x: 0, z: 0 };

  constructor(
    spawn: Spawn<EnemyKind>,
    private readonly art: EnemyArt[EnemyKind],
  ) {
    this.def = ENEMY_DEFS[spawn.kind];
    const c = cellCenter(spawn.col, spawn.row);
    this.x = c.x;
    this.z = c.z;
    this.home = { ...c };
    this.health = this.def.health;
    this.material = new SpriteMaterial({ map: art.walk0, transparent: true, alphaTest: 0.5 });
    this.sprite = new Sprite(this.material);
    this.sprite.center.set(0.5, 0);
    this.sprite.scale.set(this.def.width, this.def.height, 1);
    this.sprite.userData = { kind: "enemy", enemy: this };
    this.sprite.position.set(this.x, this.def.hover, this.z);
  }

  get alive() {
    return this.state !== "DEAD";
  }

  /** Hurts the enemy; returns true when this hit killed it. */
  hurt(amount: number, particles: Particles, hitY: number): boolean {
    if (!this.alive) return false;
    this.health -= amount;
    this.flash = 0.12;
    this.provoked = 3;
    particles.spawn(this.x, hitY, this.z, 6 + Math.min(10, amount / 3), this.def.blood, 2.2, 14);
    if (this.health > 0) return false;
    this.state = "DEAD";
    this.material.map = this.art.dead;
    this.material.color.setScalar(1);
    const mid = this.def.hover + this.def.height * 0.5;
    particles.spawn(this.x, mid, this.z, 36, this.def.blood, 4, 12, 0.9);
    particles.spawn(this.x, mid, this.z, 10, 0x2a2a1a, 3, 10, 0.9);
    return true;
  }

  alert() {
    if (this.alive) this.provoked = Math.max(this.provoked, 1);
  }

  update(dt: number, ctx: EnemyContext) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) {
      this.sprite.position.set(this.x, 0, this.z);
      this.shade(ctx);
      return;
    }
    const { player, world } = ctx;
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);

    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = 0.2 + Math.random() * 0.1;
      this.canSee = dist < this.def.sightRange && world.collision.lineOfSight(this.x, this.z, player.x, player.z);
    }
    if (this.canSee) {
      this.sinceSeen = 0;
      this.lastSeen.x = player.x;
      this.lastSeen.z = player.z;
    } else this.sinceSeen += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.provoked = Math.max(0, this.provoked - dt);
    this.stateTime += dt;

    const patrolDone = Math.hypot(this.target.x - this.x, this.target.z - this.z) < 0.6 || this.stateTime > 4;
    const next = nextAiState(this.state, this.def, {
      health: this.health,
      canSeePlayer: this.canSee,
      provoked: this.provoked > 0,
      distance: dist,
      stateTime: this.stateTime,
      sinceSeen: this.sinceSeen,
      cooldownReady: this.cooldown === 0,
      done: this.state === "ATTACK" ? this.stateTime >= this.def.windup + 0.35 : patrolDone,
    });
    if (next !== this.state) this.enter(next, ctx);

    this.moving = false;
    switch (this.state) {
      case "PATROL":
        this.stepToward(this.target.x, this.target.z, this.def.speed * 0.4, dt, ctx);
        break;
      case "ALERT":
        if (this.provoked > 0 && !this.canSee) {
          this.lastSeen.x = player.x;
          this.lastSeen.z = player.z;
        }
        break;
      case "CHASE": {
        const tx = this.canSee ? player.x : this.lastSeen.x;
        const tz = this.canSee ? player.z : this.lastSeen.z;
        const stopAt = this.def.ranged && this.canSee ? this.def.attackRange * 0.6 : this.canSee ? this.def.attackRange * 0.8 : 0.5;
        if (Math.hypot(tx - this.x, tz - this.z) > stopAt) this.stepToward(tx, tz, this.def.speed, dt, ctx);
        // Doors open for a chasing enemy, so they can follow you.
        for (const d of world.doors) {
          if (d.kind === "auto" && Math.abs(d.x - this.x) < 5 && Math.abs(d.z - this.z) < 5) d.holdOpen = Math.max(d.holdOpen, 1);
        }
        break;
      }
      case "ATTACK":
        if (!this.attackDone && this.stateTime >= this.def.windup) {
          this.attackDone = true;
          this.cooldown = this.def.cooldown;
          if (this.def.ranged) {
            ctx.spit(this);
            ctx.sound("spit");
          } else {
            ctx.sound("enemyAttack");
            if (this.canSee && dist <= this.def.attackRange + 0.6) {
              const [min, max] = this.def.damage;
              ctx.hurtPlayer(min + Math.round(Math.random() * (max - min)));
            }
          }
        }
        break;
    }

    this.separate(ctx.enemies, world);
    this.anim += dt * (this.moving ? 5 : 1.5);
    const frame: EnemyFrame =
      this.state === "ATTACK" && this.stateTime < this.def.windup + 0.25 ? "attack" : Math.floor(this.anim) % 2 ? "walk1" : "walk0";
    if (this.material.map !== this.art[frame]) this.material.map = this.art[frame];
    const bob = this.def.hover > 0 ? Math.sin(this.anim * 2) * 0.15 : 0;
    this.sprite.position.set(this.x, this.def.hover + bob, this.z);
    this.shade(ctx);
  }

  private shade(ctx: EnemyContext) {
    const l = ctx.world.lightAt(this.x, this.z);
    if (this.flash > 0) this.material.color.setScalar(2.2);
    else this.material.color.setScalar(l);
  }

  private enter(state: AiState, ctx: EnemyContext) {
    this.state = state;
    this.stateTime = 0;
    this.attackDone = false;
    if (state === "PATROL") {
      // Wander near home; back home if it had been chasing.
      const angle = Math.random() * Math.PI * 2;
      const reach = this.sinceSeen > 5 ? 0 : TILE * 1.2;
      this.target.x = this.home.x + Math.cos(angle) * reach;
      this.target.z = this.home.z + Math.sin(angle) * reach;
    }
    if (state === "ALERT" && !this.def.ranged) ctx.sound("enemyAttack");
  }

  private stepToward(tx: number, tz: number, speed: number, dt: number, ctx: EnemyContext) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    const beforeX = this.x;
    const beforeZ = this.z;
    ctx.world.collision.move(this, this.def.radius, (dx / len) * speed * dt, (dz / len) * speed * dt);
    // Blocked head-on: slide sideways so simple steering gets around corners and crates.
    if (Math.hypot(this.x - beforeX, this.z - beforeZ) < speed * dt * 0.3) {
      const side = Math.sin(this.anim * 0.7) > 0 ? 1 : -1;
      ctx.world.collision.move(this, this.def.radius, (-dz / len) * side * speed * dt, (dx / len) * side * speed * dt);
    }
    this.moving = true;
  }

  private separate(enemies: Enemy[], world: World) {
    for (const other of enemies) {
      if (other === this || !other.alive) continue;
      const dx = this.x - other.x;
      const dz = this.z - other.z;
      const d = Math.hypot(dx, dz);
      const min = this.def.radius + other.def.radius;
      if (d > 0.001 && d < min) world.collision.move(this, this.def.radius, (dx / d) * (min - d) * 0.5, (dz / d) * (min - d) * 0.5);
    }
  }

  dispose() {
    this.material.dispose();
  }
}

/* ---------- Pickups ---------- */

export class Pickup {
  readonly sprite: Sprite;
  readonly glow: Sprite;
  private readonly material: SpriteMaterial;
  taken = false;
  private readonly phase = Math.random() * Math.PI * 2;
  readonly x: number;
  readonly z: number;

  constructor(
    readonly kind: PickupKind,
    col: number,
    row: number,
    art: EffectArt,
    glowMaterial: SpriteMaterial,
  ) {
    const c = cellCenter(col, row);
    this.x = c.x;
    this.z = c.z;
    this.material = new SpriteMaterial({ map: art[kind], transparent: true, alphaTest: 0.5 });
    this.sprite = new Sprite(this.material);
    const size = kind === "shotgun" ? 1.5 : 1;
    this.sprite.scale.set(size, size, 1);
    this.glow = new Sprite(glowMaterial);
    this.glow.scale.set(2, 2, 1);
    this.sprite.position.set(this.x, 0.75, this.z);
    this.glow.position.set(this.x, 0.75, this.z);
  }

  update(time: number, world: World) {
    if (this.taken) return;
    const y = 0.75 + Math.sin(time * 2.2 + this.phase) * 0.15;
    this.sprite.position.set(this.x, y, this.z);
    this.glow.position.set(this.x, y, this.z);
    this.material.rotation = Math.sin(time * 1.7 + this.phase) * 0.15;
    const pulse = 0.85 + 0.25 * Math.sin(time * 4 + this.phase);
    this.material.color.setScalar(Math.max(0.6, world.lightAt(this.x, this.z)) * pulse);
    this.glow.scale.setScalar(1.8 + 0.3 * Math.sin(time * 4 + this.phase));
  }

  take() {
    this.taken = true;
    this.sprite.visible = false;
    this.glow.visible = false;
  }

  dispose() {
    this.material.dispose();
  }
}

/* ---------- Fireballs ---------- */

const MAX_FIREBALLS = 16;

type Fireball = { sprite: Sprite; active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; damage: number };

export class Fireballs {
  private readonly pool: Fireball[] = [];
  private readonly material: SpriteMaterial;

  constructor(scene: Scene, art: EffectArt) {
    this.material = new SpriteMaterial({ map: art.fireball, blending: AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < MAX_FIREBALLS; i++) {
      const sprite = new Sprite(this.material);
      sprite.scale.set(0.8, 0.8, 1);
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, damage: 0 });
    }
  }

  launch(x: number, y: number, z: number, tx: number, ty: number, tz: number, speed: number, damage: number) {
    const f = this.pool.find((p) => !p.active);
    if (!f) return;
    const dx = tx - x;
    const dy = ty - y;
    const dz = tz - z;
    const len = Math.hypot(dx, dy, dz) || 1;
    Object.assign(f, { active: true, x, y, z, vx: (dx / len) * speed, vy: (dy / len) * speed, vz: (dz / len) * speed, life: 4, damage });
    f.sprite.visible = true;
  }

  update(dt: number, world: World, player: { x: number; y: number; z: number }, particles: Particles, hurtPlayer: (n: number) => void) {
    for (const f of this.pool) {
      if (!f.active) continue;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      f.life -= dt;
      const hitPlayer = Math.abs(f.x - player.x) < 0.8 && Math.abs(f.z - player.z) < 0.8 && f.y > player.y && f.y < player.y + 2.1;
      const hitWorld = world.collision.overlaps(f.x, f.z, 0.1) || f.y < 0.05 || f.y > 3.95;
      if (hitPlayer) hurtPlayer(f.damage);
      if (hitPlayer || hitWorld || f.life <= 0) {
        f.active = false;
        f.sprite.visible = false;
        particles.spawn(f.x, f.y, f.z, 14, 0xff8a1a, 3, 6, 0.4);
        continue;
      }
      f.sprite.position.set(f.x, f.y, f.z);
      if (Math.random() < 0.5) particles.spawn(f.x, f.y, f.z, 1, 0xd9360b, 0.3, -1, 0.25);
    }
  }

  clear() {
    for (const f of this.pool) {
      f.active = false;
      f.sprite.visible = false;
    }
  }

  dispose() {
    this.material.dispose();
  }
}
