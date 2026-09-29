"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import { CELLS, ROUND_MS, advance, catchTarget, startRound } from "./logic";

const TICK_MS = 100;
// If the tab was in the background, don't let the clock jump ahead.
const MAX_STEP_MS = 250;

export default function CatchIt({ onFinish }: GameProps) {
  const [state, setState] = useState(startRound);
  const boardRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, MAX_STEP_MS);
      last = now;
      const roll = Math.random();
      setState((s) => advance(s, dt, () => roll));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const reportScore = useEffectEvent(() => {
    onFinish({
      headline: state.score >= 15 ? t.catchIt.speedy : t.catchIt.timesUp,
      detail: t.catchIt.caught(state.score),
      score: state.score,
    });
  });

  useEffect(() => {
    if (state.finished) reportScore();
  }, [state.finished]);

  // Keyboard play: Enter or Space catches the current star, as long as focus
  // is on the board (or the page itself) rather than a link like "Back to games".
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const active = document.activeElement;
      const onBoard =
        !active || active === document.body || active.tagName === "H1" || boardRef.current?.contains(active);
      if (!onBoard) return;
      e.preventDefault();
      setState((s) => (s.target === null ? s : catchTarget(s, s.target)));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const secondsLeft = Math.ceil((ROUND_MS - state.elapsed) / 1000);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 flex justify-center gap-3 font-display text-xl font-semibold">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="clock" className="size-5 text-sky" />
          <span>
            {secondsLeft}
            <span className="sr-only"> {t.catchIt.secondsLeft}</span>
            <span aria-hidden="true">s</span>
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="star" className="size-5 text-sun" />
          <span>
            {state.score}
            <span className="sr-only"> {t.catchIt.starsCaught}</span>
          </span>
        </span>
      </div>
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full origin-left rounded-full bg-sky transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${1 - state.elapsed / ROUND_MS})` }}
        />
      </div>
      <div ref={boardRef} className="grid grid-cols-3 gap-3">
        {Array.from({ length: CELLS }, (_, i) => {
          const hasStar = state.target === i;
          return (
            <button
              key={i}
              type="button"
              aria-label={t.catchIt.spot(i + 1, hasStar)}
              // Pointer down feels instant on touch screens; click covers everything else.
              onPointerDown={(e) => {
                if (e.pointerType !== "mouse") setState((s) => catchTarget(s, i));
              }}
              onClick={() => setState((s) => catchTarget(s, i))}
              className="grid aspect-square cursor-pointer touch-manipulation place-items-center rounded-3xl bg-card shadow-inner shadow-black/40"
            >
              {hasStar && (
                <span key={state.targetUntil} className="grid size-4/5 animate-pop place-items-center rounded-full bg-sun text-on-sun">
                  <Icon name="star" className="size-3/5" strokeWidth={2.75} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-muted-foreground">
        {t.catchIt.keyboard} <kbd className="font-bold text-foreground">Enter</kbd> {t.catchIt.or}{" "}
        <kbd className="font-bold text-foreground">Space</kbd> {t.catchIt.toCatch}
      </p>
    </div>
  );
}
