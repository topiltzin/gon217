"use client";

import { type ComponentProps, useEffect, useEffectEvent, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { tileClass } from "@/components/colors";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import type { CardColor } from "@/lib/icon-names";
import { createGame, flip, hideMismatch, isWon } from "./logic";

type SymbolName = "star" | "rocket" | "zap" | "puzzle" | "palette" | "brain" | "heart" | "crown" | "sun" | "snail";

// 10 pairs, 20 cards. Colours repeat, but every symbol has its own shape (never colour alone).
const SYMBOLS: Record<SymbolName, { icon: ComponentProps<typeof Icon>["name"]; color: CardColor }> = {
  star: { icon: "star", color: "sun" },
  rocket: { icon: "rocket", color: "sky" },
  zap: { icon: "zap", color: "accent" },
  puzzle: { icon: "puzzle", color: "mint" },
  palette: { icon: "palette", color: "secondary" },
  brain: { icon: "brain", color: "primary" },
  heart: { icon: "heart", color: "accent" },
  crown: { icon: "crown", color: "sun" },
  sun: { icon: "sun", color: "sky" },
  snail: { icon: "snail", color: "mint" },
};

const MISMATCH_MS = 900;
const WIN_DELAY_MS = 700;

export default function MemoryMatch({ onFinish }: GameProps) {
  const [state, setState] = useState(() => createGame(Object.keys(SYMBOLS), Math.random));
  const [announcement, setAnnouncement] = useState("");
  const t = useT();
  const pairs = state.cards.length / 2;
  const matchedPairs = state.cards.filter((c) => c.state === "matched").length / 2;
  const won = isWon(state);

  useEffect(() => {
    if (state.flipped.length !== 2) return;
    const timer = setTimeout(() => setState(hideMismatch), MISMATCH_MS);
    return () => clearTimeout(timer);
  }, [state.flipped]);

  const reportWin = useEffectEvent(() =>
    onFinish({ headline: t.memory.won, detail: t.memory.took(state.moves), score: state.moves }),
  );

  useEffect(() => {
    if (!won) return;
    const timer = setTimeout(reportWin, WIN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won]);

  function handleFlip(index: number) {
    const next = flip(state, index);
    if (next === state) return;
    if (next.moves > state.moves) {
      // A match clears the face-up list; a mismatch leaves both cards showing.
      setAnnouncement(next.flipped.length === 0 ? t.memory.match : t.memory.noMatch);
    }
    setState(next);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-center gap-3 font-display text-xl font-semibold">
        <span className="rounded-2xl bg-card px-4 py-2">{t.memory.moves(state.moves)}</span>
        <span className="rounded-2xl bg-card px-4 py-2">{t.memory.pairs(matchedPairs, pairs)}</span>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3">
        {state.cards.map((card, i) => {
          const name = card.symbol as SymbolName;
          const symbol = SYMBOLS[name];
          const faceUp = card.state !== "hidden";
          const label =
            card.state === "hidden"
              ? t.memory.cardDown(i + 1)
              : t.memory.card(i + 1, t.memory.symbols[name], card.state === "matched");
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleFlip(i)}
                aria-label={label}
                aria-disabled={card.state === "matched"}
                className={`grid aspect-square w-full cursor-pointer place-items-center rounded-2xl transition-transform duration-(--duration-fast) active:scale-95 ${
                  faceUp
                    ? `${tileClass[symbol.color]} ${card.state === "matched" ? "cursor-default opacity-80 ring-4 ring-mint" : ""}`
                    : "bg-primary text-on-primary shadow-[0_5px_0_0_var(--color-border)] hover:-translate-y-0.5"
                }`}
              >
                <span key={card.state === "hidden" ? "back" : "face"} className="animate-pop">
                  <Icon name={faceUp ? symbol.icon : "sparkles"} className="size-9 sm:size-11" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
