import {
  BoxGeometry,
  Color,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  PlaneGeometry,
  PointLight,
  Scene,
  type Texture,
} from "three";
import type { Surfaces } from "./art";
import { CollisionWorld } from "./collision";
import { TILE, WALL_HEIGHT, cellCenter, type DoorKind, type Level, type WallKind } from "./level";

export type HitKind = "wall" | "floor" | "door" | "prop" | "enemy";

const FOG_COLOR = 0x120a08;
const CRATE_SIZE = 2.4;
const LAMP_INTENSITY = 42;

export type Door = {
  kind: DoorKind;
  col: number;
  row: number;
  /** World-space centre. */
  x: number;
  z: number;
  mesh: Mesh;
  /** 0 closed … 1 open. */
  open: number;
  opening: boolean;
  /** Seconds the door stays open after the last trigger. */
  holdOpen: number;
};

/**
 * Shared, run-independent GPU resources: one geometry and one material per
 * surface kind. Built once per game and disposed with it.
 */
export class LevelAssets {
  readonly wallBox = new BoxGeometry(TILE, WALL_HEIGHT, TILE);
  readonly floorPlane = new PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2);
  readonly ceilingPlane = new PlaneGeometry(TILE, TILE).rotateX(Math.PI / 2);
  readonly doorSlab = new BoxGeometry(TILE, WALL_HEIGHT, 0.5);
  readonly secretBox = new BoxGeometry(TILE, WALL_HEIGHT, TILE);
  readonly crateBox = new BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE);
  readonly lampBox = new BoxGeometry(0.8, 0.2, 0.8);
  readonly materials: Record<string, MeshLambertMaterial | MeshBasicMaterial>;

  constructor(readonly surfaces: Surfaces) {
    const lambert = (map: Texture) => new MeshLambertMaterial({ map });
    this.materials = {
      brick: lambert(surfaces.brick),
      metal: lambert(surfaces.metal),
      stone: lambert(surfaces.stone),
      stripes: lambert(surfaces.stripes),
      cracked: lambert(surfaces.cracked),
      tiles: lambert(surfaces.tiles),
      grate: lambert(surfaces.grate),
      ceiling: lambert(surfaces.ceiling),
      door: lambert(surfaces.door),
      locked: lambert(surfaces.locked),
      crate: lambert(surfaces.crate),
      exit: new MeshBasicMaterial({ map: surfaces.exit }),
      lamp: new MeshBasicMaterial({ color: 0xffd28a }),
    };
  }

  dispose() {
    for (const g of [this.wallBox, this.floorPlane, this.ceilingPlane, this.doorSlab, this.secretBox, this.crateBox, this.lampBox])
      g.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    for (const t of Object.values(this.surfaces)) t.dispose();
  }
}

/**
 * The static level for one run: instanced walls/floors/ceilings (one draw call
 * per surface kind), doors, crates, lamps and the collision world.
 */
export class World {
  readonly scene = new Scene();
  readonly collision: CollisionWorld;
  readonly doors: Door[] = [];
  /** Objects the weapon raycaster may hit (enemies are added by the game). */
  readonly targets: Object3D[] = [];
  readonly lamps: PointLight[] = [];
  /** Per-cell brightness (0.3–1.1) used to shade sprites, which ignore scene lights. */
  readonly light: Float32Array;
  private readonly instanced: InstancedMesh[] = [];

  constructor(
    readonly level: Level,
    private readonly assets: LevelAssets,
  ) {
    this.collision = new CollisionWorld(level);
    this.scene.background = new Color(FOG_COLOR);
    this.scene.fog = new Fog(FOG_COLOR, 8, 44);
    this.scene.add(new HemisphereLight(0x9a7a68, 0x2a1a12, 1.9));

    const walls: Record<WallKind, [number, number][]> = { brick: [], metal: [], stone: [], stripes: [] };
    const floors: Record<"tiles" | "grate", [number, number][]> = { tiles: [], grate: [] };
    const ceiling: [number, number][] = [];

    level.cells.forEach((cell, i) => {
      const col = i % level.cols;
      const row = Math.floor(i / level.cols);
      if (cell.type === "wall") walls[cell.wall].push([col, row]);
      if (cell.type === "floor" || cell.type === "door") {
        const floorKind = cell.type === "floor" ? cell.floor : "grate";
        floors[floorKind].push([col, row]);
        ceiling.push([col, row]);
      }
      if (cell.type === "door") this.addDoor(cell.door, col, row);
    });

    for (const kind of Object.keys(walls) as WallKind[]) this.addInstances(assets.wallBox, kind, walls[kind], WALL_HEIGHT / 2, "wall");
    this.addInstances(assets.floorPlane, "tiles", floors.tiles, 0, "floor");
    this.addInstances(assets.floorPlane, "grate", floors.grate, 0, "floor");
    this.addInstances(assets.ceilingPlane, "ceiling", ceiling, WALL_HEIGHT, "floor");
    this.addInstances(assets.crateBox, "crate", level.crates.map((c) => [c.col, c.row]), CRATE_SIZE / 2, "prop");
    this.addInstances(assets.lampBox, "lamp", level.lamps.map((c) => [c.col, c.row]), WALL_HEIGHT - 0.1, null);

    for (const c of level.crates) {
      const { x, z } = cellCenter(c.col, c.row);
      const h = CRATE_SIZE / 2;
      this.collision.addProp(c.col, c.row, { minX: x - h, minZ: z - h, maxX: x + h, maxZ: z + h });
    }

    for (const lamp of level.lamps) {
      const { x, z } = cellCenter(lamp.col, lamp.row);
      const light = new PointLight(0xff9a5a, LAMP_INTENSITY, 24, 1.1);
      light.position.set(x, WALL_HEIGHT - 0.6, z);
      this.lamps.push(light);
      this.scene.add(light);
    }

    const exit = new Mesh(assets.floorPlane, assets.materials.exit);
    const e = cellCenter(level.exit.col, level.exit.row);
    exit.position.set(e.x, 0.02, e.z);
    this.scene.add(exit);

    this.light = new Float32Array(level.cols * level.rows);
    for (let i = 0; i < this.light.length; i++) {
      const { x, z } = cellCenter(i % level.cols, Math.floor(i / level.cols));
      let b = 0.32;
      for (const l of this.lamps) b += Math.max(0, 1 - Math.hypot(l.position.x - x, l.position.z - z) / 20) * 0.75;
      this.light[i] = Math.min(1.1, b);
    }
  }

