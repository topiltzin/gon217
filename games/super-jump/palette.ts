import type { Theme } from "./logic";

/** Colours for one level theme: sky, the three scenery layers, and the tiles. */
export type Palette = {
  skyTop: string;
  skyMid: string;
  skyBot: string;
  far: string;
  mid: string;
  near: string;
  cloud: string;
  cloudShade: string;
  /** Grass or crust: top, bottom. */
  grass: [string, string];
  /** Earth: top, bottom, speckle. */
  dirt: [string, string, string];
  /** Brick: face, light, dark. */
  brick: [string, string, string];
  mortar: string;
  /** Overlay tint used for the mood of the whole picture. */
  tint: string;
  tintAlpha: number;
  /** Colour of lit windows and lamps. */
  lamp: string;
};

export const PALETTES: Record<Theme, Palette> = {
  day: {
    skyTop: "#2f8cf0",
    skyMid: "#79c4ff",
    skyBot: "#d6f0ff",
    far: "#a9c6e6",
    mid: "#6fae7c",
    near: "#2f7a4a",
    cloud: "#ffffff",
    cloudShade: "#cfe3f7",
    grass: ["#5fcf4a", "#2f9a3a"],
    dirt: ["#a8683a", "#6b3f22", "#c88a55"],
    brick: ["#b7b3a6", "#e9e5d8", "#6c685c"],
    mortar: "#3a4a68",
    tint: "#ffe9a8",
    tintAlpha: 0.05,
    lamp: "#fff3b0",
  },
  sunset: {
    skyTop: "#2a1a5e",
    skyMid: "#e0566f",
    skyBot: "#ffc27a",
    far: "#8a4a7a",
    mid: "#53305f",
    near: "#2a1a3a",
    cloud: "#ffc9a0",
    cloudShade: "#e0758a",
    grass: ["#b6b84a", "#6f7a2c"],
    dirt: ["#9a5a3c", "#5a2e2a", "#c4825a"],
    brick: ["#b9503a", "#e88a62", "#6a2a22"],
    mortar: "#3a1620",
    tint: "#ff9a5a",
    tintAlpha: 0.1,
    lamp: "#ffd98a",
  },
  night: {
    skyTop: "#050914",
    skyMid: "#101c44",
    skyBot: "#27407a",
    far: "#1a2a52",
    mid: "#111c3c",
    near: "#0a1226",
    cloud: "#2b3a6e",
    cloudShade: "#1a2552",
    grass: ["#3f9a82", "#1f5f58"],
    dirt: ["#4a4a6a", "#26263f", "#6a6a92"],
    brick: ["#6a4a7a", "#9a7aae", "#2f1f45"],
    mortar: "#140c26",
    tint: "#4a6aff",
    tintAlpha: 0.1,
    lamp: "#ffe49a",
  },
  storm: {
    skyTop: "#12060f",
    skyMid: "#3a1224",
    skyBot: "#7a2a30",
    far: "#3a1a2c",
    mid: "#25101e",
    near: "#150812",
    cloud: "#4a2236",
    cloudShade: "#2a1020",
    grass: ["#6a5a62", "#3a2e36"],
    dirt: ["#5a4650", "#2e2229", "#7a6370"],
    brick: ["#7a3a3a", "#b86a5a", "#3a1618"],
    mortar: "#1c0a0c",
    tint: "#ff3a3a",
    tintAlpha: 0.08,
    lamp: "#ff8a5a",
  },
};

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mixes two `#rrggbb` colours; `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(ar, br)},${c(ag, bg)},${c(ab, bb)})`;
}

/** Lightens (amount > 0) or darkens (amount < 0) a `#rrggbb` colour. */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mix(hex, "#ffffff", amount) : mix(hex, "#000000", -amount);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** A small deterministic random generator, so scenery and tiles look the same every time. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
