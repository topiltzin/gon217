import { BOSS_HP, type Enemy, type JumpState, PLATFORM_H, type Platform, type Player, TILE } from "./logic";
import { boltPath, heartPath } from "./scenery";
import { rgba, shade } from "./palette";

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Deku                                                               */
/* ------------------------------------------------------------------ */

const D = {
  outline: "#07200f",
  suit: "#1f9a52",
  suitLight: "#47d67f",
  suitDark: "#0d5a31",
  line: "#eafff0",
  skin: "#f7cba4",
  skinShade: "#dea079",
  hair: "#2a7d3c",
  hairLight: "#58bf65",
  hairDark: "#164a29",
  boot: "#dc3a2d",
  bootDark: "#8f1f1a",
  sole: "#f5f5f5",
  glove: "#f4f6f7",
  bracer: "#c8d2d8",
  bracerDark: "#8e9ba4",
  guard: "#c3ccd3",
  guardDark: "#7d8a94",
  belt: "#dfe6ea",
  iris: "#1e8d4c",
  glow: "#7dffae",
};

/** Draws a limb as a thick rounded stroke with a dark outline. */
function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = D.outline;
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

type Joint = { a1: number; a2: number };
type Pose = { bob: number; lean: number; legs: [Joint, Joint]; arms: [Joint, Joint]; fist: boolean; squint: number; headTilt: number };

const at = (x: number, y: number, len: number, angle: number): [number, number] => [x + Math.sin(angle) * len, y + Math.cos(angle) * len];

