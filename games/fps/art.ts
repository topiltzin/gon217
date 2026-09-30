import {
  CanvasTexture,
  NearestFilter,
  NearestMipmapNearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import type { EnemyKind, FloorKind, PickupKind, WallKind } from "./level";

/**
 * Every texture and sprite is original pixel art drawn here at runtime on tiny
 * canvases: nothing is downloaded, and the whole art set is a few kilobytes of code.
 */

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Darkens/brightens every pixel a little so flat colours look gritty. */
function grain(ctx: Ctx, w: number, h: number, amount: number, seed: number) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    const n = (r() - 0.5) * amount;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function toTexture(c: HTMLCanvasElement, mipmaps: boolean): Texture {
  const t = new CanvasTexture(c);
  t.magFilter = NearestFilter;
  t.minFilter = mipmaps ? NearestMipmapNearestFilter : NearestFilter;
  t.generateMipmaps = mipmaps;
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/* ---------- Surfaces (32×32) ---------- */

function brick(ctx: Ctx, seed: number, cracked = false) {
  const r = rng(seed);
  rect(ctx, 0, 0, 32, 32, "#2a1612");
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 ? 4 : 0;
    for (let col = -1; col < 4; col++) {
      const shade = 70 + Math.floor(r() * 30);
      rect(ctx, col * 8 + offset + 1, row * 4 + 1, 7, 3, `rgb(${shade + 40},${shade * 0.45},${shade * 0.3})`);
      rect(ctx, col * 8 + offset + 1, row * 4 + 1, 7, 1, `rgb(${shade + 60},${shade * 0.6},${shade * 0.4})`);
    }
  }
  if (cracked) {
    ctx.fillStyle = "#0a0505";
    let x = 16;
    for (let y = 2; y < 30; y++) {
      x += Math.round((r() - 0.5) * 2.4);
      ctx.fillRect(x, y, 1, 1);
      if (y % 7 === 0) ctx.fillRect(x + 1, y, 3, 1);
    }
  }
  grain(ctx, 32, 32, 26, seed);
}

function metal(ctx: Ctx, seed: number) {
  const r = rng(seed);
  rect(ctx, 0, 0, 32, 32, "#4a4540");
  for (const [x, y, w, h] of [[0, 0, 16, 16], [16, 0, 16, 16], [0, 16, 16, 16], [16, 16, 16, 16]]) {
    rect(ctx, x, y, w, h, "#3a3530");
    rect(ctx, x + 1, y + 1, w - 2, h - 2, "#56504a");
    rect(ctx, x + 1, y + 1, w - 2, 1, "#6e6760");
    for (const [rx, ry] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) rect(ctx, x + rx, y + ry, 1, 1, "#8a847c");
  }
  // Rust streaks
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(r() * 32);
    const y = Math.floor(r() * 26);
    rect(ctx, x, y, 1, 2 + Math.floor(r() * 6), r() > 0.5 ? "#7a3f1c" : "#5e2e14");
  }
  grain(ctx, 32, 32, 22, seed);
}

function stone(ctx: Ctx, seed: number) {
  const r = rng(seed);
  rect(ctx, 0, 0, 32, 32, "#1f211e");
  const blocks = [[0, 0, 13, 10], [13, 0, 19, 10], [0, 10, 20, 11], [20, 10, 12, 11], [0, 21, 10, 11], [10, 21, 22, 11]];
  for (const [x, y, w, h] of blocks) {
    const s = 60 + Math.floor(r() * 25);
    rect(ctx, x + 1, y + 1, w - 1, h - 1, `rgb(${s},${s + 4},${s - 4})`);
    rect(ctx, x + 1, y + 1, w - 1, 1, `rgb(${s + 22},${s + 26},${s + 16})`);
  }
  grain(ctx, 32, 32, 30, seed);
}

function stripes(ctx: Ctx, seed: number) {
  metal(ctx, seed);
  for (let y = 20; y < 30; y++) {
    for (let x = 0; x < 32; x++) {
      rect(ctx, x, y, 1, 1, ((x + y) >> 2) % 2 ? "#d9a514" : "#161412");
    }
  }
  rect(ctx, 0, 19, 32, 1, "#2a2622");
  rect(ctx, 0, 30, 32, 1, "#2a2622");
  grain(ctx, 32, 32, 18, seed + 1);
}

