import type { ScoreUnit } from "@/lib/i18n";
import type { ScoreDirection } from "@/lib/storage";

export type Scoring = { direction: ScoreDirection; unit: ScoreUnit };

/**
 * How each scored game ranks results. Kept apart from registry.ts (which imports
 * the game components) so the score API can validate slugs without loading UI code.
 */
export const gameScoring: Record<string, Scoring> = {
  "memory-match": { direction: "lower", unit: "moves" },
  "catch-it": { direction: "higher", unit: "stars" },
  "super-jump": { direction: "higher", unit: "coins" },
  "garden-guard": { direction: "higher", unit: "snails" },
  "astro-storm": { direction: "higher", unit: "points" },
};

export function isBetter(
  score: number,
  current: number | null | undefined,
  direction: ScoreDirection,
): boolean {
  if (current === null || current === undefined) return true;
  return direction === "higher" ? score > current : score < current;
}
