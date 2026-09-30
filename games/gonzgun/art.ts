import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Every texture in Gonzgun is painted here on small canvases: no image files.
 * Painting uses its own seeded RNG so the basement looks the same every visit.
 */

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
}

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function texture(c: HTMLCanvasElement, opts: { repeat?: [number, number]; pixel?: boolean; color?: boolean } = {}): Texture {
  const t = new CanvasTexture(c);
  if (opts.color !== false) t.colorSpace = SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...opts.repeat);
  }
  if (opts.pixel) {
    t.magFilter = NearestFilter;
    t.minFilter = NearestFilter;
    t.generateMipmaps = false;
  }
  return t;
}

export function concreteTexture(): Texture {
  const { c, g } = canvas(256);
  const rnd = seeded(11);
  g.fillStyle = "#6d6f73";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + Math.floor(rnd() * 40);
    g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
    g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
  }
  // Damp stains
  for (let i = 0; i < 5; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 20 + rnd() * 40;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(40,38,34,0.35)");
    grad.addColorStop(1, "rgba(40,38,34,0)");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Slab seams and cracks
  g.strokeStyle = "rgba(30,30,32,0.7)";
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = rnd() * 256;
    let y = rnd() * 256;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rnd() - 0.5) * 30;
      y += (rnd() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return texture(c, { repeat: [5, 3] });
}

export function brickTexture(): Texture {
  const { c, g } = canvas(256);
  const rnd = seeded(23);
  g.fillStyle = "#3b3431";
  g.fillRect(0, 0, 256, 256);
  const bw = 64;
  const bh = 32;
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 5; col++) {
      const r = 110 + rnd() * 40;
      g.fillStyle = `rgb(${r},${r * 0.42},${r * 0.32})`;
      g.fillRect(col * bw + off + 3, row * bh + 3, bw - 6, bh - 6);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(col * bw + off + 3, row * bh + bh - 8, bw - 6, 5);
    }
  }
  // Grime climbing up from the floor
  const grad = g.createLinearGradient(0, 256, 0, 120);
  grad.addColorStop(0, "rgba(20,18,16,0.55)");
  grad.addColorStop(1, "rgba(20,18,16,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return texture(c, { repeat: [6, 1] });
}

export function crateTexture(): Texture {
  const { c, g } = canvas(128);
  g.fillStyle = "#9a6a3a";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#7d5226";
  for (let y = 0; y < 128; y += 21) g.fillRect(0, y, 128, 2);
  g.strokeStyle = "#5c3a18";
  g.lineWidth = 12;
  g.strokeRect(6, 6, 116, 116);
  g.beginPath();
  g.moveTo(10, 10);
  g.lineTo(118, 118);
  g.stroke();
  g.fillStyle = "#c9c2b0";
  for (const [x, y] of [[10, 10], [118, 10], [10, 118], [118, 118]]) g.fillRect(x - 3, y - 3, 6, 6);
  return texture(c);
}

export function barrelTexture(): Texture {
  const { c, g } = canvas(128, 64);
  g.fillStyle = "#2f6f4f";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "#23543b";
  g.fillRect(0, 10, 128, 5);
  g.fillRect(0, 49, 128, 5);
  g.fillStyle = "#e8c547";
  g.fillRect(50, 24, 28, 16);
  return texture(c);
}

export function firstAidTexture(): Texture {
  const { c, g } = canvas(64);
  g.fillStyle = "#f4f4f0";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#e11d48";
  g.fillRect(24, 10, 16, 44);
  g.fillRect(10, 24, 44, 16);
  return texture(c, { pixel: true });
}

/** White splat with soft edges; tinted blue by the material. */
export function splatTexture(): Texture {
  const { c, g } = canvas(128);
  const rnd = seeded(5);
  g.fillStyle = "#fff";
  const blob = (x: number, y: number, r: number) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  blob(64, 64, 26);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 20 + rnd() * 34;
    blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + rnd() * 9);
  }
  return texture(c, { color: false });
}

export function glowTexture(): Texture {
  const { c, g } = canvas(64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return texture(c, { color: false });
}

/** Name tag floating over a fighter, e.g. "P1" or "CPU". */
export function tagTexture(text: string, color: string): Texture {
  const { c, g } = canvas(128, 64);
  g.fillStyle = "rgba(10,10,20,0.75)";
  g.beginPath();
  g.roundRect(4, 8, 120, 48, 14);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = "#fff";
  g.font = "bold 30px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 64, 34);
  return texture(c);
}

/** A comic-book sound word: yellow letters, thick blue outline, dark shadow. */
export function wordTexture(word: string): Texture {
  const { c, g } = canvas(256, 128);
  g.font = "italic 900 72px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.fillText(word, 134, 72, 230);
  g.strokeStyle = "#1d4ed8";
  g.lineWidth = 16;
  g.strokeText(word, 128, 64, 230);
  g.fillStyle = "#facc15";
  g.fillText(word, 128, 64, 230);
  return texture(c);
}

/* ---------- Block-world people (Blocky and Pixel) ---------- */

type Pixels = string[];

function pixelArt(rows: Pixels, palette: Record<string, string>): Texture {
  const h = rows.length;
  const w = rows[0].length;
  const { c, g } = canvas(w, h);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      g.fillStyle = palette[ch];
      g.fillRect(x, y, 1, 1);
    }),
  );
  return texture(c, { pixel: true });
}

