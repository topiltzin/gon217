"use client";

import { useSyncExternalStore } from "react";
import { readBest, subscribe } from "@/lib/storage";

/** The stored best score for a game, or null (always null during server render). */
export function useBestScore(slug: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => readBest(slug)?.best ?? null,
    () => null,
  );
}
