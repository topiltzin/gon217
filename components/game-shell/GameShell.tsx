"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { usePlayer } from "@/components/player/PlayerProvider";
import { tileClass } from "@/components/colors";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { gameRegistry } from "@/games/registry";
import type { GameProps, GameResult } from "@/games/types";
import type { Game } from "@/lib/content";
import { recordScore } from "@/lib/storage";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { ScoreBoard } from "./ScoreBoard";

type Phase =
  | { name: "intro" }
  | { name: "playing" }
  | { name: "finished"; result: GameResult; isNewBest: boolean };

export function GameShell({ game }: { game: Game }) {
  const entry = gameRegistry[game.slug];
  const t = useT();
  const locale = useLocale();
  const { state: playerState, recordPlayerScore } = usePlayer();
  const [GameComponent, setGameComponent] = useState<ComponentType<GameProps> | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [round, setRound] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const phaseKey = `${phase.name}-${round}`;
  const lastPhaseKey = useRef(phaseKey);

  // Load the game's code while the player reads the instructions, so Play starts instantly.
  useEffect(() => {
    let active = true;
    entry.load().then((mod) => {
      if (active) setGameComponent(() => mod.default);
    });
    return () => {
      active = false;
    };
  }, [entry]);

  // Move focus to the new panel's heading so keyboard and screen reader users follow along.
  useEffect(() => {
    if (lastPhaseKey.current === phaseKey) return;
    lastPhaseKey.current = phaseKey;
    headingRef.current?.focus();
  }, [phaseKey]);

  function start() {
    setRound((r) => r + 1);
    setPhase({ name: "playing" });
  }

  function finish(result: GameResult) {
    let isNewBest = false;
    if (entry.scoring && result.score !== undefined) {
      // The device best is always kept; a logged-in player's best also goes to the server.
      const deviceBest = recordScore(game.slug, result.score, entry.scoring.direction);
      const loggedIn = playerState.status === "ready" && playerState.player !== null;
      isNewBest = loggedIn ? recordPlayerScore(game.slug, result.score) : deviceBest;
    }
    setPhase({ name: "finished", result, isNewBest });
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href={`/${locale}`} variant="ghost" className="!px-4">
          <Icon name="arrow-left" />
          {t.shell.back}
        </ButtonLink>
        {entry.scoring && <ScoreBoard slug={game.slug} unit={t.units[entry.scoring.unit]} />}
      </div>

      {phase.name === "intro" && (
        <section
          aria-labelledby="intro-heading"
          className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-(--radius-card) bg-card p-8 text-center"
        >
          <span className={`grid size-24 place-items-center rounded-3xl ${tileClass[game.color]}`}>
            <Icon name={game.icon} className="size-14" />
          </span>
          <h1
            id="intro-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-4xl font-bold outline-none sm:text-5xl"
          >
            {game.title}
          </h1>
          <p className="text-xl text-card-foreground">{game.instructions}</p>
          <Button variant="accent" onClick={start} className="!min-h-16 !px-10 !text-2xl">
            <Icon name="play" className="size-7" />
            {t.play}
          </Button>
        </section>
      )}

      {phase.name === "playing" && (
        <section aria-labelledby="play-heading">
          <h1 id="play-heading" ref={headingRef} tabIndex={-1} className="sr-only">
            {t.shell.playing(game.title)}
          </h1>
          {GameComponent ? (
            <GameComponent key={round} onFinish={finish} />
          ) : (
            <p className="py-20 text-center font-display text-2xl">{t.shell.loading}</p>
          )}
        </section>
      )}

      {phase.name === "finished" && (
        <>
          <h1 className="sr-only">{t.shell.over(game.title)}</h1>
          <ResultPanel
            result={phase.result}
            isNewBest={phase.isNewBest}
            onPlayAgain={start}
            headingRef={headingRef}
          />
        </>
      )}

      {phase.name !== "playing" && entry.scoring && (
        <Leaderboard slug={game.slug} unit={t.units[entry.scoring.unit]} />
      )}
    </div>
  );
}
