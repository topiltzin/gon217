"use client";

import { type KeyboardEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { GameProps } from "@/games/types";
import { BoomArt, HouseArt, MowerArt, Pea, PlantArt, SnailArt, SunDropArt } from "./art";
import {
  COLS,
  type GardenState,
  PLANTS,
  type PlantKind,
  ROWS,
  canPlace,
  collect,
  collectAll,
  createGame,
  place,
  step,
  wave,
} from "./logic";

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const RESULT_DELAY_MS = 900;
const KINDS: PlantKind[] = ["sunflower", "peashooter", "wall", "chili"];
const WAVES = 3;

// Idle motion per plant: flowers sway, the chili shakes before it blows.
const PLANT_MOTION: Record<PlantKind, string> = {
  sunflower: "origin-bottom animate-sway",
  peashooter: "origin-bottom animate-sway [animation-delay:-1.3s]",
  wall: "",
  chili: "animate-shake",
};

export default function GardenGuard({ onFinish }: GameProps) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GardenState | null>(null);
  const [state, setState] = useState<GardenState>(() => createGame(Math.random));
  const [selected, setSelected] = useState<PlantKind>("sunflower");
  const [focus, setFocus] = useState({ row: 2, col: 0 });
  const [banner, setBanner] = useState<number | null>(null);
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

  // Number keys pick a plant and S collects sunshine, while focus is inside the game.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const index = ["1", "2", "3", "4"].indexOf(e.key);
      const active = document.activeElement;
      const onGame =
        !active || active === document.body || active.tagName === "H1" || !!rootRef.current?.contains(active);
      if (!onGame) return;
      if (index >= 0) setSelected(KINDS[index]);
      if (e.key === "s" || e.key === "S") update(collectAll);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Applies a player action to the latest state (the ref, so it never races the loop). */
  function update(action: (s: GardenState) => GardenState) {
    const current = stateRef.current;
    if (!current) return;
    const next = action(current);
    if (next === current) return;
    stateRef.current = next;
    setState(next);
  }

  function plantAt(row: number, col: number) {
    update((s) => place(s, row, col, selected));
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

  // A big "Wave 2!" banner when a new wave starts.
  const shownWave = useRef(1);
  useEffect(() => {
    if (currentWave === shownWave.current) return;
    shownWave.current = currentWave;
    setBanner(currentWave);
    const timer = setTimeout(() => setBanner(null), 1800);
    return () => clearTimeout(timer);
  }, [currentWave]);

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
        <span className="rounded-2xl bg-card px-3 py-2 sm:px-4">{t.garden.wave(currentWave, WAVES)}</span>
      </div>
      <p role="status" className="sr-only">
        {t.garden.status(state.hearts, currentWave)}
      </p>

      {/* Plant picker */}
      <div role="group" aria-label={t.garden.pick} className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {KINDS.map((kind, i) => {
          const affordable = state.sun >= PLANTS[kind].cost;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={selected === kind}
              onClick={() => setSelected(kind)}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-4 p-2 transition-colors duration-(--duration-fast) sm:flex-col md:flex-row md:gap-2 ${
                selected === kind ? "border-sun bg-muted" : "border-transparent bg-card"
              } ${affordable ? "" : "opacity-60"}`}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#2f9e44]">
                <PlantArt kind={kind} className="size-11" />
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
      <div className="relative">
        <div
          role="grid"
          aria-label={t.garden.garden}
          className="overflow-hidden rounded-(--radius-card) border-4 border-[#5c3d1e] bg-[#2b8a3e] shadow-lg shadow-black/40"
        >
          {Array.from({ length: ROWS }, (_, row) => {
            const mower = state.mowers[row];
            return (
              <div key={row} role="row" className="relative flex">
                <div aria-hidden="true" className="relative w-7 shrink-0 sm:w-10">
                  <HouseArt className="absolute inset-0 size-full" />
                </div>
                <div className="relative grid flex-1 grid-cols-7">
                  {Array.from({ length: COLS }, (_, col) => {
                    const plant = state.plants[row][col];
                    const isFocus = focus.row === row && focus.col === col;
                    const placeable = canPlace(state, row, col, selected);
                    const health = plant ? plant.hp / PLANTS[plant.kind].hp : 1;
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
                          className={`relative grid size-full place-items-center ${
                            (row + col) % 2 === 0 ? "bg-[#40c057]" : "bg-[#37b24d]"
                          } bg-[repeating-linear-gradient(100deg,transparent_0_6px,rgba(0,0,0,0.06)_6px_8px)] ${
                            placeable ? "cursor-pointer hover:brightness-110" : "cursor-default"
                          }`}
                        >
                          {plant && (
                            <span className="relative grid size-[92%] animate-pop place-items-center">
                              <span className={`size-full ${PLANT_MOTION[plant.kind]}`}>
                                <PlantArt kind={plant.kind} health={health} className="size-full drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]" />
                              </span>
                              {plant.kind !== "chili" && health < 1 && (
                                <span className="absolute -bottom-0.5 left-1 right-1 h-1.5 overflow-hidden rounded-full bg-black/50">
                                  <span className="block h-full bg-accent" style={{ width: `${health * 100}%` }} />
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}

                  {/* Snails, peas, mowers and effects are drawn over the row and ignore the pointer. */}
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    {mower.state !== "used" && (
                      <span
                        className="absolute top-[30%] z-10 h-[55%] w-[11%]"
                        style={{ left: `${((mower.state === "running" ? mower.x : -0.62) / COLS) * 100}%` }}
                      >
                        <MowerArt className="size-full drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" />
                      </span>
                    )}
                    {state.peas
                      .filter((p) => p.row === row)
                      .map((p) => (
                        <span key={p.id} className="absolute top-[26%] size-[5%] min-h-2.5 min-w-2.5" style={{ left: `${(p.x / COLS) * 100}%` }}>
                          <Pea className="size-full" />
                        </span>
                      ))}
                    {state.snails
                      .filter((s) => s.row === row)
                      .map((s) => (
                        <span
                          key={s.id}
                          className={`absolute flex flex-col items-center justify-end ${s.big ? "top-0 h-full w-[16%]" : "top-[10%] h-[88%] w-[14%]"}`}
                          style={{ left: `${(s.x / COLS) * 100}%` }}
                        >
                          <span className={`w-full flex-1 origin-bottom-left ${s.munching ? "animate-munch" : "animate-crawl"}`}>
                            <SnailArt big={s.big} fast={s.fast} className="size-full drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]" />
                          </span>
                          <span className="mb-0.5 h-1 w-4/5 overflow-hidden rounded-full bg-black/50">
                            <span className="block h-full bg-sun" style={{ width: `${(s.hp / s.maxHp) * 100}%` }} />
                          </span>
                        </span>
                      ))}
                    {state.poofs
                      .filter((p) => p.row === row)
                      .map((p) => (
                        <span
                          key={p.id}
                          className="absolute top-1/4 h-1/2 w-[13%] animate-pop text-white"
                          style={{ left: `${(Math.max(0, p.x) / COLS) * 100}%` }}
                        >
                          <Icon name="sparkles" className="size-full" />
                        </span>
                      ))}
                    {state.booms
                      .filter((b) => b.row === row)
                      .map((b) => (
                        <span
                          key={b.id}
                          className="absolute top-[-100%] z-20 h-[300%] w-[43%] animate-pop"
                          style={{ left: `${((b.col - 1) / COLS) * 100}%` }}
                        >
                          <BoomArt className="size-full" />
                        </span>
                      ))}
                  </div>

                  {/* Sunshine to tap */}
                  {state.suns
                    .filter((d) => d.row === row)
                    .map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        tabIndex={-1}
                        aria-label={t.garden.collect}
                        onClick={() => update((s) => collect(s, d.id))}
                        className="absolute top-0 z-30 aspect-square w-[14.28%] cursor-pointer"
                        style={{ left: `${(d.col / COLS) * 100}%` }}
                      >
                        {/* The whole cell is the tap target; the sun itself sits in the top corner, off the plant. */}
                        <span className="absolute right-0 top-0 block size-3/5 animate-drop">
                          <SunDropArt className="size-full" />
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
        {banner !== null && (
          <p
            aria-hidden="true"
            key={banner}
            className="pointer-events-none absolute inset-0 grid animate-pop place-items-center font-display text-5xl font-bold text-sun [text-shadow:0_4px_0_#5c3d1e,0_0_20px_rgba(0,0,0,0.6)] sm:text-7xl"
          >
            {t.garden.waveBanner(banner, WAVES)}
          </p>
        )}
      </div>
      <p className="mt-4 text-center text-muted-foreground">{t.garden.keyboard}</p>
    </div>
  );
}
