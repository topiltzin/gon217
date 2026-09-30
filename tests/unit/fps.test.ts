import { describe, expect, it } from "vitest";
import { ENEMY_DEFS, nextAiState, type Perception } from "@/games/fps/ai";
import { CollisionWorld } from "@/games/fps/collision";
import { cellAt, cellCenter, parseLevel, TILE } from "@/games/fps/level";
import { Player } from "@/games/fps/player";
import {
  applyDamage,
  applyPickup,
  newArsenal,
  PLAYER,
  startReload,
  switchWeapon,
  tickArsenal,
  tryFire,
  WEAPONS,
  type Inventory,
} from "@/games/fps/rules";

const level = parseLevel();

describe("level", () => {
  it("has a start, an exit, enemies, pickups, a locked door and a secret", () => {
    expect(level.enemies.length).toBeGreaterThanOrEqual(10);
    expect(level.pickups.some((p) => p.kind === "shotgun")).toBe(true);
    expect(level.pickups.some((p) => p.kind === "key")).toBe(true);
    const doors = level.cells.filter((c) => c.type === "door").map((c) => c.type === "door" && c.door);
    expect(doors).toContain("locked");
    expect(doors).toContain("secret");
  });

  it("is sealed: every walkable cell is surrounded by walkable cells, walls or doors", () => {
    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.cols; col++) {
        if (cellAt(level, col, row).type !== "floor") continue;
        for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          expect(cellAt(level, col + dc, row + dr).type, `leak next to ${col},${row}`).not.toBe("void");
        }
      }
    }
  });

  it("the exit is reachable from the start through doors, and the key is reachable without it", () => {
    const reach = (throughLocked: boolean) => {
      const seen = new Set<string>();
      const queue = [level.start];
      while (queue.length) {
        const { col, row } = queue.pop()!;
        const k = `${col},${row}`;
        if (seen.has(k)) continue;
        const cell = cellAt(level, col, row);
        const open = cell.type === "floor" || (cell.type === "door" && (cell.door === "auto" || throughLocked));
        if (!open) continue;
        seen.add(k);
        for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) queue.push({ col: col + dc, row: row + dr });
      }
      return seen;
    };
    const key = level.pickups.find((p) => p.kind === "key")!;
    expect(reach(false).has(`${key.col},${key.row}`)).toBe(true);
    expect(reach(false).has(`${level.exit.col},${level.exit.row}`)).toBe(false);
    expect(reach(true).has(`${level.exit.col},${level.exit.row}`)).toBe(true);
  });

  it("rejects unknown tiles", () => {
    expect(() => parseLevel("#?#")).toThrow(/Unknown level tile/);
  });
});

describe("collision", () => {
  const world = new CollisionWorld(level);
  const start = cellCenter(level.start.col, level.start.row);

  it("stops the player at walls and lets them slide along", () => {
    const p = { ...start };
    world.move(p, PLAYER.radius, 0, -100); // straight into the north wall
    const wallFace = (level.start.row - 2) * TILE; // two rows up is the wall row (start room is 4 deep)
    expect(p.z).toBeGreaterThan(wallFace);
    expect(world.overlaps(p.x, p.z, PLAYER.radius)).toBe(false);
    const before = p.x;
    world.move(p, PLAYER.radius, 3, -1);
    expect(p.x).toBeGreaterThan(before);
  });

  it("does not tunnel through walls on huge frame steps", () => {
    const p = { ...start };
    for (let i = 0; i < 20; i++) world.move(p, PLAYER.radius, 37, 23);
    expect(world.overlaps(p.x, p.z, PLAYER.radius)).toBe(false);
    expect(Math.floor(p.x / TILE)).toBeLessThan(8);
  });

  it("closed doors block and open doors don't", () => {
    const door = { col: 4, row: 5 };
    expect(world.isCellBlocked(door.col, door.row)).toBe(true);
    world.setDoorSolid(door.col, door.row, false);
    expect(world.isCellBlocked(door.col, door.row)).toBe(false);
    world.setDoorSolid(door.col, door.row, true);
  });

  it("line of sight is blocked by walls but not open floor", () => {
    const a = cellCenter(2, 2);
    const b = cellCenter(6, 4);
    expect(world.lineOfSight(a.x, a.z, b.x, b.z)).toBe(true);
    const outside = cellCenter(20, 12); // combat room, behind walls and a closed door
    expect(world.lineOfSight(a.x, a.z, outside.x, outside.z)).toBe(false);
  });

  it("crates are solid", () => {
    const w = new CollisionWorld(level);
    const crate = level.crates[0];
    const c = cellCenter(crate.col, crate.row);
    w.addProp(crate.col, crate.row, { minX: c.x - 1, minZ: c.z - 1, maxX: c.x + 1, maxZ: c.z + 1 });
    expect(w.overlaps(c.x, c.z, 0.2)).toBe(true);
  });
});

