import { blobShadow, limb } from "./art";
import type { JumpState, Player } from "./logic";
import { rgba } from "./palette";

type Ctx = CanvasRenderingContext2D;

/** The playable heroes. */
export type Hero = "deku" | "bakugo";
export const HEROES: Hero[] = ["deku", "bakugo"];

/** Effect colours per hero: Deku's green lightning, Bakugo's orange explosions. */
export const HERO_ACCENT: Record<Hero, { main: string; light: string; dark: string }> = {
  deku: { main: "#3dff8a", light: "#e8fff0", dark: "#0b6b38" },
  bakugo: { main: "#ff8a1f", light: "#fff1c0", dark: "#8a3a05" },
};

/** The whole figure is drawn at this size relative to the rig's units. */
const FIGURE_SCALE = 0.86;

/* ------------------------------------------------------------------ */
/* Poses                                                              */
/* ------------------------------------------------------------------ */

type Joint = { a1: number; a2: number };
export type Pose = { bob: number; lean: number; legs: [Joint, Joint]; arms: [Joint, Joint]; fist: boolean; squint: number; headTilt: number };

const THIGH = 5;
const SHIN = 4.9;
const UPPER = 4.1;
const FORE = 3.9;
const HIP_Y = -9.8;

/** Point at `len` from (x, y), at `angle` radians from straight down (positive = forward). */
const at = (x: number, y: number, len: number, angle: number): [number, number] => [x + Math.sin(angle) * len, y + Math.cos(angle) * len];

const IDLE: Pose = {
  bob: 0,
  lean: 0,
  legs: [{ a1: 0.1, a2: 0.1 }, { a1: -0.1, a2: -0.1 }],
  arms: [{ a1: 0.12, a2: 0.28 }, { a1: -0.15, a2: 0.05 }],
  fist: false,
  squint: 0,
  headTilt: 0,
};

function heroPose(p: Player, time: number, reduced: boolean): Pose {
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
    ...IDLE,
    bob: breathe * 0.25,
    arms: [{ a1: 0.12 + breathe * 0.03, a2: 0.28 }, { a1: -0.15, a2: 0.05 }],
  };
}

/* ------------------------------------------------------------------ */
/* Shared drawing bits                                                */
/* ------------------------------------------------------------------ */

const OUT = "#0a0a10";

