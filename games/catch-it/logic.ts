export type Rng = () => number;

export const ROUND_MS = 30_000;
export const CELLS = 9;
const FIRST_SPAWN_MS = 600;
const GAP_AFTER_CATCH_MS = 250;
const GAP_AFTER_MISS_MS = 300;

export type CatchState = {
  elapsed: number;
  score: number;
  misses: number;
  /** Cell holding the star, or null. */
  target: number | null;
  last: number | null;
  targetUntil: number;
  nextSpawn: number;
  finished: boolean;
};

export function startRound(): CatchState {
  return {
    elapsed: 0,
    score: 0,
    misses: 0,
    target: null,
    last: null,
    targetUntil: 0,
    nextSpawn: FIRST_SPAWN_MS,
    finished: false,
  };
}

/** How long a star stays up: 1.3 s at the start, down to 0.65 s at the end. */
export function lifetime(elapsed: number): number {
  const progress = Math.min(elapsed / ROUND_MS, 1);
  return Math.max(650, Math.round(1300 - progress * 650));
}

export function advance(state: CatchState, dt: number, rng: Rng): CatchState {
  if (state.finished) return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= ROUND_MS) return { ...state, elapsed: ROUND_MS, target: null, finished: true };

  let next = { ...state, elapsed };
  if (next.target !== null && elapsed >= next.targetUntil) {
    next = { ...next, target: null, misses: next.misses + 1, nextSpawn: elapsed + GAP_AFTER_MISS_MS };
  }
  if (next.target === null && elapsed >= next.nextSpawn) {
    const cells = Array.from({ length: CELLS }, (_, i) => i).filter((i) => i !== next.last);
    const target = cells[Math.min(Math.floor(rng() * cells.length), cells.length - 1)];
    next = { ...next, target, last: target, targetUntil: elapsed + lifetime(elapsed) };
  }
  return next;
}

export function catchTarget(state: CatchState, cell: number): CatchState {
  if (state.finished || state.target === null || cell !== state.target) return state;
  return {
    ...state,
    score: state.score + 1,
    target: null,
    nextSpawn: state.elapsed + GAP_AFTER_CATCH_MS,
  };
}
