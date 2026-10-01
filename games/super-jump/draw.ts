import { EFFECT_S, type JumpState, PLATFORM_H, type Theme, TILE } from "./logic";

export const VIEW_W = 20 * TILE; // 320 logical pixels
export const VIEW_H = 12 * TILE; // 192 logical pixels

const C = {
  sky: "#5c94fc",
  cloud: "#ffffff",
  cloudShade: "#bcd4fc",
  hillDark: "#00a800",
  hillLight: "#58d854",
  hillInk: "#005800",
  ground: "#c84c0c",
  groundLight: "#fc9838",
  groundInk: "#000000",
  grass: "#00a800",
  coin: "#fcbc3c",
  coinShine: "#fff8b0",
  coinInk: "#a44400",
  goomba: "#a44400",
  goombaFoot: "#000000",
  goombaSkin: "#fcd8a8",
  white: "#ffffff",
  ink: "#000000",
  pole: "#58d854",
  poleBall: "#fcbc3c",
  flag: "#ffffff",
  checkpoint: "#e40058",
};

/** Sky, hills and clouds per level theme. */
const THEMES: Record<Theme, { sky: string; cloud: string; cloudShade: string; hillDark: string; hillLight: string }> = {
  day: { sky: C.sky, cloud: C.cloud, cloudShade: C.cloudShade, hillDark: C.hillDark, hillLight: C.hillLight },
  sunset: { sky: "#f4845f", cloud: "#ffd6a5", cloudShade: "#f7a072", hillDark: "#7b2d26", hillLight: "#b5523b" },
  night: { sky: "#14183a", cloud: "#3b4170", cloudShade: "#272c55", hillDark: "#1f2a44", hillLight: "#2f3f63" },
};

export const SPRITE_URL = "/sprites/gonzalo.png";
const SPRITE_W = 18;
const SPRITE_H = 23;

