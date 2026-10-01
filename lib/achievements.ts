import { useSyncExternalStore } from "react";
import type { GameResult } from "@/games/types";

/**
 * Achievements: little goals per game, unlocked from the `stats` a game
 * reports when a round ends. Saved only on this device (localStorage, every
 * access guarded), like best scores. Names and descriptions live in lib/i18n.ts.
 */

type Stats = NonNullable<GameResult["stats"]>;
const num = (s: Stats, k: string) => (typeof s[k] === "number" ? (s[k] as number) : 0);
const flag = (s: Stats, k: string) => s[k] === true;

export const ACHIEVEMENTS = [
  { id: "gonzgun-win", slug: "gonzgun", check: (s: Stats) => flag(s, "beatCpu") },
  { id: "gonzgun-hard", slug: "gonzgun", check: (s: Stats) => flag(s, "beatCpu") && num(s, "difficulty") >= 2 },
  { id: "gonzgun-flawless", slug: "gonzgun", check: (s: Stats) => flag(s, "won") && num(s, "kosTaken") === 0 },
  { id: "astro-wave3", slug: "astro-storm", check: (s: Stats) => num(s, "wave") >= 3 },
  { id: "astro-wave5", slug: "astro-storm", check: (s: Stats) => num(s, "wave") >= 5 },
  { id: "astro-1000", slug: "astro-storm", check: (s: Stats) => num(s, "score") >= 1000 },
  { id: "jump-level1", slug: "super-jump", check: (s: Stats) => num(s, "levels") >= 1 },
  { id: "jump-all", slug: "super-jump", check: (s: Stats) => flag(s, "allLevels") },
  { id: "jump-bricks", slug: "super-jump", check: (s: Stats) => num(s, "bricks") >= 15 },
  { id: "garden-saved", slug: "garden-guard", check: (s: Stats) => flag(s, "won") },
  { id: "garden-perfect", slug: "garden-guard", check: (s: Stats) => flag(s, "won") && num(s, "heartsLost") === 0 },
  { id: "catch-15", slug: "catch-it", check: (s: Stats) => num(s, "score") >= 15 },
  { id: "catch-25", slug: "catch-it", check: (s: Stats) => num(s, "score") >= 25 },
  { id: "memory-sharp", slug: "memory-match", check: (s: Stats) => num(s, "pairs") === 10 && num(s, "moves") <= 16 },
  { id: "memory-combo", slug: "memory-match", check: (s: Stats) => num(s, "bestCombo") >= 4 },
  { id: "memory-mega", slug: "memory-match", check: (s: Stats) => num(s, "pairs") >= 15 },
  { id: "ttt-win", slug: "tic-tac-toe", check: (s: Stats) => flag(s, "beatCpu") },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

const KEY = "gks:achievements";
const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return cache ?? "";
  }
}

/** The ids unlocked on this device. */
export function unlockedIds(raw = read()): Set<string> {
  return new Set(raw.split(",").filter(Boolean));
}

/** Checks a finished round and saves any newly met achievements. Returns the new ones. */
export function unlockAchievements(slug: string, result: GameResult): AchievementId[] {
  if (!result.stats) return [];
  const have = unlockedIds();
  const fresh = ACHIEVEMENTS.filter((a) => a.slug === slug && !have.has(a.id) && a.check(result.stats!)).map((a) => a.id);
  if (fresh.length === 0) return [];
  const next = [...have, ...fresh].join(",");
  cache = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Storage blocked: they still show for this visit.
  }
  listeners.forEach((l) => l());
  return fresh;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Unlocked ids as a comma list (stable for useSyncExternalStore); empty during server render. */
export function useUnlockedAchievements(): Set<string> {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return unlockedIds(raw);
}

export function achievementsFor(slug: string) {
  return ACHIEVEMENTS.filter((a) => a.slug === slug);
}
