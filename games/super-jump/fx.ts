import { type GameEvent, type JumpState, TILE } from "./logic";
import { VIEW_H, VIEW_W } from "./scenery";
import { PALETTES } from "./palette";

type Ctx = CanvasRenderingContext2D;

/* ---------- camera ---------- */

export type Camera = { x: number; y: number; anchorY: number; shake: number };

const maxCamX = (s: JumpState) => Math.max(0, s.level.width * TILE - VIEW_W);
const maxCamY = (s: JumpState) => Math.max(0, s.level.height * TILE - VIEW_H);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function createCamera(s: JumpState): Camera {
  const p = s.player;
  const anchorY = p.y + p.h;
  return {
    x: clamp(p.x + p.w / 2 - VIEW_W / 2, 0, maxCamX(s)),
    y: clamp(anchorY - VIEW_H * 0.62, 0, maxCamY(s)),
    anchorY,
    shake: 0,
  };
}

/** Follows Deku smoothly: a little ahead of where he faces, and steady vertically while he jumps. */
export function updateCamera(cam: Camera, s: JumpState, dt: number, reduced: boolean) {
  const p = s.player;
  const ease = (rate: number) => 1 - Math.exp(-rate * dt);
  const ahead = p.facing * (Math.abs(p.vx) > 10 ? 26 : 10);
  cam.x += (clamp(p.x + p.w / 2 + ahead - VIEW_W / 2, 0, maxCamX(s)) - cam.x) * ease(reduced ? 14 : 5);
  if (p.onGround) cam.anchorY += (p.y + p.h - cam.anchorY) * ease(4);
  const targetY = clamp(cam.anchorY - VIEW_H * 0.62, 0, maxCamY(s));
  cam.y += (targetY - cam.y) * ease(reduced ? 14 : 4);
  // Never let him leave the middle band of the screen.
  cam.y = clamp(cam.y, p.y + p.h - VIEW_H * 0.85, p.y - VIEW_H * 0.18);
  cam.y = clamp(cam.y, 0, maxCamY(s));
  cam.shake = Math.max(0, cam.shake - dt * 14);
}

/* ---------- particles ---------- */

type Shape = "dot" | "spark" | "ring" | "heart" | "chunk" | "smoke" | "streak";
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: Shape;
  rot: number;
  spin: number;
  grow: number;
};

export type Fx = {
  particles: Particle[];
  runTimer: number;
  auraTimer: number;
  emit: (events: GameEvent[], s: JumpState, cam: Camera, reduced: boolean) => void;
  update: (dt: number, s: JumpState, reduced: boolean) => void;
  draw: (ctx: Ctx) => void;
};

const MAX_PARTICLES = 160;