function tiles(ctx: Ctx, seed: number) {
  const r = rng(seed);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const s = (x + y) % 2 ? 58 : 44;
      rect(ctx, x * 8, y * 8, 8, 8, `rgb(${s + 6},${s},${s - 6})`);
      rect(ctx, x * 8, y * 8, 8, 1, "#1c1916");
      rect(ctx, x * 8, y * 8, 1, 8, "#1c1916");
    }
  }
  for (let i = 0; i < 12; i++) rect(ctx, Math.floor(r() * 30), Math.floor(r() * 30), 2, 2, "#2b2019");
  grain(ctx, 32, 32, 24, seed);
}

function grate(ctx: Ctx, seed: number) {
  rect(ctx, 0, 0, 32, 32, "#141312");
  for (let i = 0; i < 32; i += 4) {
    rect(ctx, i, 0, 2, 32, "#4d4944");
    rect(ctx, 0, i + 1, 32, 1, "#3a3733");
  }
  grain(ctx, 32, 32, 20, seed);
}

function ceiling(ctx: Ctx, seed: number) {
  rect(ctx, 0, 0, 32, 32, "#4d463e");
  for (let i = 0; i < 32; i += 16) {
    rect(ctx, i, 0, 1, 32, "#2a2622");
    rect(ctx, 0, i, 32, 1, "#2a2622");
    rect(ctx, i + 1, 1, 14, 1, "#5e564c");
  }
  grain(ctx, 32, 32, 30, seed);
}

function door(ctx: Ctx, seed: number, locked: boolean) {
  rect(ctx, 0, 0, 32, 32, "#3b3833");
  rect(ctx, 2, 0, 28, 32, "#5c574f");
  for (let y = 3; y < 32; y += 6) rect(ctx, 3, y, 26, 1, "#403c36");
  rect(ctx, 15, 0, 2, 32, "#26231f");
  for (let y = 0; y < 32; y++) {
    const c = (y >> 2) % 2 ? "#d9a514" : "#161412";
    rect(ctx, 0, y, 2, 1, c);
    rect(ctx, 30, y, 2, 1, c);
  }
  if (locked) {
    rect(ctx, 9, 10, 14, 12, "#1a0606");
    rect(ctx, 10, 11, 12, 10, "#b3160f");
    rect(ctx, 13, 13, 4, 4, "#ffd7c2");
    rect(ctx, 17, 14, 4, 2, "#ffd7c2");
  }
  grain(ctx, 32, 32, 16, seed);
}

function crate(ctx: Ctx, seed: number) {
  rect(ctx, 0, 0, 32, 32, "#3a2a18");
  rect(ctx, 2, 2, 28, 28, "#6b4f2c");
  for (let i = 0; i < 28; i++) {
    rect(ctx, 2 + i, 2 + i, 2, 1, "#3a2a18");
    rect(ctx, 29 - i, 2 + i, 2, 1, "#3a2a18");
  }
  rect(ctx, 0, 0, 32, 2, "#8a6a3c");
  grain(ctx, 32, 32, 28, seed);
}

function exitPad(ctx: Ctx) {
  rect(ctx, 0, 0, 32, 32, "#062a10");
  for (let i = 0; i < 4; i++) rect(ctx, 2 + i * 2, 2 + i * 2, 28 - i * 4, 28 - i * 4, i % 2 ? "#0b5a22" : "#16a34a");
  rect(ctx, 12, 12, 8, 8, "#86efac");
}

function gunMetal(ctx: Ctx, seed: number) {
  rect(ctx, 0, 0, 16, 16, "#474b54");
  rect(ctx, 0, 0, 16, 2, "#7a808c");
  rect(ctx, 0, 14, 16, 2, "#2a2c31");
  rect(ctx, 0, 8, 16, 1, "#33363c");
  grain(ctx, 16, 16, 20, seed);
}

