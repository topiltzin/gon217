import { gameScoring } from "./scoring";
import type { GameEntry } from "./types";

/**
 * slug → lazily loaded game. Each game is its own chunk, so opening one game
 * never downloads the others. To add a game, add one line here plus an entry
 * in content/games.json (see README).
 */
export const gameRegistry: Record<string, GameEntry> = {
  "memory-match": {
    load: () => import("./memory-match/MemoryMatch"),
    scoring: gameScoring["memory-match"],
  },
  "catch-it": {
    load: () => import("./catch-it/CatchIt"),
    scoring: gameScoring["catch-it"],
  },
  "tic-tac-toe": {
    load: () => import("./tic-tac-toe/TicTacToe"),
  },
  "super-jump": {
    load: () => import("./super-jump/SuperJump"),
    scoring: gameScoring["super-jump"],
  },
  "garden-guard": {
    load: () => import("./garden-guard/GardenGuard"),
    scoring: gameScoring["garden-guard"],
  },
  gonzgun: {
    load: () => import("./gonzgun/Gonzgun"),
    scoring: gameScoring.gonzgun,
  },
  "astro-storm": {
    load: () => import("./astro-storm/AstroStorm"),
    scoring: gameScoring["astro-storm"],
  },
};
