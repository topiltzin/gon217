import { ASTEROID_RADIUS, FIELD_H, FIELD_W, type AstroState, type GameEvent } from "./logic";

/**
 * Neon vector look on a 2D canvas. Glow comes from layering a wide faint
 * stroke under a thin bright one with additive blending ('lighter'), which is
 * far cheaper than shadowBlur. Particles and shockwave rings live in fixed
 * pools, and the nebula is painted once to an offscreen canvas.
 */

const COLORS = {
  ship: "#5eead4",
  shipCore: "#e0fffb",
  bullet: "#fde047",
  rock: { 3: "#a78bfa", 2: "#38bdf8", 1: "#f472b6" } as Record<1 | 2 | 3, string>,
  power: "#facc15",
  flame: ["#fde047", "#fb923c", "#f43f5e"],
};

const MAX_PARTICLES = 420;
const MAX_RINGS = 16;
const STAR_LAYERS = [
  { count: 90, speed: 0.08, size: 1, alpha: 0.45 },
  { count: 50, speed: 0.18, size: 1.5, alpha: 0.7 },
  { count: 22, speed: 0.35, size: 2, alpha: 0.95 },
];

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Ring = { x: number; y: number; r: number; max: number; life: number; color: string };

export class Renderer {
  private readonly particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    color: "#fff",
    size: 2,
  }));
  private nextParticle = 0;
  private readonly rings: Ring[] = Array.from({ length: MAX_RINGS }, () => ({ x: 0, y: 0, r: 0, max: 1, life: 0, color: "#fff" }));
  private nextRing = 0;
  private readonly stars: { x: number; y: number }[][];
  private readonly backdrop: HTMLCanvasElement;
  private shake = 0;
  private flash = 0;
  private banner = 0;
  private bannerText = "";
  private time = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly reducedMotion: boolean,
    private readonly font: string,
    private readonly waveLabel: (n: number) => string,
  ) {
    this.stars = STAR_LAYERS.map((layer) =>
      Array.from({ length: layer.count }, () => ({ x: Math.random() * FIELD_W, y: Math.random() * FIELD_H })),
    );
    // The nebula never changes, so paint it once and blit it every frame.
    this.backdrop = document.createElement("canvas");
    this.backdrop.width = FIELD_W;
    this.backdrop.height = FIELD_H;
    const b = this.backdrop.getContext("2d")!;
    b.fillStyle = "#04030d";
    b.fillRect(0, 0, FIELD_W, FIELD_H);
    for (const [x, y, r, color] of [
      [FIELD_W * 0.2, FIELD_H * 0.25, 360, "rgba(124,58,237,0.22)"],
      [FIELD_W * 0.85, FIELD_H * 0.7, 320, "rgba(244,63,94,0.14)"],
      [FIELD_W * 0.55, FIELD_H * 1.05, 380, "rgba(56,189,248,0.12)"],
    ] as const) {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      b.fillStyle = g;
      b.fillRect(0, 0, FIELD_W, FIELD_H);
    }
  }

  /** Turns game events into particles, rings, shake and banners. */
  react(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case "explode": {
          const color = COLORS.rock[e.size];
          this.burst(e.x, e.y, 10 + e.size * 8, color, 60 + e.size * 40, 0.5 + e.size * 0.15);
          this.burst(e.x, e.y, 6, "#ffffff", 120, 0.3);
          this.ring(e.x, e.y, ASTEROID_RADIUS[e.size] * 1.8, color, 0.45);
          this.shake = Math.max(this.shake, e.size * 3);
          break;
        }
        case "shipHit":
          this.burst(e.x, e.y, 60, COLORS.ship, 220, 1.1);
          this.burst(e.x, e.y, 30, "#ffffff", 280, 0.6);
          this.ring(e.x, e.y, 140, COLORS.ship, 0.7);
          this.shake = 16;
          this.flash = 0.35;
          break;
        case "powerUp":
          this.ring(e.x, e.y, 70, COLORS.power, 0.5);
          this.burst(e.x, e.y, 18, COLORS.power, 140, 0.5);
          break;
        case "wave":
          this.banner = 1.8;
          this.bannerText = this.waveLabel(e.wave);
          break;
        case "shot":
          break;
      }
    }
  }

  private burst(x: number, y: number, count: number, color: string, speed: number, life: number) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.nextParticle];
      this.nextParticle = (this.nextParticle + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.max = p.life = life * (0.6 + Math.random() * 0.6);
      p.color = color;
      p.size = 1.5 + Math.random() * 2;
    }
  }

  private ring(x: number, y: number, max: number, color: string, life: number) {
    const r = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % MAX_RINGS;
    Object.assign(r, { x, y, r: 0, max, life, color });
  }

  draw(state: AstroState, thrusting: boolean, dt: number) {
    const { ctx } = this;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt);
    this.banner = Math.max(0, this.banner - dt);

    // Exhaust trail
    const { ship } = state;
    if (ship.alive && thrusting && Math.random() < 0.9) {
      const back = ship.angle + Math.PI;
      const p = this.particles[this.nextParticle];
      this.nextParticle = (this.nextParticle + 1) % MAX_PARTICLES;
      const spread = (Math.random() - 0.5) * 0.5;
      p.x = ship.x + Math.cos(back) * 12;
      p.y = ship.y + Math.sin(back) * 12;
      p.vx = ship.vx * 0.3 + Math.cos(back + spread) * 180;
      p.vy = ship.vy * 0.3 + Math.sin(back + spread) * 180;
      p.max = p.life = 0.35;
      p.color = COLORS.flame[Math.floor(Math.random() * 3)];
      p.size = 2.5;
    }

    ctx.save();
    const shake = this.reducedMotion ? 0 : this.shake;
    if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.drawImage(this.backdrop, 0, 0);
    this.drawStars(ship.vx, ship.vy, dt);

    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const rock of state.asteroids) this.drawRock(rock.x, rock.y, rock.angle, rock.size, rock.shape);
    for (const p of state.powerUps) this.drawPowerUp(p.x, p.y, p.life);

    // Bullets: short glowing streaks along their velocity
    for (const b of state.bullets) {
      const len = 0.018;
      this.glowLine(b.x, b.y, b.x - b.vx * len, b.y - b.vy * len, COLORS.bullet, 2.5);
    }

    if (ship.alive) this.drawShip(state, thrusting);
    this.drawEffects(dt);

    ctx.globalCompositeOperation = "source-over";
    if (this.banner > 0) this.drawBanner();
    ctx.restore();

    if (this.flash > 0 && !this.reducedMotion) {
      ctx.fillStyle = `rgba(244,63,94,${this.flash * 0.6})`;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }
  }

  private drawStars(vx: number, vy: number, dt: number) {
    const { ctx } = this;
    STAR_LAYERS.forEach((layer, i) => {
      ctx.fillStyle = `rgba(226,232,240,${layer.alpha})`;
      for (const s of this.stars[i]) {
        // Parallax: stars drift against the ship's motion.
        s.x = (((s.x - vx * layer.speed * dt) % FIELD_W) + FIELD_W) % FIELD_W;
        s.y = (((s.y - vy * layer.speed * dt) % FIELD_H) + FIELD_H) % FIELD_H;
        ctx.fillRect(s.x, s.y, layer.size, layer.size);
      }
    });
  }

  /** Draws a shape at each position it wraps to, so objects slide smoothly across edges. */
  private wrapped(x: number, y: number, r: number, draw: (x: number, y: number) => void) {
    const xs = [x];
    const ys = [y];
    if (x < r) xs.push(x + FIELD_W);
    if (x > FIELD_W - r) xs.push(x - FIELD_W);
    if (y < r) ys.push(y + FIELD_H);
    if (y > FIELD_H - r) ys.push(y - FIELD_H);
    for (const px of xs) for (const py of ys) draw(px, py);
  }

  private drawRock(x: number, y: number, angle: number, size: 1 | 2 | 3, shape: number[]) {
    const { ctx } = this;
    const radius = ASTEROID_RADIUS[size];
    const color = COLORS.rock[size];
    this.wrapped(x, y, radius, (cx, cy) => {
      ctx.beginPath();
      shape.forEach((m, i) => {
        const a = angle + (i / shape.length) * Math.PI * 2;
        const px = cx + Math.cos(a) * radius * m;
        const py = cy + Math.sin(a) * radius * m;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(124,58,237,0.07)";
      ctx.fill();
      this.glowStroke(color, 2);
    });
  }

  private drawShip(state: AstroState, thrusting: boolean) {
    const { ctx } = this;
    const { ship } = state;
    // Blink while the respawn shield is up.
    if (ship.shield > 0 && Math.floor(this.time * 10) % 2 === 0) return;
    this.wrapped(ship.x, ship.y, 20, (cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ship.angle);
      if (thrusting) {
        const flicker = 10 + Math.random() * 8;
        ctx.beginPath();
        ctx.moveTo(-9, -5);
        ctx.lineTo(-9 - flicker, 0);
        ctx.lineTo(-9, 5);
        this.glowStroke(COLORS.flame[1], 2);
      }
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-11, -11);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-11, 11);
      ctx.closePath();
      ctx.fillStyle = "rgba(94,234,212,0.12)";
      ctx.fill();
      this.glowStroke(state.tripleShot > 0 ? COLORS.power : COLORS.ship, 2.2);
      ctx.fillStyle = COLORS.shipCore;
      ctx.fillRect(2, -1.5, 4, 3);
      ctx.restore();
      if (ship.shield > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        this.glowStroke(COLORS.ship, 1.2);
      }
    });
  }

  private drawPowerUp(x: number, y: number, life: number) {
    const { ctx } = this;
    if (life < 2 && Math.floor(this.time * 8) % 2 === 0) return; // blink before vanishing
    const pulse = 1 + Math.sin(this.time * 6) * 0.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.time * 1.5);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 11 * pulse, Math.sin(a) * 11 * pulse);
    }
    this.glowStroke(COLORS.power, 2.5);
    ctx.beginPath();
    ctx.arc(0, 0, 15 * pulse, 0, Math.PI * 2);
    this.glowStroke(COLORS.power, 1.5);
    ctx.restore();
  }

  private drawEffects(dt: number) {
    const { ctx } = this;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      r.r += (r.max - r.r) * Math.min(1, dt * 7);
      ctx.globalAlpha = Math.max(0, r.life * 1.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      this.glowStroke(r.color, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawBanner() {
    const { ctx } = this;
    const t = this.banner / 1.8;
    ctx.globalAlpha = Math.min(1, t * 3);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 64px ${this.font}`;
    ctx.fillStyle = "rgba(167,139,250,0.35)";
    ctx.fillText(this.bannerText, FIELD_W / 2 + 3, FIELD_H / 2 + 3);
    ctx.fillStyle = "#f5f3ff";
    ctx.fillText(this.bannerText, FIELD_W / 2, FIELD_H / 2);
    ctx.globalAlpha = 1;
  }

  /** Wide faint stroke + thin bright stroke = neon glow. */
  private glowStroke(color: string, width: number) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.globalAlpha *= 0.28;
    ctx.lineWidth = width * 4;
    ctx.stroke();
    ctx.globalAlpha /= 0.28;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  private glowLine(x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    this.glowStroke(color, width);
  }
}
