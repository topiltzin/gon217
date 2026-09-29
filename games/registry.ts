import type { GameEntry } from "./types";

/**
 * slug → lazily loaded game. Each game is its own chunk, so opening one game
 * never downloads the others. To add a game, add one line here plus an entry
 * in content/games.json (see README).
 */
export const gameRegistry: Record<string, GameEntry> = {
  "memory-match": {
    load: () => import("./memory-match/MemoryMatch"),
    scoring: { direction: "lower", unit: "moves" },
  },
  "catch-it": {
    load: () => import("./catch-it/CatchIt"),
    scoring: { direction: "higher", unit: "stars" },
  },
  "tic-tac-toe": {
    load: () => import("./tic-tac-toe/TicTacToe"),
  },
  "super-jump": {
    load: () => import("./super-jump/SuperJump"),
    scoring: { direction: "higher", unit: "coins" },
  },
  "garden-guard": {
    load: () => import("./garden-guard/GardenGuard"),
    scoring: { direction: "higher", unit: "snails" },
  },
};
