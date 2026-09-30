"use client";

import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import type { Engine, Hud, Mode } from "./engine";
import { RULES, soloScore, type Difficulty, type GameEvent, type GonzState, type Input } from "./logic";
import { CHARACTERS, type Character } from "./characters";
import { Portrait } from "./Portraits";

type Phase = "setup" | "loading" | "playing" | "nowebgl";
type Action = "up" | "down" | "left" | "right" | "fire" | "dash";
type KeyMap = Record<string, [0 | 1, Action]>;

const P1_KEYS: KeyMap = {
  KeyW: [0, "up"],
  KeyS: [0, "down"],
  KeyA: [0, "left"],
  KeyD: [0, "right"],
  KeyF: [0, "fire"],
  Space: [0, "fire"],
  KeyG: [0, "dash"],
  ShiftLeft: [0, "dash"],
};
const P2_KEYS: KeyMap = {
  ArrowUp: [1, "up"],
  ArrowDown: [1, "down"],
  ArrowLeft: [1, "left"],
  ArrowRight: [1, "right"],
  Enter: [1, "fire"],
  NumpadEnter: [1, "fire"],
  KeyL: [1, "fire"],
  KeyK: [1, "dash"],
  ShiftRight: [1, "dash"],
};
const DUO_KEYS: KeyMap = { ...P1_KEYS, ...P2_KEYS };
// Alone against the CPU, every key drives player 1.
const SOLO_KEYS: KeyMap = Object.fromEntries(Object.entries(DUO_KEYS).map(([code, [, action]]) => [code, [0, action]]));

const INITIAL_HUD: Hud = {
  hp: [RULES.maxHp, RULES.maxHp],
  kos: [0, 0],
  triple: [false, false],
  alive: [true, true],
  countdown: RULES.countdown,
};
const LOW_HP = 40;

function hasWebgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Gonzgun({ onFinish }: GameProps) {
  const t = useT();
  const g = t.gonzgun;
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("cpu");
  const [pick, setPick] = useState<Character>("blocky");
  const [rival, setRival] = useState<Character>("sparky");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [announce, setAnnounce] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const held = useRef([new Set<Action>(), new Set<Action>()]);
  const stick = useRef<{ x: number; z: number } | null>(null);
  const knobRef = useRef<HTMLSpanElement>(null);

  const characters: [Character, Character] = [pick, rival];
  const names = characters.map((c) => g[c]) as [string, string];
  const tags: [string, string] = mode === "cpu" ? [g.p1, g.cpuTag] : [g.p1, g.p2];

  const readInput = (): [Input, Input] =>
    [0, 1].map((i) => {
      const keys = held.current[i];
      const s = i === 0 ? stick.current : null;
      const mx = s ? s.x : (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
      const mz = s ? s.z : (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0);
      return { mx, mz, fire: keys.has("fire"), dash: keys.has("dash") };
    }) as [Input, Input];

  const finish = useEffectEvent((s: GonzState) => {
    const [a, b] = [s.fighters[0].kos, s.fighters[1].kos];
    if (mode === "cpu") {
      onFinish({
        headline: s.winner === 0 ? g.winYou : g.winCpu,
        detail: `${g.detail(a, b)} ${g.level(g[difficulty])}`,
        score: soloScore(s, difficulty),
      });
    } else {
      const winner = s.winner ?? 0;
      onFinish({ headline: g.winPlayer(`${names[winner]} (${tags[winner]})`), detail: g.detail(a, b) });
    }
  });

  const onEvent = useEffectEvent((e: GameEvent) => {
    const show = (text: string) => setBanner((prev) => ({ id: (prev?.id ?? 0) + 1, text }));
    if (e.type === "count") setAnnounce(String(e.n));
    if (e.type === "go") {
      show(g.go);
      setAnnounce(g.go);
    }
    if (e.type !== "ko") return;
    const by = e.target === 0 ? 1 : 0;
    show(e.streak >= 3 ? g.unstoppable : e.streak === 2 ? g.doubleKo : g.ko);
    setAnnounce(g.koBy(`${names[by]} (${tags[by]})`));
  });

  // Start the engine (and download Three.js) only once the players have chosen.
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
        engineRef.current = new EngineClass(stageRef.current, { mode, difficulty, characters, tags, reducedMotion }, readInput, {
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
    // characters/tags/readInput derive from mode and pick, which can't change after setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  // Hide the KO banner after a moment.
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 900);
    return () => clearTimeout(timer);
  }, [banner]);

  // Keyboard, while focus is on the game (or the page itself) rather than a link or button.
  useEffect(() => {
    if (phase !== "playing" && phase !== "loading") return;
    const keys = mode === "cpu" ? SOLO_KEYS : DUO_KEYS;
    const onGame = () => {
      const active = document.activeElement;
      return !active || active === document.body || active.tagName === "H1" || active === stageRef.current;
    };
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      const hit = keys[e.code];
      if (!hit || !onGame()) return;
      e.preventDefault();
      engineRef.current?.unlockAudio();
      const [player, action] = hit;
      if (down) held.current[player].add(action);
      else held.current[player].delete(action);
    };
    const onDown = handle(true);
    const onUp = handle(false);
    const release = () => held.current.forEach((s) => s.clear());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, [phase, mode]);

  function start() {
    held.current.forEach((s) => s.clear());
    setPhase("loading");
    // The Fight button is about to disappear: keep keyboard focus on the game.
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
  }

  /* ---------- Touch controls (vs CPU) ---------- */

  function moveStick(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const r = box.width / 2;
    let x = (e.clientX - box.left - r) / r;
    let z = (e.clientY - box.top - r) / r;
    const d = Math.hypot(x, z);
    if (d > 1) {
      x /= d;
      z /= d;
    }
    stick.current = { x, z };
    if (knobRef.current) knobRef.current.style.transform = `translate(${x * 40}px, ${z * 40}px)`;
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
    if (value) held.current[0].add(action);
    else held.current[0].delete(action);
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
    "flex min-h-24 cursor-pointer items-center gap-4 rounded-3xl border-4 bg-muted p-4 text-left transition-colors duration-(--duration-fast) aria-pressed:border-sun aria-pressed:bg-[#32324a] border-transparent";

  const fighterPicker = (legend: string, value: Character, onPick: (c: Character) => void) => (
    <fieldset>
      <legend className="mb-3 font-display text-2xl font-semibold">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHARACTERS.map((c) => (
          <button key={c} type="button" aria-pressed={value === c} onClick={() => onPick(c)} className={choice}>
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-background">
              <Portrait kind={c} className="size-14" />
            </span>
            <span>
              <span className="block font-display text-xl font-semibold">{g[c]}</span>
              <span className="block text-muted-foreground">{g[`${c}Hint`]}</span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );

  if (phase === "setup") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-(--radius-card) bg-card p-6 sm:p-8">
        <fieldset>
          <legend className="mb-3 font-display text-2xl font-semibold">{g.chooseMode}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["cpu", "duo"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={choice}>
                <Icon name={m === "cpu" ? "gamepad" : "user"} className="size-10 shrink-0 text-sun" />
                <span>
                  <span className="block font-display text-xl font-semibold">{g[m]}</span>
                  <span className="block text-muted-foreground">{m === "cpu" ? g.cpuHint : g.duoHint}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        {mode === "cpu" && (
          <fieldset>
            <legend className="mb-3 font-display text-2xl font-semibold">{g.difficulty}</legend>
            <div className="grid grid-cols-3 gap-3">
              {(["easy", "normal", "hard"] as const).map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(d)}
                  className={`${choice} min-h-16 flex-col justify-center gap-1 text-center`}
                >
                  <span className="flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: 3 }, (_, k) => (
                      <Icon key={k} name="zap" className={`size-5 ${k <= i ? "fill-sun text-sun" : "text-muted-foreground"}`} />
                    ))}
                  </span>
                  <span className="font-display text-lg font-semibold">{g[d]}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {fighterPicker(mode === "cpu" ? g.pickFighter : g.pickFighterDuo, pick, setPick)}
        {fighterPicker(mode === "cpu" ? g.pickRival : g.pickP2, rival, setRival)}
        <p className="text-muted-foreground">
          {mode === "cpu" ? (
            g.keysCpu
          ) : (
            <>
              {g.keysP1}
              <br />
              {g.keysP2}
            </>
          )}
        </p>
        <Button variant="accent" onClick={start} className="!min-h-16 self-center !px-10 !text-2xl">
          <Icon name="zap" className="size-7" />
          {g.fight}
        </Button>
      </div>
    );
  }

  const control =
    "grid min-h-16 min-w-16 cursor-pointer touch-none select-none place-items-center rounded-3xl font-display text-lg font-semibold transition-transform duration-(--duration-fast) active:translate-y-1";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {([0, 1] as const).map((i) => (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-2xl bg-card p-2 sm:gap-3 sm:p-3 ${i === 1 ? "order-3 flex-row-reverse text-right" : ""}`}
          >
            <span className={`grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border-4 bg-background ${i === 0 ? "border-sun" : "border-sky"}`}>
              <Portrait kind={characters[i]} className="size-9" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold">
                {names[i]} <span className={i === 0 ? "text-sun" : "text-sky"}>{tags[i]}</span>
              </p>
              <div
                role="meter"
                aria-label={`${names[i]}: ${g.health}`}
                aria-valuemin={0}
                aria-valuemax={RULES.maxHp}
                aria-valuenow={hud.hp[i]}
                className="mt-1 h-3 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-(--duration-fast) ${hud.hp[i] <= LOW_HP ? "animate-pulse bg-accent" : i === 0 ? "bg-sun" : "bg-sky"} ${i === 1 ? "ml-auto" : ""}`}
                  style={{ width: `${(hud.hp[i] / RULES.maxHp) * 100}%` }}
                />
              </div>
              <p className={`mt-1 flex items-center gap-1 ${i === 1 ? "justify-end" : ""}`}>
                <span className="sr-only">
                  {g.kos}: {hud.kos[i]}
                </span>
                {Array.from({ length: RULES.kosToWin }, (_, k) => (
                  <Icon
                    key={k}
                    name="star"
                    className={`size-4 ${k < hud.kos[i] ? (i === 0 ? "fill-sun text-sun" : "fill-sky text-sky") : "text-muted-foreground"}`}
                  />
                ))}
                {hud.triple[i] && <span className="ml-1 text-sm font-semibold">×3</span>}
              </p>
            </div>
          </div>
        ))}
        <p className="order-2 hidden text-center text-sm text-muted-foreground sm:block">{g.firstTo(RULES.kosToWin)}</p>
      </div>
      <p role="status" className="sr-only">
        {g.status(names[0], hud.kos[0], names[1], hud.kos[1])} {announce}
      </p>
      <div className="relative aspect-video w-full overflow-hidden rounded-(--radius-card) bg-[#07070c] shadow-lg shadow-black/40">
        <div
          ref={stageRef}
          tabIndex={-1}
          role="img"
          aria-label={g.screen}
          className="absolute inset-0 touch-none outline-none"
        />
        {phase !== "playing" && (
          <p className="absolute inset-0 grid place-items-center p-6 text-center font-display text-xl">
            {phase === "loading" ? g.loading : g.noWebgl}
          </p>
        )}
        {phase === "playing" && hud.countdown > 0 && (
          <p
            key={hud.countdown}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid animate-pop place-items-center font-display text-8xl font-bold text-foreground [text-shadow:0_6px_0_#7c3aed,0_0_30px_#a78bfa] sm:text-9xl"
          >
            {hud.countdown}
          </p>
        )}
        {banner && (
          <p
            key={banner.id}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid animate-pop place-items-center font-display text-6xl font-bold text-sun [text-shadow:0_4px_0_#1d4ed8,0_0_24px_#1d5cff] sm:text-8xl"
          >
            {banner.text}
          </p>
        )}
      </div>
      {mode === "cpu" && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div
            aria-label={g.move}
            role="group"
            className="relative grid size-32 shrink-0 touch-none select-none place-items-center rounded-full bg-muted"
            {...stickHandlers}
          >
            <span ref={knobRef} aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#32324a] shadow-[0_4px_0_0_#15152a]">
              <Icon name="arrow-up" className="size-6 text-muted-foreground" />
            </span>
          </div>
          <div className="flex gap-3">
            <button type="button" className={`${control} bg-muted px-5 text-foreground`} data-action="dash" {...holdHandlers}>
              {g.dash}
            </button>
            <button
              type="button"
              className={`${control} bg-accent px-6 text-on-accent shadow-[0_5px_0_0_#9f1239] active:shadow-[0_1px_0_0_#9f1239]`}
              data-action="fire"
              {...holdHandlers}
            >
              <span className="flex items-center gap-2">
                <Icon name="zap" className="size-7" />
                {g.fire}
              </span>
            </button>
          </div>
        </div>
      )}
      <p className="mt-4 text-center text-muted-foreground">
        {mode === "cpu" ? (
          g.keysCpu
        ) : (
          <>
            {g.keysP1}
            <br />
            {g.keysP2}
          </>
        )}
      </p>
    </div>
  );
}
