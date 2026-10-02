"use client";

import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import { type Sfx, playSfx } from "@/lib/sfx";
import { HEROES, type Hero, VIEW_H, VIEW_W, clearSceneryCache, drawFrame, drawPortrait, setPixelScale } from "./draw";
import { createCamera, createFx, updateCamera } from "./fx";
import { BOSS_HP, COWL_S, type GameEvent, type Input, type JumpState, START_LIVES, allLevels, bossStatus, createGame, step } from "./logic";

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const RESULT_DELAY_MS = 900;
/** How long the "Level 2!" card shows between levels. */
const LEVEL_BREAK_S = 2.2;

type Key = "left" | "right" | "jump" | "smash";

const KEYS: Record<string, Key> = {
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
  x: "smash",
  X: "smash",
  j: "smash",
  J: "smash",
  k: "smash",
  K: "smash",
};

const HERO_KEY = "gks:jump-hero";

function savedHero(): Hero {
  try {
    const saved = window.localStorage.getItem(HERO_KEY);
    if (saved === "deku" || saved === "bakugo") return saved;
  } catch {
    // Storage can be blocked; Deku is the default.
  }
  return "deku";
}

const NO_INPUT: Input = { left: false, right: false, jump: false, smash: false };

/** Sound for each thing that happens in a step. */
const SOUNDS: Partial<Record<GameEvent["kind"], Sfx>> = {
  jump: "jump",
  coin: "coin",
  brick: "smash",
  bump: "bump",
  stomp: "stomp",
  punch: "punch",
  kill: "smash",
  hurt: "hurt",
  power: "power",
  heart: "heart",
  checkpoint: "levelUp",
  bossHit: "boom",
  bossDown: "boom",
};

type Hud = {
  coins: number;
  lives: number;
  status: JumpState["status"];
  level: number;
  levels: number;
  bricks: number;
  cleared: number;
  kills: number;
  smashKills: number;
  /** Full Cowl seconds left, in tenths. */
  cowl: number;
  /** Boss hit points left (0 when there is no boss alive). */
  boss: number;
};

const START_HUD: Hud = {
  coins: 0,
  lives: START_LIVES,
  status: "playing",
  level: 1,
  levels: 4,
  bricks: 0,
  cleared: 0,
  kills: 0,
  smashKills: 0,
  cowl: 0,
  boss: 0,
};

/** A small canvas with the hero standing ready, for the picker. */
function HeroPortrait({ hero }: { hero: Hero }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPortrait(ctx, hero, canvas.width / 2, canvas.height - 18, canvas.height / 42, 0, "ready");
  }, [hero]);
  return <canvas ref={ref} width={360} height={420} aria-hidden="true" className="h-52 w-auto sm:h-60" />;
}

