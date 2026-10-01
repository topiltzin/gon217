// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementsFor, unlockAchievements, unlockedIds } from "@/lib/achievements";
import { getDictionary } from "@/lib/i18n";
import { gameRegistry } from "@/games/registry";

describe("achievements", () => {
  beforeEach(() => window.localStorage.clear());

  it("every achievement belongs to a real game and has words in both languages", () => {
    for (const a of ACHIEVEMENTS) {
      expect(gameRegistry[a.slug], a.id).toBeDefined();
      for (const lang of ["en", "es"] as const) expect(getDictionary(lang).achievements[a.id].title).toBeTruthy();
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("unlocks from a round's stats, once, and only for that game", () => {
    const result = { headline: "", stats: { score: 26 } };
    expect(unlockAchievements("catch-it", result).sort()).toEqual(["catch-15", "catch-25"]);
    expect(unlockAchievements("catch-it", result)).toEqual([]);
    expect(unlockAchievements("astro-storm", { headline: "", stats: { score: 26 } })).toEqual([]);
    expect(unlockedIds()).toEqual(new Set(["catch-15", "catch-25"]));
  });

  it("checks the harder goals", () => {
    expect(unlockAchievements("gonzgun", { headline: "", stats: { beatCpu: true, won: true, kosTaken: 0, difficulty: 2 } }).sort()).toEqual([
      "gonzgun-flawless",
      "gonzgun-hard",
      "gonzgun-win",
    ]);
    expect(unlockAchievements("memory-match", { headline: "", stats: { pairs: 10, moves: 17, bestCombo: 3 } })).toEqual([]);
    expect(unlockAchievements("memory-match", { headline: "", stats: { pairs: 10, moves: 16, bestCombo: 4 } }).sort()).toEqual([
      "memory-combo",
      "memory-sharp",
    ]);
  });

  it("rounds without stats unlock nothing", () => {
    expect(unlockAchievements("catch-it", { headline: "" })).toEqual([]);
    expect(achievementsFor("tic-tac-toe").map((a) => a.id)).toEqual(["ttt-win"]);
  });
});
