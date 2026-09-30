import type { PickupKind } from "./level";

/* ---------- Player ---------- */

export const PLAYER = {
  maxHealth: 100,
  maxArmor: 100,
  walkSpeed: 7,
  sprintSpeed: 11,
  jumpVelocity: 6.5,
  gravity: 20,
  /** Half-width of the player's collision box (m). */
  radius: 0.5,
  eyeHeight: 1.7,
} as const;

export type PlayerStats = { health: number; armor: number };

/**
 * Armor soaks up two thirds of each hit until it runs out; health takes the rest.
 * Returns the health actually lost.
 */
export function applyDamage(stats: PlayerStats, amount: number): number {
  const absorbed = Math.min(stats.armor, Math.round(amount * (2 / 3)));
  stats.armor -= absorbed;
  const lost = Math.min(stats.health, amount - absorbed);
  stats.health -= lost;
  return lost;
}

/* ---------- Weapons ---------- */

export type WeaponId = "pistol" | "shotgun";

export type WeaponDef = {
  id: WeaponId;
  damage: number;
  pellets: number;
  /** Max pellet deviation in radians. */
  spread: number;
  range: number;
  /** Seconds between shots. */
  fireInterval: number;
  magazine: number;
  maxReserve: number;
  reloadTime: number;
  recoil: number;
  shake: number;
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol",
    damage: 15,
    pellets: 1,
    spread: 0.006,
    range: 70,
    fireInterval: 0.3,
    magazine: 12,
    maxReserve: 150,
    reloadTime: 1.0,
    recoil: 0.02,
    shake: 0.08,
  },
  shotgun: {
    id: "shotgun",
    damage: 10,
    pellets: 8,
    spread: 0.075,
    range: 32,
    fireInterval: 0.85,
    magazine: 6,
    maxReserve: 48,
    reloadTime: 1.4,
    recoil: 0.06,
    shake: 0.25,
  },
};

export type Ammo = { mag: number; reserve: number; owned: boolean };

export type Arsenal = {
  current: WeaponId;
  ammo: Record<WeaponId, Ammo>;
  /** Seconds until the current weapon may fire again. */
  cooldown: number;
  /** Seconds left on the current reload, 0 when not reloading. */
  reloading: number;
};

export function newArsenal(): Arsenal {
  return {
    current: "pistol",
    ammo: {
      pistol: { mag: WEAPONS.pistol.magazine, reserve: 36, owned: true },
      shotgun: { mag: 0, reserve: 0, owned: false },
    },
    cooldown: 0,
    reloading: 0,
  };
}

/** Advances timers; finishes a reload by moving ammo from reserve to magazine. */
export function tickArsenal(a: Arsenal, dt: number) {
  a.cooldown = Math.max(0, a.cooldown - dt);
  if (a.reloading > 0) {
    a.reloading -= dt;
    if (a.reloading <= 0) {
      a.reloading = 0;
      const ammo = a.ammo[a.current];
      const moved = Math.min(WEAPONS[a.current].magazine - ammo.mag, ammo.reserve);
      ammo.mag += moved;
      ammo.reserve -= moved;
    }
  }
}

export function canReload(a: Arsenal): boolean {
  const ammo = a.ammo[a.current];
  return a.reloading === 0 && ammo.reserve > 0 && ammo.mag < WEAPONS[a.current].magazine;
}

export function startReload(a: Arsenal): boolean {
  if (!canReload(a)) return false;
  a.reloading = WEAPONS[a.current].reloadTime;
  return true;
}

export type FireResult = "fired" | "cooling" | "empty" | "reload";

/** Tries to fire. An empty magazine starts a reload instead when there is reserve ammo. */
export function tryFire(a: Arsenal): FireResult {
  if (a.cooldown > 0 || a.reloading > 0) return "cooling";
  const ammo = a.ammo[a.current];
  if (ammo.mag === 0) {
    if (startReload(a)) return "reload";
    a.cooldown = 0.3;
    return "empty";
  }
  ammo.mag -= 1;
  a.cooldown = WEAPONS[a.current].fireInterval;
  return "fired";
}

export function switchWeapon(a: Arsenal, id: WeaponId): boolean {
  if (a.current === id || !a.ammo[id].owned) return false;
  a.current = id;
  a.reloading = 0;
  a.cooldown = 0.35;
  return true;
}

/* ---------- Pickups ---------- */

export type Inventory = PlayerStats & { arsenal: Arsenal; hasKey: boolean };

export const PICKUP_AMOUNTS = { health: 25, armor: 25, bullets: 20, shells: 8, shotgunShells: 8 } as const;

/**
 * Applies a pickup. Returns false (and leaves the pickup on the floor) when the
 * player can't use it, e.g. health at full.
 */
export function applyPickup(inv: Inventory, kind: PickupKind): boolean {
  const { ammo } = inv.arsenal;
  switch (kind) {
    case "health":
      if (inv.health >= PLAYER.maxHealth) return false;
      inv.health = Math.min(PLAYER.maxHealth, inv.health + PICKUP_AMOUNTS.health);
      return true;
    case "armor":
      if (inv.armor >= PLAYER.maxArmor) return false;
      inv.armor = Math.min(PLAYER.maxArmor, inv.armor + PICKUP_AMOUNTS.armor);
      return true;
    case "bullets":
      return addReserve(ammo.pistol, WEAPONS.pistol.maxReserve, PICKUP_AMOUNTS.bullets);
    case "shells":
      return addReserve(ammo.shotgun, WEAPONS.shotgun.maxReserve, PICKUP_AMOUNTS.shells);
    case "shotgun": {
      const wasOwned = ammo.shotgun.owned;
      ammo.shotgun.owned = true;
      if (!wasOwned) {
        ammo.shotgun.mag = WEAPONS.shotgun.magazine;
        inv.arsenal.current = "shotgun";
        inv.arsenal.reloading = 0;
        return true;
      }
      return addReserve(ammo.shotgun, WEAPONS.shotgun.maxReserve, PICKUP_AMOUNTS.shotgunShells);
    }
    case "key":
      inv.hasKey = true;
      return true;
  }
}

function addReserve(ammo: Ammo, max: number, amount: number): boolean {
  if (ammo.reserve >= max) return false;
  ammo.reserve = Math.min(max, ammo.reserve + amount);
  return true;
}
