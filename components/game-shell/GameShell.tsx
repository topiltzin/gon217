"use client";

import { type ComponentType, useEffect, useEffectEvent, useRef, useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { Badge } from "@/components/Badge";
import { GameCover } from "@/components/GameCard";
import { usePlayer } from "@/components/player/PlayerProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { gameRegistry } from "@/games/registry";
import type { GameProps, GameResult } from "@/games/types";
import type { Game } from "@/lib/content";
import { readPad } from "@/games/gamepad";
import { gameScoring } from "@/games/scoring";
import { achievementsFor, unlockAchievements, useUnlockedAchievements, type AchievementId } from "@/lib/achievements";
import { setSoundOn, useSoundOn } from "@/lib/settings";
import { unlockSfx } from "@/lib/sfx";
import { recordScore } from "@/lib/storage";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { ScoreBoard } from "./ScoreBoard";
import { useBestScore } from "./useBestScore";

type Phase =
  | { name: "intro" }
  | { name: "playing" }
  | { name: "finished"; result: GameResult; isNewBest: boolean; fresh: AchievementId[] };

export function GameShell({ game }: { game: Game }) {
  const entry = gameRegistry[game.slug];
  const t = useT();
  const locale = useLocale();
  const { state: playerState, recordPlayerScore } = usePlayer();
  const [GameComponent, setGameComponent] = useState<ComponentType<GameProps> | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [round, setRound] = useState(0);
  const best = useBestScore(game.slug);
  const [paused, setPaused] = useState(false);
  const soundOn = useSoundOn();
  const unlocked = useUnlockedAchievements();
  const gameAchievements = achievementsFor(game.slug);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const canPause = !!entry.pausable && phase.name === "playing";
  // After a round with its own leaderboard (e.g. a board size), show that one.
  const scoreSlug = phase.name === "finished" ? (phase.result.scoreSlug ?? game.slug) : game.slug;
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
    unlockSfx();
    setPaused(false);
    setRound((r) => r + 1);
    setPhase({ name: "playing" });
  }

  function finish(result: GameResult) {
    let isNewBest = false;
    const slug = result.scoreSlug ?? game.slug;
    const scoring = gameScoring[slug] ?? entry.scoring;
    if (scoring && result.score !== undefined) {
      // The device best is always kept; a logged-in player's best also goes to the server.
      const deviceBest = recordScore(slug, result.score, scoring.direction);
      const loggedIn = playerState.status === "ready" && playerState.player !== null;
      isNewBest = loggedIn ? recordPlayerScore(slug, result.score) : deviceBest;
    }
    setPaused(false);
    setPhase({ name: "finished", result, isNewBest, fresh: unlockAchievements(game.slug, result) });
  }

  function resume() {
    setPaused(false);
    // Back to the game: its keys work while focus is on the page heading.
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  const togglePause = useEffectEvent(() => {
    if (!canPause) return;
    if (paused) resume();
    else setPaused(true);
  });

  // Esc or P toggles the pause menu; leaving the window pauses too.
  useEffect(() => {
    if (!canPause) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "p" && e.key !== "P") return;
      if (e.repeat) return;
      e.preventDefault();
      togglePause();
    };
    const onBlur = () => setPaused(true);
    const onVisibility = () => document.hidden && setPaused(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    // The Start button on a controller toggles too.
    let wasDown = false;
    const pad = setInterval(() => {
      const down = !!readPad(0)?.start;
      if (down && !wasDown) togglePause();
      wasDown = down;
    }, 100);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(pad);
    };
  }, [canPause]);

  useEffect(() => {
    if (paused) resumeRef.current?.focus();
  }, [paused]);

  // The first tap or key on the page allows sound effects to play.
  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href={`/${locale}`} variant="ghost" className="!px-4">
          <Icon name="arrow-left" />
          {t.shell.back}
        </ButtonLink>
        <div className="flex flex-wrap items-center gap-2">
          {entry.scoring && <ScoreBoard slug={scoreSlug} unit={t.units[entry.scoring.unit]} />}
          <button
            type="button"
            aria-pressed={soundOn}
            onClick={() => setSoundOn(!soundOn)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-card px-3 font-semibold hover:border-secondary/60"
          >
            <Icon name={soundOn ? "volume" : "volume-off"} className="size-5 text-sky" />
            <span className="sr-only sm:not-sr-only">{t.shell.sound}</span>
          </button>
          {canPause && (
            <button
              type="button"
              onClick={() => setPaused(true)}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-card px-3 font-semibold hover:border-secondary/60"
            >
              <Icon name="pause" className="size-5 text-sun" />
              <span className="sr-only sm:not-sr-only">{t.shell.pause}</span>
            </button>
          )}
        </div>
      </div>

      {phase.name === "intro" && (
        <section
          aria-labelledby="intro-heading"
          className="mx-auto max-w-3xl overflow-hidden rounded-(--radius-card) border border-white/10 bg-card shadow-2xl shadow-black/40"
        >
          <GameCover game={game} className="h-36 sm:h-52" />
          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
            <div>
              <div className="flex flex-wrap gap-2">
                {game.featured && <Badge kind="featured" locale={locale} />}
                {game.status === "new" && <Badge kind="new" locale={locale} />}
              </div>
              <h1
                id="intro-heading"
                ref={headingRef}
                tabIndex={-1}
                className="mt-3 text-4xl uppercase outline-none sm:text-5xl"
              >
                {game.title}
              </h1>
              <p className="mt-2 text-lg text-card-foreground">{game.description}</p>
              <h2 className="eyebrow mt-6 text-secondary">{t.shell.howToPlay}</h2>
              <p className="mt-2 text-lg leading-relaxed text-card-foreground">{game.instructions}</p>
              {gameAchievements.length > 0 && (
                <>
                  <h2 className="eyebrow mt-6 text-secondary">
                    {t.shell.achievements} ({gameAchievements.filter((a) => unlocked.has(a.id)).length}/{gameAchievements.length})
                  </h2>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {gameAchievements.map((a) => {
                      const done = unlocked.has(a.id);
                      return (
                        <li
                          key={a.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 ${done ? "border-sun/50 bg-sun/10" : "border-white/10 bg-background/40"}`}
                        >
                          <Icon name={done ? "trophy" : "lock"} className={`mt-0.5 size-5 shrink-0 ${done ? "text-sun" : "text-muted-foreground"}`} />
                          <span>
                            <span className="block font-semibold text-foreground">{t.achievements[a.id].title}</span>
                            <span className="block text-sm text-muted-foreground">
                              {t.achievements[a.id].desc} <span className="sr-only">({done ? t.shell.unlocked : t.shell.locked})</span>
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
            {entry.scoring && (
              <div className="flex flex-row items-center gap-4 self-start rounded-lg border border-white/10 bg-background/60 p-4 sm:flex-col sm:items-stretch sm:text-center">
                <Icon name="trophy" className="size-8 text-sun sm:mx-auto" />
                <div>
                  <p className="eyebrow text-muted-foreground">{t.shell.yourBest}</p>
                  {best === null ? (
                    <p className="font-display text-3xl text-muted-foreground">
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">{t.shell.noBest}</span>
                    </p>
                  ) : (
                    <p className="font-display text-3xl text-sun">
                      {best} <span className="text-base text-card-foreground">{t.units[entry.scoring.unit]}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-center border-t border-white/10 bg-background/40 p-5 sm:justify-end sm:px-8">
            <Button variant="accent" onClick={start} className="!min-h-16 w-full !px-10 !text-xl sm:w-auto">
              <Icon name="play" className="size-7" />
              {t.play}
            </Button>
          </div>
        </section>
      )}

      {phase.name === "playing" && (
        <section aria-labelledby="play-heading">
          <h1 id="play-heading" ref={headingRef} tabIndex={-1} className="sr-only">
            {t.shell.playing(game.title)}
          </h1>
          {GameComponent ? (
            <div className="relative">
              <div inert={paused}>
                <GameComponent key={round} onFinish={finish} paused={paused} />
              </div>
              {paused && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="pause-heading"
                  className="absolute inset-0 z-40 flex items-start justify-center rounded-(--radius-card) bg-background/80 p-6 pt-16 backdrop-blur-sm"
                >
                  <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-(--radius-card) border border-secondary/40 bg-card p-6 text-center shadow-2xl">
                    <Icon name="pause" className="size-10 text-sun" />
                    <h2 id="pause-heading" className="text-3xl uppercase">
                      {t.shell.paused}
                    </h2>
                    <p className="text-card-foreground">{t.shell.pausedHint}</p>
                    <Button ref={resumeRef} variant="accent" onClick={resume} className="w-full">
                      <Icon name="play" />
                      {t.shell.resume}
                    </Button>
                    <ButtonLink href={`/${locale}`} variant="ghost" className="w-full">
                      <Icon name="home" />
                      {t.shell.quit}
                    </ButtonLink>
                  </div>
                </div>
              )}
            </div>
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
            fresh={phase.fresh}
            onPlayAgain={start}
            headingRef={headingRef}
          />
        </>
      )}

      {phase.name !== "playing" && entry.scoring && (
        <Leaderboard slug={scoreSlug} unit={t.units[entry.scoring.unit]} />
      )}
    </div>
  );
}
