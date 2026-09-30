"use client";

import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import type { Engine, Hud } from "./engine";
import { START_LIVES, type AstroEvent, type AstroState, type Input } from "./logic";
import type { ViewMode } from "./view";

type Phase = "setup" | "loading" | "playing" | "nowebgl";
type Action = "up" | "down" | "left" | "right" | "fire" | "roll";

const KEYS: Record<string, Action> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "fire",
  KeyF: "fire",
  ShiftLeft: "roll",
  ShiftRight: "roll",
  KeyB: "roll",
};

const INITIAL_HUD: Hud = { score: 0, lives: START_LIVES, wave: 1, triple: false, status: "playing" };

function hasWebgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The inside of the cockpit, drawn over the 3D view: canopy frame, dashboard and crosshair. */
function CockpitFrame({ triple }: { triple: boolean }) {
  return (
    <svg
      viewBox="0 0 160 90"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id="dash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
      </defs>
      {/* Canopy struts and top rim */}
      <path d="M0 0 H160 V5 Q80 12 0 5 Z" fill="#0f172a" />
      <path d="M0 5 L26 70 L20 90 H0 Z" fill="#0f172a" />
      <path d="M160 5 L134 70 L140 90 H160 Z" fill="#0f172a" />
      <path d="M0 5 L26 70 M160 5 L134 70" stroke="#334155" strokeWidth="1" />
      {/* Dashboard */}
      <path d="M20 90 L30 72 Q80 64 130 72 L140 90 Z" fill="url(#dash)" stroke="#334155" strokeWidth="0.8" />
      <rect x="62" y="75" width="36" height="11" rx="2" fill="#022c22" stroke="#10b981" strokeWidth="0.6" />
      <path d="M64 83 L70 79 L76 82 L82 77 L88 81 L96 78" stroke="#34d399" strokeWidth="0.6" fill="none" />
      <circle cx="46" cy="81" r="5" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="0.6" />
      <path d="M46 81 L49 78" stroke="#7dd3fc" strokeWidth="0.8" />
      <circle cx="114" cy="81" r="5" fill={triple ? "#713f12" : "#1e293b"} stroke={triple ? "#facc15" : "#475569"} strokeWidth="0.6" />
      <text x="114" y="82.6" textAnchor="middle" fontSize="4" fontWeight="700" fill={triple ? "#facc15" : "#64748b"}>
        x3
      </text>
      {[36, 40, 120, 124].map((x, i) => (
        <circle key={x} cx={x} cy="86" r="0.9" fill={["#f43f5e", "#34d399", "#facc15", "#38bdf8"][i]} className="animate-pulse" />
      ))}
      {/* Crosshair */}
      <g stroke="#4ade80" strokeWidth="0.5" fill="none" opacity="0.9">
        <circle cx="80" cy="42" r="4" />
        <path d="M80 35 V38.5 M80 45.5 V49 M73 42 H76.5 M83.5 42 H87" />
      </g>
    </svg>
  );
}

