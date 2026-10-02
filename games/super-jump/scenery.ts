import { type Level, TILE, type Theme } from "./logic";
import { PALETTES, type Palette, rgba, rng, shade } from "./palette";

export const VIEW_W = 20 * TILE; // 320 logical pixels
export const VIEW_H = 12 * TILE; // 192 logical pixels
/** Canvas pixels per logical pixel; tiles and scenery are pre-rendered at this size so every blit is 1:1. */
let scale = 4;
export const getPixelScale = () => scale;
/** Picks the canvas resolution (2–4). Rebuilds the cached art when it changes. */
export function setPixelScale(n: number) {
  if (n === scale) return;
  scale = n;
  cache = null;
  overlay = null;
}

const LAYER_W = 512;
const LAYER_H = 260;
/** The line, in layer pixels, where each layer's ground sits. */
const LAYER_BASE = 170;
/** Only these rows of a layer are ever visible, so only they are kept. */
const LAYER_TOP = LAYER_BASE - 140;
const LAYER_KEEP = 176;

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext("2d")!];
}

/* ------------------------------------------------------------------ */
/* Cached art: scenery layers, clouds and tiles, built once per theme. */
/* ------------------------------------------------------------------ */

type ThemeCache = {
  theme: Theme;
  layers: HTMLCanvasElement[];
  cloud: HTMLCanvasElement;
  tiles: Map<string, HTMLCanvasElement>;
  sky: CanvasGradient | null;
};

let cache: ThemeCache | null = null;

function themeCache(theme: Theme): ThemeCache {
  if (cache?.theme === theme) return cache;
  const pal = PALETTES[theme];
  cache = { theme, layers: buildLayers(theme, pal), cloud: buildCloud(pal), tiles: new Map(), sky: null };
  return cache;
}

/** Frees the cached canvases (when the game closes). */
export function clearSceneryCache() {
  cache = null;
}

function buildCloud(pal: Palette): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(120 * scale, 50 * scale);
  ctx.scale(scale, scale);
  const puffs: [number, number, number][] = [[24, 32, 14], [42, 24, 18], [64, 22, 20], [84, 30, 15], [58, 34, 18], [34, 36, 12], [96, 36, 10]];
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, pal.cloud);
    g.addColorStop(0.7, pal.cloud);
    g.addColorStop(1, pal.cloudShade);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Flat soft bottom.
  const fade = ctx.createLinearGradient(0, 30, 0, 50);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 30, 120, 20);
  return c;
}

/* ---------- scenery layers ---------- */

function skyline(
  ctx: Ctx,
  color: string,
  rand: () => number,
  opts: { minH: number; maxH: number; minW: number; maxW: number; windows?: string; antenna?: boolean; edge?: string },
) {
  let x = 0;
  while (x < LAYER_W) {
    const w = Math.min(opts.minW + rand() * (opts.maxW - opts.minW), LAYER_W - x);
    const h = opts.minH + rand() * (opts.maxH - opts.minH);
    const top = LAYER_BASE - h;
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, LAYER_H - top);
    if (opts.edge) {
      ctx.fillStyle = opts.edge;
      ctx.fillRect(x, top, w, 1.2);
      ctx.fillRect(x, top, 1, h);
    }
    if (opts.antenna && rand() < 0.35) {
      ctx.fillRect(x + w / 2 - 0.5, top - 10, 1, 10);
      ctx.fillStyle = opts.windows ?? "#fff";
      ctx.fillRect(x + w / 2 - 1, top - 11, 2, 2);
    } else if (rand() < 0.2) {
      ctx.fillStyle = color;
      ctx.fillRect(x + 3, top - 5, Math.max(4, w * 0.3), 5);
    }
    if (opts.windows) {
      for (let wy = top + 5; wy < LAYER_BASE - 4; wy += 6) {
        for (let wx = x + 3; wx < x + w - 4; wx += 5) {
          if (rand() < 0.38) {
            ctx.fillStyle = rand() < 0.7 ? opts.windows : shade(opts.windows, -0.35);
            ctx.fillRect(wx, wy, 2.4, 3);
          }
        }
      }
    }
    x += w + (rand() < 0.3 ? 2 + rand() * 4 : 0);
  }
}

function hills(ctx: Ctx, color: string, top: string, amp: number, cycles: number, phase: number) {
  const g = ctx.createLinearGradient(0, LAYER_BASE - amp * 1.4, 0, LAYER_H);
  g.addColorStop(0, top);
  g.addColorStop(0.35, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 4) {
    const t = (x / LAYER_W) * Math.PI * 2 * cycles + phase;
    const y = LAYER_BASE - amp - Math.sin(t) * amp * 0.6 - Math.sin(t * 2.3 + 1) * amp * 0.25;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(LAYER_W, LAYER_H);
  ctx.closePath();
  ctx.fill();
}

function tree(ctx: Ctx, x: number, base: number, size: number, trunk: string, leaf: string, leafLight: string) {
  ctx.fillStyle = trunk;
  ctx.fillRect(x - size * 0.07, base - size * 0.45, size * 0.14, size * 0.5);
  for (const [dx, dy, r] of [[0, -0.7, 0.42], [-0.28, -0.55, 0.32], [0.28, -0.55, 0.32], [0, -0.95, 0.3]]) {
    const g = ctx.createRadialGradient(x + dx * size - r * size * 0.3, base + dy * size - r * size * 0.4, 1, x + dx * size, base + dy * size, r * size);
    g.addColorStop(0, leafLight);
    g.addColorStop(1, leaf);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + dx * size, base + dy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function crane(ctx: Ctx, x: number, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, LAYER_BASE);
  ctx.lineTo(x + 6, LAYER_BASE - 70);
  ctx.moveTo(x + 14, LAYER_BASE);
  ctx.lineTo(x + 8, LAYER_BASE - 70);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - 24, LAYER_BASE - 68);
  ctx.lineTo(x + 40, LAYER_BASE - 68);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - 20, LAYER_BASE - 68);
  ctx.lineTo(x - 20, LAYER_BASE - 42);
  ctx.stroke();
  ctx.fillRect(x - 24, LAYER_BASE - 42, 8, 6);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 6 + i * 0.1 - (i % 2) * 3, LAYER_BASE - 8 - i * 10);
    ctx.lineTo(x + 8 + 3 - (i % 2) * 3, LAYER_BASE - 18 - i * 10);
    ctx.stroke();
  }
}

