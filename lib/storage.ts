/**
 * Device-local best scores. Nothing here ever leaves the player's browser, and
 * every access is guarded so blocked or corrupt storage just means "no best yet".
 */

export type ScoreDirection = "higher" | "lower";

export type BestScore = { best: number; updatedAt: string };

const PREFIX = "gks:best:";
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readBest(slug: string): BestScore | null {
  try {
    const raw = storage()?.getItem(PREFIX + slug);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value?.best === "number" && Number.isFinite(value.best) ? value : null;
  } catch {
    return null;
  }
}

/** Saves the score if it beats the stored best. Returns true when it did. */
export function recordScore(slug: string, score: number, direction: ScoreDirection): boolean {
  const current = readBest(slug);
  const better =
    !current || (direction === "higher" ? score > current.best : score < current.best);
  if (!better) return false;
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(PREFIX + slug, JSON.stringify({ best: score, updatedAt: new Date().toISOString() }));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

/** For useSyncExternalStore: notifies when a best score changes in this tab or another. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key?.startsWith(PREFIX) && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
