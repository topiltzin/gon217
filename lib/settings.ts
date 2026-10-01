import { useSyncExternalStore } from "react";

/**
 * Device settings shared by every game (just sound for now). Stored in
 * localStorage, every access guarded, so blocked storage means "defaults".
 */

const SOUND_KEY = "gks:sound";
const listeners = new Set<() => void>();
// Remembers the choice even when storage is blocked.
let memory: boolean | null = null;

export function isSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  memory = on;
  listeners.forEach((l) => l());
}

const read = () => memory ?? isSoundOn();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === SOUND_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether game sound is on. Always true during server render. */
export function useSoundOn(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}

export { read as soundOn };