  private addInstances(geometry: BoxGeometry | PlaneGeometry, material: string, cells: [number, number][], y: number, kind: HitKind | null) {
    if (!cells.length) return;
    const mesh = new InstancedMesh(geometry, this.assets.materials[material], cells.length);
    const m = new Matrix4();
    cells.forEach(([col, row], i) => {
      const { x, z } = cellCenter(col, row);
      mesh.setMatrixAt(i, m.makeTranslation(x, y, z));
    });
    mesh.computeBoundingSphere();
    mesh.userData.kind = kind;
    this.scene.add(mesh);
    this.instanced.push(mesh);
    if (kind) this.targets.push(mesh);
  }

  private addDoor(kind: DoorKind, col: number, row: number) {
    const { x, z } = cellCenter(col, row);
    const secret = kind === "secret";
    const mat = secret ? this.assets.materials.cracked : kind === "locked" ? this.assets.materials.locked : this.assets.materials.door;
    const mesh = new Mesh(secret ? this.assets.secretBox : this.assets.doorSlab, mat);
    mesh.position.set(x, WALL_HEIGHT / 2, z);
    // Slabs face along the passage: rotate when the open floor is east/west.
    const passageAlongX = this.collision.isCellBlocked(col, row - 1) && this.collision.isCellBlocked(col, row + 1);
    if (!secret && passageAlongX) mesh.rotation.y = Math.PI / 2;
    const door: Door = { kind, col, row, x, z, mesh, open: 0, opening: false, holdOpen: 0 };
    mesh.userData = { kind: "door", door };
    this.doors.push(door);
    this.scene.add(mesh);
    this.targets.push(mesh);
  }

  lightAt(x: number, z: number): number {
    const col = Math.floor(x / TILE);
    const row = Math.floor(z / TILE);
    if (col < 0 || row < 0 || col >= this.level.cols || row >= this.level.rows) return 0.3;
    return this.light[row * this.level.cols + col];
  }

  /** Door animation; solid until mostly open, and never closes on someone standing in it. */
  updateDoors(dt: number, occupied: (col: number, row: number) => boolean, onMove: (door: Door) => void) {
    for (const d of this.doors) {
      d.holdOpen = Math.max(0, d.holdOpen - dt);
      const want = d.kind === "secret" ? (d.opening ? 1 : 0) : d.holdOpen > 0 ? 1 : 0;
      if (want === 0 && d.open > 0 && occupied(d.col, d.row)) {
        d.holdOpen = 0.5;
        continue;
      }
      const before = d.open;
      d.open = Math.max(0, Math.min(1, d.open + (want ? 1 : -1) * dt * (d.kind === "secret" ? 0.6 : 1.6)));
      if (before !== d.open) {
        if ((before === 0 && want) || (before === 1 && !want)) onMove(d);
        const y = d.kind === "secret" ? WALL_HEIGHT / 2 - d.open * (WALL_HEIGHT - 0.05) : WALL_HEIGHT / 2 + d.open * (WALL_HEIGHT - 0.3);
        d.mesh.position.y = y;
        this.collision.setDoorSolid(d.col, d.row, d.open < 0.85);
      }
    }
  }

  /** Flickers a couple of lamps for atmosphere. */
  updateLamps(time: number) {
    this.lamps.forEach((l, i) => {
      if (i % 3 !== 1) return;
      l.intensity = LAMP_INTENSITY * (0.75 + 0.25 * Math.sin(time * 13 + i) * Math.sin(time * 5.3 + i * 2));
    });
  }

  dispose() {
    for (const mesh of this.instanced) mesh.dispose();
    this.scene.clear();
  }
}
