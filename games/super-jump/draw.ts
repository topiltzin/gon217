import { drawCheckpoint, drawCoin, drawEnemy, drawFlag, drawItem, drawPlatform, drawSpikes } from "./art";
import type { Camera, Fx } from "./fx";
import { HERO_ACCENT, type Hero, drawHero } from "./heroes";
import { EFFECT_S, type JumpState, type Level, TILE, bossStatus } from "./logic";
import { type TileKind, VIEW_H, VIEW_W, drawAmbient, drawBackdrop, drawOverlay, drawSpeedLines, drawTiles, getPixelScale } from "./scenery";

export { VIEW_H, VIEW_W, clearSceneryCache, getPixelScale, setPixelScale } from "./scenery";

type Blocks = { bricks: Set<string>; questions: Map<string, "coin" | "cowl" | "heart"> };
const blockCache = new WeakMap<Level, Blocks>();

function blocksOf(level: Level): Blocks {
  let b = blockCache.get(level);
  if (!b) {
    b = {
      bricks: new Set(level.bricks.map((p) => `${p.x},${p.y}`)),
      questions: new Map(level.questions.map((q) => [`${q.x},${q.y}`, q.item])),
    };
    blockCache.set(level, b);
  }
  return b;
}

/** Rounds to the canvas pixel grid so tiles never show seams while the camera moves. */
const snap = (v: number) => Math.round(v * getPixelScale()) / getPixelScale();

export type DrawOptions = { camera: Camera; fx: Fx; reducedMotion: boolean; hero: Hero };

export { HEROES, HERO_ACCENT, type Hero, drawPortrait } from "./heroes";

/** Draws one frame of the game. The context must already be scaled by getPixelScale(). */
export function drawFrame(ctx: CanvasRenderingContext2D, s: JumpState, { camera, fx, reducedMotion, hero }: DrawOptions) {
  const { level } = s;
  const shakeX = reducedMotion ? 0 : Math.sin(s.time * 83) * camera.shake * 0.5;
  const shakeY = reducedMotion ? 0 : Math.cos(s.time * 71) * camera.shake * 0.5;
  const camX = snap(camera.x + shakeX);
  const camY = snap(camera.y + shakeY);

  drawBackdrop(ctx, level.theme, camX, camY, s.time, reducedMotion);

  ctx.save();
  ctx.translate(-camX, -camY);

  const x0 = Math.max(0, Math.floor(camX / TILE));
  const x1 = Math.min(level.width - 1, Math.ceil((camX + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(camY / TILE));
  const y1 = Math.min(level.height - 1, Math.ceil((camY + VIEW_H) / TILE));
  const { bricks, questions } = blocksOf(level);
  const used = new Set(s.usedBlocks);

  // A block hops up a little when bumped.
  const bumpOf = (tx: number, ty: number) => {
    if (reducedMotion) return 0;
    const e = s.effects.find((f) => f.kind !== "smash" && f.x === tx && f.y === ty);
    const age = e ? s.time - e.at : 1;
    return age < 0.16 ? -snap(Math.sin((age / 0.16) * Math.PI) * 4) : 0;
  };
  const blockAt = (key: string): TileKind | null => {
    if (bricks.has(key)) return "brick";
    const item = questions.get(key);
    if (!item) return null;
    return used.has(key) ? "used" : item === "coin" ? "question" : item;
  };
  drawTiles(ctx, level, x0, x1, y0, y1, s.time, reducedMotion, blockAt, bumpOf);

  for (const sp of level.spikes) if (sp.x >= x0 - 1 && sp.x <= x1 + 1) drawSpikes(ctx, sp.x, sp.y);
  if (level.checkpoint) drawCheckpoint(ctx, level.checkpoint.x, level.checkpoint.y, s.checkpointReached, s.time, reducedMotion);
  drawFlag(ctx, level.flag.x, level.flag.y, s.time, bossStatus(s) !== null, reducedMotion);
  for (const pl of s.platforms) if (pl.px + pl.w > camX - TILE && pl.px < camX + VIEW_W + TILE) drawPlatform(ctx, pl, s.time, reducedMotion);

  for (const c of s.coins) {
    if (c.taken || c.x < x0 - 1 || c.x > x1 + 1) continue;
    drawCoin(ctx, c.x * TILE + TILE / 2, c.y * TILE + TILE / 2, s.time, c.x * 0.5, reducedMotion);
  }
  for (const it of s.items) {
    if (it.taken || it.x < x0 - 1 || it.x > x1 + 1) continue;
    drawItem(ctx, it.kind, it.x * TILE + TILE / 2, it.y * TILE + TILE / 2, s.time, reducedMotion);
  }

  for (const e of s.enemies) {
    if (!e.alive || e.x + e.w < camX - TILE * 2 || e.x > camX + VIEW_W + TILE * 2) continue;
    drawEnemy(ctx, s, e, reducedMotion);
  }

  // Items and coins popping out of bumped blocks.
  for (const e of s.effects) {
    if (e.kind === "smash") continue;
    const age = s.time - e.at;
    if (age > EFFECT_S * 0.7) continue;
    const rise = reducedMotion ? 14 : Math.round(age * 80 - age * age * 110);
    const cx = e.x * TILE + TILE / 2;
    const cy = e.y * TILE - 6 - rise;
    ctx.globalAlpha = Math.min(1, (EFFECT_S * 0.7 - age) * 5);
    if (e.kind === "coin") drawCoin(ctx, cx, cy, s.time * 3, 0, reducedMotion);
    else if (e.item === "cowl" || e.item === "heart") drawItem(ctx, e.item, cx, cy, s.time, reducedMotion);
    ctx.globalAlpha = 1;
  }

  // Deku (blinks, or turns see-through with reduced motion, while invulnerable).
  const hidden = s.invulnerable > 0 && !reducedMotion && Math.floor(s.time * 12) % 2 === 0;
  if (!hidden) {
    ctx.globalAlpha = s.invulnerable > 0 && reducedMotion ? 0.5 : 1;
    drawHero(ctx, s, reducedMotion, hero);
    ctx.globalAlpha = 1;
  }

  fx.draw(ctx);
  ctx.restore();

  drawAmbient(ctx, level.theme, camX, camY, s.time, reducedMotion);
  if (s.player.cowl > 0 && !reducedMotion) drawSpeedLines(ctx, s.time, HERO_ACCENT[hero].light, Math.min(1, s.player.cowl / 1.2) * 0.55);
  drawOverlay(ctx, level.theme, s.time, reducedMotion);
}