function spires(ctx: Ctx, rand: () => number, color: string, glow: string) {
  const g = ctx.createLinearGradient(0, LAYER_BASE - 110, 0, LAYER_H);
  g.addColorStop(0, shade(color, 0.12));
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, LAYER_H);
  let x = 0;
  ctx.lineTo(0, LAYER_BASE - 20);
  while (x < LAYER_W) {
    const w = 18 + rand() * 40;
    const h = 24 + rand() * 80;
    ctx.lineTo(x + w * 0.35, LAYER_BASE - h);
    ctx.lineTo(x + w * 0.5, LAYER_BASE - h * 0.7);
    ctx.lineTo(x + w, LAYER_BASE - 14 - rand() * 14);
    x += w;
  }
  ctx.lineTo(LAYER_W, LAYER_H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = glow;
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

/** U.A. High: two wings joined by a tall glass tower, with the school's lettering. */
function uaSchool(ctx: Ctx, x: number) {
  const concrete = "#c8d3e2";
  const dark = "#8fa2bd";
  const glass = ctx.createLinearGradient(0, LAYER_BASE - 118, 0, LAYER_BASE);
  glass.addColorStop(0, "#9ad3ff");
  glass.addColorStop(1, "#4c86c8");
  // Wings.
  for (const wx of [x, x + 86]) {
    const g = ctx.createLinearGradient(0, LAYER_BASE - 70, 0, LAYER_BASE);
    g.addColorStop(0, concrete);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(wx, LAYER_BASE - 70, 52, 70);
    ctx.fillStyle = "#6f86a8";
    ctx.fillRect(wx - 2, LAYER_BASE - 72, 56, 4);
    ctx.fillStyle = "rgba(40,70,120,0.55)";
    for (let wy = LAYER_BASE - 62; wy < LAYER_BASE - 6; wy += 11) for (let ix = wx + 4; ix < wx + 48; ix += 8) ctx.fillRect(ix, wy, 5, 7);
  }
  // Central glass tower.
  ctx.fillStyle = "#2a4a78";
  ctx.fillRect(x + 48, LAYER_BASE - 120, 42, 120);
  ctx.fillStyle = glass;
  ctx.fillRect(x + 50, LAYER_BASE - 118, 38, 116);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(x + 50 + i * 9.5, LAYER_BASE - 118);
    ctx.lineTo(x + 50 + i * 9.5, LAYER_BASE - 2);
  }
  for (let wy = LAYER_BASE - 104; wy < LAYER_BASE - 4; wy += 14) {
    ctx.moveTo(x + 50, wy);
    ctx.lineTo(x + 88, wy);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(x + 52, LAYER_BASE - 116);
  ctx.lineTo(x + 66, LAYER_BASE - 116);
  ctx.lineTo(x + 52, LAYER_BASE - 60);
  ctx.fill();
  // Roof, mast and flag.
  ctx.fillStyle = "#6f86a8";
  ctx.fillRect(x + 46, LAYER_BASE - 124, 46, 5);
  ctx.fillRect(x + 68, LAYER_BASE - 142, 1.4, 19);
  ctx.fillStyle = "#e0405a";
  ctx.fillRect(x + 69.4, LAYER_BASE - 142, 8, 5);
  // Lettering.
  ctx.fillStyle = "#0d2a55";
  ctx.font = "bold 13px Impact, 'Arial Black', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("U.A.", x + 69, LAYER_BASE - 96);
  ctx.textAlign = "start";
  // The big entrance gate in front.
  ctx.fillStyle = "#e8eef6";
  ctx.fillRect(x + 52, LAYER_BASE - 10, 34, 10);
  ctx.fillStyle = "#274a7a";
  ctx.fillRect(x + 60, LAYER_BASE - 8, 18, 8);
}

/** Broken building tops: jagged cuts and a few girders. */
function ruinedTops(ctx: Ctx, color: string, rand: () => number) {
  ctx.fillStyle = color;
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 56 + rand() * 20;
    const h = 36 + rand() * 40;
    ctx.beginPath();
    ctx.moveTo(x, LAYER_BASE);
    ctx.lineTo(x, LAYER_BASE - h);
    ctx.lineTo(x + 6, LAYER_BASE - h - 6);
    ctx.lineTo(x + 10, LAYER_BASE - h + 4);
    ctx.lineTo(x + 16, LAYER_BASE - h - 2);
    ctx.lineTo(x + 22, LAYER_BASE - h + 10);
    ctx.lineTo(x + 22, LAYER_BASE);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + 6, LAYER_BASE - h - 6);
    ctx.lineTo(x + 9, LAYER_BASE - h - 14);
    ctx.stroke();
  }
}

/** A big glass dome with ribs, like a disaster-training arena. */
function dome(ctx: Ctx, x: number, color: string) {
  const g = ctx.createRadialGradient(x, LAYER_BASE - 30, 4, x, LAYER_BASE, 64);
  g.addColorStop(0, "rgba(255,210,170,0.9)");
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, LAYER_BASE, 62, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,30,60,0.55)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.moveTo(x, LAYER_BASE);
    ctx.lineTo(x + Math.cos(a) * 62, LAYER_BASE + Math.sin(a) * 62);
  }
  ctx.arc(x, LAYER_BASE, 40, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x - 70, LAYER_BASE - 8, 140, 8);
}

