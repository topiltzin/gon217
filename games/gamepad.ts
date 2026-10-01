/**
 * Game controller support through the Gamepad API (no permission needed,
 * nothing leaves the browser). Standard mapping: left stick or d-pad moves,
 * A (0) or right trigger (7) is the main button, B (1) or a bumper (4/5) the
 * second one, Y (3) the third, Start (9) pauses.
 */

export type Pad = { x: number; y: number; a: boolean; b: boolean; y3: boolean; start: boolean };

const DEADZONE = 0.22;

const pressed = (gp: Gamepad, i: number) => !!gp.buttons[i]?.pressed;

/** Reads controller `index` (0 = first plugged in). Null when there is none. `y` is up-positive. */
export function readPad(index: number): Pad | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads().filter((p): p is Gamepad => !!p && p.connected);
  const gp = pads[index];
  if (!gp) return null;
  let x = gp.axes[0] ?? 0;
  let y = -(gp.axes[1] ?? 0);
  if (Math.hypot(x, y) < DEADZONE) x = y = 0;
  if (pressed(gp, 14)) x = -1;
  if (pressed(gp, 15)) x = 1;
  if (pressed(gp, 12)) y = 1;
  if (pressed(gp, 13)) y = -1;
  return {
    x,
    y,
    a: pressed(gp, 0) || pressed(gp, 7),
    b: pressed(gp, 1) || pressed(gp, 4) || pressed(gp, 5) || pressed(gp, 6),
    y3: pressed(gp, 3),
    start: pressed(gp, 9),
  };
}