function grip(ctx: Ctx, seed: number) {
  rect(ctx, 0, 0, 16, 16, "#4a2e1a");
  for (let y = 1; y < 16; y += 3) rect(ctx, 0, y, 16, 1, "#2e1c10");
  grain(ctx, 16, 16, 24, seed);
}

function glove(ctx: Ctx, seed: number) {
  rect(ctx, 0, 0, 16, 16, "#3b3f26");
  rect(ctx, 0, 12, 16, 4, "#2a2d1b");
  grain(ctx, 16, 16, 20, seed);
}

export type Surfaces = Record<WallKind | FloorKind | "cracked" | "ceiling" | "door" | "locked" | "crate" | "exit", Texture> & {
  gun: Texture;
  grip: Texture;
  glove: Texture;
};

export function makeSurfaces(): Surfaces {
  const make = (draw: (ctx: Ctx) => void, size = 32, repeat = 1) => {
    const [c, ctx] = canvas(size, size);
    draw(ctx);
    const t = toTexture(c, true);
    t.repeat.set(repeat, repeat);
    return t;
  };
  // Walls and floors tile twice per 4 m cell: about 16 texels per metre.
  return {
    brick: make((c) => brick(c, 11), 32, 2),
    metal: make((c) => metal(c, 22), 32, 2),
    stone: make((c) => stone(c, 33), 32, 2),
    stripes: make((c) => stripes(c, 44)),
    cracked: make((c) => brick(c, 11, true), 32, 2),
    tiles: make((c) => tiles(c, 55), 32, 2),
    grate: make((c) => grate(c, 66), 32, 2),
    ceiling: make((c) => ceiling(c, 77), 32, 2),
    door: make((c) => door(c, 88, false)),
    locked: make((c) => door(c, 88, true)),
    crate: make((c) => crate(c, 99)),
    exit: make(exitPad),
    gun: make((c) => gunMetal(c, 5), 16),
    grip: make((c) => grip(c, 6), 16),
    glove: make((c) => glove(c, 7), 16),
  };
}

/* ---------- Enemy sprites ---------- */

export type EnemyFrame = "walk0" | "walk1" | "attack" | "dead";

/** Zombie: rotting green skin, torn shirt, arms reaching forward, green ooze (32×40). */
function zombie(ctx: Ctx, frame: EnemyFrame) {
  const skin = "#7d9a62";
  const shade = "#56703f";
  const pale = "#a3bb86";
  const shirt = "#44546a";
  const shirtDark = "#2e3a4a";
  const pants = "#4a3b2c";
  const ooze = "#3fae2a";
  if (frame === "dead") {
    rect(ctx, 2, 34, 28, 5, "#1f5a14");
    rect(ctx, 5, 35, 8, 3, ooze);
    rect(ctx, 6, 31, 18, 5, shirt);
    rect(ctx, 22, 30, 7, 5, skin);
    rect(ctx, 24, 31, 2, 1, "#1a1a12");
    rect(ctx, 3, 32, 5, 3, pants);
    rect(ctx, 12, 32, 4, 2, shade);
    return;
  }
  const step = frame === "walk1" ? 2 : 0;
  const attack = frame === "attack";
  // Legs: ragged trousers, shuffling
  rect(ctx, 9 - step, 27, 6, 11, pants);
  rect(ctx, 17 + step, 27, 6, 11, pants);
  rect(ctx, 9 - step, 35, 2, 3, skin);
  rect(ctx, 8 - step, 38, 7, 2, "#1f1a14");
  rect(ctx, 16 + step, 38, 7, 2, "#1f1a14");
  // Torso: torn shirt with skin showing through the rips
  rect(ctx, 8, 13, 16, 15, shirt);
  rect(ctx, 8, 13, 16, 2, shirtDark);
  rect(ctx, 12, 18, 4, 5, skin);
  rect(ctx, 13, 19, 1, 3, shade);
  rect(ctx, 19, 22, 3, 4, skin);
  rect(ctx, 9, 25, 3, 3, skin);
  rect(ctx, 20, 16, 2, 2, ooze);
  rect(ctx, 14, 26, 6, 2, shirtDark);
  // Head: lopsided, sunken eyes, slack jaw, patchy hair
  rect(ctx, 11, 3, 10, 10, skin);
  rect(ctx, 11, 3, 10, 2, pale);
  rect(ctx, 11, 2, 4, 2, "#2a241c");
  rect(ctx, 17, 1, 3, 3, "#2a241c");
  rect(ctx, 20, 5, 1, 5, shade);
  rect(ctx, 12, 6, 3, 3, "#1a1a12");
  rect(ctx, 17, 6, 3, 3, "#1a1a12");
  rect(ctx, 13, 7, 1, 1, "#e8f0a0");
  rect(ctx, 18, 7, 1, 1, "#e8f0a0");
  rect(ctx, 13, attack ? 10 : 11, 6, attack ? 3 : 2, "#1a0f0a");
  rect(ctx, 14, 10, 1, 1, "#d8cfae");
  rect(ctx, 17, 10, 1, 1, "#d8cfae");
  rect(ctx, 12, 12, 2, 2, ooze);
  // Arms reaching forward (raised higher to grab when attacking)
  const armY = attack ? 9 : 14 + step;
  const armY2 = attack ? 9 : 15 - step;
  rect(ctx, 3, armY, 6, 4, shirt);
  rect(ctx, 23, armY2, 6, 4, shirt);
  rect(ctx, 2, armY + 4, 5, 3, skin);
  rect(ctx, 25, armY2 + 4, 5, 3, skin);
  for (const x of [2, 4, 6]) rect(ctx, x, armY + 7, 1, 2, shade);
  for (const x of [25, 27, 29]) rect(ctx, x, armY2 + 7, 1, 2, shade);
}

