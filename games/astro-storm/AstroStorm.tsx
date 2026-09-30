"use client";

import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import { Renderer } from "./draw";
import { FIELD_H, FIELD_W, START_LIVES, createGame, step, type AstroState, type Input } from "./logic";

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const RESULT_DELAY_MS = 1200;

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowUp: "thrust",
  w: "thrust",
  W: "thrust",
  " ": "fire",
};

type Hud = { score: number; lives: number; wave: number; status: AstroState["status"] };

export default function AstroStorm({ onFinish }: GameProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const input = useRef<Input>({ left: false, right: false, thrust: false, fire: false });
  const [hud, setHud] = useState<Hud>({ score: 0, lives: START_LIVES, wave: 1, status: "playing" });
  const waveLabel = useEffectEvent((n: number) => t.astro.wave(n));

  // Game loop: fixed 60 Hz simulation, drawn every animation frame. React only re-renders when the HUD changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = FIELD_W * dpr;
    canvas.height = FIELD_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new Renderer(ctx, reducedMotion, getComputedStyle(canvas).fontFamily, waveLabel);

    let state = createGame(Math.random);
    renderer.react(state.events);
    let last = performance.now();
    let acc = 0;
    let frame = 0;

    const loop = () => {
      const now = performance.now();
      const elapsed = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME);
      last = now;
      acc += elapsed;
      while (acc >= STEP) {
        state = step(state, input.current, STEP, Math.random);
        renderer.react(state.events);
        acc -= STEP;
      }
      renderer.draw(state, input.current.thrust && state.ship.alive, elapsed);
      setHud((h) =>
        h.score === state.score && h.lives === state.lives && h.wave === state.wave && h.status === state.status
          ? h
          : { score: state.score, lives: state.lives, wave: state.wave, status: state.status },
      );
      // Keep drawing briefly after the last life so the explosion plays out.
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const report = useEffectEvent(() =>
    onFinish({ headline: t.astro.over, detail: t.astro.detail(hud.score, hud.wave), score: hud.score }),
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
      input.current = { left: false, right: false, thrust: false, fire: false };
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
    "grid min-h-16 min-w-16 cursor-pointer touch-none select-none place-items-center rounded-3xl font-display text-lg font-semibold transition-transform duration-(--duration-fast) active:translate-y-1";

  return (
    <div ref={rootRef} className="mx-auto max-w-4xl">
      <div className="mb-3 flex flex-wrap justify-center gap-3 font-display text-xl font-semibold">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="star" className="size-5 text-sun" />
          <span className="sr-only">{t.astro.score}: </span>
          {hud.score}
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="heart" className="size-5 text-accent" />
          <span className="sr-only">{t.astro.lives}: </span>
          {hud.lives}
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="rocket" className="size-5 text-secondary" />
          {t.astro.wave(hud.wave)}
        </span>
      </div>
      <p role="status" className="sr-only">
        {t.astro.status(hud.score, hud.lives, hud.wave)}
      </p>
      <canvas
        ref={canvasRef}
        width={FIELD_W}
        height={FIELD_H}
        role="img"
        aria-label={t.astro.screen}
        className="aspect-video w-full touch-none rounded-(--radius-card) bg-[#04030d] font-display shadow-lg shadow-black/40"
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <button type="button" aria-label={t.astro.left} className={`${control} bg-muted text-foreground`} data-key="left" {...holdHandlers}>
            <Icon name="replay" className="size-8" />
          </button>
          <button type="button" aria-label={t.astro.right} className={`${control} bg-muted text-foreground`} data-key="right" {...holdHandlers}>
            <Icon name="replay" className="size-8 -scale-x-100" />
          </button>
        </div>
        <div className="flex gap-3">
          <button type="button" aria-label={t.astro.thrust} className={`${control} bg-muted text-foreground`} data-key="thrust" {...holdHandlers}>
            <Icon name="arrow-up" className="size-8" />
          </button>
          <button
            type="button"
            className={`${control} bg-accent px-6 text-on-accent shadow-[0_5px_0_0_#9f1239] active:shadow-[0_1px_0_0_#9f1239]`}
            data-key="fire"
            {...holdHandlers}
          >
            <span className="flex items-center gap-2">
              <Icon name="zap" className="size-7" />
              {t.astro.fire}
            </span>
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-muted-foreground">{t.astro.keyboard}</p>
    </div>
  );
}
