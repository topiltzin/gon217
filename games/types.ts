import type { ComponentType } from "react";
import type { Scoring } from "./scoring";

export type GameResult = {
  /** Big, friendly outcome line, e.g. "You won!" */
  headline: string;
  detail?: string;
  /** Numeric score for best-score tracking; omit for games without one. */
  score?: number;
  /** Keep the score under another scoring slug (e.g. one leaderboard per board size). Must be in games/scoring.ts. */
  scoreSlug?: string;
  /** Facts about the round that achievements check (lib/achievements.ts). */
  stats?: Record<string, number | boolean>;
};

/** Every game component receives this. It calls onFinish once when a round ends. */
export type GameProps = {
  onFinish: (result: GameResult) => void;
  /** True while the shell's pause menu is open; real-time games freeze their clock. */
  paused: boolean;
};

export type GameEntry = {
  load: () => Promise<{ default: ComponentType<GameProps> }>;
  scoring?: Scoring;
  /** Real-time games get a pause menu (Esc, P, the Pause button, or losing focus). */
  pausable?: boolean;
};
