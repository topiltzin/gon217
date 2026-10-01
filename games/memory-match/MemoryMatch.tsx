"use client";

import { type ComponentProps, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { tileClass } from "@/components/colors";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import type { CardColor } from "@/lib/icon-names";
import { playSfx } from "@/lib/sfx";
import { createGame, flip, hideMismatch, isWon, type MemoryState } from "./logic";

type SymbolName =
  | "star"
  | "rocket"
  | "zap"
  | "puzzle"
  | "palette"
  | "brain"
  | "heart"
  | "crown"
  | "sun"
  | "snail"
  | "flower"
  | "coins"
  | "flag"
  | "sprout"
  | "trophy";

// Up to 15 pairs. Colours repeat, but every symbol has its own shape (never colour alone).
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
  flower: { icon: "flower", color: "secondary" },
  coins: { icon: "coins", color: "sun" },
  flag: { icon: "flag", color: "primary" },
  sprout: { icon: "sprout", color: "mint" },
  trophy: { icon: "trophy", color: "sky" },
};

/** Board sizes. Each keeps its own leaderboard; 20 cards uses the plain slug. */
const SIZES = [
  { pairs: 6, scoreSlug: "memory-match-12", cols: "grid-cols-4" },
  { pairs: 10, scoreSlug: "memory-match", cols: "grid-cols-4 sm:grid-cols-5" },
  { pairs: 15, scoreSlug: "memory-match-30", cols: "grid-cols-5 sm:grid-cols-6" },
] as const;

const MISMATCH_MS = 900;
const WIN_DELAY_MS = 700;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function MemoryMatch({ onFinish }: GameProps) {
  const t = useT();
  const m = t.memory;
  const [size, setSize] = useState(1);
  const [state, setState] = useState<MemoryState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [started, setStarted] = useState(false);
  const startedAt = useRef(0);
  const [seconds, setSeconds] = useState(0);
  const won = state !== null && isWon(state);

  useEffect(() => {
    if (state?.flipped.length !== 2) return;
    const timer = setTimeout(() => setState((s) => (s ? hideMismatch(s) : s)), MISMATCH_MS);
    return () => clearTimeout(timer);
  }, [state?.flipped]);

  // The clock runs from the first flip until the last pair.
  useEffect(() => {
    if (!started || won) return;
    startedAt.current = performance.now();
    const id = setInterval(() => setSeconds(Math.floor((performance.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [started, won]);

  const reportWin = useEffectEvent(() => {
    if (!state) return;
    const { pairs, scoreSlug } = SIZES[size];
    onFinish({
      headline: m.won,
      detail: `${m.took(state.moves)} ${m.timeAndCombo(clock(seconds), bestCombo)}`,
      score: state.moves,
      scoreSlug,
      stats: { pairs, moves: state.moves, bestCombo, seconds },
    });
  });

  useEffect(() => {
    if (!won) return;
    playSfx("win");
    const timer = setTimeout(reportWin, WIN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won]);

  function begin() {
    const names = (Object.keys(SYMBOLS) as SymbolName[]).slice(0, SIZES[size].pairs);
    setState(createGame(names, Math.random));
  }

  function handleFlip(index: number) {
    if (!state) return;
    const next = flip(state, index);
    if (next === state) return;
    if (!started) setStarted(true);
    if (next.moves > state.moves) {
      // A match clears the face-up list; a mismatch leaves both cards showing.
      const matched = next.flipped.length === 0;
      if (matched) {
        const c = combo + 1;
        setCombo(c);
        setBestCombo((b) => Math.max(b, c));
        setAnnouncement(c >= 2 ? `${m.match} ${m.combo(c)}` : m.match);
        playSfx(c >= 2 ? "combo" : "match");
      } else {
        setCombo(0);
        setAnnouncement(m.noMatch);
        playSfx("miss");
      }
    } else playSfx("flip");
    setState(next);
  }

  if (!state) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 rounded-(--radius-card) border border-white/10 bg-card p-6 sm:p-8">
        <fieldset>
          <legend className="mb-3 font-display text-2xl uppercase">{m.chooseSize}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {SIZES.map((option, i) => (
              <button
                key={option.pairs}
                type="button"
                aria-pressed={size === i}
                onClick={() => setSize(i)}
                className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-transparent bg-muted p-3 transition-colors duration-(--duration-fast) hover:border-white/20 aria-pressed:border-sun aria-pressed:bg-[#32324a]"
              >
                <span className="font-display text-2xl">{option.pairs * 2}</span>
                <span className="text-sm text-muted-foreground">{m.sizes[i]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Button variant="accent" onClick={begin} className="!min-h-14 self-center !px-10">
          <Icon name="play" className="size-6" />
          {m.start}
        </Button>
      </div>
    );
  }

  const pairs = state.cards.length / 2;
  const matchedPairs = state.cards.filter((c) => c.state === "matched").length / 2;
  const chip = "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-card px-4 py-2";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap justify-center gap-2 font-display text-lg sm:gap-3 sm:text-xl">
        <span className={chip}>{m.moves(state.moves)}</span>
        <span className={chip}>{m.pairs(matchedPairs, pairs)}</span>
        <span className={chip}>
          <Icon name="clock" className="size-5 text-sky" />
          <span className="sr-only">{m.time}: </span>
          {clock(seconds)}
        </span>
        {combo >= 2 && (
          <span key={combo} className={`${chip} animate-pop border-sun/60 text-sun`}>
            <Icon name="zap" className="size-5" />
            {m.combo(combo)}
          </span>
        )}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ul className={`grid gap-2 sm:gap-3 ${SIZES[size].cols}`}>
        {state.cards.map((card, i) => {
          const name = card.symbol as SymbolName;
          const symbol = SYMBOLS[name];
          const faceUp = card.state !== "hidden";
          const label =
            card.state === "hidden" ? m.cardDown(i + 1) : m.card(i + 1, m.symbols[name], card.state === "matched");
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleFlip(i)}
                aria-label={label}
                aria-disabled={card.state === "matched"}
                className={`grid aspect-square w-full cursor-pointer place-items-center rounded-lg transition-transform duration-(--duration-fast) active:scale-95 ${
                  faceUp
                    ? `${tileClass[symbol.color]} ${card.state === "matched" ? "cursor-default opacity-80 ring-2 ring-mint ring-offset-2 ring-offset-background" : ""}`
                    : "border border-secondary/40 bg-linear-to-br from-primary to-[#3b1a7a] text-on-primary shadow-[0_0_14px_rgb(124_58_237/0.35)] hover:-translate-y-0.5 hover:border-secondary"
                }`}
              >
                <span key={card.state === "hidden" ? "back" : "face"} className="animate-pop">
                  <Icon name={faceUp ? symbol.icon : "sparkles"} className="size-8 sm:size-10" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
