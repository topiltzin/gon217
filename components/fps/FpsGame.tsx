"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import type { Game, GameMessage, GameState, Hud, Stats } from "@/games/fps/Game";
import styles from "./fps.module.css";

type Phase = GameState | "LOADING" | "UNSUPPORTED" | "NO_WEBGL";

const PREFS_KEY = "gks:fps:prefs";

function readPrefs(): { crt: boolean; muted: boolean } {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return { crt: v?.crt !== false, muted: v?.muted === true };
  } catch {
    return { crt: true, muted: false };
  }
}

function savePrefs(prefs: { crt: boolean; muted: boolean }) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: settings just won't be remembered.
  }
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * RUSTFALL's screen. The engine (and Three.js) is imported only in the
 * browser, only on this page. React holds just the UI: game state, HUD numbers
 * and one-off effects. Positions, AI and animation live in the engine.
 */
export function FpsGame() {
  const t = useT();
  const locale = useLocale();
  const f = t.fps;
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const focusRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("LOADING");
  const [hud, setHud] = useState<Hud | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [prefs, setPrefs] = useState({ crt: true, muted: false });
  const [message, setMessage] = useState<{ id: number; key: GameMessage } | null>(null);
  const [hit, setHit] = useState<{ id: number; kill: boolean } | null>(null);
  const [damage, setDamage] = useState(0);
  const [runs, setRuns] = useState(0);
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    let game: Game | null = null;
    let cancelled = false;
    const fine = window.matchMedia("(any-pointer: fine)").matches;
    if (!fine) {
      queueMicrotask(() => !cancelled && setPhase("UNSUPPORTED"));
      return () => {
        cancelled = true;
      };
    }
    import("@/games/fps/Game").then(({ Game: GameClass }) => {
      if (cancelled || !containerRef.current) return;
      const initial = readPrefs();
      setPrefs(initial);
      try {
        game = new GameClass(
          containerRef.current,
          {
            onState: (state, s) => {
              setPhase(state);
              setStats(s);
              if (state === "PLAYING") setRuns((n) => n + 1);
            },
            onHud: setHud,
            onHit: (kill) => setHit((h) => ({ id: (h?.id ?? 0) + 1, kill })),
            onDamage: () => setDamage((n) => n + 1),
            onMessage: (key) => setMessage((m) => ({ id: (m?.id ?? 0) + 1, key })),
            onFps: process.env.NODE_ENV === "development" ? setFps : undefined,
          },
          initial,
        );
      } catch {
        setPhase("NO_WEBGL");
        return;
      }
      gameRef.current = game;
      setPhase("MENU");
    });
    return () => {
      cancelled = true;
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  // Keyboard users land on the main button of each overlay.
  useEffect(() => {
    focusRef.current?.focus();
  }, [phase]);

  const updatePrefs = useCallback((next: { crt: boolean; muted: boolean }) => {
    setPrefs(next);
    savePrefs(next);
    gameRef.current?.setCrt(next.crt);
    gameRef.current?.setMuted(next.muted);
  }, []);

  const lowHealth = hud !== null && hud.health > 0 && hud.health <= 25;
  const overlay = phase !== "PLAYING";

  return (
    <div className={`${styles.screen} fixed inset-0 z-50 select-none bg-black`}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* ---------- HUD (never catches the mouse) ---------- */}
      {hud && (phase === "PLAYING" || phase === "PAUSED") && (
        <div className="pointer-events-none absolute inset-0" aria-hidden={overlay}>
          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2">
            <span className="absolute top-1/2 left-0 h-0.5 w-1.5 -translate-y-1/2 bg-[#f5e6c8]" />
            <span className="absolute top-1/2 right-0 h-0.5 w-1.5 -translate-y-1/2 bg-[#f5e6c8]" />
            <span className="absolute top-0 left-1/2 h-1.5 w-0.5 -translate-x-1/2 bg-[#f5e6c8]" />
            <span className="absolute bottom-0 left-1/2 h-1.5 w-0.5 -translate-x-1/2 bg-[#f5e6c8]" />
          </div>
          {hit && (
            <div
              key={hit.id}
              className={`${styles.hitmarker} absolute top-1/2 left-1/2 -mt-4 -ml-4 size-8`}
              style={{ transform: "rotate(45deg)" }}
            >
              <span className={`absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 ${hit.kill ? "bg-[#ff3b1f]" : "bg-white"}`} />
              <span className={`absolute top-0 left-1/2 h-full w-1 -translate-x-1/2 ${hit.kill ? "bg-[#ff3b1f]" : "bg-white"}`} />
              <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 bg-black" />
            </div>
          )}

          {/* Damage: brief red flash plus a vignette that stays while health is low */}
          {damage > 0 && (
            <div
              key={damage}
              className={`${styles.damage} absolute inset-0`}
              style={{ background: "radial-gradient(ellipse at center, rgb(255 0 0 / 0.12) 30%, rgb(160 0 0 / 0.65) 100%)" }}
            />
          )}
          {lowHealth && (
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgb(140 0 0 / 0.45) 100%)" }}
            />
          )}

          {message && (
            <p
              key={message.id}
              role="status"
              className={`${styles.message} ${styles.hudLabel} absolute top-6 left-1/2 w-max max-w-[90vw] -translate-x-1/2 text-center !text-sm !text-[#ffe08a]`}
            >
              {f.messages[message.key]}
            </p>
          )}

          {runs === 1 && phase === "PLAYING" && (
            <p className={`${styles.hint} ${styles.hudLabel} absolute top-16 left-1/2 w-max max-w-[92vw] -translate-x-1/2 text-center`}>
              {f.hint}
            </p>
          )}

          {/* Bottom corners, leaving the centre to the weapon */}
          <div className={`${styles.panel} absolute bottom-3 left-3 flex gap-5 px-4 py-3`}>
            <div>
              <p className={styles.hudLabel}>{f.hud.health}</p>
              <p className={styles.hudNumber}>{hud.health}%</p>
            </div>
            <div>
              <p className={styles.hudLabel}>{f.hud.armor}</p>
              <p className={`${styles.hudNumber} !text-[#4ade80]`}>{hud.armor}%</p>
            </div>
            {hud.hasKey && (
              <div>
                <p className={styles.hudLabel}>{f.hud.key}</p>
                <p className="mt-1 h-5 w-8 border-2 border-black bg-[#b3160f]" />
              </div>
            )}
          </div>
          <div className={`${styles.panel} absolute right-3 bottom-3 px-4 py-3 text-right`}>
            <p className={styles.hudLabel}>
              {f.hud.weapons[hud.weapon]}
              {hud.hasShotgun && <span className="ml-2 text-[#8f7c68]">1·2</span>}
            </p>
            <p className={`${styles.hudNumber} !text-[#ffb13b]`}>
              {hud.reloading ? <span className="text-[0.6em]">{f.hud.reloading}</span> : hud.mag}
              <span className="text-[0.55em] text-[#d8cfae]"> / {hud.reserve}</span>
            </p>
            <p className={styles.hudLabel}>{f.hud.ammo}</p>
          </div>

          {fps !== null && <p className="absolute top-2 right-2 text-[10px] text-[#4ade80]">{fps} FPS</p>}
        </div>
      )}

      {/* ---------- Overlays ---------- */}
      {phase === "LOADING" && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="animate-pulse">LOADING…</p>
        </div>
      )}

      {phase === "MENU" && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
          <div className={`${styles.panel} flex max-w-lg flex-col items-center gap-6 p-8 text-center`}>
            <h1 className={`${styles.logo} !text-4xl`}>{f.title}</h1>
            <button ref={focusRef} type="button" className={styles.button} onClick={() => void gameRef.current?.start()}>
              {f.start}
            </button>
            <p className="text-[0.6rem] leading-relaxed text-[#d8cfae]">{f.startHint}</p>
            <p className="text-[0.6rem] leading-relaxed text-[#8f7c68]">{f.hint}</p>
            <MessageLine message={message} text={message ? f.messages[message.key] : ""} />
            <Link href={`/${locale}/play`} className="text-xs text-[#ffb13b] underline underline-offset-4">
              {f.menu.back}
            </Link>
          </div>
        </div>
      )}

      {phase === "PAUSED" && (
        <Overlay title={f.paused}>
          <button ref={focusRef} type="button" className={styles.button} onClick={() => void gameRef.current?.resume()}>
            {f.resume}
          </button>
          <button type="button" className={styles.button} onClick={() => void gameRef.current?.restart()}>
            {f.restart}
          </button>
          <button
            type="button"
            aria-pressed={prefs.crt}
            className={styles.button}
            onClick={() => updatePrefs({ ...prefs, crt: !prefs.crt })}
          >
            {f.crt(prefs.crt)}
          </button>
          <button
            type="button"
            aria-pressed={!prefs.muted}
            className={styles.button}
            onClick={() => updatePrefs({ ...prefs, muted: !prefs.muted })}
          >
            {f.sound(prefs.muted)}
          </button>
          <MessageLine message={message} text={message ? f.messages[message.key] : ""} />
          <Link href={`/${locale}/play`} className="text-xs text-[#ffb13b] underline underline-offset-4">
            {f.quit}
          </Link>
        </Overlay>
      )}

      {(phase === "GAME_OVER" || phase === "VICTORY") && stats && (
        <Overlay title={phase === "VICTORY" ? f.victory : f.gameOver} danger={phase === "GAME_OVER"}>
          <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 text-left text-xs">
            <dt className="text-[#d8cfae]">{f.stats.time}</dt>
            <dd className="text-right">{formatTime(stats.seconds)}</dd>
            <dt className="text-[#d8cfae]">{f.stats.kills}</dt>
            <dd className="text-right">
              {stats.kills} / {stats.enemies}
            </dd>
            <dt className="text-[#d8cfae]">{f.stats.secrets}</dt>
            <dd className="text-right">
              {stats.secrets} / {stats.totalSecrets}
            </dd>
            <dt className="text-[#d8cfae]">{f.stats.accuracy}</dt>
            <dd className="text-right">{stats.accuracy}%</dd>
          </dl>
          <button ref={focusRef} type="button" className={styles.button} onClick={() => void gameRef.current?.restart()}>
            {f.restart}
          </button>
          <MessageLine message={message} text={message ? f.messages[message.key] : ""} />
          <Link href={`/${locale}/play`} className="text-xs text-[#ffb13b] underline underline-offset-4">
            {f.quit}
          </Link>
        </Overlay>
      )}

      {(phase === "UNSUPPORTED" || phase === "NO_WEBGL") && (
        <Overlay title={f.unsupported.title}>
          <p className="text-xs leading-relaxed">{phase === "NO_WEBGL" ? f.unsupported.noWebgl : f.unsupported.body}</p>
          <Link href={`/${locale}/play`} className={styles.button}>
            {f.menu.back}
          </Link>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ title, danger = false, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/70 p-4">
      <section
        aria-labelledby="fps-overlay-title"
        className={`${styles.panel} flex w-full max-w-md flex-col items-center gap-4 p-6 text-center sm:p-8`}
      >
        <h1 id="fps-overlay-title" className={`${styles.logo} !text-2xl sm:!text-3xl ${danger ? "!text-[#ff3b1f]" : ""}`}>
          {title}
        </h1>
        {children}
      </section>
    </div>
  );
}

/** Shows "click again" style notices on menus, where the HUD isn't visible. */
function MessageLine({ message, text }: { message: { id: number; key: GameMessage } | null; text: string }) {
  if (!message || message.key !== "lockFailed") return null;
  return (
    <p role="status" className="text-[0.6rem] text-[#ffe08a]">
      {text}
    </p>
  );
}
