"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import { playSfx } from "@/lib/sfx";
import { type Board, type Player, computerMove, emptyBoard, getOutcome, play } from "./logic";

type Mode = "computer" | "friends";

const COMPUTER_DELAY_MS = 500;
const RESULT_DELAY_MS = 900;

function Mark({ player }: { player: Player }) {
  return player === "X" ? (
    <Icon name="x" className="size-3/5 text-accent" strokeWidth={3.5} />
  ) : (
    <Icon name="circle" className="size-1/2 text-sky" strokeWidth={3.5} />
  );
}

export default function TicTacToe({ onFinish }: GameProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [board, setBoard] = useState<Board>(emptyBoard);
  const firstCell = useRef<HTMLButtonElement>(null);
  const t = useT();

  const outcome = getOutcome(board);
  const turn: Player = board.filter(Boolean).length % 2 === 0 ? "X" : "O";
  const computerTurn = mode === "computer" && turn === "O" && !outcome;
  const marks = board.filter(Boolean).length;

  // A click for every mark placed.
  useEffect(() => {
    if (marks > 0) playSfx("place");
  }, [marks]);

  useEffect(() => {
    if (mode) firstCell.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!computerTurn) return;
    const timer = setTimeout(
      () => setBoard((b) => play(b, computerMove(b, "O", Math.random), "O")),
      COMPUTER_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [computerTurn]);

  // A string, so the effect below only re-runs when the outcome actually changes.
  const outcomeKey = outcome ? (outcome.kind === "draw" ? "draw" : outcome.player) : null;

  const reportOutcome = useEffectEvent(() => {
    if (!outcome) return;
    const result =
      outcome.kind === "draw"
        ? { headline: t.ttt.draw, detail: t.ttt.drawDetail }
        : mode === "computer"
          ? outcome.player === "X"
            ? { headline: t.ttt.youWon, detail: t.ttt.youWonDetail }
            : { headline: t.ttt.computerWon, detail: t.ttt.computerWonDetail }
          : { headline: t.ttt.wins(outcome.player), detail: t.ttt.winsDetail };
    const beatCpu = mode === "computer" && outcome.kind === "win" && outcome.player === "X";
    const lostToCpu = mode === "computer" && outcome.kind === "win" && outcome.player === "O";
    playSfx(lostToCpu ? "lose" : "win");
    onFinish({ ...result, stats: { beatCpu } });
  });

  useEffect(() => {
    if (!outcomeKey) return;
    const timer = setTimeout(reportOutcome, RESULT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [outcomeKey]);

  if (!mode) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-(--radius-card) border border-white/10 bg-card p-8 text-center">
        <h2 className="text-3xl uppercase">{t.ttt.who}</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => setMode("computer")}>{t.ttt.computer}</Button>
          <Button variant="ghost" onClick={() => setMode("friends")}>
            {t.ttt.friends}
          </Button>
        </div>
      </div>
    );
  }

  const status = outcome
    ? outcome.kind === "draw"
      ? t.ttt.draw
      : t.ttt.wins(outcome.player)
    : mode === "computer"
      ? computerTurn
        ? t.ttt.thinking
        : t.ttt.yourTurn
      : t.ttt.turnOf(turn);

  const winLine = outcome?.kind === "win" ? outcome.line : [];

  return (
    <div className="mx-auto max-w-sm">
      <p role="status" className="mb-4 text-center font-display text-2xl uppercase">
        {status}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {board.map((cell, i) => {
          const row = Math.floor(i / 3) + 1;
          const col = (i % 3) + 1;
          const disabled = cell !== null || !!outcome || computerTurn;
          return (
            <button
              key={i}
              ref={i === 0 ? firstCell : undefined}
              type="button"
              aria-label={t.ttt.cell(row, col, cell)}
              aria-disabled={disabled}
              onClick={() => !disabled && setBoard((b) => play(b, i, turn))}
              className={`grid aspect-square place-items-center rounded-xl border transition-colors duration-(--duration-base) ${
                winLine.includes(i) ? "border-sun bg-sun shadow-[0_0_24px_rgb(250_204_21/0.45)]" : "border-white/10 bg-card"
              } ${disabled ? "cursor-default" : "cursor-pointer hover:border-secondary/60 hover:bg-muted"}`}
            >
              {cell && (
                <span className="grid size-full animate-pop place-items-center">
                  <Mark player={cell} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