/** Gloom: a floating one-eyed orb trailing tendrils, spits fireballs (32×32). */
function gloom(ctx: Ctx, frame: EnemyFrame) {
  if (frame === "dead") {
    rect(ctx, 4, 27, 24, 5, "#2a0f33");
    rect(ctx, 8, 25, 16, 4, "#4c1d5e");
    rect(ctx, 13, 26, 5, 2, "#f5d90a");
    rect(ctx, 5, 30, 4, 2, "#5a0a08");
    return;
  }
  const sway = frame === "walk1" ? 1 : 0;
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 4;
    rect(ctx, x + ((i + sway) % 2), 22, 2, 6 + ((i + sway) % 3) * 2, "#3a1447");
  }
  rect(ctx, 6, 4, 20, 20, "#4c1d5e");
  rect(ctx, 4, 8, 24, 12, "#4c1d5e");
  rect(ctx, 8, 5, 12, 3, "#7c3aa0");
  rect(ctx, 5, 9, 3, 6, "#6a2c8a");
  // Eye
  rect(ctx, 11, 8, 10, 8, "#f5f0d0");
  rect(ctx, 14, 9 + sway, 4, 5, "#e0a800");
  rect(ctx, 15, 10 + sway, 2, 3, "#120408");
  // Mouth
  if (frame === "attack") {
    rect(ctx, 10, 17, 12, 5, "#1a0504");
    rect(ctx, 12, 18, 8, 3, "#ff7a1a");
    rect(ctx, 14, 19, 4, 1, "#ffe08a");
  } else {
    rect(ctx, 11, 18, 10, 2, "#1a0504");
    for (let x = 11; x < 21; x += 2) rect(ctx, x, 18, 1, 1, "#d8cfae");
  }
}

export type EnemyArt = Record<EnemyKind, Record<EnemyFrame, Texture>>;

export function makeEnemyArt(): EnemyArt {
  const frames: EnemyFrame[] = ["walk0", "walk1", "attack", "dead"];
  const build = (w: number, h: number, draw: (ctx: Ctx, f: EnemyFrame) => void, seed: number) =>
    Object.fromEntries(
      frames.map((f, i) => {
        const [c, ctx] = canvas(w, h);
        draw(ctx, f);
        grain(ctx, w, h, 14, seed + i);
        return [f, toTexture(c, false)];
      }),
    ) as Record<EnemyFrame, Texture>;
  return { zombie: build(32, 40, zombie, 101), gloom: build(32, 32, gloom, 202) };
}

