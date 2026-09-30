import type { EnemyKind } from "./level";

export type AiState = "IDLE" | "PATROL" | "ALERT" | "CHASE" | "ATTACK" | "DEAD";

export type EnemyDef = {
  kind: EnemyKind;
  health: number;
  speed: number;
  /** Distance at which it stops and attacks. */
  attackRange: number;
  sightRange: number;
  damage: [min: number, max: number];
  /** Wind-up before the hit lands or the fireball leaves. */
  windup: number;
  cooldown: number;
  ranged: boolean;
  /** Collision half-size. */
  radius: number;
  /** Sprite size in metres. */
  width: number;
  height: number;
  /** Height of the sprite's feet above the floor (floating enemies). */
  hover: number;
};

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  husk: {
    kind: "husk",
    health: 45,
    speed: 4.6,
    attackRange: 2.4,
    sightRange: 30,
    damage: [8, 14],
    windup: 0.35,
    cooldown: 1.0,
    ranged: false,
    radius: 0.6,
    width: 2.0,
    height: 2.8,
    hover: 0,
  },
  gloom: {
    kind: "gloom",
    health: 35,
    speed: 3.2,
    attackRange: 16,
    sightRange: 34,
    damage: [10, 16],
    windup: 0.5,
    cooldown: 2.0,
    ranged: true,
    radius: 0.7,
    width: 1.9,
    height: 1.9,
    hover: 0.9,
  },
};

/** How long a chaser keeps hunting after losing sight of the player. */
export const GIVE_UP_AFTER = 6;
/** Reaction time between spotting the player and chasing. */
export const ALERT_TIME = 0.45;

export type Perception = {
  health: number;
  canSeePlayer: boolean;
  /** Recently hurt, or heard a nearby shot. */
  provoked: boolean;
  distance: number;
  /** Seconds in the current state. */
  stateTime: number;
  /** Seconds since the player was last seen. */
  sinceSeen: number;
  cooldownReady: boolean;
  /** For PATROL: reached (or gave up on) the patrol point. For ATTACK: the swing finished. */
  done: boolean;
};

/**
 * The enemy brain: picks the next state from what the enemy perceives.
 * Movement and attacks happen in the caller; this only decides.
 */
export function nextAiState(state: AiState, def: EnemyDef, p: Perception): AiState {
  if (state === "DEAD" || p.health <= 0) return "DEAD";
  const inRange = p.canSeePlayer && p.distance <= def.attackRange;

  switch (state) {
    case "IDLE":
    case "PATROL":
      if (p.canSeePlayer || p.provoked) return "ALERT";
      if (state === "IDLE") return p.stateTime > 2 ? "PATROL" : "IDLE";
      return p.done ? "IDLE" : "PATROL";
    case "ALERT":
      return p.stateTime >= ALERT_TIME ? "CHASE" : "ALERT";
    case "CHASE":
      if (inRange && p.cooldownReady) return "ATTACK";
      if (!p.canSeePlayer && p.sinceSeen > GIVE_UP_AFTER) return "PATROL";
      return "CHASE";
    case "ATTACK":
      return p.done ? "CHASE" : "ATTACK";
  }
}
