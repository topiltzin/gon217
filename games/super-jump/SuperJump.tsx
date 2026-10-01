"use client";

import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import { playSfx } from "@/lib/sfx";
import { SPRITE_URL, VIEW_H, VIEW_W, drawFrame } from "./draw";
import { type Input, type JumpState, START_LIVES, allLevels, createGame, step } from "./logic";

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const RESULT_DELAY_MS = 900;
const PIXEL_SCALE = 3;
/** How long the "Level 2!" card shows between levels. */
const LEVEL_BREAK_S = 1.6;

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowUp: "jump",
  w: "jump",
  W: "jump",
  " ": "jump",
};

type Hud = { coins: number; lives: number; status: JumpState["status"]; level: number; levels: number; bricks: number; cleared: number };

export default function SuperJump({ onFinish, paused }: GameProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const input = useRef<Input>({ left: false, right: false, jump: false });
  const [hud, setHud] = useState<Hud>({ coins: 0, lives: START_LIVES, status: "playing", level: 1, levels: 3, bricks: 0, cleared: 0 });
  const [banner, setBanner] = useState<number | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) input.current = { left: false, right: false, jump: false };
  }, [paused]);

  // Game loop: fixed 60 Hz physics, drawn every animation frame. React only re-renders when the HUD changes.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sprite = new Image();
    sprite.src = SPRITE_URL;

    const levels = allLevels();
    let index = 0;
    let cleared = 0;
    let state = createGame(levels[0]);
    let levelBreak = 0;
    let last = performance.now();
    let acc = 0;
    let frame = 0;

    /** Sounds for what changed during one physics step. */
    const sounds = (before: JumpState, after: JumpState) => {
      if (after.coinsCollected > before.coinsCollected) playSfx("coin");
      if (after.bricksSmashed > before.bricksSmashed) playSfx("smash");
      else if (before.player.vy < 0 && after.player.vy === 0 && !after.player.onGround) playSfx("bump");
      if (after.lives < before.lives) playSfx("hurt");
      if (after.enemies.filter((e) => e.alive).length < before.enemies.filter((e) => e.alive).length) playSfx("stomp");
      if (before.player.onGround && after.player.vy < -200) playSfx("jump");
    };

    const loop = () => {
      // Read the clock here rather than trusting the rAF timestamp, whose time base can differ.
      const now = performance.now();
      const elapsed = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME);
      last = now;
      if (!pausedRef.current) {
        if (levelBreak > 0) {
          levelBreak -= elapsed;
          if (levelBreak <= 0) setBanner(null);
        } else acc += elapsed;
      }
      while (acc >= STEP) {
        const before = state;
        state = step(state, input.current, STEP);
        sounds(before, state);
        acc -= STEP;
        // Reached a flag with more levels to go: carry coins and lives into the next one.
        if (state.status === "won" && index < levels.length - 1) {
          cleared++;
          index++;
          state = createGame(levels[index], { coins: state.coinsCollected, lives: state.lives, bricks: state.bricksSmashed });
          levelBreak = LEVEL_BREAK_S;
          acc = 0;
          playSfx("levelUp");
          setBanner(index + 1);
          break;
        }
      }
      drawFrame(ctx, state, reducedMotion, sprite);
      const won = state.status === "won";
      if (won && cleared < levels.length) cleared = levels.length;
      setHud((h) =>
        h.coins === state.coinsCollected && h.lives === state.lives && h.status === state.status && h.level === index + 1 && h.bricks === state.bricksSmashed
          ? h
          : { coins: state.coinsCollected, lives: state.lives, status: state.status, level: index + 1, levels: levels.length, bricks: state.bricksSmashed, cleared },
      );
      if (state.status === "playing") frame = requestAnimationFrame(loop);
      else playSfx(won ? "win" : "lose");
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const report = useEffectEvent(() =>
    onFinish({
      headline: hud.status === "won" ? t.jump.won : t.jump.lost,
      detail: `${t.jump.detail(hud.coins)} ${t.jump.levelsDone(hud.cleared, hud.levels)}`,
      score: hud.coins,
      stats: { levels: hud.cleared, allLevels: hud.status === "won", bricks: hud.bricks, coins: hud.coins },
    }),
  );

  useEffect(() => {
    if (hud.status === "playing") return;
    const timer = setTimeout(report, RESULT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hud.status]);

  // Keyboard, while focus is on the game (or the page itself) rather than a link.
  useEffect(() => {
    const onGame = () => {
      const active = document.activeElement;
      return !active || active === document.body || active.tagName === "H1" || !!rootRef.current?.contains(active);
    };
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      const key = KEYS[e.key];
      if (!key || !onGame()) return;
      e.preventDefault();
      input.current = { ...input.current, [key]: down };
    };
    const onDown = handle(true);
    const onUp = handle(false);
    const release = () => {
      input.current = { left: false, right: false, jump: false };
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, []);

  // Touch/mouse buttons: held while the pointer is down on them.
  function setKey(e: PointerEvent<HTMLButtonElement>, value: boolean) {
    const key = e.currentTarget.dataset.key as keyof Input;
    input.current = { ...input.current, [key]: value };
  }
  const holdHandlers = {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setKey(e, true);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => setKey(e, false),
    onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => setKey(e, false),
    onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => setKey(e, false),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };

  const control =
    "grid min-h-16 min-w-16 cursor-pointer touch-none select-none place-items-center rounded-xl font-display text-lg uppercase transition-transform duration-(--duration-fast) active:scale-95";

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl">
      <div className="mb-3 flex justify-center gap-3 font-display text-xl">
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-card px-4 py-2">
          <Icon name="flag" className="size-5 text-mint" />
          {t.jump.level(hud.level, hud.levels)}
        </span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-card px-4 py-2">
          <Icon name="coins" className="size-5 text-sun" />
          <span className="sr-only">{t.jump.coins}: </span>
          {hud.coins}
        </span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-card px-4 py-2">
          <Icon name="heart" className="size-5 text-accent" />
          <span className="sr-only">{t.jump.lives}: </span>
          {hud.lives}
        </span>
      </div>
      <p role="status" className="sr-only">
        {t.jump.status(hud.coins, hud.lives)}
      </p>
      <div className="relative">
      <canvas
        ref={canvasRef}
        width={VIEW_W * PIXEL_SCALE}
        height={VIEW_H * PIXEL_SCALE}
        role="img"
        aria-label={t.jump.screen}
        className="aspect-[5/3] w-full touch-none rounded-(--radius-card) bg-[#5c94fc] shadow-lg shadow-black/40 [image-rendering:pixelated]"
      />
      {banner !== null && (
        <p
          aria-live="polite"
          className="pointer-events-none absolute inset-0 grid animate-pop place-items-center font-display text-5xl uppercase text-white [text-shadow:0_4px_0_#000,0_0_20px_rgba(0,0,0,0.6)] sm:text-7xl"
        >
          {t.jump.levelBanner(banner)}
        </p>
      )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex gap-3">
          <button type="button" aria-label={t.jump.left} className={`${control} bg-muted text-foreground`} data-key="left" {...holdHandlers}>
            <Icon name="arrow-left" className="size-8" />
          </button>
          <button type="button" aria-label={t.jump.right} className={`${control} bg-muted text-foreground`} data-key="right" {...holdHandlers}>
            <Icon name="arrow-right" className="size-8" />
          </button>
        </div>
        <button
          type="button"
          className={`${control} bg-accent px-8 text-on-accent shadow-[0_0_18px_rgb(244_63_94/0.4)]`}
          data-key="jump"
          {...holdHandlers}
        >
          <span className="flex items-center gap-2">
            <Icon name="arrow-up" className="size-7" />
            {t.jump.jump}
          </span>
        </button>
      </div>
      <p className="mt-4 text-center text-muted-foreground">{t.jump.keyboard}</p>
    </div>
  );
}