export default function SuperJump({ onFinish, paused }: GameProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const input = useRef<Input>({ ...NO_INPUT });
  // The game loads on the client only, so the last pick on this device can be read straight away.
  const [pick, setPick] = useState<Hero>(savedHero);
  const [hero, setHero] = useState<Hero | null>(null);
  const [hud, setHud] = useState<Hud>(START_HUD);
  const [banner, setBanner] = useState<number | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) input.current = { ...NO_INPUT };
  }, [paused]);

  // Game loop: fixed 60 Hz physics, drawn every animation frame. React only re-renders when the HUD changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!hero || !canvas) return;
    // Match the canvas to the screen: sharp on big or high-density screens, lighter on small ones.
    const pixelScale = Math.min(4, Math.max(2, Math.ceil(((canvas.clientWidth || 640) * (window.devicePixelRatio || 1)) / VIEW_W)));
    setPixelScale(pixelScale);
    canvas.width = VIEW_W * pixelScale;
    canvas.height = VIEW_H * pixelScale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const levels = allLevels();
    let index = 0;
    let cleared = 0;
    let state = createGame(levels[0]);
    let camera = createCamera(state);
    const fx = createFx(hero);
    let levelBreak = 0;
    let last = performance.now();
    let acc = 0;
    let frame = 0;

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
        state = step(state, input.current, STEP);
        for (const e of state.events) {
          const sound = SOUNDS[e.kind];
          if (sound) playSfx(sound);
        }
        fx.emit(state.events, state, camera, reducedMotion);
        acc -= STEP;
        // Reached a flag with more levels to go: carry coins, lives and counters into the next one.
        if (state.status === "won" && index < levels.length - 1) {
          cleared++;
          index++;
          state = createGame(levels[index], {
            coins: state.coinsCollected,
            lives: state.lives,
            bricks: state.bricksSmashed,
            kills: state.kills,
            smashKills: state.smashKills,
          });
          camera = createCamera(state);
          fx.particles = [];
          levelBreak = LEVEL_BREAK_S;
          acc = 0;
          playSfx("levelUp");
          setBanner(index + 1);
          break;
        }
      }
      if (!pausedRef.current) {
        updateCamera(camera, state, elapsed, reducedMotion);
        fx.update(elapsed, state, reducedMotion);
      }
      drawFrame(ctx, state, { camera, fx, reducedMotion, hero });
      const won = state.status === "won";
      if (won && cleared < levels.length) cleared = levels.length;
      const next: Hud = {
        coins: state.coinsCollected,
        lives: state.lives,
        status: state.status,
        level: index + 1,
        levels: levels.length,
        bricks: state.bricksSmashed,
        cleared,
        kills: state.kills,
        smashKills: state.smashKills,
        cowl: Math.ceil(state.player.cowl * 10),
        boss: bossStatus(state)?.hp ?? 0,
      };
      setHud((h) => {
        const same =
          h.coins === next.coins &&
          h.lives === next.lives &&
          h.status === next.status &&
          h.level === next.level &&
          h.bricks === next.bricks &&
          h.kills === next.kills &&
          h.smashKills === next.smashKills &&
          h.boss === next.boss &&
          h.cleared === next.cleared &&
          Math.floor(h.cowl / 2) === Math.floor(next.cowl / 2);
        return same ? h : next;
      });
      if (state.status === "playing") frame = requestAnimationFrame(loop);
      else playSfx(won ? "win" : "lose");
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      clearSceneryCache();
    };
  }, [hero]);

  const report = useEffectEvent(() =>
    onFinish({
      headline: hud.status === "won" ? t.jump.won : t.jump.lost,
      detail: `${t.jump.detail(hud.coins)} ${t.jump.villains(hud.kills)} ${t.jump.levelsDone(hud.cleared, hud.levels)}`,
      score: hud.coins,
      stats: { levels: hud.cleared, allLevels: hud.status === "won", bricks: hud.bricks, coins: hud.coins, kills: hud.kills, smashKills: hud.smashKills, bakugo: hero === "bakugo" },
    }),
  );

  useEffect(() => {
    if (hud.status === "playing") return;
    const timer = setTimeout(report, RESULT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hud.status]);

  // Keyboard, while focus is on the game (or the page itself) rather than a link.
  useEffect(() => {
    if (!hero) return;
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
      input.current = { ...NO_INPUT };
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, [hero]);

  // Touch/mouse buttons: held while the pointer is down on them.
  function setKey(e: PointerEvent<HTMLButtonElement>, value: boolean) {
    const key = e.currentTarget.dataset.key as Key;
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

  if (!hero) {
    const start = () => {
      try {
        window.localStorage.setItem(HERO_KEY, pick);
      } catch {
        // Not saving is fine.
      }
      setHero(pick);
    };
    const cardLook: Record<Hero, string> = {
      deku: "bg-[linear-gradient(160deg,#0f5a32,#0a2416)] hover:border-[#3dff8a]/60",
      bakugo: "bg-[linear-gradient(160deg,#7a3508,#2a1206)] hover:border-[#ff8a1f]/60",
    };
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-(--radius-card) bg-card p-5 sm:p-8">
        <p className="-skew-x-6 self-start border-2 border-sun bg-black px-4 py-1 font-display text-lg uppercase text-sun shadow-[4px_4px_0_#000] sm:text-2xl">
          <span className="inline-block skew-x-6">{t.jump.plusUltra}</span>
        </p>
        <fieldset>
          <legend className="mb-3 font-display text-2xl uppercase">{t.jump.chooseHero}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {HEROES.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={pick === h}
                onClick={() => setPick(h)}
                className={`relative flex cursor-pointer flex-col items-center gap-1 overflow-hidden rounded-lg border-4 border-transparent p-4 text-center shadow-[5px_5px_0_#000] transition-[transform,border-color] duration-(--duration-fast) hover:-translate-y-0.5 aria-pressed:border-sun aria-pressed:shadow-[5px_5px_0_#000,0_0_24px_rgba(255,209,102,0.35)] ${cardLook[h]}`}
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.14)_1.2px,transparent_1.4px)] [background-size:9px_9px]" />
                <span className="relative">
                  <HeroPortrait hero={h} />
                </span>
                <span className="relative block -skew-x-6 bg-black/70 px-4 py-0.5 font-display text-2xl uppercase text-white">
                  <span className="inline-block skew-x-6">{t.jump.heroNames[h]}</span>
                </span>
                <span className="relative block text-sm font-semibold uppercase tracking-wide text-white/80">{t.jump.heroFull[h]}</span>
                <span className="relative block text-white/90">{t.jump.heroHints[h]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-14 -skew-x-6 cursor-pointer items-center justify-center border-4 border-black bg-accent px-8 font-display text-xl uppercase text-on-accent shadow-[5px_5px_0_#000] transition-transform duration-(--duration-fast) hover:-translate-y-0.5 active:translate-y-0.5"
        >
          <span className="inline-flex skew-x-6 items-center gap-2">
            <Icon name="play" className="size-6" />
            {t.jump.start}
          </span>
        </button>
      </div>
    );
  }

  const control =
    "grid min-h-16 min-w-16 cursor-pointer touch-none select-none place-items-center rounded-xl border-b-4 border-black/50 font-display text-lg uppercase shadow-[0_3px_0_rgba(0,0,0,0.35)] transition-transform duration-(--duration-fast) active:translate-y-0.5 active:scale-95";
  const chip = "-skew-x-6 border-2 border-sun/80 bg-black/70 px-3 py-1.5 shadow-[3px_3px_0_#000] sm:px-4 sm:py-2";
  const chipInner = "inline-flex skew-x-6 items-center gap-2";
  const levelName = t.jump.levelNames[hud.level - 1] ?? "";

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl">
      <div className="mb-3 flex flex-wrap justify-center gap-2 font-display text-lg sm:gap-3 sm:text-xl">
        <span className={chip}>
          <span className={chipInner}>
            <Icon name="flag" className="size-5 text-mint" />
            {t.jump.level(hud.level, hud.levels)}
            <span className="hidden text-muted-foreground sm:inline">· {levelName}</span>
          </span>
        </span>
        <span className={chip}>
          <span className={chipInner}>
            <Icon name="coins" className="size-5 text-sun" />
            <span className="sr-only">{t.jump.coins}: </span>
            {hud.coins}
          </span>
        </span>
        <span className={chip}>
          <span className={chipInner}>
            <Icon name="heart" className="size-5 text-accent" />
            <span className="sr-only">{t.jump.lives}: </span>
            {hud.lives}
          </span>
        </span>
      </div>
      <p role="status" className="sr-only">
        {t.jump.status(hud.coins, hud.lives)}
      </p>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={VIEW_W * 3}
          height={VIEW_H * 3}
          role="img"
          aria-label={t.jump.screen}
          className="aspect-[5/3] w-full touch-none rounded-(--radius-card) bg-[#79c4ff] shadow-lg shadow-black/40"
        />
        {hud.cowl > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 w-36 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white"
          >
            {hero === "bakugo" ? t.jump.boost : t.jump.cowl}
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[#3dff8a]" style={{ width: `${Math.min(100, (hud.cowl / (COWL_S * 10)) * 100)}%` }} />
            </div>
          </div>
        )}
        {hud.boss > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white"
          >
            {t.jump.boss}
            <div className="mt-1 flex gap-1">
              {Array.from({ length: BOSS_HP }, (_, i) => (
                <span key={i} className={`h-1.5 w-5 rounded-full ${i < hud.boss ? "bg-[#ff4a55]" : "bg-white/20"}`} />
              ))}
            </div>
          </div>
        )}
        {banner !== null && (
          <div aria-live="polite" className="pointer-events-none absolute inset-0 grid place-content-center overflow-hidden text-center">
            <div className="-skew-y-3 animate-pop border-y-4 border-sun bg-black/75 px-10 py-3 font-display uppercase shadow-[0_0_40px_rgba(0,0,0,0.6)]">
              <p className="skew-y-3 text-4xl italic text-sun [text-shadow:3px_3px_0_#000] sm:text-6xl">{t.jump.levelBanner(banner)}</p>
              <p className="skew-y-3 text-lg text-white [text-shadow:2px_2px_0_#000] sm:text-3xl">{t.jump.levelNames[banner - 1]}</p>
              <p className="skew-y-3 text-sm tracking-widest text-[#7dffae] sm:text-lg">{t.jump.plusUltra}</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex gap-2 sm:gap-3">
          <button type="button" aria-label={t.jump.left} className={`${control} bg-muted text-foreground`} data-key="left" {...holdHandlers}>
            <Icon name="arrow-left" className="size-8" />
          </button>
          <button type="button" aria-label={t.jump.right} className={`${control} bg-muted text-foreground`} data-key="right" {...holdHandlers}>
            <Icon name="arrow-right" className="size-8" />
          </button>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button type="button" aria-label={t.jump.smash} className={`${control} bg-mint text-on-mint sm:px-5`} data-key="smash" {...holdHandlers}>
            <span className="flex items-center gap-2">
              <Icon name="zap" className="size-7 sm:size-6" />
              <span className="hidden sm:inline">{t.jump.smash}</span>
            </span>
          </button>
          <button
            type="button"
            aria-label={t.jump.jump}
            className={`${control} min-w-20 bg-accent text-on-accent shadow-[0_0_18px_rgb(244_63_94/0.4)] sm:px-6`}
            data-key="jump"
            {...holdHandlers}
          >
            <span className="flex items-center gap-2">
              <Icon name="arrow-up" className="size-8 sm:size-7" />
              <span className="hidden sm:inline">{t.jump.jump}</span>
            </span>
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-muted-foreground">{t.jump.keyboard}</p>
    </div>
  );
}