describe("player", () => {
  const world = new CollisionWorld(level);

  it("moves the same distance at 30 and 144 fps", () => {
    const start = cellCenter(level.start.col, level.start.row);
    const run = (fps: number) => {
      const p = new Player(start.x, start.z, Math.PI / 2); // facing west, room to walk
      for (let i = 0; i < fps / 2; i++) p.update(1 / fps, { forward: 1, strafe: 0, sprint: false, jump: false }, world);
      return start.x - p.x;
    };
    expect(Math.abs(run(30) - run(144))).toBeLessThan(0.15);
  });

  it("jumps and lands back on the floor", () => {
    const start = cellCenter(level.start.col, level.start.row);
    const p = new Player(start.x, start.z);
    p.update(1 / 60, { forward: 0, strafe: 0, sprint: false, jump: true }, world);
    expect(p.onGround).toBe(false);
    for (let i = 0; i < 120; i++) p.update(1 / 60, { forward: 0, strafe: 0, sprint: false, jump: false }, world);
    expect(p.y).toBe(0);
    expect(p.onGround).toBe(true);
  });

  it("clamps looking up and down", () => {
    const p = new Player(0, 0);
    p.look(0, -100);
    expect(p.pitch).toBeLessThanOrEqual(1.35);
    p.look(0, 100);
    expect(p.pitch).toBeGreaterThanOrEqual(-1.35);
  });
});

describe("damage and pickups", () => {
  const inv = (): Inventory => ({ health: 100, armor: 0, arsenal: newArsenal(), hasKey: false });

  it("armor absorbs damage first", () => {
    const s = { health: 100, armor: 30 };
    applyDamage(s, 30);
    expect(s.armor).toBe(10);
    expect(s.health).toBe(90);
    const bare = { health: 50, armor: 0 };
    applyDamage(bare, 80);
    expect(bare.health).toBe(0);
  });

  it("health and armor cap at the maximum and are left behind when full", () => {
    const i = inv();
    expect(applyPickup(i, "health")).toBe(false);
    i.health = 90;
    expect(applyPickup(i, "health")).toBe(true);
    expect(i.health).toBe(PLAYER.maxHealth);
    expect(applyPickup(i, "armor")).toBe(true);
    expect(i.armor).toBe(25);
  });

  it("the shotgun pickup unlocks and equips the shotgun", () => {
    const i = inv();
    expect(switchWeapon(i.arsenal, "shotgun")).toBe(false);
    applyPickup(i, "shotgun");
    expect(i.arsenal.current).toBe("shotgun");
    expect(i.arsenal.ammo.shotgun.mag).toBe(WEAPONS.shotgun.magazine);
  });
});

describe("weapons", () => {
  it("respects the fire rate", () => {
    const a = newArsenal();
    expect(tryFire(a)).toBe("fired");
    expect(tryFire(a)).toBe("cooling");
    tickArsenal(a, WEAPONS.pistol.fireInterval);
    expect(tryFire(a)).toBe("fired");
  });

  it("reloads from reserve, automatically when empty", () => {
    const a = newArsenal();
    a.ammo.pistol.mag = 0;
    const reserve = a.ammo.pistol.reserve;
    expect(tryFire(a)).toBe("reload");
    tickArsenal(a, WEAPONS.pistol.reloadTime + 0.01);
    expect(a.ammo.pistol.mag).toBe(WEAPONS.pistol.magazine);
    expect(a.ammo.pistol.reserve).toBe(reserve - WEAPONS.pistol.magazine);
  });

  it("clicks empty with no ammo at all", () => {
    const a = newArsenal();
    a.ammo.pistol.mag = 0;
    a.ammo.pistol.reserve = 0;
    expect(startReload(a)).toBe(false);
    expect(tryFire(a)).toBe("empty");
  });
});

describe("enemy AI", () => {
  const def = ENEMY_DEFS.zombie;
  const p = (over: Partial<Perception>): Perception => ({
    health: 40,
    canSeePlayer: false,
    provoked: false,
    distance: 20,
    stateTime: 0,
    sinceSeen: 99,
    cooldownReady: true,
    done: false,
    ...over,
  });

  it("idles, then patrols", () => {
    expect(nextAiState("IDLE", def, p({ stateTime: 0.5 }))).toBe("IDLE");
    expect(nextAiState("IDLE", def, p({ stateTime: 3 }))).toBe("PATROL");
    expect(nextAiState("PATROL", def, p({ done: true }))).toBe("IDLE");
  });

  it("spots the player (or gets shot), reacts, then chases", () => {
    expect(nextAiState("PATROL", def, p({ canSeePlayer: true }))).toBe("ALERT");
    expect(nextAiState("IDLE", def, p({ provoked: true }))).toBe("ALERT");
    expect(nextAiState("ALERT", def, p({ stateTime: 1 }))).toBe("CHASE");
  });

  it("attacks only in range, in sight and off cooldown", () => {
    expect(nextAiState("CHASE", def, p({ canSeePlayer: true, distance: 2 }))).toBe("ATTACK");
    expect(nextAiState("CHASE", def, p({ canSeePlayer: false, distance: 2, sinceSeen: 1 }))).toBe("CHASE");
    expect(nextAiState("CHASE", def, p({ canSeePlayer: true, distance: 2, cooldownReady: false }))).toBe("CHASE");
    expect(nextAiState("ATTACK", def, p({ done: true }))).toBe("CHASE");
  });

  it("gives up after losing the player for a while, and stays dead", () => {
    expect(nextAiState("CHASE", def, p({ sinceSeen: 10 }))).toBe("PATROL");
    expect(nextAiState("CHASE", def, p({ health: 0 }))).toBe("DEAD");
    expect(nextAiState("DEAD", def, p({ canSeePlayer: true }))).toBe("DEAD");
  });
});
