import { describe, expect, it } from "vitest";
import { gameScoring, isBetter } from "@/games/scoring";
import { gameRegistry } from "@/games/registry";
import { ADJECTIVES, ANIMALS, formatNickname, parseCredentials } from "@/lib/player";
import { credentialsSchema, scoreSubmissionSchema } from "@/lib/player-schemas";
import { hashPin, verifyPin } from "@/lib/server/auth";

describe("player names", () => {
  it("formats in each language's word order", () => {
    const nick = { adjective: "brave", animal: "tiger", number: 7 } as const;
    expect(formatNickname(nick, "en")).toBe("Brave Tiger 7");
    expect(formatNickname(nick, "es")).toBe("Tigre Valiente 7");
  });

  it("only accepts preset words, a number 1–99 and a 4-digit PIN", () => {
    const ok = { adjective: "happy", animal: "owl", number: 12, pin: "0420" };
    expect(credentialsSchema.safeParse(ok).success).toBe(true);
    expect(credentialsSchema.safeParse({ ...ok, adjective: "Sam" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ ...ok, number: 100 }).success).toBe(false);
    expect(credentialsSchema.safeParse({ ...ok, number: 0 }).success).toBe(false);
    expect(credentialsSchema.safeParse({ ...ok, pin: "12a4" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ ...ok, pin: "12345" }).success).toBe(false);
  });

  it("has words for every language", () => {
    for (const word of [...Object.values(ADJECTIVES), ...Object.values(ANIMALS)]) {
      expect(word.en).toBeTruthy();
      expect(word.es).toBeTruthy();
    }
  });
});

describe("PIN hashing", () => {
  it("verifies the right PIN and rejects others", async () => {
    const stored = await hashPin("1234");
    expect(stored).not.toContain("1234");
    expect(await verifyPin("1234", stored)).toBe(true);
    expect(await verifyPin("1235", stored)).toBe(false);
    expect(await verifyPin("1234", "garbage")).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPin("1234")).not.toBe(await hashPin("1234"));
  });
});

describe("scores", () => {
  it("ranks by each game's direction", () => {
    expect(isBetter(5, null, "higher")).toBe(true);
    expect(isBetter(5, 4, "higher")).toBe(true);
    expect(isBetter(5, 5, "higher")).toBe(false);
    expect(isBetter(10, 12, "lower")).toBe(true);
    expect(isBetter(12, 10, "lower")).toBe(false);
  });

  it("rejects impossible submissions", () => {
    expect(scoreSubmissionSchema.safeParse({ slug: "catch-it", score: 12 }).success).toBe(true);
    expect(scoreSubmissionSchema.safeParse({ slug: "catch-it", score: -1 }).success).toBe(false);
    expect(scoreSubmissionSchema.safeParse({ slug: "catch-it", score: 1.5 }).success).toBe(false);
    expect(scoreSubmissionSchema.safeParse({ slug: "catch-it", score: 1e9 }).success).toBe(false);
  });

  it("the registry and the server agree on which games are scored", () => {
    const scored = Object.entries(gameRegistry).filter(([, e]) => e.scoring).map(([slug]) => slug);
    // Extra scoring slugs are per-variant leaderboards of a scored game, like "memory-match-30".
    const base = (slug: string) => scored.find((g) => slug === g || slug.startsWith(`${g}-`));
    expect(Object.keys(gameScoring).every((slug) => base(slug))).toBe(true);
    for (const slug of scored) expect(gameScoring[slug]).toBeDefined();
  });
});

describe("parseCredentials (client form check)", () => {
  it("accepts what the server schema accepts and rejects the rest", () => {
    const ok = { adjective: "brave", animal: "tiger", number: 7, pin: "1234" };
    expect(parseCredentials(ok)).toEqual(ok);
    expect(credentialsSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, adjective: "evil" },
      { ...ok, animal: "toString" },
      { ...ok, number: 0 },
      { ...ok, number: 100 },
      { ...ok, number: 1.5 },
      { ...ok, pin: "12a4" },
      { ...ok, pin: "12345" },
    ]) {
      expect(parseCredentials(bad)).toBeNull();
      expect(credentialsSchema.safeParse(bad).success).toBe(false);
    }
  });
});
