import type { ComponentType } from "react";
import type { Scoring } from "./scoring";

export type GameResult = {
  /** Big, friendly outcome line, e.g. "You won!" */
  headline: string;
  detail?: string;
  /** Numeric score for best-score tracking; omit for games without one. */
  score?: number;
};

/** Every game component receives this. It calls onFinish once when a round ends. */
export type GameProps = {
  onFinish: (result: GameResult) => void;
};

export type GameEntry = {
  load: () => Promise<{ default: ComponentType<GameProps> }>;
  scoring?: Scoring;
};