/* ---------- Pickups and effects ---------- */

function pickup(ctx: Ctx, kind: PickupKind) {
  switch (kind) {
    case "health":
      rect(ctx, 3, 5, 18, 14, "#e8e2d6");
      rect(ctx, 3, 5, 18, 2, "#ffffff");
      rect(ctx, 10, 7, 4, 10, "#c81e1e");
      rect(ctx, 7, 10, 10, 4, "#c81e1e");
      rect(ctx, 3, 17, 18, 2, "#9c968a");
      break;
    case "armor":
      rect(ctx, 5, 3, 14, 17, "#1f7a3a");
      rect(ctx, 3, 3, 4, 6, "#1f7a3a");
      rect(ctx, 17, 3, 4, 6, "#1f7a3a");
      rect(ctx, 9, 3, 6, 3, "#0b1a10");
      rect(ctx, 7, 8, 10, 9, "#2fb35a");
      rect(ctx, 11, 8, 2, 9, "#1f7a3a");
      break;
    case "bullets":
      for (let i = 0; i < 4; i++) {
        rect(ctx, 4 + i * 4, 8, 3, 12, "#b08d2a");
        rect(ctx, 4 + i * 4, 5, 3, 3, "#d8cfae");
      }
      rect(ctx, 3, 18, 18, 3, "#3a3733");
      break;
    case "shells":
      rect(ctx, 2, 8, 20, 12, "#4a3a22");
      for (let i = 0; i < 4; i++) {
        rect(ctx, 4 + i * 4, 4, 3, 9, "#b3160f");
        rect(ctx, 4 + i * 4, 11, 3, 2, "#d9a514");
      }
      break;
    case "shotgun":
      rect(ctx, 1, 10, 18, 3, "#2c2e33");
      rect(ctx, 1, 13, 14, 2, "#44474f");
      rect(ctx, 8, 14, 6, 3, "#6b4a2a");
      rect(ctx, 16, 12, 7, 5, "#6b4a2a");
      rect(ctx, 19, 16, 4, 3, "#6b4a2a");
      break;
    case "key":
      rect(ctx, 5, 6, 14, 12, "#b3160f");
      rect(ctx, 5, 6, 14, 2, "#e04a3a");
      rect(ctx, 8, 10, 8, 4, "#ffd7c2");
      rect(ctx, 5, 16, 14, 2, "#6e0c08");
      break;
  }
}

export type EffectArt = Record<PickupKind, Texture> & { glow: Texture; fireball: Texture; flash: Texture };

export function makeEffectArt(): EffectArt {
  const kinds: PickupKind[] = ["health", "armor", "bullets", "shells", "shotgun", "key"];
  const art = Object.fromEntries(
    kinds.map((k) => {
      const [c, ctx] = canvas(24, 24);
      pickup(ctx, k);
      return [k, toTexture(c, false)];
    }),
  ) as EffectArt;

  const radial = (size: number, stops: [number, string][]) => {
    const [c, ctx] = canvas(size, size);
    // Pixelated rings rather than a smooth gradient, to match the art.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
        const stop = stops.find(([limit]) => d <= limit);
        if (stop) rect(ctx, x, y, 1, 1, stop[1]);
      }
    }
    return toTexture(c, false);
  };
  art.glow = radial(16, [[0.35, "rgba(255,255,255,0.5)"], [0.7, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0.1)"]]);
  art.fireball = radial(12, [[0.3, "#fff4c2"], [0.6, "#ffab1a"], [1, "#d9360b"]]);

  const [c, ctx] = canvas(16, 16);
  for (const [x, y, w, h, color] of [
    [5, 0, 6, 16, "#ff9d1a"],
    [0, 5, 16, 6, "#ff9d1a"],
    [2, 2, 12, 12, "#ffcc4d"],
    [5, 5, 6, 6, "#fff7d6"],
  ] as const)
    rect(ctx, x, y, w, h, color);
  art.flash = toTexture(c, false);
  return art;
}
