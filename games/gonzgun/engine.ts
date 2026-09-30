import { PCFShadowMap, SRGBColorSpace, WebGLRenderer } from "three";
import { CpuBrain } from "./ai";
import { GonzAudio } from "./audio";
import { createGame, step, type GameEvent, type GonzState, type Input } from "./logic";
import type { Character } from "./models";
import { View } from "./view";

export type Mode = "cpu" | "duo";

export type Hud = {
  hp: [number, number];
  kos: [number, number];
  triple: [boolean, boolean];
  alive: [boolean, boolean];
};

export type EngineOptions = {
  mode: Mode;
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
const OVER_DELAY = 1.8;

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
    this.brain = options.mode === "cpu" ? new CpuBrain(1, Math.random) : null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.emitHud();
    this.frameId = requestAnimationFrame(this.frame);
  }

  /** Call from a click or key handler so the browser allows sound. */
  unlockAudio() {
    this.audio.unlock();
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
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
    this.acc += elapsed;
    while (this.acc >= STEP) {
      this.tick();
      this.acc -= STEP;
    }
    this.view.draw(this.state, elapsed);
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
      }
    }
    this.emitHud();
    if (s.status === "over" && !this.reported) {
      this.overFor += STEP;
      if (this.overFor >= OVER_DELAY) {
        this.reported = true;
        this.events.onOver(s);
      }
    }
  }

  private emitHud() {
    const [a, b] = this.state.fighters;
    const hud: Hud = {
      hp: [a.hp, b.hp],
      kos: [a.kos, b.kos],
      triple: [a.triple > 0, b.triple > 0],
      alive: [a.alive, b.alive],
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
