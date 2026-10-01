import { PCFShadowMap, SRGBColorSpace, WebGLRenderer } from "three";
import { CpuBrain } from "./ai";
import { GonzAudio } from "./audio";
import { createGame, step, type Difficulty, type GameEvent, type GonzState, type Input } from "./logic";
import type { Character } from "./models";
import { View } from "./view";

export type Mode = "cpu" | "duo";

export type Hud = {
  hp: [number, number];
  kos: [number, number];
  triple: [boolean, boolean];
  alive: [boolean, boolean];
  /** 3, 2, 1 before the fight; 0 once it's on. */
  countdown: number;
};

export type EngineOptions = {
  mode: Mode;
  difficulty: Difficulty;
  characters: [Character, Character];
  tags: [string, string];
  reducedMotion: boolean;
};

export type EngineEvents = {
  onHud: (hud: Hud) => void;
  onEvent: (event: GameEvent) => void;
  onOver: (state: GonzState) => void;
};

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
/** Let the final knockout play out before reporting the result. */
const OVER_DELAY = 3.2;
/** A tiny freeze on each knockout makes it land harder. */
const HIT_STOP = 0.09;
/** The winning blow plays in slow motion. */
const SLOW_MO = { time: 1.2, scale: 0.3 };

/**
 * Owns the renderer and the loop: a fixed 60 Hz simulation, drawn every
 * animation frame. Human input is read through `readInput` each step; in
 * "cpu" mode the second fighter is driven by CpuBrain.
 */
export class Engine {
  private readonly renderer: WebGLRenderer;
  private readonly view: View;
  private readonly audio = new GonzAudio();
  private readonly brain: CpuBrain | null;
  private readonly resizeObserver: ResizeObserver;
  private state: GonzState = createGame();
  private frameId = 0;
  private last = performance.now();
  private acc = 0;
  private overFor = 0;
  private freeze = 0;
  private paused = false;
  private countedIn = false;
  private slowMo = 0;
  private reported = false;
  private lastHud = "";

  constructor(
    private readonly container: HTMLElement,
    private readonly options: EngineOptions,
    private readonly readInput: () => [Input, Input],
    private readonly events: EngineEvents,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    this.view = new View(options.characters, options.tags, options.reducedMotion);
    this.brain = options.mode === "cpu" ? new CpuBrain(1, Math.random, options.difficulty) : null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.emitHud();
    this.frameId = requestAnimationFrame(this.frame);
  }

  /** Call from a click or key handler so the browser allows sound. */
  unlockAudio() {
    this.audio.unlock();
    // The first "3" of the countdown has no step event; beep it once sound is allowed.
    if (!this.countedIn && this.state.countdown > 2) {
      this.countedIn = true;
      this.audio.play("count");
    }
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  /** Freezes the game (it keeps drawing the last frame). */
  setPaused(paused: boolean) {
    this.paused = paused;
    this.last = performance.now();
    this.acc = 0;
  }


  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.view.setAspect(w / h);
  }

  private readonly frame = () => {
    this.frameId = requestAnimationFrame(this.frame);
    const now = performance.now();
    const elapsed = Math.min(Math.max((now - this.last) / 1000, 0), MAX_FRAME);
    this.last = now;
    let simTime = elapsed;
    if (this.paused) {
      simTime = 0;
    } else if (this.freeze > 0) {
      simTime = 0;
      this.freeze -= elapsed;
    } else if (this.slowMo > 0) {
      simTime = elapsed * SLOW_MO.scale;
      this.slowMo -= elapsed;
    }
    this.acc += simTime;
    while (this.acc >= STEP) {
      this.tick();
      this.acc -= STEP;
    }
    if (this.state.status === "over" && !this.reported && !this.paused) {
      this.overFor += elapsed;
      if (this.overFor >= OVER_DELAY) {
        this.reported = true;
        this.events.onOver(this.state);
      }
    }
    this.view.draw(this.state, this.paused ? 0 : simTime > 0 ? simTime : elapsed * 0.05);
    this.renderer.render(this.view.scene, this.view.camera);
  };

  private tick() {
    const s = this.state;
    const [p1, p2] = this.readInput();
    const second = this.brain ? this.brain.input(s, STEP) : p2;
    step(s, [p1, second], STEP, Math.random);
    if (s.events.length) {
      this.view.react(s.events, s);
      for (const e of s.events) {
        this.audio.play(e.type);
        this.events.onEvent(e);
        if (e.type === "ko") this.freeze = HIT_STOP;
        if (e.type === "win" && !this.options.reducedMotion) this.slowMo = SLOW_MO.time;
      }
    }
    this.emitHud();
  }

  private emitHud() {
    const [a, b] = this.state.fighters;
    const hud: Hud = {
      hp: [a.hp, b.hp],
      kos: [a.kos, b.kos],
      triple: [a.triple > 0, b.triple > 0],
      alive: [a.alive, b.alive],
      countdown: Math.ceil(this.state.countdown),
    };
    const key = JSON.stringify(hud);
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.events.onHud(hud);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.view.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.audio.dispose();
  }
}
