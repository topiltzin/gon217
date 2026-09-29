"use client";

import { type KeyboardEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import {
  COLS,
  type GardenState,
  PLANTS,
  type PlantKind,
  ROWS,
  canPlace,
  createGame,
  place,
  step,
  wave,
} from "./logic";

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const RESULT_DELAY_MS = 900;
const KINDS: PlantKind[] = ["sunflower", "peashooter", "wall"];

const PLANT_LOOK: Record<PlantKind, { icon: "flower" | "sprout" | "brick-wall"; className: string }> = {
  sunflower: { icon: "flower", className: "bg-sun text-on-sun" },
  peashooter: { icon: "sprout", className: "bg-mint text-on-mint" },
  wall: { icon: "brick-wall", className: "bg-secondary text-on-secondary" },
};

export default function GardenGuard({ onFinish }: GameProps) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GardenState | null>(null);
  const [state, setState] = useState<GardenState>(() => createGame(Math.random));
  const [selected, setSelected] = useState<PlantKind>("sunflower");
  const [focus, setFocus] = useState({ row: 2, col: 0 });
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fixed-step loop. The latest state lives in a ref so planting (an event) and ticking (a frame) never race.
  useEffect(() => {
    stateRef.current = state;
    let last = performance.now();
    let acc = 0;
    let frame = 0;
    const loop = () => {
      // Read the clock here rather than trusting the rAF timestamp, whose time base can differ.
      const now = performance.now();
      acc += Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME);
      last = now;
      let s = stateRef.current!;
      while (acc >= STEP) {
        s = step(s, STEP);
        acc -= STEP;
      }
      stateRef.current = s;
      setState(s);
      if (s.status === "playing") frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // The loop reads state through the ref; it only needs to start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = useEffectEvent(() =>
    onFinish({
      headline: state.status === "won" ? t.garden.won : t.garden.lost,
      detail: t.garden.detail(state.shooed),
      score: state.shooed,
    }),
  );

  useEffect(() => {
    if (state.status === "playing") return;
    const timer = setTimeout(report, RESULT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.status]);

  // Number keys pick a plant while focus is inside the game.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const index = ["1", "2", "3"].indexOf(e.key);
      const active = document.activeElement;
      const onGame =
        !active || active === document.body || active.tagName === "H1" || !!rootRef.current?.contains(active);
      if (index >= 0 && onGame) setSelected(KINDS[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function plantAt(row: number, col: number) {
    const current = stateRef.current;
    if (!current) return;
    const next = place(current, row, col, selected);
    if (next === current) return;
    stateRef.current = next;
    setState(next);
  }

  // Arrow keys move around the garden (one tab stop for the whole grid).
  function onCellKey(e: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const row = Math.min(ROWS - 1, Math.max(0, focus.row + move[0]));
    const col = Math.min(COLS - 1, Math.max(0, focus.col + move[1]));
    setFocus({ row, col });
    cellRefs.current[row * COLS + col]?.focus();
  }

  const currentWave = wave(state);

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl">
      <div className="mb-3 flex flex-wrap justify-center gap-2 font-display text-lg font-semibold sm:gap-3 sm:text-xl">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2 sm:px-4">
          <Icon name="sun" className="size-5 text-sun" />
          <span className="sr-only">{t.garden.sun}: </span>
          {state.sun}
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2 sm:px-4">
          <Icon name="heart" className="size-5 text-accent" />
          <span className="sr-only">{t.garden.hearts}: </span>
          {state.hearts}
        </span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2 sm:px-4">
          <Icon name="snail" className="size-5 text-sky" />
          <span className="sr-only">{t.garden.shooed}: </span>
          {state.shooed}
        </span>
        <span className="rounded-2xl bg-card px-3 py-2 sm:px-4">{t.garden.wave(currentWave, 3)}</span>
      </div>
      <p role="status" className="sr-only">
        {t.garden.status(state.hearts, currentWave)}
      </p>

      {/* Plant picker */}
      <div role="group" aria-label={t.garden.pick} className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
        {KINDS.map((kind, i) => {
          const affordable = state.sun >= PLANTS[kind].cost;
          const look = PLANT_LOOK[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={selected === kind}
              onClick={() => setSelected(kind)}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-4 p-2 transition-colors duration-(--duration-fast) sm:flex-row sm:gap-3 ${
                selected === kind ? "border-sun bg-muted" : "border-transparent bg-card"
              } ${affordable ? "" : "opacity-60"}`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${look.className}`}>
                <Icon name={look.icon} className="size-6" />
              </span>
              <span className="text-center sm:text-left">
                <span className="block text-sm font-extrabold leading-tight sm:text-base">
                  <span aria-hidden="true">{i + 1}. </span>
                  {t.garden.plants[kind]}
                </span>
                <span className="flex items-center justify-center gap-1 text-sm text-sun sm:justify-start">
                  <Icon name="sun" className="size-4" />
                  {PLANTS[kind].cost}
                  <span className="sr-only"> {t.garden.sun}. {t.garden.hints[kind]}.</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Garden */}
      <div
        role="grid"
        aria-label={t.garden.garden}
        className="overflow-hidden rounded-(--radius-card) border-4 border-[#065f46] bg-[#065f46]"
      >
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} role="row" className="relative flex">
            <div
              aria-hidden="true"
              className="grid w-7 shrink-0 place-items-center bg-[#4c1d95] text-secondary sm:w-10"
            >
              <Icon name="home" className="size-4 sm:size-6" />
            </div>
            <div className="relative grid flex-1 grid-cols-7">
              {Array.from({ length: COLS }, (_, col) => {
                const plant = state.plants[row][col];
                const look = plant ? PLANT_LOOK[plant.kind] : null;
                const isFocus = focus.row === row && focus.col === col;
                const placeable = canPlace(state, row, col, selected);
                return (
                  <div key={col} role="gridcell" className="aspect-square">
                    <button
                      ref={(el) => {
                        cellRefs.current[row * COLS + col] = el;
                      }}
                      type="button"
                      tabIndex={isFocus ? 0 : -1}
                      aria-label={t.garden.cell(row + 1, col + 1, plant ? t.garden.plants[plant.kind] : null)}
                      aria-disabled={!placeable}
                      onFocus={() => setFocus({ row, col })}
                      onClick={() => plantAt(row, col)}
                      onKeyDown={onCellKey}
                      className={`grid size-full place-items-center ${
                        (row + col) % 2 === 0 ? "bg-[#15803d]" : "bg-[#166534]"
                      } ${placeable ? "cursor-pointer hover:brightness-125" : "cursor-default"}`}
                    >
                      {plant && look && (
                        <span className="relative grid size-4/5 animate-pop place-items-center">
                          <span className={`grid size-full place-items-center rounded-2xl ${look.className}`}>
                            <Icon name={look.icon} className="size-3/5" />
                          </span>
                          {plant.hp < PLANTS[plant.kind].hp && (
                            <span className="absolute -bottom-1 left-1 right-1 h-1.5 overflow-hidden rounded-full bg-black/50">
                              <span
                                className="block h-full bg-accent"
                                style={{ width: `${(plant.hp / PLANTS[plant.kind].hp) * 100}%` }}
                              />
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Snails, peas, and poofs are drawn over the row and ignore the pointer. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                {state.peas
                  .filter((p) => p.row === row)
                  .map((p) => (
                    <span
                      key={p.id}
                      className="absolute top-1/2 size-[18%] max-h-3 max-w-3 -translate-y-1/2 rounded-full border-2 border-[#14532d] bg-mint"
                      style={{ left: `${(p.x / COLS) * 100}%` }}
                    />
                  ))}
                {state.snails
                  .filter((s) => s.row === row)
                  .map((s) => (
                    <span
                      key={s.id}
                      className="absolute top-[8%] flex h-[84%] w-[13%] flex-col items-center justify-center"
                      style={{ left: `${(s.x / COLS) * 100}%` }}
                    >
                      <span
                        className={`grid size-full place-items-center rounded-full ${
                          s.big ? "bg-accent text-on-accent ring-4 ring-sun" : "bg-sky text-on-sky"
                        } ${s.munching ? "animate-pulse" : ""}`}
                      >
                        <Icon name="snail" className="size-3/5" />
                      </span>
                      <span className="mt-0.5 h-1 w-4/5 overflow-hidden rounded-full bg-black/50">
                        <span className="block h-full bg-sun" style={{ width: `${(s.hp / s.maxHp) * 100}%` }} />
                      </span>
                    </span>
                  ))}
                {state.poofs
                  .filter((p) => p.row === row)
                  .map((p) => (
                    <span
                      key={p.id}
                      className="absolute top-1/4 h-1/2 w-[13%] animate-pop text-sun"
                      style={{ left: `${(p.x / COLS) * 100}%` }}
                    >
                      <Icon name="sparkles" className="size-full" />
                    </span>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-muted-foreground">{t.garden.keyboard}</p>
    </div>
  );
}
