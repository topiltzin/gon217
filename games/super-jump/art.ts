import { BOSS_HP, type Enemy, type JumpState, PLATFORM_H, type Platform, TILE } from "./logic";
import { boltPath, heartPath } from "./scenery";
import { rgba, shade } from "./palette";

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Draws a limb as a thick rounded stroke with a dark outline. */
export function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string, outline = "#07200f") {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + 1.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** The ground (or platform) under a point, if any is within reach. */
function groundBelow(s: JumpState, x: number, y: number): number | null {
  const tx = Math.floor(x / TILE);
  let best: number | null = null;
  for (let ty = Math.max(0, Math.floor((y - 1) / TILE)); ty < s.level.height; ty++) {
    if (tx >= 0 && tx < s.level.width && s.level.solid[ty][tx]) {
      best = ty * TILE;
      break;
    }
  }
  for (const pl of s.platforms) {
    if (x > pl.px && x < pl.px + pl.w && pl.py >= y - 2 && (best === null || pl.py < best)) best = pl.py;
  }
  return best;
}

export function blobShadow(ctx: Ctx, s: JumpState, cx: number, feetY: number, halfW: number) {
  const gy = groundBelow(s, cx, feetY);
  if (gy === null) return;
  const height = gy - feetY;
  if (height > 56) return;
  const a = 0.38 * (1 - Math.max(0, height) / 56);
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(cx, gy + 0.3, halfW * (1 - height / 160), 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Villains                                                           */
/* ------------------------------------------------------------------ */

function drawSlime(ctx: Ctx, s: JumpState, e: Enemy, reduced: boolean) {
  const t = s.time;
  const squish = reduced ? 0 : Math.sin(t * 7 + e.x * 0.3) * 0.09;
  const w = e.w * (1 + squish);
  const h = e.h * (1 - squish);
  const cx = e.x + e.w / 2;
  const bottom = e.y + e.h;
  blobShadow(ctx, s, cx, bottom, 6);
  ctx.save();
  ctx.translate(cx, bottom);
  const dir = e.vx < 0 ? -1 : 1;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.bezierCurveTo(-w / 2 - 1, -h * 0.9, -w * 0.2, -h * 1.25, 0, -h * 1.1);
    ctx.bezierCurveTo(w * 0.2, -h * 1.25, w / 2 + 1, -h * 0.9, w / 2, 0);
    ctx.quadraticCurveTo(0, 1.6, -w / 2, 0);
    ctx.closePath();
  };
  ctx.fillStyle = "#101a08";
  ctx.save();
  ctx.scale(1.12, 1.12);
  ctx.translate(0, 0.4);
  body();
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(0, -h * 1.2, 0, 0);
  g.addColorStop(0, "#c4e268");
  g.addColorStop(0.5, "#6f9a2a");
  g.addColorStop(1, "#2e470e");
  ctx.fillStyle = g;
  body();
  ctx.fill();
  // Shine and bubbles.
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.2, -h * 0.85, 2.4, 1.2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.arc(w * 0.25, -h * 0.4, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // Big yellow eyes with slit pupils, looking where it walks.
  for (const ex of [-2.8, 2.8]) {
    ctx.fillStyle = "#101a08";
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.6, -h * 0.55, 2.4, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe85a";
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.6, -h * 0.55, 1.9, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101a08";
    ctx.fillRect(ex + dir * 1.2 - 0.35, -h * 0.55 - 1.8, 0.7, 3.6);
  }
  // Bubbles rising in the goo.
  ctx.fillStyle = "rgba(230,255,160,0.4)";
  ctx.beginPath();
  ctx.arc(-w * 0.28, -h * 0.25, 0.8, 0, Math.PI * 2);
  ctx.arc(w * 0.3, -h * 0.75 - (reduced ? 0 : Math.abs(Math.sin(t * 3 + e.x)) * 1.5), 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#101a08";
  ctx.lineWidth = 0.9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4.8, -h * 0.55 - 3.2);
  ctx.lineTo(-1, -h * 0.55 - 1.6);
  ctx.moveTo(4.8, -h * 0.55 - 3.2);
  ctx.lineTo(1, -h * 0.55 - 1.6);
  ctx.stroke();
  // Little jagged grin.
  ctx.fillStyle = "#101a08";
  ctx.beginPath();
  ctx.moveTo(-2.4 + dir * 0.4, -h * 0.2);
  ctx.lineTo(-1.2 + dir * 0.4, -h * 0.05);
  ctx.lineTo(0 + dir * 0.4, -h * 0.2);
  ctx.lineTo(1.2 + dir * 0.4, -h * 0.05);
  ctx.lineTo(2.4 + dir * 0.4, -h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDrone(ctx: Ctx, s: JumpState, e: Enemy, reduced: boolean) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.max(-0.2, Math.min(0.2, e.vx * 0.008)));
  // Thruster glow.
  const flick = reduced ? 1 : 0.7 + Math.sin(s.time * 40 + e.x) * 0.3;
  const glow = ctx.createRadialGradient(0, 6, 0, 0, 6, 7);
  glow.addColorStop(0, `rgba(255,170,70,${0.8 * flick})`);
  glow.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-7, -1, 14, 14);
  // Rotors: a fast blur.
  const spin = reduced ? 0 : Math.sin(s.time * 60 + e.x);
  ctx.fillStyle = "rgba(210,220,230,0.55)";
  ctx.beginPath();
  ctx.ellipse(-4.5, -6, 4.5 * Math.abs(spin * 0.5 + 0.5) + 1.5, 0.9, 0, 0, Math.PI * 2);
  ctx.ellipse(4.5, -6, 4.5 * Math.abs(-spin * 0.5 + 0.5) + 1.5, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a3040";
  ctx.fillRect(-4.8, -6, 0.9, 3);
  ctx.fillRect(3.9, -6, 0.9, 3);
  // Body.
  ctx.fillStyle = "#10141f";
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, "#c9d2de");
  g.addColorStop(0.5, "#7f8ba0");
  g.addColorStop(1, "#3d4659");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.2, 4.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(-2.4, -2.6, 2.6, 1, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // The red eye, which looks toward its way of travel.
  const dir = e.vx < 0 ? -1 : 1;
  ctx.fillStyle = "#1a0508";
  ctx.beginPath();
  ctx.arc(dir * 2.2, 0.4, 2.6, 0, Math.PI * 2);
  ctx.fill();
  const pulse = reduced ? 1 : 0.65 + Math.sin(s.time * 6 + e.x) * 0.35;
  ctx.fillStyle = `rgba(255,50,60,${pulse})`;
  ctx.beginPath();
  ctx.arc(dir * 2.4, 0.4, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(dir * 2.4 - 0.4, -0.3, 0.7, 0.7);
  ctx.restore();
}

function drawBoss(ctx: Ctx, s: JumpState, e: Enemy, reduced: boolean) {
  const cx = e.x + e.w / 2;
  const bottom = e.y + e.h;
  const flash = e.hurt > 0 && !reduced && Math.floor(s.time * 16) % 2 === 0;
  const dir = s.player.x < e.x ? -1 : 1;
  blobShadow(ctx, s, cx, bottom, 14);
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.scale(dir, 1);
  const metal = (hi: string, lo: string, y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, flash ? "#ffffff" : hi);
    g.addColorStop(1, flash ? "#ffd0d0" : lo);
    return g;
  };
  const stomp = Math.sin(s.time * 8) * (Math.abs(e.vx) > 1 && e.onGround ? 1.2 : 0);
  // Legs.
  for (const [x, off] of [[-7, stomp], [3, -stomp]] as const) {
    ctx.fillStyle = "#12141c";
    ctx.fillRect(x - 0.6, -9.6 + off * 0.3, 9.2, 9.6);
    ctx.fillStyle = metal("#7a8498", "#3a4152", -9, 0);
    ctx.fillRect(x, -9 + off * 0.3, 8, 8.6);
  }
  // Torso.
  ctx.fillStyle = "#12141c";
  ctx.beginPath();
  ctx.roundRect(-12.6, -24, 25.2, 16, 3);
  ctx.fill();
  ctx.fillStyle = metal("#a9b3c6", "#4a5266", -24, -8);
  ctx.beginPath();
  ctx.roundRect(-12, -23.4, 24, 14.8, 2.6);
  ctx.fill();
  // Glowing core.
  const pulse = reduced ? 1 : 0.7 + Math.sin(s.time * 5) * 0.3;
  const core = ctx.createRadialGradient(2, -15, 0, 2, -15, 6);
  core.addColorStop(0, `rgba(255,230,160,${pulse})`);
  core.addColorStop(0.5, `rgba(255,70,50,${0.9 * pulse})`);
  core.addColorStop(1, "rgba(255,40,40,0)");
  ctx.fillStyle = core;
  ctx.fillRect(-6, -21, 16, 12);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-3.5, -18.5, 11, 7);
  // Head with a visor.
  ctx.fillStyle = "#12141c";
  ctx.beginPath();
  ctx.roundRect(-6.2, -31.4, 13.4, 9, 2.4);
  ctx.fill();
  ctx.fillStyle = metal("#8c97ab", "#3f4659", -31, -23);
  ctx.beginPath();
  ctx.roundRect(-5.6, -30.8, 12.2, 7.8, 2);
  ctx.fill();
  ctx.fillStyle = "#12050a";
  ctx.fillRect(-1, -28.6, 7.4, 3.2);
  const scan = reduced ? 0.5 : (Math.sin(s.time * 3) + 1) / 2;
  ctx.fillStyle = "#ff3a45";
  ctx.fillRect(-0.4 + scan * 4.4, -28, 2.4, 2);
  // Shoulder spikes and arms.
  ctx.fillStyle = "#58607a";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 11, -23);
    ctx.lineTo(side * 14.5, -29);
    ctx.lineTo(side * 8.4, -23.4);
    ctx.fill();
  }
  limb(ctx, 11, -19, 13.4, -12 + stomp * 0.2, 4.4, "#7a8498");
  ctx.fillStyle = "#2a2f3c";
  ctx.beginPath();
  ctx.arc(13.4, -11.2 + stomp * 0.2, 3.2, 0, Math.PI * 2);
  ctx.fill();
  limb(ctx, -11, -19, -13.4, -12 - stomp * 0.2, 4.4, "#5a6378");
  ctx.beginPath();
  ctx.arc(-13.4, -11.2 - stomp * 0.2, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Health pips.
  const px = cx - (BOSS_HP * 5) / 2;
  for (let i = 0; i < BOSS_HP; i++) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(px + i * 5 - 0.5, e.y - 13.5, 5, 4);
    ctx.fillStyle = i < e.hp ? "#ff4a55" : "#3a2a30";
    ctx.fillRect(px + i * 5, e.y - 13, 4, 3);
  }
}