/** Draws one frame. `reducedMotion` turns off parallax, bobbing, and blinking. `sprite` is Gonzalo's pixel sheet (stand, run, jump). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: JumpState,
  reducedMotion: boolean,
  sprite?: HTMLImageElement | null,
) {
  const { level, player } = s;
  const worldW = level.width * TILE;
  const camX = Math.round(Math.min(Math.max(player.x + player.w / 2 - VIEW_W / 2, 0), worldW - VIEW_W));

  // Old-school sky, clouds and hills, tinted by the level's theme.
  const theme = THEMES[level.theme];
  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (level.theme === "night") {
    ctx.fillStyle = "#fff7d6";
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97 - Math.round(camX * 0.05)) % VIEW_W, (i * 53) % 90, 1, 1);
    ctx.fillRect(260, 20, 14, 14);
  }
  drawClouds(ctx, reducedMotion ? 0 : camX * 0.15, theme);
  drawHills(ctx, reducedMotion ? 0 : camX * 0.4, theme);

  ctx.save();
  ctx.translate(-camX, 0);

  const x0 = Math.max(0, Math.floor(camX / TILE));
  const x1 = Math.min(level.width - 1, Math.ceil((camX + VIEW_W) / TILE));
  const brickSet = new Set(level.bricks.map((b) => `${b.x},${b.y}`));
  const questionSet = new Set(level.questions.map((q) => `${q.x},${q.y}`));
  const usedSet = new Set(s.usedBlocks);
  // A question block jumps up a little when bumped.
  const bumpOf = (tx: number, ty: number) => {
    if (reducedMotion) return 0;
    const e = s.effects.find((f) => f.kind === "coin" && f.x === tx && f.y === ty);
    const age = e ? s.time - e.at : 1;
    return age < 0.16 ? -Math.round(Math.sin((age / 0.16) * Math.PI) * 4) : 0;
  };

  // Tiles.
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!level.solid[ty][tx]) continue;
      const px = tx * TILE;
      const py = ty * TILE;
      const key = `${tx},${ty}`;
      if (questionSet.has(key)) {
        drawQuestion(ctx, px, py + bumpOf(tx, ty), usedSet.has(key), reducedMotion ? 0 : s.time);
      } else if (brickSet.has(key)) {
        drawBrick(ctx, px, py);
      } else {
        drawGround(ctx, px, py, ty === 0 || !level.solid[ty - 1][tx]);
      }
    }
  }

  // Coins.
  const bob = reducedMotion ? 0 : Math.round(Math.sin(s.time * 5) * 1.5);
  for (const c of s.coins) {
    if (c.taken || c.x < x0 - 1 || c.x > x1 + 1) continue;
    const cx = Math.round(c.x * TILE + TILE / 2);
    const cy = Math.round(c.y * TILE + TILE / 2 + bob);
    // Spinning coin: width steps 6 -> 4 -> 2 -> 4.
    const half = reducedMotion ? 3 : [3, 2, 1, 2][Math.floor(s.time * 8) % 4];
    ctx.fillStyle = C.coinInk;
    ctx.fillRect(cx - half - 1, cy - 7, half * 2 + 2, 14);
    ctx.fillStyle = C.coin;
    ctx.fillRect(cx - half, cy - 6, half * 2, 12);
    ctx.fillStyle = C.coinShine;
    ctx.fillRect(cx - half, cy - 5, 1, 8);
  }

  // Moving platforms: steel girders with rivets.
  for (const pl of s.platforms) {
    const x = Math.round(pl.px);
    const y = Math.round(pl.py);
    ctx.fillStyle = C.groundInk;
    ctx.fillRect(x, y, pl.w, PLATFORM_H);
    ctx.fillStyle = "#9aa4b5";
    ctx.fillRect(x + 1, y + 1, pl.w - 2, PLATFORM_H - 2);
    ctx.fillStyle = "#d6dce6";
    ctx.fillRect(x + 1, y + 1, pl.w - 2, 1);
    ctx.fillStyle = "#4b5563";
    for (let rx = x + 3; rx < x + pl.w - 2; rx += 6) ctx.fillRect(rx, y + 3, 1, 1);
  }

  // Smashed bricks fly apart in four pieces; bumped question blocks pop a coin.
  for (const e of s.effects) {
    const age = s.time - e.at;
    const bx = e.x * TILE;
    const by = e.y * TILE;
    if (e.kind === "smash") {
      for (const [dx, dy, vx, vy] of [[0, 0, -40, -170], [8, 0, 40, -170], [0, 8, -30, -110], [8, 8, 30, -110]]) {
        const x = Math.round(bx + dx + vx * age);
        const y = Math.round(by + dy + vy * age + 500 * age * age);
        ctx.fillStyle = C.ground;
        ctx.fillRect(x, y, 7, 7);
        ctx.fillStyle = C.groundInk;
        ctx.fillRect(x, y + 3, 7, 1);
        ctx.fillRect(x + 3, y, 1, 3);
        ctx.fillStyle = C.groundLight;
        ctx.fillRect(x, y, 3, 1);
      }
    } else if (age < EFFECT_S * 0.6) {
      const rise = reducedMotion ? 10 : Math.round(age * 90 - age * age * 120);
      const cx = bx + TILE / 2;
      const cy = by - 6 - rise;
      ctx.fillStyle = C.coinInk;
      ctx.fillRect(cx - 4, cy - 7, 8, 14);
      ctx.fillStyle = C.coin;
      ctx.fillRect(cx - 3, cy - 6, 6, 12);
      ctx.fillStyle = C.coinShine;
      ctx.fillRect(cx - 3, cy - 5, 1, 8);
    }
  }

  // Checkpoint and flag.
  if (level.checkpoint) {
    const bx = level.checkpoint.x * TILE + 7;
    const by = (level.checkpoint.y + 1) * TILE;
    ctx.fillStyle = C.pole;
    ctx.fillRect(bx, by - 28, 2, 28);
    ctx.fillStyle = s.checkpointReached ? C.coin : C.checkpoint;
    ctx.fillRect(bx + 2, by - 28, 8, 2);
    ctx.fillRect(bx + 2, by - 26, 6, 2);
    ctx.fillRect(bx + 2, by - 24, 4, 2);
    ctx.fillRect(bx + 2, by - 22, 2, 2);
  }
  const fx = level.flag.x * TILE + 7;
  const fy = (level.flag.y + 1) * TILE;
  const top = fy - 7 * TILE;
  ctx.fillStyle = C.hillInk;
  ctx.fillRect(fx - 4, fy - 8, 12, 8);
  ctx.fillStyle = C.pole;
  ctx.fillRect(fx, top, 3, 7 * TILE);
  ctx.fillStyle = C.poleBall;
  ctx.fillRect(fx - 1, top - 3, 5, 4);
  ctx.fillStyle = C.flag;
  for (let i = 0; i < 6; i++) ctx.fillRect(fx - 12 + i, top + 3 + i * 2, 12 - i * 2, 2);

  // Goomba-style mushrooms.
  for (const e of s.enemies) {
    if (!e.alive || e.x + e.w < camX - TILE || e.x > camX + VIEW_W + TILE) continue;
    const ex = Math.round(e.x);
    const ey = Math.round(e.y);
    const step = !reducedMotion && Math.floor(s.time * 6) % 2 === 0;
    ctx.fillStyle = C.goomba;
    ctx.fillRect(ex + 2, ey, e.w - 4, 2);
    ctx.fillRect(ex + 1, ey + 2, e.w - 2, 4);
    ctx.fillRect(ex, ey + 6, e.w, 2);
    ctx.fillStyle = C.goombaSkin;
    ctx.fillRect(ex + 3, ey + 8, e.w - 6, e.h - 10);
    ctx.fillStyle = C.goombaFoot;
    ctx.fillRect(ex + (step ? 0 : 1), ey + e.h - 2, 4, 2);
    ctx.fillRect(ex + e.w - 4 - (step ? 0 : 1), ey + e.h - 2, 4, 2);
    ctx.fillStyle = C.white;
    ctx.fillRect(ex + 2, ey + 4, 3, 3);
    ctx.fillRect(ex + e.w - 5, ey + 4, 3, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(ex + 3, ey + 5, 1, 2);
    ctx.fillRect(ex + e.w - 4, ey + 5, 1, 2);
    ctx.fillRect(ex + 2, ey + 3, 4, 1);
    ctx.fillRect(ex + e.w - 6, ey + 3, 4, 1);
  }

  // Player (blinks, or turns see-through with reduced motion, while invulnerable).
  const hidden = s.invulnerable > 0 && !reducedMotion && Math.floor(s.time * 12) % 2 === 0;
  if (!hidden) {
    ctx.globalAlpha = s.invulnerable > 0 && reducedMotion ? 0.5 : 1;
    const { x, y, w, h, facing, onGround, vx } = player;
    const pose = !onGround ? 2 : Math.abs(vx) > 5 && (reducedMotion || Math.floor(s.time * 10) % 2 === 0) ? 1 : 0;
    const dx = Math.round(x + w / 2 - SPRITE_W / 2);
    const dy = Math.round(y + h - SPRITE_H);
    if (sprite?.complete && sprite.naturalWidth > 0) {
      ctx.save();
      if (facing < 0) {
        ctx.translate(dx + SPRITE_W, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, pose * SPRITE_W, 0, SPRITE_W, SPRITE_H, 0, 0, SPRITE_W, SPRITE_H);
      } else {
        ctx.drawImage(sprite, pose * SPRITE_W, 0, SPRITE_W, SPRITE_H, dx, dy, SPRITE_W, SPRITE_H);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = C.checkpoint;
      ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawBrick(ctx: CanvasRenderingContext2D, px: number, py: number) {
  ctx.fillStyle = C.ground;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = C.groundInk;
  ctx.fillRect(px, py + 3, TILE, 1);
  ctx.fillRect(px, py + 7, TILE, 1);
  ctx.fillRect(px, py + 11, TILE, 1);
  ctx.fillRect(px, py + 15, TILE, 1);
  ctx.fillRect(px + 7, py, 1, 4);
  ctx.fillRect(px + 3, py + 4, 1, 4);
  ctx.fillRect(px + 11, py + 4, 1, 4);
  ctx.fillRect(px + 7, py + 8, 1, 4);
  ctx.fillRect(px + 3, py + 12, 1, 4);
  ctx.fillRect(px + 11, py + 12, 1, 4);
  ctx.fillStyle = C.groundLight;
  ctx.fillRect(px, py, 7, 1);
  ctx.fillRect(px + 8, py, 8, 1);
}

/** A golden "?" block; once emptied it turns into a plain dark block. `time` makes the "?" shimmer. */
function drawQuestion(ctx: CanvasRenderingContext2D, px: number, py: number, used: boolean, time: number) {
  ctx.fillStyle = C.groundInk;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = used ? "#8c5a2c" : Math.floor(time * 3) % 3 === 2 ? C.coinShine : C.coin;
  ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  ctx.fillStyle = used ? "#6b4020" : C.coinInk;
  // Rivets
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) ctx.fillRect(px + x, py + y, 1, 1);
  if (used) return;
  // A chunky pixel "?"
  ctx.fillRect(px + 5, py + 3, 6, 2);
  ctx.fillRect(px + 10, py + 4, 2, 4);
  ctx.fillRect(px + 7, py + 7, 4, 2);
  ctx.fillRect(px + 7, py + 8, 2, 2);
  ctx.fillRect(px + 7, py + 11, 2, 2);
  ctx.fillStyle = C.white;
  ctx.fillRect(px + 5, py + 3, 1, 1);
}

