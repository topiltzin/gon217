export type Rng = () => number;

export type Card = { symbol: string; state: "hidden" | "flipped" | "matched" };

export type MemoryState = {
  cards: Card[];
  /** Indices of face-up, unmatched cards (0–2). */
  flipped: number[];
  moves: number;
};

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createGame(symbols: string[], rng: Rng): MemoryState {
  const cards = shuffle([...symbols, ...symbols], rng).map((symbol) => ({ symbol, state: "hidden" as const }));
  return { cards, flipped: [], moves: 0 };
}

/** Turns an open mismatched pair face down again. */
export function hideMismatch(state: MemoryState): MemoryState {
  if (state.flipped.length < 2) return state;
  const cards = state.cards.map((c, i) => (state.flipped.includes(i) ? { ...c, state: "hidden" as const } : c));
  return { ...state, cards, flipped: [] };
}

export function flip(state: MemoryState, index: number): MemoryState {
  if (state.cards[index]?.state !== "hidden") return state;
  // Tapping a new card while a mismatch is showing hides the mismatch straight away.
  const base = hideMismatch(state);
  const cards = base.cards.map((c, i) => (i === index ? { ...c, state: "flipped" as const } : c));
  const flipped = [...base.flipped, index];

  if (flipped.length < 2) return { ...base, cards, flipped };

  const [a, b] = flipped;
  const moves = base.moves + 1;
  if (cards[a].symbol === cards[b].symbol) {
    cards[a] = { ...cards[a], state: "matched" };
    cards[b] = { ...cards[b], state: "matched" };
    return { cards, flipped: [], moves };
  }
  return { cards, flipped, moves };
}

export function isWon(state: MemoryState): boolean {
  return state.cards.every((c) => c.state === "matched");
}
