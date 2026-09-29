import { type JumpState, TILE } from "./logic";

export const VIEW_W = 20 * TILE; // 320 logical pixels
export const VIEW_H = 12 * TILE; // 192 logical pixels

const C = {
  skyTop: "#1e1b4b",
  skyBottom: "#4c1d95",
  hill: "#312e81",
  hillFar: "#27235e",
  ground: "#065f46",
  grass: "#34d399",
  brick: "#f43f5e",
  brickLine: "#9f1239",
  coin: "#facc15",
  coinShine: "#fef08a",
  slime: "#38bdf8",
  slimeDark: "#0369a1",
  player: "#a78bfa",
  cap: "#7c3aed",
  white: "#ffffff",
  ink: "#0f0f23",
  pole: "#e2e8f0",
  flag: "#facc15",
  checkpoint: "#34d399",
};

/** Draws one frame. `reducedMotion` turns off parallax, bobbing, and blinking. */
export function drawFrame(ctx: CanvasRenderingContext2D, s: JumpState, reducedMotion: boolean) {
  const { level, player } = s;
  const worldW = level.width * TILE;
  const camX = Math.round(Math.min(Math.max(player.x + player.w / 2 - VIEW_W / 2, 0), worldW - VIEW_W));

  // Sky and hills.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(1, C.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawHills(ctx, reducedMotion ? 0 : camX * 0.2, 150, 70, C.hillFar);
  drawHills(ctx, reducedMotion ? 0 : camX * 0.45, 165, 50, C.hill);

  ctx.save();
  ctx.translate(-camX, 0);

  const x0 = Math.max(0, Math.floor(camX / TILE));
  const x1 = Math.min(level.width - 1, Math.ceil((camX + VIEW_W) / TILE));
  const brickSet = new Set(level.bricks.map((b) => `${b.x},${b.y}`));

  // Tiles.
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!level.solid[ty][tx]) continue;
      const px = tx * TILE;
      const py = ty * TILE;
      if (brickSet.has(`${tx},${ty}`)) {
        ctx.fillStyle = C.brick;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = C.brickLine;
        ctx.fillRect(px, py + 7, TILE, 2);
        ctx.fillRect(px + 7, py, 2, 7);
        ctx.fillRect(px + 2, py + 9, 2, 7);
        ctx.fillRect(px + 12, py + 9, 2, 7);
      } else {
        ctx.fillStyle = C.ground;
        ctx.fillRect(px, py, TILE, TILE);
        if (ty === 0 || !level.solid[ty - 1][tx]) {
          ctx.fillStyle = C.grass;
          ctx.fillRect(px, py, TILE, 4);
        }
      }
    }
  }

  // Coins.
  const bob = reducedMotion ? 0 : Math.sin(s.time * 5) * 1.5;
  for (const c of s.coins) {
    if (c.taken || c.x < x0 - 1 || c.x > x1 + 1) continue;
    const cx = c.x * TILE + TILE / 2;
    const cy = c.y * TILE + TILE / 2 + bob;
    ctx.fillStyle = C.coin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.coinShine;
    ctx.fillRect(cx - 1, cy - 3, 2, 6);
  }

  // Checkpoint and flag.
  if (level.checkpoint) {
    const bx = level.checkpoint.x * TILE + 7;
    const by = (level.checkpoint.y + 1) * TILE;
    ctx.fillStyle = C.pole;
    ctx.fillRect(bx, by - 28, 2, 28);
    ctx.fillStyle = s.checkpointReached ? C.flag : C.checkpoint;
    ctx.beginPath();
    ctx.moveTo(bx + 2, by - 28);
    ctx.lineTo(bx + 12, by - 24);
    ctx.lineTo(bx + 2, by - 20);
    ctx.fill();
  }
  const fx = level.flag.x * TILE + 7;
  const fy = (level.flag.y + 1) * TILE;
  ctx.fillStyle = C.pole;
  ctx.fillRect(fx, fy - 7 * TILE, 3, 7 * TILE);
  ctx.beginPath();
  ctx.arc(fx + 1.5, fy - 7 * TILE, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.flag;
  ctx.beginPath();
  ctx.moveTo(fx + 3, fy - 7 * TILE + 3);
  ctx.lineTo(fx + 22, fy - 7 * TILE + 10);
  ctx.lineTo(fx + 3, fy - 7 * TILE + 17);
  ctx.fill();

  // Slimes.
  for (const e of s.enemies) {
    if (!e.alive || e.x + e.w < camX - TILE || e.x > camX + VIEW_W + TILE) continue;
    ctx.fillStyle = C.slime;
    ctx.beginPath();
    ctx.ellipse(e.x + e.w / 2, e.y + e.h * 0.6, e.w / 2, e.h * 0.6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(e.x, e.y + e.h * 0.6, e.w, e.h * 0.4);
    ctx.fillStyle = C.slimeDark;
    ctx.fillRect(e.x, e.y + e.h - 2, e.w, 2);
    const look = e.vx < 0 ? -1 : 1;
    ctx.fillStyle = C.white;
    ctx.fillRect(e.x + 3 + look, e.y + 4, 3, 3);
    ctx.fillRect(e.x + 8 + look, e.y + 4, 3, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(e.x + 4 + look, e.y + 5, 1, 2);
    ctx.fillRect(e.x + 9 + look, e.y + 5, 1, 2);
  }

  // Player (blinks, or turns see-through with reduced motion, while invulnerable).
  const hidden = s.invulnerable > 0 && !reducedMotion && Math.floor(s.time * 12) % 2 === 0;
  if (!hidden) {
    ctx.globalAlpha = s.invulnerable > 0 && reducedMotion ? 0.5 : 1;
    const { x, y, w, h, facing } = player;
    ctx.fillStyle = C.player;
    ctx.fillRect(x + 1, y + 4, w - 2, h - 6);
    ctx.fillStyle = C.cap;
    ctx.fillRect(x, y + 1, w, 4);
    ctx.fillRect(facing > 0 ? x + w - 2 : x - 2, y + 3, 4, 2);
    ctx.fillStyle = C.white;
    ctx.fillRect(facing > 0 ? x + 7 : x + 2, y + 6, 3, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(facing > 0 ? x + 9 : x + 2, y + 7, 1, 2);
    ctx.fillStyle = C.cap;
    ctx.fillRect(x + 1, y + h - 2, 4, 2);
    ctx.fillRect(x + w - 5, y + h - 2, 4, 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawHills(ctx: CanvasRenderingContext2D, offset: number, baseY: number, height: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 8) {
    const wx = x + offset;
    ctx.lineTo(x, baseY - Math.abs(Math.sin(wx / 60)) * height * 0.6 - Math.sin(wx / 23) * 4);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.fill();
}