function vGradient(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function hGradient(ctx: Ctx, x0: number, x1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** A fill with a dark outline, from the same path. */
function inked(ctx: Ctx, fill: string | CanvasGradient, width = 0.7) {
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function lightning(ctx: Ctx, time: number, cx: number, cy: number, reach: number, count: number, seed: number, core: string, glow: string) {
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
    for (const [w, c] of [[1.8, glow], [0.7, core]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      path.forEach(([px, py], n) => (n === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
    }
  }
}

/** Jagged flame burst, used for Bakugo's explosions. */
function blast(ctx: Ctx, x: number, y: number, r: number, time: number, alpha: number) {
  const n = 11;
  const frame = Math.floor(time * 30);
  const star = (radius: number, inner: number, seed: number) => {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const wob = 0.82 + (((frame * 31 + i * 17 + seed) % 11) / 11) * 0.36;
      const rr = (i % 2 === 0 ? radius : radius * inner) * wob;
      const a = (i / (n * 2)) * Math.PI * 2;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  ctx.globalAlpha = alpha;
  star(r, 0.55, 1);
  ctx.fillStyle = "#e5471a";
  ctx.fill();
  star(r * 0.74, 0.55, 5);
  ctx.fillStyle = "#ff9a1f";
  ctx.fill();
  star(r * 0.46, 0.6, 9);
  ctx.fillStyle = "#fff2a0";
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Legs, arms and boots                                               */
/* ------------------------------------------------------------------ */

type Look = {
  suit: string;
  suitDark: string;
  suitLight: string;
  trim: string;
  pad: string;
  padDark: string;
  boot: string;
  bootDark: string;
  sole: string;
  lace: string;
  skin: string;
  skinShade: string;
};

const LOOKS: Record<Hero, Look> = {
  deku: {
    suit: "#1f9a52",
    suitDark: "#0d5a31",
    suitLight: "#4fe08a",
    trim: "#eafff0",
    pad: "#cfd8de",
    padDark: "#8794a0",
    boot: "#dc3a2d",
    bootDark: "#8f1f1a",
    sole: "#f5f5f5",
    lace: "#ffffff",
    skin: "#f7cba4",
    skinShade: "#dea079",
  },
  bakugo: {
    suit: "#2a2a33",
    suitDark: "#121218",
    suitLight: "#4a4a58",
    trim: "#ff8a1f",
    pad: "#ff8f1c",
    padDark: "#a8470a",
    boot: "#26262e",
    bootDark: "#101015",
    sole: "#ff8a1f",
    lace: "#ff9f3a",
    skin: "#f8d5bb",
    skinShade: "#dfa98a",
  },
};

function drawLegs(ctx: Ctx, hero: Hero, pose: Pose, order: number[]) {
  const L = LOOKS[hero];
  for (const i of order) {
    const j = pose.legs[i];
    const front = i === 0;
    const [kx, ky] = at(0.4, 0, THIGH, j.a1);
    const [fx, fy] = at(kx, ky, SHIN, j.a2);
    const cloth = front ? L.suit : L.suitDark;
    limb(ctx, 0.4, 0, kx, ky, 3.7, cloth, OUT);
    // Outer trim line down the thigh.
    ctx.strokeStyle = hero === "deku" ? rgba(L.trim, front ? 0.85 : 0.5) : rgba(L.trim, front ? 0.9 : 0.55);
    ctx.lineWidth = 0.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    const [tx0, ty0] = at(0.4, 0, 0.6, j.a1 + 1.4);
    const [tx1, ty1] = at(kx, ky, 0.4, j.a1 + 1.4);
    ctx.moveTo(tx0 + 0.5, ty0);
    ctx.lineTo(tx1 + 0.5, ty1);
    ctx.stroke();
    limb(ctx, kx, ky, fx, fy, 3.4, cloth, OUT);
    // Knee guard (Deku's grey pads, Bakugo's small orange ones).
    ctx.fillStyle = OUT;
    ctx.beginPath();
    ctx.ellipse(kx + 0.5, ky, 2.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = front ? L.pad : L.padDark;
    ctx.beginPath();
    ctx.ellipse(kx + 0.5, ky, 1.7, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(kx, ky - 1.4, 0.8, 1);
    // Boot, tilted with the shin.
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(-j.a2 * 0.5);
    ctx.beginPath();
    ctx.roundRect(-2.7, -3.4, 6.6, 4.5, 1.5);
    inked(ctx, front ? L.boot : L.bootDark, 0.7);
    // Cuff, laces and a thick sole.
    ctx.fillStyle = hero === "deku" ? L.sole : L.suitLight;
    ctx.fillRect(-2.5, -3.2, 3.6, 0.9);
    ctx.fillStyle = L.lace;
    for (const lx of [0.3, 1.3, 2.3]) ctx.fillRect(lx, -2, 0.6, 0.4);
    ctx.fillStyle = L.sole;
    ctx.fillRect(-2.7, 0.2, 6.6, 0.9);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(-2, -2.6, 2.4, 0.5);
    ctx.restore();
  }
}

/** Draws an arm. Returns the hand position. */
function drawArm(ctx: Ctx, hero: Hero, pose: Pose, i: number, sx: number, sy: number, glow: boolean, time: number): readonly [number, number] {
  const L = LOOKS[hero];
  const j = pose.arms[i];
  const back = i === 1;
  const [ex, ey] = at(sx, sy, UPPER, j.a1);
  const [hx, hy] = at(ex, ey, FORE, j.a2);
  if (hero === "deku") {
    limb(ctx, sx, sy, ex, ey, 3.2, back ? L.suitDark : L.suit, OUT);
    ctx.strokeStyle = rgba(L.trim, back ? 0.45 : 0.85);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(sx + 0.3, sy - 0.2);
    ctx.lineTo(ex + 0.3, ey - 0.2);
    ctx.stroke();
    // Elbow pad and bracer.
    ctx.fillStyle = back ? L.padDark : L.pad;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.7, 0, Math.PI * 2);
    ctx.fill();
    limb(ctx, ex, ey, hx, hy, 3.5, back ? L.padDark : L.pad, OUT);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ex + 0.3, ey - 0.8);
    ctx.lineTo(hx + 0.3, hy - 0.8);
    ctx.stroke();
    // Glove.
    const r = pose.fist && !back ? 2.4 : 2.1;
    ctx.fillStyle = OUT;
    ctx.beginPath();
    ctx.arc(hx, hy, r + 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = glow ? HERO_ACCENT.deku.main : back ? "#c8cfd3" : "#f4f6f7";
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(hx - 0.8, hy - r + 0.4);
    ctx.lineTo(hx - 0.8, hy + 0.2);
    ctx.moveTo(hx + 0.2, hy - r + 0.2);
    ctx.lineTo(hx + 0.2, hy + 0.6);
    ctx.stroke();
    return [hx, hy];
  }
  // Bakugo: bare arm, then the big orange grenade gauntlet.
  limb(ctx, sx, sy, ex, ey, 3.3, back ? L.skinShade : L.skin, OUT);
  ctx.strokeStyle = "rgba(160,90,60,0.4)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(sx + 0.4, sy + 0.4);
  ctx.lineTo(ex + 0.4, ey - 0.4);
  ctx.stroke();
  const ang = Math.atan2(hy - ey, hx - ex);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  const len = FORE + 0.4;
  ctx.beginPath();
  ctx.roundRect(-0.4, -2.9, len, 5.8, 1.3);
  inked(ctx, vGradient(ctx, -2.9, 2.9, [[0, back ? "#ffb25a" : "#ffc46e"], [0.5, back ? "#d9741c" : "#ff8a1f"], [1, back ? "#7a3304" : "#a8470a"]]), 0.8);
  // Ridges of the grenade, a dark grip cuff and the pin ring.
  ctx.fillStyle = "rgba(90,35,0,0.55)";
  for (const rx of [0.7, 1.6, 2.5]) ctx.fillRect(rx, -2.8, 0.45, 5.6);
  ctx.fillStyle = "#17171d";
  ctx.fillRect(len - 1.5, -2.8, 1.2, 5.6);
  ctx.strokeStyle = "#e8ecef";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(1.1, -3.3, 1.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(0.2, -2.3, len - 2, 0.7);
  if (glow) {
    const pulse = 0.6 + Math.sin(time * 30) * 0.3;
    const g = ctx.createRadialGradient(len + 1, 0, 0, len + 1, 0, 6);
    g.addColorStop(0, `rgba(255,240,160,${pulse})`);
    g.addColorStop(1, "rgba(255,140,30,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(len - 5, -6, 12, 12);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
  // Fist.
  const r = pose.fist && !back ? 2.4 : 2.1;
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.arc(hx, hy, r + 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = back ? L.skinShade : L.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17171d";
  ctx.fillRect(hx - 1.6, hy - 0.4, 3.2, 0.7);
  return [hx, hy];
}

/* ------------------------------------------------------------------ */
/* Torsos                                                             */
/* ------------------------------------------------------------------ */

function torsoPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(-4.3, -9.4);
  ctx.quadraticCurveTo(0, -10.4, 4.3, -9.4);
  ctx.quadraticCurveTo(4.9, -4.5, 3.6, 0.9);
  ctx.lineTo(-3.6, 0.9);
  ctx.quadraticCurveTo(-4.9, -4.5, -4.3, -9.4);
  ctx.closePath();
}

function drawTorso(ctx: Ctx, hero: Hero) {
  const L = LOOKS[hero];
  torsoPath(ctx);
  inked(ctx, hGradient(ctx, -4.5, 4.5, [[0, L.suitDark], [0.45, L.suit], [1, L.suitLight]]), 0.9);
  if (hero === "deku") {
    // White piping down both sides, a centre seam, a collar and the support-gear belt.
    ctx.strokeStyle = L.trim;
    ctx.lineWidth = 0.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-2.6, -9.2);
    ctx.quadraticCurveTo(-3.4, -4.8, -2.9, 0.4);
    ctx.moveTo(2.6, -9.2);
    ctx.quadraticCurveTo(3.4, -4.8, 2.9, 0.4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0.2, -9);
    ctx.lineTo(0.2, -1.8);
    ctx.stroke();
    ctx.fillStyle = L.trim;
    ctx.beginPath();
    ctx.roundRect(-3.1, -10, 6.2, 1.5, 0.6);
    ctx.fill();
    // Belt, buckle and two pouches.
    ctx.beginPath();
    ctx.roundRect(-4.4, -2.1, 8.8, 3, 0.6);
    inked(ctx, vGradient(ctx, -2, 1, [[0, "#f2f6f8"], [1, "#aab4bc"]]), 0.6);
    for (const px of [-3.7, 1.5]) {
      ctx.beginPath();
      ctx.roundRect(px, -1.7, 2.2, 2.4, 0.5);
      inked(ctx, L.padDark, 0.4);
    }
    ctx.fillStyle = "#f2c94c";
    ctx.fillRect(-0.7, -1.7, 1.4, 2);
    ctx.fillStyle = "#8a6a10";
    ctx.fillRect(-0.3, -1.2, 0.6, 1);
    return;
  }
  // Bakugo: black tank top with orange X marks, orange neckline, black belt with orange buckle.
  ctx.save();
  torsoPath(ctx);
  ctx.clip();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(-3.6, -8.4);
  ctx.lineTo(3.6, -1.6);
  ctx.moveTo(3.6, -8.4);
  ctx.lineTo(-3.6, -1.6);
  ctx.stroke();
  ctx.strokeStyle = L.trim;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-3.6, -8.4);
  ctx.lineTo(3.6, -1.6);
  ctx.moveTo(3.6, -8.4);
  ctx.lineTo(-3.6, -1.6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-3.6, -8.8);
  ctx.lineTo(3.2, -2.4);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = L.trim;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-3.2, -9.8);
  ctx.quadraticCurveTo(0, -7.6, 3.2, -9.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-4.2, -1.9, 8.4, 2.8, 0.6);
  inked(ctx, "#17171d", 0.6);
  ctx.fillStyle = L.trim;
  ctx.fillRect(-1, -1.6, 2, 2.2);
  ctx.fillStyle = "#17171d";
  ctx.fillRect(-0.4, -1.1, 0.8, 1.2);
  // A little muscle shading on the chest.
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.ellipse(1.6, -7.2, 1.7, 1.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Heads                                                              */
/* ------------------------------------------------------------------ */

function drawNeck(ctx: Ctx, hero: Hero) {
  ctx.fillStyle = OUT;
  ctx.fillRect(-1.9, -12.1, 3.8, 3.6);
  ctx.fillStyle = hero === "deku" ? LOOKS.deku.skinShade : LOOKS.bakugo.skinShade;
  ctx.fillRect(-1.4, -12, 2.8, 3.4);
}

function drawEye(ctx: Ctx, x: number, y: number, rx: number, ry: number, iris: string, pupil: string, squint: number, angry: boolean) {
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 0.4, ry + 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(x + 0.4, y + 0.15, rx * 0.72, Math.min(ry * 0.88, 2.2), 0, 0, Math.PI * 2);
  ctx.fill();
  // Iris shading, pupil and the two highlights.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + 0.4, y - ry * 0.45, rx * 0.7, ry * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pupil;
  ctx.beginPath();
  ctx.ellipse(x + 0.5, y + 0.2, angry ? 0.45 : rx * 0.34, angry ? 0.9 : ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 0.1, y - ry * 0.55, 0.8, 0.8);
  ctx.fillRect(x + 0.9, y + ry * 0.25, 0.45, 0.45);
  // Upper lid.
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(x - rx - 0.1, y - ry * 0.3 + squint * 0.3);
  ctx.quadraticCurveTo(x, y - ry - 0.5 + squint * 0.7, x + rx + 0.1, y - ry * 0.3 + squint * 0.3);
  ctx.stroke();
}

function drawDekuHead(ctx: Ctx, pose: Pose, time: number, reduced: boolean, glow: boolean) {
  const L = LOOKS.deku;
  ctx.save();
  ctx.translate(0.7, -15.7);
  ctx.rotate(pose.headTilt);
  const sway = reduced ? 0 : Math.sin(time * 3) * 0.25;

  // Hood ears.
  for (const [x, rot] of [[-2.8, -0.38], [1.1, 0.02]]) {
    ctx.save();
    ctx.translate(x, -4.2);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-2, 1.8);
    ctx.lineTo(0.1, -5.6);
    ctx.lineTo(2, 1.8);
    ctx.closePath();
    inked(ctx, hGradient(ctx, -2, 2, [[0, L.suitDark], [0.5, L.suit], [1, L.suitLight]]), 0.7);
    ctx.fillStyle = L.padDark;
    ctx.beginPath();
    ctx.moveTo(-0.7, 1);
    ctx.lineTo(0.1, -3.6);
    ctx.lineTo(0.9, 1);
    ctx.fill();
    ctx.restore();
  }

  // Face and ear.
  ctx.beginPath();
  ctx.ellipse(0.6, 0.2, 5.7, 5.9, 0, 0, Math.PI * 2);
  const face = ctx.createRadialGradient(2, -1.5, 1, 0.6, 0.2, 6.3);
  face.addColorStop(0, "#ffe3c6");
  face.addColorStop(1, L.skin);
  inked(ctx, face, 0.9);
  ctx.beginPath();
  ctx.ellipse(-3.9, 0.9, 1.2, 1.7, 0, 0, Math.PI * 2);
  inked(ctx, L.skinShade, 0.5);
  // Soft jaw shadow.
  ctx.fillStyle = "rgba(160,90,60,0.18)";
  ctx.beginPath();
  ctx.ellipse(0.6, 4.4, 4.6, 1.7, 0, 0, Math.PI);
  ctx.fill();

  // Hood over the back of the head, with a green hairline of messy locks in front.
  ctx.beginPath();
  ctx.moveTo(-5.9, 1.6);
  ctx.quadraticCurveTo(-6.6, -4.4, -2.4, -6);
  ctx.quadraticCurveTo(1.6, -7.2, 4.4, -4.8);
  ctx.lineTo(1.2, -3.1);
  ctx.lineTo(-1.4, -3.6);
  ctx.lineTo(-3.9, -1.6);
  ctx.lineTo(-3.4, 1.4);
  ctx.closePath();
  inked(ctx, vGradient(ctx, -7, 2, [[0, L.suitLight], [1, L.suit]]), 0.8);
  // Hair: spiky locks, three shades.
  const hair = (grow: number) => {
    ctx.beginPath();
    ctx.moveTo(-5.2 - grow, -2.6);
    ctx.lineTo(-6.9 - grow, -5.4 + sway);
    ctx.lineTo(-3.8, -5.1);
    ctx.lineTo(-4.2 - grow, -8.8 + sway);
    ctx.lineTo(-1.2, -6.2);
    ctx.lineTo(-0.2 - grow, -9.6 + sway);
    ctx.lineTo(1.5, -6.2);
    ctx.lineTo(3.4 + grow, -8.9 + sway);
    ctx.lineTo(4.1, -5.4);
    ctx.lineTo(6.9 + grow, -5.4 + sway);
    ctx.lineTo(5.6, -3.3);
    ctx.lineTo(6.5 + grow, -1.4);
    ctx.lineTo(4.3, -2.7);
    ctx.lineTo(2.4, -3.7);
    ctx.lineTo(0.4, -2.2);
    ctx.lineTo(-1.5, -3.9);
    ctx.lineTo(-3.4, -2.3);
    ctx.closePath();
  };
  ctx.fillStyle = OUT;
  hair(0.7);
  ctx.fill();
  hair(0);
  ctx.fillStyle = vGradient(ctx, -9.6, -2, [[0, "#6bd47a"], [0.5, "#2f8a42"], [1, "#1b5a2c"]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(10,60,25,0.8)";
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  for (const [a, b, c, d] of [[-3, -8.6, -2.2, -4.4], [0.2, -9.2, 0.2, -4.2], [3.2, -8.4, 2.4, -4.3], [-5.6, -4.6, -4.4, -3], [5.6, -4.6, 4.8, -3]] as const) {
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(190,255,200,0.55)";
  ctx.beginPath();
  ctx.moveTo(-1.6, -7.6);
  ctx.lineTo(-0.4, -5.6);
  ctx.lineTo(-0.9, -7.8);
  ctx.fill();

  // Eyes, brows, nose and freckles.
  const ry = 2.9 - pose.squint * 1.1;
  drawEye(ctx, 1.3, 0.4, 1.95, ry, glow ? "#8dffb8" : "#1e8d4c", "#052410", pose.squint, false);
  drawEye(ctx, 4.7, 0.4, 1.6, ry, glow ? "#8dffb8" : "#1e8d4c", "#052410", pose.squint, false);
  ctx.strokeStyle = "#16482a";
  ctx.lineWidth = 0.95;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-0.7, -2.6 + pose.squint * 0.7);
  ctx.quadraticCurveTo(1.5, -3.6, 2.9, -3.2 - pose.squint * 0.2);
  ctx.moveTo(3.6, -3.2 - pose.squint * 0.2);
  ctx.quadraticCurveTo(5.2, -3.5, 6, -2.2 + pose.squint * 0.7);
  ctx.stroke();
  ctx.strokeStyle = "rgba(150,80,50,0.7)";
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(5.9, 1.6);
  ctx.lineTo(6.5, 2.8);
  ctx.lineTo(5.7, 3.1);
  ctx.stroke();
  ctx.fillStyle = "#c98760";
  for (const [fx, fy] of [[-0.2, 3.1], [1.1, 3.6], [2.5, 3.2], [4.1, 3.2], [5.2, 3.5], [3.2, 3.9]]) ctx.fillRect(fx, fy, 0.5, 0.5);

  // Mouth guard with a strap to the hood.
  ctx.strokeStyle = L.padDark;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0.8, 3.4);
  ctx.lineTo(-3.4, 1.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(0.7, 2.8, 5.4, 3.6, 1.4);
  inked(ctx, vGradient(ctx, 2.8, 6.4, [[0, "#eef2f5"], [0.6, "#aab4bc"], [1, "#6c7882"]]), 0.8);
  ctx.strokeStyle = "#5a6670";
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (const x of [2.2, 3.4, 4.6]) {
    ctx.moveTo(x, 3.5);
    ctx.lineTo(x, 5.7);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(1.2, 3.1, 3.4, 0.5);
  ctx.restore();
}

function drawBakugoHead(ctx: Ctx, pose: Pose, time: number, reduced: boolean, rage: boolean) {
  const L = LOOKS.bakugo;
  ctx.save();
  ctx.translate(0.7, -15.7);
  ctx.rotate(pose.headTilt);
  const sway = reduced ? 0 : Math.sin(time * 5) * 0.3;

  // Spiky ash-blond hair, back layer first.
  const spikes: [number, number, number, number][] = [
    [-6.2, -3.2, -9.6, -7.6],
    [-4.8, -5.2, -7.4, -10.4],
    [-2.6, -6.2, -3.6, -11.4],
    [-0.2, -6.5, 0.8, -12.2],
    [2.2, -6.2, 4.6, -11.2],
    [4.2, -5, 7.6, -9.4],
    [5.6, -3.4, 9.4, -6.2],
    [6, -1.4, 9.8, -2.2],
  ];
  const spikeSet = (grow: number) => {
    ctx.beginPath();
    ctx.moveTo(-5.9 - grow, 1);
    for (const [bx, by, tx, ty] of spikes) {
      ctx.lineTo(bx - 1.3, by + 0.4);
      ctx.lineTo(tx + sway * (ty / -12) + (tx < 0 ? -grow : grow), ty - grow);
      ctx.lineTo(bx + 1.4, by + 0.2);
    }
    ctx.lineTo(6.2 + grow, 0);
    ctx.closePath();
  };
  ctx.fillStyle = OUT;
  spikeSet(0.8);
  ctx.fill();
  ctx.fillStyle = vGradient(ctx, -12, 0, [[0, "#fff4b0"], [0.45, "#ecd46c"], [1, "#b8993e"]]);
  spikeSet(0);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,90,20,0.7)";
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (const [bx, by, tx, ty] of spikes) {
    ctx.moveTo(bx, by);
    ctx.lineTo(tx * 0.8 + bx * 0.2, ty * 0.8 + by * 0.2);
  }
  ctx.stroke();

  // Face, jaw and ear.
  ctx.beginPath();
  ctx.moveTo(-5.2, -1.5);
  ctx.quadraticCurveTo(-5.6, 4.6, -1.6, 6);
  ctx.quadraticCurveTo(2.6, 7, 5.6, 4.4);
  ctx.quadraticCurveTo(6.8, 0.6, 5.4, -3.4);
  ctx.quadraticCurveTo(0.6, -6.6, -5.2, -1.5);
  ctx.closePath();
  const face = ctx.createRadialGradient(2, -1.5, 1, 0.6, 0.4, 7);
  face.addColorStop(0, "#fde3cc");
  face.addColorStop(1, L.skin);
  inked(ctx, face, 0.9);
  ctx.beginPath();
  ctx.ellipse(-4.2, 1, 1.2, 1.7, 0, 0, Math.PI * 2);
  inked(ctx, L.skinShade, 0.5);
  ctx.fillStyle = "rgba(160,90,60,0.2)";
  ctx.beginPath();
  ctx.ellipse(0.8, 5, 4.4, 1.5, 0, 0, Math.PI);
  ctx.fill();

  // Fringe spikes over the forehead.
  ctx.beginPath();
  ctx.moveTo(-5.4, -2.6);
  ctx.lineTo(-4.4, -6.2);
  ctx.lineTo(-2.4, -3.6);
  ctx.lineTo(-1.4, -6.8);
  ctx.lineTo(0.4, -3.6);
  ctx.lineTo(2, -6.4);
  ctx.lineTo(3.2, -3.4);
  ctx.lineTo(5.2, -5.2);
  ctx.lineTo(5.6, -2.8);
  ctx.lineTo(2.6, -2.3);
  ctx.lineTo(0, -1.8);
  ctx.lineTo(-3, -1.8);
  ctx.closePath();
  inked(ctx, vGradient(ctx, -7, -2, [[0, "#fff4b0"], [1, "#d6bb55"]]), 0.8);

  // The black eye mask, flaring to the temples.
  ctx.beginPath();
  ctx.moveTo(-4.6, -0.6);
  ctx.lineTo(-1.6, -1.2);
  ctx.lineTo(2.4, -0.8);
  ctx.lineTo(6.4, -2.2);
  ctx.lineTo(6.1, 1.7);
  ctx.lineTo(2.6, 2.1);
  ctx.lineTo(-1.2, 1.7);
  ctx.lineTo(-4.4, 1.8);
  ctx.closePath();
  inked(ctx, "#111117", 0.6);

  // Red eyes: narrow and furious.
  const ry = 1.9 - pose.squint * 0.5;
  drawEye(ctx, 1.2, 0.2, 1.85, ry, rage ? "#ff2a1a" : "#d4162a", "#2a0508", pose.squint, true);
  drawEye(ctx, 4.5, 0.15, 1.5, ry, rage ? "#ff2a1a" : "#d4162a", "#2a0508", pose.squint, true);
  // Heavy angry brows.
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-0.8, -3.8 - pose.squint * 0.3);
  ctx.lineTo(2.7, -1.9);
  ctx.moveTo(6.2, -4 - pose.squint * 0.3);
  ctx.lineTo(3.6, -2);
  ctx.stroke();
  ctx.strokeStyle = "#e6cc66";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-0.8, -3.8 - pose.squint * 0.3);
  ctx.lineTo(2.7, -1.9);
  ctx.moveTo(6.2, -4 - pose.squint * 0.3);
  ctx.lineTo(3.6, -2);
  ctx.stroke();
  // Nose and cheek shadow.
  ctx.strokeStyle = "rgba(150,80,50,0.75)";
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(6, 2.3);
  ctx.lineTo(6.6, 3.2);
  ctx.lineTo(5.8, 3.5);
  ctx.stroke();

  // Scowl with bared teeth.
  const open = pose.squint > 0.5 ? 1.2 : 0.7;
  ctx.beginPath();
  ctx.moveTo(0.4, 4.2);
  ctx.quadraticCurveTo(3, 4.6 + open * 0.6, 5.6, 4);
  ctx.lineTo(5.2, 5.3 + open);
  ctx.quadraticCurveTo(2.8, 6.4 + open, 0.8, 5.4 + open * 0.5);
  ctx.closePath();
  inked(ctx, "#5a0d12", 0.6);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(1.1, 4.4, 4.1, 0.9 + open * 0.3);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  for (const x of [2, 2.9, 3.8, 4.6]) {
    ctx.moveTo(x, 4.4);
    ctx.lineTo(x, 5.3 + open * 0.3);
  }
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* The figure                                                         */
/* ------------------------------------------------------------------ */

type RigOptions = { time: number; reduced: boolean; cowl: boolean; smashing: boolean };

/** Draws the figure with its feet at the origin, facing right. Returns the front fist's position (hip frame, rotated by the lean). */
function drawRig(ctx: Ctx, hero: Hero, pose: Pose, o: RigOptions): readonly [number, number] {
  ctx.translate(0, HIP_Y + pose.bob);
  drawLegs(ctx, hero, pose, [1]);
  ctx.save();
  ctx.rotate(pose.lean);
  drawArm(ctx, hero, pose, 1, -0.5, -8, false, o.time);
  drawTorso(ctx, hero);
  drawNeck(ctx, hero);
  if (hero === "deku") drawDekuHead(ctx, pose, o.time, o.reduced, o.cowl || o.smashing);
  else drawBakugoHead(ctx, pose, o.time, o.reduced, o.cowl || o.smashing);
  const hand = drawArm(ctx, hero, pose, 0, 0.5, -8.2, o.cowl || o.smashing, o.time);
  ctx.restore();
  drawLegs(ctx, hero, pose, [0]);
  const c = Math.cos(pose.lean);
  const s = Math.sin(pose.lean);
  return [hand[0] * c - hand[1] * s, hand[0] * s + hand[1] * c];
}

/** The hero in play: shadow, aura, figure and the punch's flash. */
export function drawHero(ctx: Ctx, s: JumpState, reduced: boolean, hero: Hero) {
  const p = s.player;
  const cowl = p.cowl > 0;
  const accent = HERO_ACCENT[hero];
  const pose = heroPose(p, s.time, reduced);
  const feetX = p.x + p.w / 2;
  const feetY = p.y + p.h;
  blobShadow(ctx, s, feetX, feetY, 6);

  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.scale(p.facing * FIGURE_SCALE, FIGURE_SCALE);

  // Full Cowl / rage: a glow behind and crackling energy.
  if (cowl) {
    const pulse = reduced ? 1 : 0.85 + Math.sin(s.time * 14) * 0.15;
    const fade = Math.min(1, p.cowl / 1.5);
    const g = ctx.createRadialGradient(0, -14, 2, 0, -14, 24);
    g.addColorStop(0, rgba(accent.main, 0.7 * pulse * fade));
    g.addColorStop(1, rgba(accent.main, 0));
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(-26, -40, 52, 52);
    ctx.globalCompositeOperation = "source-over";
    if (!reduced) {
      if (hero === "deku") lightning(ctx, s.time, 0, -14, 14, 3, 11, accent.light, rgba("#2dff80", 0.45));
      else lightning(ctx, s.time, 0, -14, 12, 3, 23, "#fff1c0", rgba("#ff7a10", 0.5));
    }
  }

  const fist = drawRig(ctx, hero, pose, { time: s.time, reduced, cowl, smashing: p.smashT > 0 });

  // The punch: a crescent shockwave for Deku, an explosion for Bakugo.
  if (p.smashT > 0) {
    const q = 1 - p.smashT / 0.22;
    const scale = cowl ? 1.5 : 1;
    const [fx, fy] = [fist[0], fist[1] + HIP_Y + pose.bob];
    ctx.save();
    if (hero === "deku") {
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
      if (!reduced) lightning(ctx, s.time, fx + 3, fy, 10 * scale, 4, 5, accent.light, rgba("#2dff80", 0.45));
    } else {
      const grow = (3 + q * 8) * scale;
      const gl = ctx.createRadialGradient(fx + 4, fy, 0, fx + 4, fy, 16 * scale);
      gl.addColorStop(0, rgba("#fff2a0", 0.7 * (1 - q)));
      gl.addColorStop(1, rgba("#ff6a10", 0));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = gl;
      ctx.fillRect(fx - 14, fy - 18 * scale, 36 * scale, 36 * scale);
      ctx.globalCompositeOperation = "source-over";
      blast(ctx, fx + 5 + q * 4, fy, grow, reduced ? 0 : s.time, 1 - q * 0.6);
      // Smoke ring and flying sparks.
      ctx.strokeStyle = `rgba(60,50,50,${0.5 * (1 - q)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(fx + 6, fy, (6 + q * 12) * scale, -1.1, 1.1);
      ctx.stroke();
      ctx.fillStyle = "#ffd36a";
      for (let i = 0; i < 6; i++) {
        const a = -0.9 + i * 0.36;
        const d = (5 + q * 18) * scale;
        ctx.fillRect(fx + 6 + Math.cos(a) * d, fy + Math.sin(a) * d, 1, 1);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

/** A standing portrait for the character picker, drawn with its feet at (cx, cy). */
export function drawPortrait(ctx: Ctx, hero: Hero, cx: number, cy: number, size: number, time: number, pose: "idle" | "ready" = "idle") {
  const accent = HERO_ACCENT[hero];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size, size);
  const g = ctx.createRadialGradient(0, -16, 2, 0, -16, 26);
  g.addColorStop(0, rgba(accent.main, 0.45));
  g.addColorStop(1, rgba(accent.main, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-30, -46, 60, 60);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0.3, 7, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  const ready: Pose = {
    ...IDLE,
    lean: 0.1,
    legs: [{ a1: 0.45, a2: 0.2 }, { a1: -0.4, a2: -0.2 }],
    arms: [{ a1: 1.35, a2: 2.2 }, { a1: -0.8, a2: 0.6 }],
    fist: true,
    squint: 0.5,
  };
  drawRig(ctx, hero, pose === "ready" ? ready : IDLE, { time, reduced: true, cowl: false, smashing: false });
  ctx.restore();
}
