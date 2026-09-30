import { SRGBColorSpace, WebGLRenderer } from "three";
import { AstroAudio } from "./audio";
import { createGame, step, type AstroEvent, type AstroState, type Input } from "./logic";
import { View, type ViewMode } from "./view";

export type Hud = { score: number; lives: number; wave: number; triple: boolean; status: AstroState["status"] };

export type EngineEvents = {
  onHud: (hud: Hud) => void;
  onEvent: (event: AstroEvent) => void;
  onOver: (state: AstroState) => void;
};

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
/** Let the final explosion play out before reporting the result. */
const OVER_DELAY = 1.6;

/** Owns the renderer and a fixed 60 Hz loop. Input is read through `readInput` every step. */
export class Engine {
  private readonly renderer: WebGLRenderer;
  private readonly view: View;
  private readonly audio = new AstroAudio();
  private readonly resizeObserver: ResizeObserver;
  private readonly state: AstroState = createGame();
  private frameId = 0;
  private last = performance.now();
  private acc = 0;
  private overFor = 0;
  private reported = false;
  private lastHud = "";

  constructor(
    private readonly container: HTMLElement,
    mode: ViewMode,
    reducedMotion: boolean,
    private readonly readInput: () => Input,
    private readonly events: EngineEvents,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);
    this.view = new View(reducedMotion);
    this.view.mode = mode;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.emitHud();
    this.frameId = requestAnimationFrame(this.frame);
  }

  unlockAudio() {
    this.audio.unlock();
  }

  setView(mode: ViewMode) {
    this.view.mode = mode;
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
      step(this.state, this.readInput(), STEP, Math.random);
      if (this.state.events.length) {
        this.view.react(this.state.events, this.state);
        for (const e of this.state.events) {
          this.audio.play(e);
          this.events.onEvent(e);
        }
      }
      this.acc -= STEP;
    }
    this.emitHud();
    if (this.state.status === "over" && !this.reported) {
      this.overFor += elapsed;
      if (this.overFor >= OVER_DELAY) {
        this.reported = true;
        this.events.onOver(this.state);
      }
    }
    this.view.draw(this.state, elapsed);
    this.renderer.render(this.view.scene, this.view.camera);
  };

  private emitHud() {
    const s = this.state;
    const hud: Hud = { score: s.score, lives: s.lives, wave: s.wave, triple: s.ship.triple > 0, status: s.status };
    const key = `${hud.score}|${hud.lives}|${hud.wave}|${hud.triple}|${hud.status}`;
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
