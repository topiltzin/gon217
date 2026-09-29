import { describe, expect, it } from "vitest";
import { createGame, flip, hideMismatch, isWon, shuffle } from "@/games/memory-match/logic";

// Deterministic RNG so decks are reproducible.
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const SYMBOLS = ["a", "b", "c"];

function indicesOf(state: ReturnType<typeof createGame>, symbol: string) {
  return state.cards.flatMap((c, i) => (c.symbol === symbol ? [i] : []));
}

describe("memory match", () => {
  it("shuffle keeps every item", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(items, seeded()).sort()).toEqual(items);
  });

  it("creates two face-down cards per symbol", () => {
    const state = createGame(SYMBOLS, seeded());
    expect(state.cards).toHaveLength(6);
    expect(state.cards.every((c) => c.state === "hidden")).toBe(true);
    for (const s of SYMBOLS) expect(indicesOf(state, s)).toHaveLength(2);
    expect(state.moves).toBe(0);
  });

  it("same seed gives the same deck", () => {
    expect(createGame(SYMBOLS, seeded(7)).cards).toEqual(createGame(SYMBOLS, seeded(7)).cards);
  });

  it("matching two cards keeps them open and counts one move", () => {
    let state = createGame(SYMBOLS, seeded());
    const [i, j] = indicesOf(state, "a");
    state = flip(state, i);
    expect(state.cards[i].state).toBe("flipped");
    expect(state.moves).toBe(0);
    state = flip(state, j);
    expect(state.cards[i].state).toBe("matched");
    expect(state.cards[j].state).toBe("matched");
    expect(state.flipped).toEqual([]);
    expect(state.moves).toBe(1);
  });

  it("a mismatch stays visible until hidden", () => {
    let state = createGame(SYMBOLS, seeded());
    const [a] = indicesOf(state, "a");
    const [b] = indicesOf(state, "b");
    state = flip(flip(state, a), b);
    expect(state.moves).toBe(1);
    expect(state.flipped).toEqual([a, b]);
    state = hideMismatch(state);
    expect(state.cards[a].state).toBe("hidden");
    expect(state.cards[b].state).toBe("hidden");
    expect(state.flipped).toEqual([]);
  });

  it("flipping a third card hides an open mismatch first", () => {
    let state = createGame(SYMBOLS, seeded());
    const [a] = indicesOf(state, "a");
    const [b] = indicesOf(state, "b");
    const [c] = indicesOf(state, "c");
    state = flip(flip(flip(state, a), b), c);
    expect(state.cards[a].state).toBe("hidden");
    expect(state.cards[b].state).toBe("hidden");
    expect(state.flipped).toEqual([c]);
  });

  it("ignores taps on open or matched cards", () => {
    let state = createGame(SYMBOLS, seeded());
    const [i, j] = indicesOf(state, "a");
    state = flip(state, i);
    expect(flip(state, i)).toBe(state);
    state = flip(state, j);
    expect(flip(state, i)).toBe(state);
  });

  it("is won when every pair is matched", () => {
    let state = createGame(SYMBOLS, seeded());
    for (const s of SYMBOLS) {
      expect(isWon(state)).toBe(false);
      const [i, j] = indicesOf(state, s);
      state = flip(flip(state, i), j);
    }
    expect(isWon(state)).toBe(true);
    expect(state.moves).toBe(3);
  });
});
