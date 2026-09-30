import type { ReactNode } from "react";
import styles from "./fps.module.css";

// Fixed ember positions so server and client render the same markup.
const EMBERS = [
  [6, 7, 0],
  [14, 9, 2.5],
  [23, 6, 1.2],
  [31, 11, 4],
  [42, 8, 0.6],
  [55, 10, 3.1],
  [63, 7, 1.8],
  [71, 12, 5],
  [80, 9, 2.2],
  [88, 6, 0.3],
  [95, 11, 3.6],
];

/** The title-screen look shared by the menu, instructions and credits: dark foundry glow, scrolling grid, embers, scanlines. */
export function RetroFrame({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.screen} relative isolate overflow-hidden`} style={{ minHeight: "calc(100svh - 5rem)" }}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.grid} />
        {EMBERS.map(([left, duration, delay]) => (
          <span
            key={left}
            className={styles.ember}
            style={{ left: `${left}%`, animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
          />
        ))}
        <div className={styles.scanlines} />
      </div>
      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-4 py-12 text-center">
        {children}
      </div>
    </div>
  );
}
