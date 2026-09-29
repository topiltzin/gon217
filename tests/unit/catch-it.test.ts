import { describe, expect, it } from "vitest";
import { CELLS, ROUND_MS, advance, catchTarget, lifetime, startRound } from "@/games/catch-it/logic";

const rng = (value: number) => () => value;

describe("catch it", () => {
  it("starts with no score and no star", () => {
    const s = startRound();
    expect(s).toMatchObject({ elapsed: 0, score: 0, misses: 0, target: null, finished: false });
  });

  it("spawns a star on a valid cell after the first delay", () => {
    let s = startRound();
    s = advance(s, 100, rng(0.5));
    expect(s.target).toBeNull();
    s = advance(s, 1000, rng(0.5));
    expect(s.target).not.toBeNull();
    expect(s.target).toBeGreaterThanOrEqual(0);
    expect(s.target).toBeLessThan(CELLS);
  });

  it("never spawns on the same cell twice in a row", () => {
    let s = advance(startRound(), 1000, rng(0));
    const first = s.target!;
    s = catchTarget(s, first);
    s = advance(s, 1000, rng(0));
    expect(s.target).not.toBe(first);
  });

  it("catching the star scores a point and clears it", () => {
    let s = advance(startRound(), 1000, rng(0.3));
    const target = s.target!;
    s = catchTarget(s, target);
    expect(s.score).toBe(1);
    expect(s.target).toBeNull();
  });

  it("tapping an empty cell does nothing", () => {
    let s = advance(startRound(), 1000, rng(0.3));
    const wrong = (s.target! + 1) % CELLS;
    expect(catchTarget(s, wrong)).toBe(s);
    s = catchTarget(s, s.target!);
    expect(catchTarget(s, 0)).toBe(s);
  });

  it("a star that times out counts as a miss", () => {
    let s = advance(startRound(), 1000, rng(0.3));
    s = advance(s, lifetime(s.elapsed) + 10, rng(0.3));
    expect(s.misses).toBe(1);
    expect(s.target).toBeNull();
  });

  it("stars get quicker but never too fast", () => {
    expect(lifetime(ROUND_MS)).toBeLessThan(lifetime(0));
    expect(lifetime(ROUND_MS)).toBeGreaterThanOrEqual(650);
  });

  it("ends after 30 seconds and ignores taps afterwards", () => {
    let s = startRound();
    for (let t = 0; t < ROUND_MS; t += 100) s = advance(s, 100, rng(0.4));
    expect(s.finished).toBe(true);
    expect(s.target).toBeNull();
    expect(catchTarget(s, 0)).toBe(s);
    expect(advance(s, 100, rng(0.4))).toBe(s);
  });
});