function drawGround(ctx: CanvasRenderingContext2D, px: number, py: number, topEdge: boolean) {
  ctx.fillStyle = C.ground;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = C.groundInk;
  ctx.fillRect(px + 15, py, 1, TILE);
  ctx.fillRect(px, py + 15, TILE, 1);
  ctx.fillRect(px + 4, py + 4, 2, 2);
  ctx.fillRect(px + 10, py + 9, 2, 2);
  ctx.fillStyle = C.groundLight;
  ctx.fillRect(px, py, 1, 15);
  ctx.fillRect(px + 1, py + 1, 3, 1);
  if (topEdge) {
    ctx.fillStyle = C.grass;
    ctx.fillRect(px, py, TILE, 3);
    ctx.fillStyle = C.hillLight;
    ctx.fillRect(px, py, TILE, 1);
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, offset: number, theme: (typeof THEMES)[Theme]) {
  const span = VIEW_W + 96;
  for (const [cx, cy] of [[30, 24], [150, 40], [250, 16], [330, 34]]) {
    const x = Math.round((((cx - offset) % span) + span) % span) - 48;
    ctx.fillStyle = theme.cloudShade;
    ctx.fillRect(x + 4, cy + 12, 40, 2);
    ctx.fillStyle = theme.cloud;
    ctx.fillRect(x + 8, cy + 2, 8, 4);
    ctx.fillRect(x + 4, cy + 6, 16, 4);
    ctx.fillRect(x + 16, cy, 12, 12);
    ctx.fillRect(x + 28, cy + 4, 16, 8);
    ctx.fillRect(x + 4, cy + 8, 40, 4);
  }
}

/** Blocky green hills that repeat every 240 pixels. */
function drawHills(ctx: CanvasRenderingContext2D, offset: number, theme: (typeof THEMES)[Theme]) {
  const period = 240;
  const base = VIEW_H - TILE * 2;
  const start = -(((offset % period) + period) % period);
  for (let x0 = start; x0 < VIEW_W; x0 += period) {
    for (const [dx, w, rows] of [[20, 88, 7], [150, 56, 4]]) {
      for (let i = 0; i < rows; i++) {
        const x = x0 + dx + (i + 1) * 4;
        const rw = w - (i + 1) * 8;
        const y = base - (i + 1) * 4;
        ctx.fillStyle = C.hillInk;
        ctx.fillRect(x - 1, y, rw + 2, 4);
        ctx.fillStyle = theme.hillDark;
        ctx.fillRect(x, y, rw, 4);
        if (i > 0) {
          ctx.fillStyle = theme.hillLight;
          ctx.fillRect(x + 2, y + 1, 2, 2);
        }
      }
    }
  }
}
