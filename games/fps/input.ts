/** Keys the game uses; the browser's default action (scrolling etc.) is blocked for these while playing. */
const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Digit1",
  "Digit2",
  "KeyR",
  "KeyF",
  "KeyQ",
]);

/**
 * Keyboard, mouse and pointer-lock state for the game loop. Uses event.code so
 * WASD works on any keyboard layout. Mouse movement accumulates between frames
 * and is consumed once per frame.
 */
export class Input {
  readonly keys = new Set<string>();
  /** Keys pressed since the last consumePressed(). */
  private readonly pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  fireHeld = false;
  wheel = 0;
  active = false;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("mousemove", this.onMouseMove);
    element.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    element.addEventListener("wheel", this.onWheel, { passive: false });
    element.addEventListener("contextmenu", this.prevent);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.element;
  }

  /** Must be called from a user gesture. Resolves false when the browser refuses (e.g. right after ESC). */
  async lock(): Promise<boolean> {
    if (this.locked) return true;
    try {
      await this.element.requestPointerLock();
      return true;
    } catch {
      return false;
    }
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  consumePressed(code: string): boolean {
    return this.pressed.delete(code);
  }

  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.pressed.clear();
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.fireHeld = false;
    this.endFrame();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.active) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => this.reset();

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.locked && e.button === 0) this.fireHeld = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.fireHeld = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.locked) return;
    e.preventDefault();
    this.wheel += Math.sign(e.deltaY);
  };

  private prevent = (e: Event) => e.preventDefault();

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.element.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.element.removeEventListener("wheel", this.onWheel);
    this.element.removeEventListener("contextmenu", this.prevent);
    this.unlock();
  }
}