export function createFx(): Fx {
  const fx: Fx = {
    particles: [],
    runTimer: 0,
    auraTimer: 0,
    emit(events, s, cam, reduced) {
      for (const e of events) {
        // Screen shake and camera kicks are skipped for people who asked for less motion.
        const shake = (amount: number) => {
          if (!reduced) cam.shake = Math.max(cam.shake, amount);
        };
        if (e.kind === "jump") dust(fx, e.x, e.y, 5, 1);
        else if (e.kind === "land") dust(fx, e.x, e.y, 8, 1.4);
        else if (e.kind === "coin") sparkle(fx, e.x, e.y, 7, "#ffd84a");
        else if (e.kind === "brick") {
          const pal = PALETTES[s.level.theme];
          for (let i = 0; i < 9; i++) {
            fx.particles.push(p(e.x + (Math.random() - 0.5) * 10, e.y + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 120, -60 - Math.random() * 120, 420, 0.7 + Math.random() * 0.4, 2 + Math.random() * 2.4, i % 3 === 0 ? pal.brick[1] : pal.brick[0], "chunk", (Math.random() - 0.5) * 12));
          }
          dust(fx, e.x, e.y, 6, 1.2);
          shake(2);
        } else if (e.kind === "bump") dust(fx, e.x, e.y + 6, 4, 0.8);
        else if (e.kind === "stomp") {
          burst(fx, e.x, e.y, 9, "#fff4a0");
          ring(fx, e.x, e.y, "#ffffff", 14);
          shake(1.5);
        } else if (e.kind === "punch") ring(fx, e.x + s.player.facing * 6, e.y, "#7dffae", 12);
        else if (e.kind === "kill") {
          burst(fx, e.x, e.y, 12, "#9dffc0");
          smoke(fx, e.x, e.y, 5);
          ring(fx, e.x, e.y, "#ffffff", 18);
          shake(3);
        } else if (e.kind === "hurt") {
          burst(fx, e.x, e.y, 12, "#ff5a5a");
          shake(4);
        } else if (e.kind === "power") {
          burst(fx, e.x, e.y, 18, "#5dff9d");
          ring(fx, e.x, e.y, "#5dff9d", 26);
          ring(fx, e.x, e.y, "#ffffff", 16);
          shake(2);
        } else if (e.kind === "heart") {
          for (let i = 0; i < 6; i++) fx.particles.push(p(e.x + (Math.random() - 0.5) * 14, e.y, (Math.random() - 0.5) * 30, -40 - Math.random() * 30, -30, 1 + Math.random() * 0.4, 3 + Math.random() * 1.5, "#ff6a8e", "heart", 0));
        } else if (e.kind === "checkpoint") {
          for (let i = 0; i < 14; i++) fx.particles.push(p(e.x + (Math.random() - 0.5) * 10, e.y - 28, (Math.random() - 0.5) * 50, -30 - Math.random() * 60, 60, 0.9, 1.4, "#3dff8a", "spark", 0));
        } else if (e.kind === "bossHit") {
          burst(fx, e.x, e.y, 16, "#ffb35a");
          smoke(fx, e.x, e.y, 6);
          shake(5);
        } else if (e.kind === "bossDown") {
          for (let i = 0; i < 4; i++) {
            burst(fx, e.x + (Math.random() - 0.5) * 22, e.y + (Math.random() - 0.5) * 22, 14, i % 2 ? "#ffb35a" : "#fff0a0");
            smoke(fx, e.x + (Math.random() - 0.5) * 22, e.y + (Math.random() - 0.5) * 22, 6);
          }
          ring(fx, e.x, e.y, "#ffffff", 40);
          shake(9);
        }
      }
      if (fx.particles.length > MAX_PARTICLES) fx.particles.splice(0, fx.particles.length - MAX_PARTICLES);
    },
    update(dt, s, reduced) {
      for (const q of fx.particles) {
        q.life -= dt;
        q.vy += q.ay * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.rot += q.spin * dt;
        q.size += q.grow * dt;
        if (q.shape === "smoke") q.vx *= 0.96;
      }
      fx.particles = fx.particles.filter((q) => q.life > 0);
      if (reduced) return;
      const pl = s.player;
      // Dust kicked up while running.
      fx.runTimer -= dt;
      if (pl.onGround && Math.abs(pl.vx) > 55 && fx.runTimer <= 0) {
        fx.runTimer = pl.cowl > 0 ? 0.05 : 0.1;
        fx.particles.push(p(pl.x + pl.w / 2 - Math.sign(pl.vx) * 4, pl.y + pl.h - 1, -Math.sign(pl.vx) * 14, -8 - Math.random() * 8, 20, 0.35, 1.6 + Math.random(), "rgba(230,220,200,0.6)", "smoke", 0, 6));
      }
      // Green sparks off a Full Cowl.
      fx.auraTimer -= dt;
      if (pl.cowl > 0 && fx.auraTimer <= 0) {
        fx.auraTimer = 0.04;
        fx.particles.push(p(pl.x + pl.w / 2 + (Math.random() - 0.5) * 12, pl.y + Math.random() * pl.h, (Math.random() - 0.5) * 20, -30 - Math.random() * 30, 0, 0.45, 1.2, Math.random() < 0.5 ? "#7dffae" : "#ffffff", "spark", 0));
      }
    },
    draw(ctx) {
      for (const q of fx.particles) {
        const a = Math.max(0, Math.min(1, q.life / q.max));
        ctx.save();
        ctx.translate(q.x, q.y);
        if (q.shape === "ring") {
          ctx.strokeStyle = q.color;
          ctx.globalAlpha = a * 0.9;
          ctx.lineWidth = 1.6 * a + 0.3;
          ctx.beginPath();
          ctx.arc(0, 0, q.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (q.shape === "smoke") {
          ctx.globalAlpha = a * 0.7;
          ctx.fillStyle = q.color;
          ctx.beginPath();
          ctx.arc(0, 0, q.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (q.shape === "heart") {
          ctx.globalAlpha = a;
          ctx.fillStyle = q.color;
          ctx.beginPath();
          const s2 = q.size;
          ctx.moveTo(0, s2 * 0.9);
          ctx.bezierCurveTo(-s2 * 1.5, -s2 * 0.1, -s2 * 0.9, -s2 * 1.1, 0, -s2 * 0.35);
          ctx.bezierCurveTo(s2 * 0.9, -s2 * 1.1, s2 * 1.5, -s2 * 0.1, 0, s2 * 0.9);
          ctx.fill();
        } else if (q.shape === "chunk") {
          ctx.rotate(q.rot);
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.fillStyle = q.color;
          ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(-q.size / 2, q.size / 2 - 0.7, q.size, 0.7);
        } else if (q.shape === "streak") {
          ctx.globalAlpha = a;
          ctx.strokeStyle = q.color;
          ctx.lineWidth = q.size;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-q.vx * 0.05, -q.vy * 0.05);
          ctx.stroke();
        } else {
          // Sparks: a soft halo and a bright core, no gradients (they are costly in bulk).
          ctx.globalCompositeOperation = "lighter";
          const r = q.size * (q.shape === "spark" ? 1.6 : 1.3);
          ctx.fillStyle = q.color;
          ctx.globalAlpha = a * 0.35;
          ctx.beginPath();
          ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
  return fx;
}

function p(
  x: number,
  y: number,
  vx: number,
  vy: number,
  ay: number,
  life: number,
  size: number,
  color: string,
  shape: Shape,
  spin: number,
  grow = 0,
): Particle {
  return { x, y, vx, vy, ay, life, max: life, size, color, shape, rot: 0, spin, grow };
}

function dust(fx: Fx, x: number, y: number, n: number, power: number) {
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? 1 : -1;
    fx.particles.push(p(x + (Math.random() - 0.5) * 6, y - 1, dir * (15 + Math.random() * 30) * power, -6 - Math.random() * 14, 30, 0.35 + Math.random() * 0.25, 1.4 + Math.random() * 1.4, "rgba(235,225,205,0.7)", "smoke", 0, 5));
  }
}

function sparkle(fx: Fx, x: number, y: number, n: number, color: string) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    fx.particles.push(p(x, y, Math.cos(a) * (30 + Math.random() * 30), Math.sin(a) * (30 + Math.random() * 30), 80, 0.4 + Math.random() * 0.2, 1, color, "spark", 0));
  }
}

function burst(fx: Fx, x: number, y: number, n: number, color: string) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const sp = 50 + Math.random() * 90;
    fx.particles.push(p(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 20, 160, 0.4 + Math.random() * 0.3, 1.2 + Math.random(), color, i % 3 === 0 ? "streak" : "spark", 0));
  }
}

function smoke(fx: Fx, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    fx.particles.push(p(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 40, -10 - Math.random() * 30, -10, 0.5 + Math.random() * 0.4, 3 + Math.random() * 3, "rgba(70,70,90,0.7)", "smoke", 0, 8));
  }
}

function ring(fx: Fx, x: number, y: number, color: string, radius: number) {
  const q = p(x, y, 0, 0, 0, 0.35, 2, color, "ring", 0, radius / 0.35);
  fx.particles.push(q);
}
