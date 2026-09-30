import { TILE, type Level } from "./level";

export type AABB = { minX: number; minZ: number; maxX: number; maxZ: number };

const EPS = 0.001;

/**
 * Collision for the tile level. Everything solid lives in a uniform grid that
 * matches the tiles: wall and void cells, doors (which switch between solid and
 * open), and smaller prop boxes such as crates. A query only looks at the few
 * cells a box touches, so cost doesn't grow with level size.
 */
export class CollisionWorld {
  readonly cols: number;
  readonly rows: number;
  /** 1 = always solid, 0 = open floor. Doors are tracked separately. */
  private readonly solid: Uint8Array;
  private readonly doorSolid = new Map<number, boolean>();
  private readonly props = new Map<number, AABB[]>();

  constructor(level: Level) {
    this.cols = level.cols;
    this.rows = level.rows;
    this.solid = new Uint8Array(level.cols * level.rows);
    level.cells.forEach((cell, i) => {
      if (cell.type === "void" || cell.type === "wall") this.solid[i] = 1;
      else if (cell.type === "door") this.doorSolid.set(i, true);
    });
  }

  /** Adds a solid box inside one cell (crates, pillars). */
  addProp(col: number, row: number, box: AABB) {
    const i = row * this.cols + col;
    const list = this.props.get(i) ?? [];
    list.push(box);
    this.props.set(i, list);
  }

  setDoorSolid(col: number, row: number, solid: boolean) {
    this.doorSolid.set(row * this.cols + col, solid);
  }

  /** True for walls, void, the outside of the map and closed doors. */
  isCellBlocked(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true;
    const i = row * this.cols + col;
    return this.solid[i] === 1 || this.doorSolid.get(i) === true;
  }

  /** Does a square of half-size r centred at (x, z) overlap anything solid? */
  overlaps(x: number, z: number, r: number): boolean {
    return this.firstHit(x - r, z - r, x + r, z + r) !== null;
  }

  private readonly scratch: AABB = { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };

  /** The first solid box overlapping the given bounds, or null. Reuses one scratch object. */
  private firstHit(minX: number, minZ: number, maxX: number, maxZ: number): AABB | null {
    const c0 = Math.floor(minX / TILE);
    const c1 = Math.floor((maxX - EPS) / TILE);
    const r0 = Math.floor(minZ / TILE);
    const r1 = Math.floor((maxZ - EPS) / TILE);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (this.isCellBlocked(col, row)) {
          const s = this.scratch;
          s.minX = col * TILE;
          s.minZ = row * TILE;
          s.maxX = s.minX + TILE;
          s.maxZ = s.minZ + TILE;
          return s;
        }
        const props = this.props.get(row * this.cols + col);
        if (props) {
          for (const p of props) {
            if (maxX > p.minX && minX < p.maxX && maxZ > p.minZ && minZ < p.maxZ) return p;
          }
        }
      }
    }
    return null;
  }

  /**
   * Moves a square of half-size r by (dx, dz), resolving X then Z so it slides
   * along walls. Large moves are split into steps smaller than the box so fast
   * movers can't tunnel through thin geometry. Mutates and returns pos.
   */
  move<T extends { x: number; z: number }>(pos: T, r: number, dx: number, dz: number): T {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (r * 0.9)));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        const nx = pos.x + sx;
        const hit = this.firstHit(nx - r, pos.z - r, nx + r, pos.z + r);
        pos.x = hit ? (sx > 0 ? hit.minX - r - EPS : hit.maxX + r + EPS) : nx;
      }
      if (sz !== 0) {
        const nz = pos.z + sz;
        const hit = this.firstHit(pos.x - r, nz - r, pos.x + r, nz + r);
        pos.z = hit ? (sz > 0 ? hit.minZ - r - EPS : hit.maxZ + r + EPS) : nz;
      }
    }
    return pos;
  }

  /**
   * Grid line of sight (DDA): false if a wall or closed door lies between the
   * two points. Props are ignored because they are shorter than eye height.
   */
  lineOfSight(x0: number, z0: number, x1: number, z1: number): boolean {
    let col = Math.floor(x0 / TILE);
    let row = Math.floor(z0 / TILE);
    const endCol = Math.floor(x1 / TILE);
    const endRow = Math.floor(z1 / TILE);
    const dx = x1 - x0;
    const dz = z1 - z0;
    const stepC = dx > 0 ? 1 : -1;
    const stepR = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(TILE / dz) : Infinity;
    let tMaxX = dx !== 0 ? ((stepC > 0 ? (col + 1) * TILE : col * TILE) - x0) / dx : Infinity;
    let tMaxZ = dz !== 0 ? ((stepR > 0 ? (row + 1) * TILE : row * TILE) - z0) / dz : Infinity;
    for (let guard = 0; guard < 256; guard++) {
      if ((col === endCol && row === endRow) || Math.min(tMaxX, tMaxZ) > 1) return true;
      if (tMaxX < tMaxZ) {
        tMaxX += tDeltaX;
        col += stepC;
      } else {
        tMaxZ += tDeltaZ;
        row += stepR;
      }
      if (col === endCol && row === endRow) return true;
      if (this.isCellBlocked(col, row)) return false;
    }
    return false;
  }
}