/** A glowing hero billboard: a star and a bold silhouette on a neon panel. */
function billboard(ctx: Ctx, x: number, y: number, neon: string, variant: number) {
  ctx.fillStyle = "#0a0f22";
  ctx.fillRect(x - 1, y - 1, 52, 70);
  const g = ctx.createLinearGradient(0, y, 0, y + 68);
  g.addColorStop(0, neon);
  g.addColorStop(1, shade(neon, -0.55));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, 50, 68);
  // Halftone dots.
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let iy = y + 3; iy < y + 66; iy += 5) for (let ix = x + 3 + ((iy - y) % 10 === 3 ? 2.5 : 0); ix < x + 48; ix += 5) {
    ctx.beginPath();
    ctx.arc(ix, iy, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Silhouette hero striking a pose.
  ctx.fillStyle = "#0a0f22";
  ctx.beginPath();
  ctx.arc(x + 25, y + 20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 20, y + 26, 11, 16);
  ctx.save();
  ctx.translate(x + 25, y + 30);
  ctx.rotate(variant === 1 ? -0.9 : variant === 2 ? 0.5 : -1.5);
  ctx.fillRect(0, -2, 20, 4);
  ctx.restore();
  ctx.fillRect(x + 20, y + 42, 4, 14);
  ctx.fillRect(x + 27, y + 42, 4, 14);
  // Lettering strip.
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 8px Impact, 'Arial Black', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PLUS ULTRA", x + 25, y + 64);
  ctx.textAlign = "start";
  const glow = ctx.createRadialGradient(x + 25, y + 34, 10, x + 25, y + 34, 60);
  glow.addColorStop(0, rgba(neon, 0.35));
  glow.addColorStop(1, rgba(neon, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - 40, y - 30, 130, 130);
}

/** A twisted tower with a glowing red window, the villains' lookout. */
function villainTower(ctx: Ctx, x: number) {
  const g = ctx.createLinearGradient(0, LAYER_BASE - 130, 0, LAYER_BASE);
  g.addColorStop(0, "#2a0f1c");
  g.addColorStop(1, "#14060e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 20, LAYER_BASE);
  ctx.lineTo(x - 16, LAYER_BASE - 80);
  ctx.lineTo(x - 22, LAYER_BASE - 96);
  ctx.lineTo(x - 8, LAYER_BASE - 112);
  ctx.lineTo(x - 2, LAYER_BASE - 134);
  ctx.lineTo(x + 6, LAYER_BASE - 110);
  ctx.lineTo(x + 20, LAYER_BASE - 96);
  ctx.lineTo(x + 14, LAYER_BASE - 78);
  ctx.lineTo(x + 18, LAYER_BASE);
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createRadialGradient(x - 1, LAYER_BASE - 88, 0, x - 1, LAYER_BASE - 88, 30);
  glow.addColorStop(0, "rgba(255,60,50,0.8)");
  glow.addColorStop(1, "rgba(255,60,50,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 32, LAYER_BASE - 120, 64, 64);
  ctx.fillStyle = "#ff7a5a";
  ctx.fillRect(x - 5, LAYER_BASE - 92, 8, 10);
  ctx.strokeStyle = "rgba(255,90,70,0.6)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - 16, LAYER_BASE - 80);
  ctx.lineTo(x - 6, LAYER_BASE - 60);
  ctx.lineTo(x - 12, LAYER_BASE - 30);
  ctx.stroke();
}

function buildLayers(theme: Theme, pal: Palette): HTMLCanvasElement[] {
  const layers: HTMLCanvasElement[] = [];
  const make = (draw: (ctx: Ctx) => void) => {
    const [c, ctx] = makeCanvas(LAYER_W * scale, LAYER_KEEP * scale);
    ctx.scale(scale, scale);
    ctx.translate(0, -LAYER_TOP);
    draw(ctx);
    layers.push(c);
  };
  const r = rng(theme.length * 977 + 13);

  if (theme === "day") {
    // A hero-school campus far away, rolling hills, then trees.
    make((ctx) => {
      skyline(ctx, pal.far, r, { minH: 24, maxH: 78, minW: 16, maxW: 34, edge: shade(pal.far, 0.25) });
      uaSchool(ctx, 150);
    });
    make((ctx) => hills(ctx, pal.mid, shade(pal.mid, 0.2), 40, 2, 0.4));
    make((ctx) => {
      hills(ctx, pal.near, shade(pal.near, 0.15), 14, 3, 1.9);
      for (let i = 0; i < 9; i++) {
        tree(ctx, 30 + i * 56 + r() * 20, LAYER_BASE - 6 + r() * 6, 34 + r() * 22, "#3a2616", "#2c7a40", "#58b85a");
      }
    });
  } else if (theme === "sunset") {
    make((ctx) => {
      skyline(ctx, pal.far, r, { minH: 20, maxH: 60, minW: 14, maxW: 30, edge: rgba("#ffb080", 0.4) });
      ruinedTops(ctx, pal.far, rng(41));
      dome(ctx, 330, pal.far);
      crane(ctx, 60, pal.far);
    });
    make((ctx) => {
      // The harbour: a warm water band with ships and containers.
      const g = ctx.createLinearGradient(0, LAYER_BASE - 30, 0, LAYER_H);
      g.addColorStop(0, "#ff9a6a");
      g.addColorStop(0.2, "#a54a6a");
      g.addColorStop(1, "#2a1a4a");
      ctx.fillStyle = g;
      ctx.fillRect(0, LAYER_BASE - 30, LAYER_W, LAYER_H);
      ctx.fillStyle = pal.mid;
      ctx.beginPath();
      ctx.moveTo(60, LAYER_BASE - 30);
      ctx.lineTo(70, LAYER_BASE - 16);
      ctx.lineTo(160, LAYER_BASE - 16);
      ctx.lineTo(172, LAYER_BASE - 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(90, LAYER_BASE - 42, 34, 12);
      ctx.fillRect(100, LAYER_BASE - 52, 14, 10);
      const rr = rng(5);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = ["#3a2a5a", "#5a2a4a", "#2a3a5a"][i % 3];
        ctx.fillRect(250 + i * 26, LAYER_BASE - 30 - (i % 2) * 8, 22, 8);
        if (rr() < 0.5) ctx.fillRect(250 + i * 26, LAYER_BASE - 38 - (i % 2) * 8, 22, 8);
      }
    });
    make((ctx) => {
      ctx.fillStyle = pal.near;
      ctx.fillRect(0, LAYER_BASE - 4, LAYER_W, LAYER_H);
      for (let i = 0; i < 10; i++) {
        const x = 20 + i * 52;
        ctx.fillStyle = pal.near;
        ctx.fillRect(x, LAYER_BASE - 34, 4, 34);
        ctx.fillRect(x - 2, LAYER_BASE - 36, 8, 4);
        if (i % 3 === 0) {
          ctx.fillStyle = pal.lamp;
          ctx.fillRect(x + 4, LAYER_BASE - 30, 6, 3);
          ctx.fillStyle = pal.near;
          ctx.fillRect(x + 4, LAYER_BASE - 34, 8, 3);
        }
      }
      ctx.strokeStyle = pal.near;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        ctx.moveTo(22 + i * 52, LAYER_BASE - 28);
        ctx.quadraticCurveTo(48 + i * 52, LAYER_BASE - 14, 74 + i * 52, LAYER_BASE - 28);
      }
      ctx.stroke();
    });
  } else if (theme === "night") {
    make((ctx) => skyline(ctx, pal.far, r, { minH: 30, maxH: 100, minW: 16, maxW: 32, windows: pal.lamp, antenna: true, edge: rgba("#8aa0ff", 0.25) }));
    make((ctx) => {
      skyline(ctx, pal.mid, r, { minH: 20, maxH: 70, minW: 20, maxW: 44, windows: "#ffd27a", edge: rgba("#6a80ff", 0.18) });
      billboard(ctx, 70, LAYER_BASE - 96, "#ff3d81", 0);
      billboard(ctx, 250, LAYER_BASE - 84, "#3dd6ff", 1);
      billboard(ctx, 410, LAYER_BASE - 100, "#ffd23d", 2);
    });
    make((ctx) => {
      ctx.fillStyle = pal.near;
      ctx.fillRect(0, LAYER_BASE - 6, LAYER_W, LAYER_H);
      for (let i = 0; i < 8; i++) {
        const x = 24 + i * 64 + r() * 16;
        ctx.fillStyle = pal.near;
        ctx.fillRect(x, LAYER_BASE - 40, 3, 40);
        ctx.fillRect(x - 6, LAYER_BASE - 43, 14, 4);
        const g = ctx.createRadialGradient(x + 1, LAYER_BASE - 40, 1, x + 1, LAYER_BASE - 40, 24);
        g.addColorStop(0, rgba(pal.lamp, 0.5));
        g.addColorStop(1, rgba(pal.lamp, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - 24, LAYER_BASE - 64, 50, 50);
        ctx.fillStyle = pal.lamp;
        ctx.fillRect(x - 4, LAYER_BASE - 41, 10, 2);
      }
    });
  } else {
    make((ctx) => {
      spires(ctx, r, pal.far, rgba("#ff6a4a", 0.5));
      villainTower(ctx, 300);
    });
    make((ctx) => {
      // Broken pillars and arches of the villains' lair.
      ctx.fillStyle = pal.mid;
      ctx.fillRect(0, LAYER_BASE - 8, LAYER_W, LAYER_H);
      for (let i = 0; i < 7; i++) {
        const x = 12 + i * 74 + r() * 14;
        const h = 40 + r() * 60;
        ctx.fillStyle = pal.mid;
        ctx.fillRect(x, LAYER_BASE - h, 12, h);
        ctx.fillRect(x - 3, LAYER_BASE - h - 4, 18, 5);
        if (i % 2 === 0) {
          ctx.beginPath();
          ctx.arc(x + 40, LAYER_BASE - h + 14, 28, Math.PI, 0);
          ctx.lineWidth = 8;
          ctx.strokeStyle = pal.mid;
          ctx.stroke();
          ctx.fillRect(x + 64, LAYER_BASE - h + 12, 10, h - 12);
        }
        ctx.fillStyle = rgba("#ff5a3a", 0.35);
        ctx.fillRect(x + 1, LAYER_BASE - h, 1, h * 0.7);
      }
    });
    make((ctx) => {
      ctx.fillStyle = pal.near;
      ctx.fillRect(0, LAYER_BASE - 4, LAYER_W, LAYER_H);
      for (let i = 0; i < 16; i++) {
        const x = 8 + i * 32 + r() * 12;
        const h = 14 + r() * 40;
        ctx.beginPath();
        ctx.moveTo(x - 6, LAYER_BASE);
        ctx.lineTo(x, LAYER_BASE - h);
        ctx.lineTo(x + 6, LAYER_BASE);
        ctx.fill();
      }
    });
  }
  return layers;
}

/* ---------- per-frame backdrop ---------- */

const PARALLAX = [0.08, 0.22, 0.5];
/** Camera y range where scenery parallax is measured from (the lowest view). */
const MAX_CAM_Y = 4 * TILE;

/** Blits the visible slice of a scenery layer (wrapping around its seam) at whole canvas pixels. */
function drawLayer(ctx: Ctx, layer: HTMLCanvasElement, camX: number, camY: number, factor: number, dropY: number) {
  const px = (v: number) => Math.round(v * scale);
  const scroll = ((camX * factor) % LAYER_W + LAYER_W) % LAYER_W;
  const srcX = px(scroll);
  const dy = px(VIEW_H - TILE * 2 - LAYER_BASE + dropY + (MAX_CAM_Y - camY) * factor * 0.6 + LAYER_TOP) / scale;
  const total = px(VIEW_W);
  const first = Math.min(total, layer.width - srcX);
  ctx.drawImage(layer, srcX, 0, first, layer.height, 0, dy, first / scale, layer.height / scale);
  if (first < total) ctx.drawImage(layer, 0, 0, total - first, layer.height, first / scale, dy, (total - first) / scale, layer.height / scale);
}

function twinkle(ctx: Ctx, time: number, camX: number, reduced: boolean, count: number, maxY: number) {
  const r = rng(99);
  for (let i = 0; i < count; i++) {
    const x = (((r() * 700 - camX * 0.04) % VIEW_W) + VIEW_W) % VIEW_W;
    const y = r() * maxY;
    const size = 0.5 + r() * 0.9;
    const phase = r() * 6;
    const a = reduced ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(time * (0.8 + r()) + phase));
    ctx.fillStyle = `rgba(255,248,220,${a})`;
    ctx.fillRect(x, y, size, size);
  }
}

/** Sky, sun or moon, stars, clouds and the three scenery layers. */
export function drawBackdrop(ctx: Ctx, theme: Theme, camX: number, camY: number, time: number, reduced: boolean) {
  const c = themeCache(theme);
  const pal = PALETTES[theme];
  if (!c.sky) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.55, pal.skyMid);
    g.addColorStop(1, pal.skyBot);
    c.sky = g;
  }
  ctx.fillStyle = c.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const drift = reduced ? 0 : time;
  if (theme === "night") twinkle(ctx, time, camX, reduced, 70, 90);
  if (theme === "storm") twinkle(ctx, time, camX, reduced, 14, 50);

  // Sun or moon.
  const celestial = (x: number, y: number, r: number, core: string, glow: string) => {
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 4.5);
    g.addColorStop(0, rgba(glow, 0.55));
    g.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (theme === "day") celestial(256, 36, 12, "#fffbe0", "#fff3a0");
  else if (theme === "sunset") celestial(214, 104 + (MAX_CAM_Y - camY) * 0.1, 22, "#ffe2a0", "#ff9a5a");
  else if (theme === "night") {
    celestial(262, 34, 11, "#f4f1e0", "#9ab4ff");
    ctx.fillStyle = "rgba(160,170,190,0.45)";
    for (const [dx, dy, r] of [[-3, -2, 2.4], [3, 3, 1.8], [-1, 5, 1.2]]) {
      ctx.beginPath();
      ctx.arc(262 + dx, 34 + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else celestial(240, 40, 14, "#9a3a3a", "#ff4a3a");

  // Clouds drift slowly.
  const span = VIEW_W + 160;
  const clouds: [number, number, number, number][] = [
    [30, 22, 0.9, 3],
    [170, 46, 0.7, 4.5],
    [270, 16, 1, 2.5],
    [380, 38, 0.8, 3.5],
  ];
  for (const [cx, cy, s, speed] of clouds) {
    const x = ((((cx - camX * 0.12 - drift * speed) % span) + span) % span) - 90;
    ctx.globalAlpha = theme === "night" || theme === "storm" ? 0.7 : 0.95;
    ctx.drawImage(c.cloud, x, cy + (MAX_CAM_Y - camY) * 0.1, 120 * s, 50 * s);
  }
  ctx.globalAlpha = 1;

  c.layers.forEach((layer, i) => drawLayer(ctx, layer, camX, camY, PARALLAX[i], i === 2 ? 6 : i === 1 ? 2 : -4));

  // Sunset: glittering water on the harbour layer.
  if (theme === "sunset" && !reduced) {
    const y0 = VIEW_H - TILE * 2 - 30 + 2 + (MAX_CAM_Y - camY) * PARALLAX[1] * 0.6;
    for (let i = 0; i < 26; i++) {
      const x = (((i * 37 - camX * PARALLAX[1] + Math.sin(time * 1.5 + i) * 6) % VIEW_W) + VIEW_W) % VIEW_W;
      const y = y0 + 4 + (i % 6) * 5;
      ctx.fillStyle = `rgba(255,220,160,${0.2 + 0.4 * Math.abs(Math.sin(time * 2 + i * 1.7))})`;
      ctx.fillRect(x, y, 6 + (i % 3) * 3, 0.9);
    }
  }
}

/** Drifting petals, embers, fireflies or rain in front of the world. */
export function drawAmbient(ctx: Ctx, theme: Theme, camX: number, camY: number, time: number, reduced: boolean) {
  if (reduced) return;
  const r = rng(321);
  const n = theme === "storm" ? 46 : theme === "night" ? 22 : 18;
  for (let i = 0; i < n; i++) {
    const sx = r() * 640;
    const sy = r() * 300;
    const sp = 0.4 + r();
    const ph = r() * 6.28;
    if (theme === "day") {
      // Cherry-blossom petals.
      const x = (((sx - time * 14 * sp - camX * 1.15) % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40);
      const y = (sy + time * 12 * sp + Math.sin(time + ph) * 6 - camY * 0.2) % (VIEW_H + 20);
      ctx.fillStyle = "rgba(255,190,210,0.85)";
      ctx.beginPath();
      ctx.ellipse(x, y, 1.8, 1, time * sp + ph, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === "sunset") {
      const x = (((sx - time * 10 * sp - camX * 1.1) % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40);
      const y = (VIEW_H - ((sy + time * 9 * sp) % (VIEW_H + 20)) + 10) % (VIEW_H + 20);
      ctx.fillStyle = `rgba(255,200,120,${0.4 + 0.4 * Math.sin(time * 3 + ph)})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    } else if (theme === "night") {
      // Fireflies.
      const x = (((sx + Math.sin(time * 0.6 + ph) * 18 - camX * 1.1) % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40);
      const y = 70 + (sy % 110) + Math.cos(time * 0.7 + ph) * 8 - camY * 0.3;
      const a = 0.3 + 0.7 * Math.max(0, Math.sin(time * 1.6 + ph));
      const g = ctx.createRadialGradient(x, y, 0, x, y, 5);
      g.addColorStop(0, `rgba(220,255,140,${a})`);
      g.addColorStop(1, "rgba(220,255,140,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 5, y - 5, 10, 10);
    } else {
      // Rising embers and slanted rain.
      if (i % 3 === 0) {
        const x = (((sx + Math.sin(time * 0.8 + ph) * 10 - camX * 1.1) % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40);
        const y = VIEW_H - ((sy * 0.7 + time * 22 * sp) % (VIEW_H + 20)) + 10;
        ctx.fillStyle = `rgba(255,${120 + (i % 5) * 20},60,${0.5 + 0.4 * Math.sin(time * 4 + ph)})`;
        ctx.fillRect(x, y, 1.4, 1.4);
      } else {
        const x = (((sx - time * 40 * sp - camX * 1.2) % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40);
        const y = ((sy + time * 230 * sp) % (VIEW_H + 20)) - 10;
        ctx.strokeStyle = "rgba(190,200,230,0.35)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2.5, y + 8);
        ctx.stroke();
      }
    }
  }
}

let overlay: { theme: Theme; canvas: HTMLCanvasElement } | null = null;

/** Mood tint, soft screen edges and comic halftone dots in the corners, built once per theme. */
function buildOverlay(theme: Theme): HTMLCanvasElement {
  const pal = PALETTES[theme];
  const [canvas, ctx] = makeCanvas(VIEW_W * scale, VIEW_H * scale);
  ctx.scale(scale, scale);
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
  g.addColorStop(0, rgba(pal.tint, pal.tintAlpha));
  g.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Halftone dots grow toward the corners, like a printed comic panel.
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  const step = 5;
  for (let y = 0, row = 0; y < VIEW_H; y += step, row++) {
    for (let x = (row % 2) * (step / 2); x < VIEW_W; x += step) {
      const dx = (x - VIEW_W / 2) / (VIEW_W / 2);
      const dy = (y - VIEW_H / 2) / (VIEW_H / 2);
      const d = Math.hypot(dx, dy);
      const r = Math.max(0, d - 0.82) * 4.6;
      if (r < 0.15) continue;
      ctx.beginPath();
      ctx.arc(x, y, Math.min(1.7, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

/** The finished-picture overlay plus storm lightning. */
export function drawOverlay(ctx: Ctx, theme: Theme, time: number, reduced: boolean) {
  if (overlay?.theme !== theme) overlay = { theme, canvas: buildOverlay(theme) };
  ctx.drawImage(overlay.canvas, 0, 0, VIEW_W, VIEW_H);
  if (theme === "storm" && !reduced) {
    // Two quick flashes every few seconds.
    const phase = time % 6.5;
    const flash = phase < 0.08 ? 1 - phase / 0.08 : phase > 0.22 && phase < 0.3 ? 0.7 * (1 - (phase - 0.22) / 0.08) : 0;
    if (flash > 0) {
      ctx.fillStyle = `rgba(210,220,255,${flash * 0.22})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}

/** Comic speed lines rushing in from the edges, for Full Cowl and explosions. */
export function drawSpeedLines(ctx: Ctx, time: number, color: string, strength: number) {
  const frame = Math.floor(time * 20);
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5 * strength;
  const r = rng(frame * 977 + 3);
  for (let i = 0; i < 34; i++) {
    const a = r() * Math.PI * 2;
    const inner = 0.62 + r() * 0.16;
    const rx = VIEW_W * 0.62;
    const ry = VIEW_H * 0.62;
    const w = 0.025 + r() * 0.03;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rx * inner, cy + Math.sin(a) * ry * inner);
    ctx.lineTo(cx + Math.cos(a - w) * rx * 1.25, cy + Math.sin(a - w) * ry * 1.25);
    ctx.lineTo(cx + Math.cos(a + w) * rx * 1.25, cy + Math.sin(a + w) * ry * 1.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Tiles                                                              */
/* ------------------------------------------------------------------ */

export type TileKind = "ground" | "brick" | "question" | "cowl" | "heart" | "used";

type Mask = { top: boolean; left: boolean; right: boolean; bottom: boolean; depth: number };

function tileCanvas(kind: TileKind, mask: Mask, variant: number, frame: number): HTMLCanvasElement {
  const c = themeCache(cacheTheme());
  const key = `${kind}:${mask.top ? 1 : 0}${mask.left ? 1 : 0}${mask.right ? 1 : 0}${mask.bottom ? 1 : 0}${mask.depth}:${variant}:${frame}`;
  let tile = c.tiles.get(key);
  if (!tile) {
    const [canvas, ctx] = makeCanvas(TILE * scale, TILE * scale);
    ctx.scale(scale, scale);
    const pal = PALETTES[c.theme];
    if (kind === "ground") renderGround(ctx, pal, mask, variant, c.theme);
    else if (kind === "brick") renderBrick(ctx, pal, variant, mask.depth, mask.top, c.theme);
    else renderBlock(ctx, pal, kind, frame);
    c.tiles.set(key, canvas);
    tile = canvas;
  }
  return tile;
}

function cacheTheme(): Theme {
  return cache?.theme ?? "day";
}

function renderGround(ctx: Ctx, pal: Palette, m: Mask, variant: number, theme: Theme) {
  const rand = rng(variant * 131 + m.depth * 17 + (m.top ? 3 : 0) + 7);
  const dark = -0.1 * m.depth;
  const rad = 3;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, TILE, TILE, [m.top && m.left ? rad : 0, m.top && m.right ? rad : 0, m.bottom && m.right ? rad : 0, m.bottom && m.left ? rad : 0]);
  ctx.clip();

  const body = ctx.createLinearGradient(0, 0, 0, TILE);
  body.addColorStop(0, shade(pal.dirt[0], dark));
  body.addColorStop(1, shade(pal.dirt[1], dark));
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, TILE, TILE);

  // Speckles and pebbles.
  for (let i = 0; i < 12; i++) {
    const x = rand() * TILE;
    const y = rand() * TILE;
    ctx.fillStyle = rand() < 0.5 ? rgba(pal.dirt[2], 0.35) : rgba("#000000", 0.2);
    ctx.fillRect(x, y, 0.8 + rand(), 0.8 + rand() * 0.6);
  }
  for (let i = 0; i < 2; i++) {
    const x = 2 + rand() * 12;
    const y = 5 + rand() * 9;
    const r = 1 + rand() * 1.1;
    ctx.fillStyle = rgba("#000000", 0.25);
    ctx.beginPath();
    ctx.ellipse(x + 0.3, y + 0.5, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(pal.dirt[2], 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x - r * 0.5, y - r * 0.4, r * 0.7, 0.5);
  }

  // Shadowed sides and underside.
  const side = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
  };
  if (m.left) {
    side(0, 0, 3, 0);
    ctx.fillRect(0, 0, 3, TILE);
  }
  if (m.right) {
    side(TILE, 0, TILE - 3, 0);
    ctx.fillRect(TILE - 3, 0, 3, TILE);
  }
  if (m.bottom) {
    side(0, TILE, 0, TILE - 6);
    ctx.fillRect(0, TILE - 6, TILE, 6);
    // Hanging roots.
    ctx.strokeStyle = rgba("#2a1608", 0.7);
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 2; i++) {
      const x = 3 + rand() * 10;
      ctx.beginPath();
      ctx.moveTo(x, TILE - 4);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 3, TILE - 2, x + (rand() - 0.5) * 2, TILE);
      ctx.stroke();
    }
  }

  if (m.top) {
    if (theme === "storm") {
      // Ash crust with glowing cracks.
      const g = ctx.createLinearGradient(0, 0, 0, 5);
      g.addColorStop(0, "#7a6870");
      g.addColorStop(1, pal.grass[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TILE, 4.5);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(0, 0, TILE, 0.8);
      ctx.strokeStyle = "rgba(255,90,50,0.8)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      const cx = 3 + rand() * 10;
      ctx.moveTo(cx, 4.5);
      ctx.lineTo(cx - 1, 7);
      ctx.lineTo(cx + 1, 9);
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, 5);
      g.addColorStop(0, shade(pal.grass[0], 0.2));
      g.addColorStop(0.35, pal.grass[0]);
      g.addColorStop(1, pal.grass[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TILE, 4.5);
      // Soft shadow under the grass lip.
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 4.5, TILE, 1.2);
      // Blades overhanging the earth, and a tuft or flower above.
      ctx.fillStyle = pal.grass[1];
      for (let x = 0.5; x < TILE; x += 1.6) {
        const h = 1 + rand() * 2.2;
        ctx.beginPath();
        ctx.moveTo(x, 4.2);
        ctx.lineTo(x + 0.7, 4.2 + h);
        ctx.lineTo(x + 1.4, 4.2);
        ctx.fill();
      }
      ctx.fillStyle = shade(pal.grass[0], 0.3);
      for (let x = 1; x < TILE; x += 3.2) ctx.fillRect(x + rand(), 0.4, 0.5, 1.4);
      if (variant === 1) {
        const fx = 4 + rand() * 8;
        ctx.fillStyle = theme === "night" ? "#9ab4ff" : theme === "sunset" ? "#ffd27a" : "#ffffff";
        ctx.beginPath();
        ctx.arc(fx, 0.6, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function renderBrick(ctx: Ctx, pal: Palette, variant: number, depth: number, top: boolean, theme: Theme) {
  const rand = rng(variant * 53 + 11);
  ctx.fillStyle = pal.mortar;
  ctx.fillRect(0, 0, TILE, TILE);
  const rows = 4;
  const bh = TILE / rows;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : -4;
    for (let x = offset; x < TILE; x += 8) {
      const bx = Math.max(0, x) + 0.4;
      const bw = Math.min(TILE, x + 8) - Math.max(0, x) - 0.8;
      const by = r * bh + 0.4;
      const h = bh - 0.8;
      const tone = (rand() - 0.5) * 0.18;
      const g = ctx.createLinearGradient(0, by, 0, by + h);
      g.addColorStop(0, shade(pal.brick[0], tone + 0.1));
      g.addColorStop(1, shade(pal.brick[0], tone - 0.12));
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, bw, h);
      ctx.fillStyle = rgba(pal.brick[1], 0.75);
      ctx.fillRect(bx, by, bw, 0.7);
      ctx.fillStyle = rgba(pal.brick[2], 0.55);
      ctx.fillRect(bx, by + h - 0.6, bw, 0.6);
      if (rand() < 0.35) {
        ctx.fillStyle = rgba("#000000", 0.12);
        ctx.fillRect(bx + rand() * (bw - 2), by + 1, 1.2, 0.6);
      }
    }
  }
  if (variant === 2 && depth > 0 && (theme === "night" || theme === "storm")) {
    // A lit window in the tower wall.
    ctx.fillStyle = "#0b0a14";
    ctx.fillRect(5, 3, 6, 9);
    ctx.fillStyle = pal.lamp;
    ctx.fillRect(5.8, 3.8, 4.4, 7.4);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(7.8, 3.8, 0.5, 7.4);
    ctx.fillRect(5.8, 7.2, 4.4, 0.5);
  } else if (variant === 2) {
    ctx.strokeStyle = rgba(pal.mortar, 0.7);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(10, 3);
    ctx.lineTo(8.5, 6);
    ctx.lineTo(9.5, 8.5);
    ctx.stroke();
  }
  // Walls get darker the deeper a brick is inside them, with a pale cap on top.
  if (depth > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.1 * depth})`;
    ctx.fillRect(0, 0, TILE, TILE);
  }
  if (top) {
    ctx.fillStyle = rgba(pal.brick[1], 0.9);
    ctx.fillRect(0, 0, TILE, 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 2, TILE, 0.6);
  }
  // Bevel.
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(0, 0, TILE, 0.8);
  ctx.fillRect(0, 0, 0.8, TILE);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, TILE - 0.8, TILE, 0.8);
  ctx.fillRect(TILE - 0.8, 0, 0.8, TILE);
}

export function boltPath(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx + 1.2 * s, cy - 5 * s);
  ctx.lineTo(cx - 3 * s, cy + 0.6 * s);
  ctx.lineTo(cx - 0.3 * s, cy + 0.6 * s);
  ctx.lineTo(cx - 1.4 * s, cy + 5 * s);
  ctx.lineTo(cx + 3.2 * s, cy - 1 * s);
  ctx.lineTo(cx + 0.4 * s, cy - 1 * s);
  ctx.closePath();
}

/** Blocks that hold an item: gold "?" (coin), green bolt (Full Cowl), pink heart. `frame` 0..2 sweeps a shine across. */
function renderBlock(ctx: Ctx, pal: Palette, kind: TileKind, frame: number) {
  const used = kind === "used";
  const base = used ? "#7a6a64" : kind === "cowl" ? "#2fb36a" : kind === "heart" ? "#e0547a" : "#f2b632";
  const g = ctx.createLinearGradient(0, 0, 0, TILE);
  g.addColorStop(0, shade(base, 0.28));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, -0.28));
  ctx.fillStyle = "#1a0f08";
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = g;
  ctx.fillRect(0.8, 0.8, TILE - 1.6, TILE - 1.6);
  // Bevel and rivets.
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(0.8, 0.8, TILE - 1.6, 1);
  ctx.fillRect(0.8, 0.8, 1, TILE - 1.6);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0.8, TILE - 1.8, TILE - 1.6, 1);
  ctx.fillRect(TILE - 1.8, 0.8, 1, TILE - 1.6);
  for (const [x, y] of [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]]) {
    ctx.fillStyle = shade(base, -0.4);
    ctx.beginPath();
    ctx.arc(x, y, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x - 0.4, y - 0.4, 0.5, 0.5);
  }
  if (used) return;
  if (kind === "question") {
    // A hero star, the mark of a Plus Ultra block.
    const star = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
    };
    ctx.lineJoin = "round";
    star(8.3, 8.6, 5.4);
    ctx.fillStyle = shade(base, -0.5);
    ctx.fill();
    star(8, 8.2, 5.1);
    ctx.fillStyle = "#fffbe0";
    ctx.fill();
    ctx.strokeStyle = shade(base, -0.45);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  } else if (kind === "cowl") {
    ctx.fillStyle = "#0b3a22";
    boltPath(ctx, 8.4, 8.4, 1.15);
    ctx.fill();
    ctx.fillStyle = "#d8ffe6";
    boltPath(ctx, 8, 8, 1.1);
    ctx.fill();
  } else {
    ctx.fillStyle = "#4a0f22";
    heartPath(ctx, 8.3, 8.7, 5.4);
    ctx.fill();
    ctx.fillStyle = "#fff0f4";
    heartPath(ctx, 8, 8.3, 5);
    ctx.fill();
  }
  // A glint sweeping across.
  const x = -4 + frame * 9;
  const shine = ctx.createLinearGradient(x, 0, x + 5, 5);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.55)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0.8, 0.8, TILE - 1.6, TILE - 1.6);
}

export function heartPath(ctx: Ctx, cx: number, cy: number, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.9, cy - s * 1.1, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.95);
  ctx.closePath();
}

/** Draws every visible solid tile of a level. */
export function drawTiles(
  ctx: Ctx,
  level: Level,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  time: number,
  reduced: boolean,
  blockAt: (key: string) => TileKind | null,
  bumpOf: (tx: number, ty: number) => number,
) {
  themeCache(level.theme);
  const solid = (tx: number, ty: number) => tx < 0 || tx >= level.width || (ty >= 0 && ty < level.height && level.solid[ty][tx]);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!level.solid[ty]?.[tx]) continue;
      const block = blockAt(`${tx},${ty}`);
      const variant = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      const px = tx * TILE;
      const py = ty * TILE + bumpOf(tx, ty);
      let canvas: HTMLCanvasElement;
      if (block === "brick") {
        const above = (dy: number) => {
          const k = `${tx},${ty - dy}`;
          return blockAt(k) === "brick";
        };
        const depth = above(1) ? (above(2) ? 2 : 1) : 0;
        canvas = tileCanvas("brick", { ...NO_MASK, top: !above(1), depth }, variant % 3, 0);
      }
      else if (block) canvas = tileCanvas(block, NO_MASK, 0, shineFrame(block, time, reduced));
      else {
        let depth = 0;
        while (depth < 2 && ty - depth - 1 >= 0 && solid(tx, ty - depth - 1)) depth++;
        const mask = { top: !solid(tx, ty - 1), left: !solid(tx - 1, ty), right: !solid(tx + 1, ty), bottom: ty + 1 < level.height && !solid(tx, ty + 1), depth };
        canvas = tileCanvas("ground", mask, variant % 3, 0);
      }
      ctx.drawImage(canvas, px, py, TILE, TILE);
    }
  }
}

const NO_MASK: Mask = { top: false, left: false, right: false, bottom: false, depth: 0 };

/** Item blocks glint briefly every couple of seconds: frames 0–2 sweep the shine, 3 is at rest. */
function shineFrame(kind: TileKind, time: number, reduced: boolean): number {
  if (kind === "used" || reduced) return 3;
  const t = time % 2.6;
  return t < 0.45 ? Math.floor(t / 0.15) : 3;
}
