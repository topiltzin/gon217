import type { CollisionWorld } from "./collision";
import { PLAYER, newArsenal, type Inventory } from "./rules";

export type MoveInput = {
  forward: number;
  strafe: number;
  sprint: boolean;
  jump: boolean;
};

/**
 * Player body: position (feet), velocity, look angles and inventory. Movement is
 * frame-rate independent (everything scales by dt) and collides as an AABB.
 */
export class Player {
  x: number;
  y = 0;
  z: number;
  vx = 0;
  vy = 0;
  vz = 0;
  /** Radians; 0 looks towards -z. */
  yaw: number;
  pitch = 0;
  onGround = true;
  readonly inv: Inventory = { health: PLAYER.maxHealth, armor: 0, arsenal: newArsenal(), hasKey: false };

  constructor(x: number, z: number, yaw = 0) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy));
  }

  update(dt: number, input: MoveInput, collision: CollisionWorld) {
    const len = Math.hypot(input.forward, input.strafe);
    const speed = input.sprint && input.forward > 0 ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    let wx = 0;
    let wz = 0;
    if (len > 0) {
      const f = input.forward / len;
      const s = input.strafe / len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Forward is (-sin, -cos); right is (cos, -sin).
      wx = (-sin * f + cos * s) * speed;
      wz = (-cos * f - sin * s) * speed;
    }
    // Quick acceleration on the ground, a little air control when jumping.
    const blend = 1 - Math.exp(-dt * (this.onGround ? 14 : 3));
    this.vx += (wx - this.vx) * blend;
    this.vz += (wz - this.vz) * blend;

    if (input.jump && this.onGround) {
      this.vy = PLAYER.jumpVelocity;
      this.onGround = false;
    }
    this.vy -= PLAYER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.onGround = true;
    }

    collision.move(this, PLAYER.radius, this.vx * dt, this.vz * dt);
  }

  /** Pushes the player out of a circle (an enemy's body). */
  pushOutOf(cx: number, cz: number, r: number, collision: CollisionWorld) {
    const dx = this.x - cx;
    const dz = this.z - cz;
    const d = Math.hypot(dx, dz);
    const min = r + PLAYER.radius;
    if (d > 0.001 && d < min) collision.move(this, PLAYER.radius, (dx / d) * (min - d), (dz / d) * (min - d));
  }
}