/** Colours and 8×8 head rows for a block-world person. Letters: h/H hair, s/S skin, w eye white, e iris, n nose, m mouth. */
export type BlockLook = {
  palette: { h: string; H: string; s: string; S: string; w: string; e: string; n: string; m: string };
  shirt: [string, string];
  pants: [string, string];
  shoes: [string, string];
  face: Pixels;
  side: Pixels;
  back: Pixels;
  /** Long hair hanging down the back of the head. */
  longHair: boolean;
};

const PLAIN_BACK = ["hhhhhhhh", "hhhhHhhh", "hhhhhhhh", "hhHhhhhh", "hhhhhhHh", "hhhhhhhh", "Hhhhhhhh", "hhhhhhhh"];

export const BLOCKY_LOOK: BlockLook = {
  palette: { h: "#4a2f1b", H: "#3a2412", s: "#c89370", S: "#b07b58", w: "#ffffff", e: "#4b3aa8", n: "#8f5a3e", m: "#6b3d26" },
  shirt: ["#27a7b5", "#1f8f9b"],
  pants: ["#3c3caa", "#33338f"],
  shoes: ["#6e6e6e", "#5a5a5a"],
  face: ["hhhhhhhh", "hhHhhhhh", "hsssssSh", "swessews", "ssssssss", "sssnnsss", "ssmmmmss", "ssmsssms"],
  side: ["hhhhhhhh", "hhhhhhhh", "hhhhhsss", "hhhhssss", "hhhsssss", "hhssssss", "hsssssss", "ssssssss"],
  back: PLAIN_BACK,
  longHair: false,
};

export const PIXEL_LOOK: BlockLook = {
  palette: { h: "#e2701f", H: "#c75a12", s: "#f1c9a5", S: "#e3b08a", w: "#ffffff", e: "#2f9e44", n: "#e3b08a", m: "#e0707a" },
  shirt: ["#5cb85c", "#4a9d4a"],
  pants: ["#7a5230", "#664325"],
  shoes: ["#5a5a5a", "#474747"],
  face: ["hhhhhhhh", "hhhhhhHh", "hhhhssss", "hwessewh", "hssssssh", "hsssSssh", "hssmmssh", "hsssssss"],
  side: ["hhhhhhhh", "hhhhhhhh", "hhhhhhhh", "hhhhhhss", "hhhhhhss", "hhhhhsss", "hhhhhhss", "hhhhhhhs"],
  back: PLAIN_BACK,
  longHair: true,
};

export function blockHead(look: BlockLook) {
  const p = look.palette;
  const fill = (ch: string) => Array.from({ length: 8 }, () => ch.repeat(8));
  return {
    face: pixelArt(look.face, p),
    side: pixelArt(look.side, p),
    back: pixelArt(look.back, p),
    top: pixelArt(["hhhhhhhh", "hHhhhhhh", "hhhhhHhh", "hhhhhhhh", "hhhHhhhh", "hhhhhhhh", "hhhhhhHh", "hhhhhhhh"], p),
    bottom: pixelArt(fill("s"), p),
    hair: pixelArt(PLAIN_BACK, p),
  };
}

export function blockShirt(look: BlockLook): Texture {
  const [c, C] = look.shirt;
  const { s, S } = look.palette;
  return pixelArt(["sssSsSss", "cccssccc", "cccccccc", "cCcccccc", "cccccCcc", "cccccccc", "ccCccccc", "cccccccc"], { s, S, c, C });
}

export function blockPants(look: BlockLook): Texture {
  const [p, P] = look.pants;
  const [g, G] = look.shoes;
  return pixelArt(["pppppppp", "pPpppppp", "pppppPpp", "pppppppp", "ppPppppp", "pppppppp", "gggggggg", "gGgggggg"], { p, P, g, G });
}

export function blockArm(look: BlockLook): Texture {
  const [c, C] = look.shirt;
  const { s, S } = look.palette;
  return pixelArt(["cccc", "cCcc", "cccc", "ssss", "ssss", "sSss", "ssss", "ssss"], { c, C, s, S });
}