function dekuPose(p: Player, time: number, reduced: boolean): Pose {
  const cowl = p.cowl > 0;
  if (p.smashT > 0) {
    return {
      bob: 0,
      lean: 0.24,
      legs: [{ a1: 0.8, a2: 0.35 }, { a1: -0.7, a2: -0.5 }],
      arms: [{ a1: 1.5, a2: 1.55 }, { a1: -1, a2: -0.3 }],
      fist: true,
      squint: 1,
      headTilt: 0.05,
    };
  }
  if (!p.onGround) {
    if (p.vy < 0) {
      return {
        bob: 0,
        lean: 0.08,
        legs: [{ a1: 1.15, a2: -0.2 }, { a1: -0.7, a2: -1.3 }],
        arms: [{ a1: 2.1, a2: 2.45 }, { a1: -1, a2: -0.2 }],
        fist: true,
        squint: 0.6,
        headTilt: -0.1,
      };
    }
    return {
      bob: 0,
      lean: 0.04,
      legs: [{ a1: 0.4, a2: 0.15 }, { a1: -0.4, a2: -0.1 }],
      arms: [{ a1: 1.8, a2: 1.6 }, { a1: -1.6, a2: -1.4 }],
      fist: false,
      squint: 0.2,
      headTilt: 0.05,
    };
  }
  if (Math.abs(p.vx) > 8) {
    const phase = p.x * (cowl ? 0.2 : 0.24);
    const leg = (k: number): Joint => {
      const ph = phase + k * Math.PI;
      const a1 = 0.95 * Math.sin(ph);
      return { a1, a2: a1 - (0.2 + 1.15 * Math.max(0, Math.cos(ph))) };
    };
    const arm = (k: number): Joint => {
      const a1 = 1.0 * Math.sin(phase + (k + 1) * Math.PI);
      return { a1, a2: a1 + 0.9 };
    };
    return {
      bob: -Math.abs(Math.cos(phase)) * 1.1,
      lean: cowl ? 0.22 : 0.13,
      legs: [leg(0), leg(1)],
      arms: [arm(0), arm(1)],
      fist: true,
      squint: 0.4,
      headTilt: 0,
    };
  }
  const breathe = reduced ? 0 : Math.sin(time * 2.4);
  return {
    bob: breathe * 0.25,
    lean: 0,
    legs: [{ a1: 0.1, a2: 0.1 }, { a1: -0.1, a2: -0.1 }],
    arms: [{ a1: 0.12 + breathe * 0.03, a2: 0.28 }, { a1: -0.15, a2: 0.05 }],
    fist: false,
    squint: 0,
    headTilt: 0,
  };
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

function blobShadow(ctx: Ctx, s: JumpState, cx: number, feetY: number, halfW: number) {
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

function drawLegs(ctx: Ctx, pose: Pose, order: number[]) {
  for (const i of order) {
    const j = pose.legs[i];
    const [kx, ky] = at(0.4, 0, 3.6, j.a1);
    const [fx, fy] = at(kx, ky, 3.6, j.a2);
    limb(ctx, 0.4, 0, kx, ky, 3.1, i === 0 ? D.suit : D.suitDark);
    // Knee pad.
    ctx.fillStyle = D.bracer;
    ctx.beginPath();
    ctx.arc(kx, ky, 1.5, 0, Math.PI * 2);
    ctx.fill();
    limb(ctx, kx, ky, fx, fy, 3, i === 0 ? D.suit : D.suitDark);
    // Boot, tilted with the shin.
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(-j.a2 * 0.5);
    ctx.fillStyle = D.outline;
    ctx.beginPath();
    ctx.roundRect(-2.5, -2.9, 6.1, 3.9, 1.4);
    ctx.fill();
    ctx.fillStyle = i === 0 ? D.boot : D.bootDark;
    ctx.beginPath();
    ctx.roundRect(-2, -2.5, 5.2, 3, 1.1);
    ctx.fill();
    ctx.fillStyle = D.sole;
    ctx.fillRect(-2, 0, 5.2, 0.7);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-1.5, -2.2, 3, 0.6);
    ctx.restore();
  }
}

function drawArm(ctx: Ctx, pose: Pose, i: number, shoulderX: number, shoulderY: number, glow: boolean) {
  const j = pose.arms[i];
  const [ex, ey] = at(shoulderX, shoulderY, 3.5, j.a1);
  const [hx, hy] = at(ex, ey, 3.3, j.a2);
  const back = i === 1;
  limb(ctx, shoulderX, shoulderY, ex, ey, 2.9, back ? D.suitDark : D.suit);
  limb(ctx, ex, ey, hx, hy, 3.1, back ? D.bracerDark : D.bracer);
  // Glove.
  const r = pose.fist && !back ? 2.2 : 1.9;
  ctx.fillStyle = D.outline;
  ctx.beginPath();
  ctx.arc(hx, hy, r + 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glow ? D.glow : back ? "#c8cfd3" : D.glove;
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  ctx.fill();
  return [hx, hy] as const;
}

function drawHead(ctx: Ctx, pose: Pose, time: number, reduced: boolean, glow: boolean) {
  ctx.save();
  ctx.translate(0.8, -14.6);
  ctx.rotate(pose.headTilt);

  // Hood ears behind the hair.
  ctx.fillStyle = D.outline;
  for (const [x, rot] of [[-2.6, -0.35], [1.4, 0.05]]) {
    ctx.save();
    ctx.translate(x, -4.8);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-1.9, 1.5);
    ctx.lineTo(0, -5.2);
    ctx.lineTo(1.9, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const [x, rot] of [[-2.6, -0.35], [1.4, 0.05]]) {
    ctx.save();
    ctx.translate(x, -4.8);
    ctx.rotate(rot);
    ctx.fillStyle = D.suit;
    ctx.beginPath();
    ctx.moveTo(-1.4, 1.4);
    ctx.lineTo(0, -4.4);
    ctx.lineTo(1.4, 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = D.suitLight;
    ctx.beginPath();
    ctx.moveTo(-0.2, 1);
    ctx.lineTo(0.2, -3.6);
    ctx.lineTo(0.7, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Head.
  ctx.fillStyle = D.outline;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.7, 6.3, 0, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(1.5, -1.5, 1, 0, 0, 6.4);
  face.addColorStop(0, "#ffe0c0");
  face.addColorStop(1, D.skin);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.1, 5.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Messy hair: a back mass and spikes over the forehead.
  const sway = reduced ? 0 : Math.sin(time * 3) * 0.25;
  ctx.fillStyle = D.outline;
  hairShape(ctx, sway, 0.75);
  ctx.fill();
  const hg = ctx.createLinearGradient(0, -7, 0, 0);
  hg.addColorStop(0, D.hairLight);
  hg.addColorStop(1, D.hair);
  ctx.fillStyle = hg;
  hairShape(ctx, sway, 0);
  ctx.fill();
  ctx.strokeStyle = D.hairDark;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-2, -5.8);
  ctx.lineTo(-1.4, -2.4);
  ctx.moveTo(1.2, -6.2);
  ctx.lineTo(1.6, -3);
  ctx.moveTo(-4.6, -3.6);
  ctx.lineTo(-3.2, -1.6);
  ctx.stroke();

  // Eyes: big, round, a little determined.
  const eyeH = 2.6 - pose.squint * 0.9;
  for (const [ex, small] of [[0.9, 0], [4.4, 0.25]]) {
    ctx.fillStyle = D.outline;
    ctx.beginPath();
    ctx.ellipse(ex, 0.2, 1.9 - small, eyeH + 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, 0.2, 1.55 - small, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = glow ? D.glow : D.iris;
    ctx.beginPath();
    ctx.ellipse(ex + 0.35, 0.3, 1.1 - small * 0.5, Math.min(1.9, eyeH * 0.8), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#06240f";
    ctx.beginPath();
    ctx.arc(ex + 0.45, 0.35, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(ex - 0.1, -0.7, 0.8, 0.8);
  }
  // Brows.
  ctx.strokeStyle = D.hairDark;
  ctx.lineWidth = 0.9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-0.6, -2.7 + pose.squint * 0.6);
  ctx.lineTo(2.4, -3.2 - pose.squint * 0.2);
  ctx.moveTo(3.4, -3.1 - pose.squint * 0.2);
  ctx.lineTo(5.6, -2.6 + pose.squint * 0.6);
  ctx.stroke();

  // Freckles.
  ctx.fillStyle = D.skinShade;
  for (const [fx, fy] of [[-0.8, 2.6], [0.6, 3.1], [2.6, 3], [4.6, 2.6], [5.4, 3.4]]) ctx.fillRect(fx, fy, 0.55, 0.55);

  // Mouth guard.
  ctx.fillStyle = D.outline;
  ctx.beginPath();
  ctx.roundRect(0.8, 2.9, 4.9, 3.1, 1.3);
  ctx.fill();
  const gg = ctx.createLinearGradient(0, 3.8, 0, 6.4);
  gg.addColorStop(0, "#e1e8ec");
  gg.addColorStop(1, D.guardDark);
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.roundRect(1.2, 3.3, 4.1, 2.3, 1);
  ctx.fill();
  ctx.strokeStyle = D.guardDark;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (const x of [2.2, 3.2, 4.2]) {
    ctx.moveTo(x, 3.5);
    ctx.lineTo(x, 5.4);
  }
  ctx.stroke();
  ctx.restore();
}

function hairShape(ctx: Ctx, sway: number, grow: number) {
  const g = grow;
  ctx.beginPath();
  ctx.moveTo(-6.4 - g, 1.4);
  ctx.lineTo(-7.6 - g, -2.4 + sway);
  ctx.lineTo(-5.4 - g, -2.6);
  ctx.lineTo(-6.4 - g, -6 + sway);
  ctx.lineTo(-3.4, -5.2);
  ctx.lineTo(-3 - g, -8.4 + sway);
  ctx.lineTo(-0.6, -6);
  ctx.lineTo(0.8, -8.8 - g + sway);
  ctx.lineTo(2.6, -5.8);
  ctx.lineTo(4.6 + g, -7.4 + sway);
  ctx.lineTo(5, -4.4);
  ctx.lineTo(6.6 + g, -3.6);
  ctx.lineTo(5.6, -2.6);
  ctx.lineTo(2.4, -3.4);
  ctx.lineTo(-0.4, -2.6);
  ctx.lineTo(-3.6, -3.2);
  ctx.lineTo(-4.6, -0.2);
  ctx.closePath();
}

function lightning(ctx: Ctx, time: number, cx: number, cy: number, reach: number, count: number, seed: number) {
  const frame = Math.floor(time * 24);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < count; i++) {
    let h = (frame * 7919 + i * 104729 + seed) >>> 0;
    const rand = () => {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      return h / 4294967296;
    };
    const ang = rand() * Math.PI * 2;
    let x = cx + Math.cos(ang) * 4;
    let y = cy + Math.sin(ang) * 6;
    const path: [number, number][] = [[x, y]];
    for (let k = 0; k < 3; k++) {
      x += Math.cos(ang) * (reach / 3) + (rand() - 0.5) * 3;
      y += Math.sin(ang) * (reach / 3) + (rand() - 0.5) * 3;
      path.push([x, y]);
    }
    for (const [w, c] of [[1.8, rgba("#2dff80", 0.45)], [0.7, "#e8fff0"]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      path.forEach(([px, py], n) => (n === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
    }
  }
}

/** Deku, in hero costume: a side view with run, jump, punch and Full Cowl poses. */
export function drawDeku(ctx: Ctx, s: JumpState, reduced: boolean) {
  const p = s.player;
  const cowl = p.cowl > 0;
  const pose = dekuPose(p, s.time, reduced);
  const feetX = p.x + p.w / 2;
  const feetY = p.y + p.h;
  blobShadow(ctx, s, feetX, feetY, 6);

  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.scale(p.facing, 1);

  // Full Cowl: a green glow behind him and crackling lightning.
  if (cowl) {
    const pulse = reduced ? 1 : 0.85 + Math.sin(s.time * 14) * 0.15;
    const fade = Math.min(1, p.cowl / 1.5);
    const g = ctx.createRadialGradient(0, -13, 2, 0, -13, 22);
    g.addColorStop(0, rgba("#5dffa0", 0.7 * pulse * fade));
    g.addColorStop(1, rgba("#1fcf6a", 0));
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(-24, -36, 48, 48);
    ctx.globalCompositeOperation = "source-over";
    if (!reduced) lightning(ctx, s.time, 0, -13, 13, 3, 11);
  }

  const bob = pose.bob;
  ctx.translate(0, -7 + bob);
  // Legs hang from the hips; draw the back one first.
  drawLegs(ctx, pose, [1]);

  ctx.save();
  ctx.rotate(pose.lean);
  const [bx, by] = [0, 0];
  drawArm(ctx, pose, 1, bx - 0.4, by - 5.4, false);

  // Torso.
  ctx.fillStyle = D.outline;
  ctx.beginPath();
  ctx.roundRect(-4.6, -8.2, 9.2, 9.4, 2.4);
  ctx.fill();
  const tg = ctx.createLinearGradient(-4, 0, 4, 0);
  tg.addColorStop(0, D.suitDark);
  tg.addColorStop(0.45, D.suit);
  tg.addColorStop(1, D.suitLight);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(-4, -7.6, 8, 8.4, 2);
  ctx.fill();
  // White suit lines and collar.
  ctx.strokeStyle = D.line;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-2.4, -7.4);
  ctx.quadraticCurveTo(-1.2, -3.5, -2.6, 0.2);
  ctx.moveTo(2.4, -7.4);
  ctx.quadraticCurveTo(1.4, -3.5, 2.6, 0.2);
  ctx.stroke();
  ctx.fillStyle = D.line;
  ctx.fillRect(-3, -8.1, 6, 1.3);
  // Belt with support gear.
  ctx.fillStyle = D.outline;
  ctx.fillRect(-4.4, -1.9, 8.8, 2.9);
  ctx.fillStyle = D.belt;
  ctx.fillRect(-4, -1.5, 8, 2.1);
  ctx.fillStyle = D.bracerDark;
  ctx.fillRect(-3.2, -1.5, 2, 2.1);
  ctx.fillRect(1.4, -1.5, 2, 2.1);
  ctx.fillStyle = "#f2c94c";
  ctx.fillRect(-0.5, -1.4, 1.1, 1.8);

  drawHead(ctx, pose, s.time, reduced, cowl);
  const [hx, hy] = drawArm(ctx, pose, 0, 0.4, -5.6, cowl || p.smashT > 0);
  ctx.restore();

  // Front leg over the torso's lower edge.
  drawLegs(ctx, pose, [0]);

  // The punch: a crescent shockwave and sparks ahead of the fist.
  if (p.smashT > 0) {
    const q = 1 - p.smashT / 0.22;
    const scale = cowl ? 1.5 : 1;
    ctx.save();
    const fx = hx * Math.cos(pose.lean) - hy * Math.sin(pose.lean);
    const fy = hx * Math.sin(pose.lean) + hy * Math.cos(pose.lean);
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const r = (4 + q * 12 + k * 3.5) * scale;
      const a = (1 - q) * (1 - k * 0.28);
      ctx.strokeStyle = k === 0 ? rgba("#ffffff", a) : rgba("#4dff94", a * 0.8);
      ctx.lineWidth = (2.4 - k * 0.6) * (1 - q * 0.5);
      ctx.beginPath();
      ctx.arc(fx + 2, fy, r, -1.0, 1.0);
      ctx.stroke();
    }
    const burst = ctx.createRadialGradient(fx + 3, fy, 0, fx + 3, fy, 9 * scale);
    burst.addColorStop(0, rgba("#ffffff", 0.9 * (1 - q)));
    burst.addColorStop(1, rgba("#2dff80", 0));
    ctx.fillStyle = burst;
    ctx.fillRect(fx - 8, fy - 12 * scale, 24 * scale, 24 * scale);
    ctx.globalCompositeOperation = "source-over";
    if (!reduced) lightning(ctx, s.time, fx + 3, fy, 10 * scale, 4, 5);
    ctx.restore();
  }
  ctx.restore();
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
  ctx.fillStyle = "#1a0a33";
  ctx.save();
  ctx.scale(1.12, 1.12);
  ctx.translate(0, 0.4);
  body();
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(0, -h * 1.2, 0, 0);
  g.addColorStop(0, "#b46bff");
  g.addColorStop(0.5, "#7a3ad0");
  g.addColorStop(1, "#3d1a85");
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
  // Angry eyes looking where it walks.
  for (const ex of [-2.6, 2.6]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.6, -h * 0.55, 1.9, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e02040";
    ctx.beginPath();
    ctx.arc(ex + dir * 1.2, -h * 0.5, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#1a0a33";
  ctx.lineWidth = 0.9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4.8, -h * 0.55 - 3.2);
  ctx.lineTo(-1, -h * 0.55 - 1.6);
  ctx.moveTo(4.8, -h * 0.55 - 3.2);
  ctx.lineTo(1, -h * 0.55 - 1.6);
  ctx.stroke();
  // Little jagged grin.
  ctx.fillStyle = "#1a0a33";
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
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(cx - w * 0.5, y - 3.4, 0.9, 3.4);
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