export default function AstroStorm({ onFinish }: GameProps) {
  const t = useT();
  const a = t.astro;
  const [phase, setPhase] = useState<Phase>("setup");
  const [view, setView] = useState<ViewMode>("chase");
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [flash, setFlash] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const held = useRef(new Set<Action>());
  const stick = useRef<{ x: number; y: number } | null>(null);
  const knobRef = useRef<HTMLSpanElement>(null);

  const readInput = (): Input => {
    const k = held.current;
    const s = stick.current;
    return {
      x: s ? s.x : (k.has("right") ? 1 : 0) - (k.has("left") ? 1 : 0),
      y: s ? s.y : (k.has("up") ? 1 : 0) - (k.has("down") ? 1 : 0),
      fire: k.has("fire"),
      roll: k.has("roll"),
    };
  };

  const finish = useEffectEvent((s: AstroState) =>
    onFinish({ headline: a.over, detail: a.detail(s.score, s.wave), score: s.score }),
  );

  const onEvent = useEffectEvent((e: AstroEvent) => {
    if (e.type === "wave") setBanner((b) => ({ id: (b?.id ?? 0) + 1, text: a.waveBanner(e.wave) }));
    if (e.type === "crash") setFlash((n) => n + 1);
  });

  function toggleView() {
    setView((v) => {
      const next = v === "chase" ? "cockpit" : "chase";
      engineRef.current?.setView(next);
      return next;
    });
  }
  const toggleViewEvent = useEffectEvent(toggleView);

  // Start the engine (and download Three.js) once the player launches.
  useEffect(() => {
    if (phase !== "loading") return;
    let cancelled = false;
    if (!hasWebgl()) {
      queueMicrotask(() => !cancelled && setPhase("nowebgl"));
      return () => {
        cancelled = true;
      };
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./engine").then(({ Engine: EngineClass }) => {
      if (cancelled || !stageRef.current) return;
      try {
        engineRef.current = new EngineClass(stageRef.current, view, reducedMotion, readInput, {
          onHud: setHud,
          onEvent,
          onOver: finish,
        });
        engineRef.current.unlockAudio();
        setPhase("playing");
      } catch {
        setPhase("nowebgl");
      }
    });
    return () => {
      cancelled = true;
    };
    // view and readInput are read once at launch; later view changes go through setView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 1500);
    return () => clearTimeout(timer);
  }, [banner]);

  // Keyboard, while focus is on the game (or the page itself) rather than a link or button.
  useEffect(() => {
    if (phase === "setup" || phase === "nowebgl") return;
    const onGame = () => {
      const active = document.activeElement;
      return !active || active === document.body || active.tagName === "H1" || active === stageRef.current;
    };
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      if (!onGame()) return;
      if (e.code === "KeyC") {
        if (down && !e.repeat) toggleViewEvent();
        return;
      }
      const action = KEYS[e.code];
      if (!action) return;
      e.preventDefault();
      engineRef.current?.unlockAudio();
      if (down) held.current.add(action);
      else held.current.delete(action);
    };
    const onDown = handle(true);
    const onUp = handle(false);
    const release = () => held.current.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, [phase]);

  function launch() {
    held.current.clear();
    setPhase("loading");
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
  }

  /* ---------- Touch controls ---------- */

  function moveStick(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const r = box.width / 2;
    let x = (e.clientX - box.left - r) / r;
    let y = -(e.clientY - box.top - r) / r;
    const d = Math.hypot(x, y);
    if (d > 1) {
      x /= d;
      y /= d;
    }
    stick.current = { x, y };
    if (knobRef.current) knobRef.current.style.transform = `translate(${x * 40}px, ${-y * 40}px)`;
  }
  function releaseStick() {
    stick.current = null;
    if (knobRef.current) knobRef.current.style.transform = "";
  }
  const stickHandlers = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      engineRef.current?.unlockAudio();
      moveStick(e);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => stick.current && moveStick(e),
    onPointerUp: releaseStick,
    onPointerCancel: releaseStick,
    onLostPointerCapture: releaseStick,
  };
  function setAction(e: PointerEvent<HTMLButtonElement>, value: boolean) {
    const action = e.currentTarget.dataset.action as Action;
    if (value) held.current.add(action);
    else held.current.delete(action);
  }
  const holdHandlers = {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      engineRef.current?.unlockAudio();
      setAction(e, true);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => setAction(e, false),
    onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => setAction(e, false),
    onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => setAction(e, false),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };

  const choice =
    "flex min-h-24 cursor-pointer items-center gap-4 rounded-3xl border-4 border-transparent bg-muted p-4 text-left transition-colors duration-(--duration-fast) aria-pressed:border-sun aria-pressed:bg-[#32324a]";

  if (phase === "setup") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-(--radius-card) bg-card p-6 sm:p-8">
        <fieldset>
          <legend className="mb-3 font-display text-2xl font-semibold">{a.chooseView}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["chase", "cockpit"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={view === m} onClick={() => setView(m)} className={choice}>
                <Icon name={m === "chase" ? "rocket" : "gamepad"} className="size-10 shrink-0 text-sky" />
                <span>
                  <span className="block font-display text-xl font-semibold">{a[m]}</span>
                  <span className="block text-muted-foreground">{m === "chase" ? a.chaseHint : a.cockpitHint}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-muted-foreground">{a.keyboard}</p>
        <Button variant="accent" onClick={launch} className="!min-h-16 self-center !px-10 !text-2xl">
          <Icon name="rocket" className="size-7" />
          {a.launch}
        </Button>
      </div>
    );
  }

  const control =
    "grid min-h-16 min-w-16 cursor-pointer touch-none select-none place-items-center rounded-3xl font-display text-lg font-semibold transition-transform duration-(--duration-fast) active:translate-y-1";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 font-display text-xl font-semibold sm:gap-3">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="star" className="size-5 text-sun" />
          <span className="sr-only">{a.score}: </span>
          {hud.score}
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="heart" className="size-5 text-accent" />
          <span className="sr-only">{a.lives}: </span>
          {hud.lives}
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-2">
          <Icon name="rocket" className="size-5 text-secondary" />
          {a.wave(hud.wave)}
        </span>
        {hud.triple && (
          <span className="inline-flex items-center gap-2 rounded-2xl bg-sun px-4 py-2 text-on-sun">
            <Icon name="zap" className="size-5" />
            {a.triple}
          </span>
        )}
        <button
          type="button"
          onClick={toggleView}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-base hover:bg-[#32324a]"
        >
          <Icon name="tv" className="size-5 text-sky" />
          {a.switchView}: {view === "chase" ? a.chase : a.cockpit}
        </button>
      </div>
      <p role="status" className="sr-only">
        {a.status(hud.score, hud.lives, hud.wave)}
      </p>
      <div className="relative aspect-video w-full overflow-hidden rounded-(--radius-card) bg-[#03030c] shadow-lg shadow-black/40">
        <div ref={stageRef} tabIndex={-1} role="img" aria-label={a.screen} className="absolute inset-0 touch-none outline-none" />
        {phase === "playing" && view === "cockpit" && <CockpitFrame triple={hud.triple} />}
        {phase !== "playing" && (
          <p className="absolute inset-0 grid place-items-center p-6 text-center font-display text-xl">
            {phase === "loading" ? a.loading : a.noWebgl}
          </p>
        )}
        {flash > 0 && (
          <span
            key={flash}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-[pop_0.5s_ease-out_reverse_both] bg-[radial-gradient(circle,transparent_40%,rgba(244,63,94,0.55))]"
          />
        )}
        {banner && (
          <p
            key={banner.id}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid animate-pop place-items-center font-display text-6xl font-bold text-sky [text-shadow:0_4px_0_#1e3a8a,0_0_24px_#38bdf8] sm:text-8xl"
          >
            {banner.text}
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div
          aria-label={a.move}
          role="group"
          className="relative grid size-32 shrink-0 touch-none select-none place-items-center rounded-full bg-muted"
          {...stickHandlers}
        >
          <span ref={knobRef} aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#32324a] shadow-[0_4px_0_0_#15152a]">
            <Icon name="rocket" className="size-6 text-muted-foreground" />
          </span>
        </div>
        <div className="flex gap-3">
          <button type="button" className={`${control} bg-muted px-5 text-foreground`} data-action="roll" {...holdHandlers}>
            <span className="flex items-center gap-2">
              <Icon name="replay" className="size-6" />
              {a.roll}
            </span>
          </button>
          <button
            type="button"
            className={`${control} bg-accent px-6 text-on-accent shadow-[0_5px_0_0_#9f1239] active:shadow-[0_1px_0_0_#9f1239]`}
            data-action="fire"
            {...holdHandlers}
          >
            <span className="flex items-center gap-2">
              <Icon name="zap" className="size-7" />
              {a.fire}
            </span>
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-muted-foreground">{a.keyboard}</p>
    </div>
  );
}