export function drawEnemy(ctx: Ctx, s: JumpState, e: Enemy, reduced: boolean) {
  if (e.kind === "flyer") drawDrone(ctx, s, e, reduced);
  else if (e.kind === "boss") drawBoss(ctx, s, e, reduced);
  else drawSlime(ctx, s, e, reduced);
}

/* ------------------------------------------------------------------ */
/* Pickups, hazards and landmarks                                     */
/* ------------------------------------------------------------------ */

export function drawCoin(ctx: Ctx, cx: number, cy: number, time: number, phase: number, reduced: boolean) {
  const bob = reduced ? 0 : Math.sin(time * 4 + phase) * 1.4;
  const spin = reduced ? 1 : Math.cos(time * 5 + phase);
  const w = Math.max(0.9, Math.abs(spin) * 4.6);
  const y = cy + bob;
  const glow = ctx.createRadialGradient(cx, y, 0, cx, y, 9);
  glow.addColorStop(0, "rgba(255,220,90,0.35)");
  glow.addColorStop(1, "rgba(255,220,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 9, y - 9, 18, 18);
  ctx.fillStyle = "#7a4a08";
  ctx.beginPath();
  ctx.ellipse(cx, y, w + 0.7, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(cx - w, y - 5, cx + w, y + 5);
  g.addColorStop(0, "#fff3a0");
  g.addColorStop(0.5, "#ffc738");
  g.addColorStop(1, "#d98a10");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, y, w, 4.9, 0, 0, Math.PI * 2);
  ctx.fill();
  if (w > 2.4) {
    ctx.strokeStyle = "rgba(160,90,10,0.6)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(cx, y, w * 0.6, 3.1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(170,100,10,0.75)";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? 2.2 : 0.95;
      ctx.lineTo(cx + Math.cos(a) * rr * Math.min(1, w / 3.6), y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(cx - w * 0.78, y - 3.8, 0.8, 2.6);
  }
}

export function drawItem(ctx: Ctx, kind: "cowl" | "heart", cx: number, cy: number, time: number, reduced: boolean) {
  const bob = reduced ? 0 : Math.sin(time * 3 + cx) * 1.6;
  const y = cy + bob;
  const pulse = reduced ? 1 : 0.8 + Math.sin(time * 6 + cx) * 0.2;
  const col = kind === "cowl" ? "#3dff8a" : "#ff6a8e";
  const glow = ctx.createRadialGradient(cx, y, 0, cx, y, 14);
  glow.addColorStop(0, rgba(col, 0.6 * pulse));
  glow.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 14, y - 14, 28, 28);
  if (kind === "cowl") {
    const orb = ctx.createRadialGradient(cx - 1.5, y - 1.8, 0.5, cx, y, 6);
    orb.addColorStop(0, "#d8ffe6");
    orb.addColorStop(0.5, "#2fd070");
    orb.addColorStop(1, "#0d6a38");
    ctx.fillStyle = "#06240f";
    ctx.beginPath();
    ctx.arc(cx, y, 6.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(cx, y, 5.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    boltPath(ctx, cx, y, 0.85);
    ctx.fill();
  } else {
    ctx.fillStyle = "#4a0f22";
    heartPath(ctx, cx, y + 0.4, 12.6);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y - 5, 0, y + 5);
    g.addColorStop(0, "#ff9ab0");
    g.addColorStop(1, "#e0305a");
    ctx.fillStyle = g;
    heartPath(ctx, cx, y, 11.4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(cx - 3.2, y - 3.2, 1.6, 1.6);
  }
}

export function drawSpikes(ctx: Ctx, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = "#14161e";
  ctx.fillRect(x, y + 13, TILE, 3);
  for (let i = 0; i < 4; i++) {
    const bx = x + i * 4;
    ctx.fillStyle = "#14161e";
    ctx.beginPath();
    ctx.moveTo(bx - 0.4, y + 14);
    ctx.lineTo(bx + 2, y + 5.4);
    ctx.lineTo(bx + 4.4, y + 14);
    ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + 4, 0);
    g.addColorStop(0, "#f0f4f8");
    g.addColorStop(0.5, "#aab4c2");
    g.addColorStop(1, "#5d6678");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx + 0.2, y + 14);
    ctx.lineTo(bx + 2, y + 6.4);
    ctx.lineTo(bx + 3.8, y + 14);
    ctx.fill();
  }
}

export function drawPlatform(ctx: Ctx, pl: Platform, time: number, reduced: boolean) {
  const x = Math.round(pl.px * 4) / 4;
  const y = Math.round(pl.py * 4) / 4;
  // Hover glow underneath.
  const flick = reduced ? 1 : 0.75 + Math.sin(time * 12 + pl.x) * 0.25;
  for (let gx = x + 4; gx < x + pl.w - 2; gx += 10) {
    const g = ctx.createRadialGradient(gx, y + PLATFORM_H + 2, 0, gx, y + PLATFORM_H + 2, 7);
    g.addColorStop(0, `rgba(80,220,255,${0.5 * flick})`);
    g.addColorStop(1, "rgba(80,220,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(gx - 7, y + PLATFORM_H - 3, 14, 14);
  }
  ctx.fillStyle = "#0e1118";
  ctx.beginPath();
  ctx.roundRect(x - 0.6, y - 0.6, pl.w + 1.2, PLATFORM_H + 1.2, 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + PLATFORM_H);
  g.addColorStop(0, "#e4eaf2");
  g.addColorStop(0.4, "#9aa6b8");
  g.addColorStop(1, "#4b5568");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, pl.w, PLATFORM_H, 1.6);
  ctx.fill();
  ctx.fillStyle = "#3dd6ff";
  ctx.fillRect(x + 3, y + PLATFORM_H - 2, pl.w - 6, 0.9);
  ctx.fillStyle = "rgba(20,24,34,0.65)";
  for (let rx = x + 3.5; rx < x + pl.w - 2; rx += 8) {
    ctx.beginPath();
    ctx.arc(rx, y + 2, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCheckpoint(ctx: Ctx, tx: number, ty: number, reached: boolean, time: number, reduced: boolean) {
  const x = tx * TILE + 8;
  const base = (ty + 1) * TILE;
  ctx.fillStyle = "#12141c";
  ctx.fillRect(x - 2.4, base - 29, 4.8, 29);
  const g = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
  g.addColorStop(0, "#d7dde6");
  g.addColorStop(1, "#6a7488");
  ctx.fillStyle = g;
  ctx.fillRect(x - 1.8, base - 28, 3.6, 28);
  ctx.fillStyle = "#12141c";
  ctx.fillRect(x - 4.6, base - 3, 9.2, 3);
  const colour = reached ? "#3dff8a" : "#ff4a5a";
  const pulse = reduced || !reached ? 0.8 : 0.7 + Math.sin(time * 5) * 0.3;
  const glow = ctx.createRadialGradient(x, base - 32, 0, x, base - 32, 18);
  glow.addColorStop(0, rgba(colour, (reached ? 0.7 : 0.35) * pulse));
  glow.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - 18, base - 50, 36, 36);
  ctx.fillStyle = shade(colour, -0.2);
  ctx.beginPath();
  ctx.arc(x, base - 32, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, base - 32, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(x - 1.8, base - 34, 1.4, 1.4);
}

/** The goal: a tall pole with a waving banner; while a boss lives the banner is locked and red. */
export function drawFlag(ctx: Ctx, tx: number, ty: number, time: number, locked: boolean, reduced: boolean) {
  const x = tx * TILE + 7;
  const base = (ty + 1) * TILE;
  const top = base - 7 * TILE;
  ctx.fillStyle = "#12141c";
  ctx.beginPath();
  ctx.roundRect(x - 6.4, base - 8.8, 16.8, 8.8, 1.6);
  ctx.fill();
  const stone = ctx.createLinearGradient(0, base - 8, 0, base);
  stone.addColorStop(0, "#c4ccd6");
  stone.addColorStop(1, "#6a7488");
  ctx.fillStyle = stone;
  ctx.fillRect(x - 5.6, base - 8, 15.2, 7.4);
  const pole = ctx.createLinearGradient(x - 1.5, 0, x + 1.5, 0);
  pole.addColorStop(0, "#f4f7fa");
  pole.addColorStop(1, "#8a95a8");
  ctx.fillStyle = "#12141c";
  ctx.fillRect(x - 0.8, top, 3.4, 7 * TILE - 7);
  ctx.fillStyle = pole;
  ctx.fillRect(x - 0.2, top + 0.4, 2.2, 7 * TILE - 8);
  ctx.fillStyle = "#12141c";
  ctx.beginPath();
  ctx.arc(x + 0.9, top - 2, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = locked ? "#ff8a8a" : "#ffd84a";
  ctx.beginPath();
  ctx.arc(x + 0.9, top - 2, 2.8, 0, Math.PI * 2);
  ctx.fill();
  // Banner cloth.
  const wave = (px: number) => (reduced ? 0 : Math.sin(time * 4 + px * 0.5) * 1.3 * (px / 16));
  const cloth = ctx.createLinearGradient(0, top, 0, top + 16);
  cloth.addColorStop(0, locked ? "#e0505a" : "#3dd67a");
  cloth.addColorStop(1, locked ? "#8a2430" : "#14804a");
  ctx.fillStyle = "#12141c";
  ctx.beginPath();
  ctx.moveTo(x + 2.4, top + 1);
  for (let px = 0; px <= 17; px += 2) ctx.lineTo(x + 2.4 + px, top + 1.6 + wave(px) + px * 0.12);
  for (let px = 17; px >= 0; px -= 2) ctx.lineTo(x + 2.4 + px, top + 15 + wave(px) - px * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(x + 2.4, top + 1.6);
  for (let px = 0; px <= 16; px += 2) ctx.lineTo(x + 2.4 + px, top + 2.2 + wave(px) + px * 0.12);
  for (let px = 16; px >= 0; px -= 2) ctx.lineTo(x + 2.4 + px, top + 14.2 + wave(px) - px * 0.35);
  ctx.closePath();
  ctx.fill();
  // Emblem.
  const ey = top + 8 + wave(8);
  ctx.fillStyle = "#ffffff";
  if (locked) {
    ctx.fillRect(x + 9, ey - 0.4, 4.4, 3.6);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x + 11.2, ey - 0.4, 1.5, Math.PI, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 3.2 : 1.4;
      ctx.lineTo(x + 11 + Math.cos(a) * r, ey + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
}
