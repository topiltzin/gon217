"use client";

import { useSyncExternalStore } from "react";
import { useCurrentPlayer } from "@/components/player/PlayerProvider";
import { readBest, subscribe } from "@/lib/storage";

/**
 * The best score for a game: the logged-in player's saved best, otherwise this
 * device's. Null when there is none (and always during server render).
 */
export function useBestScore(slug: string): number | null {
  const player = useCurrentPlayer();
  const deviceBest = useSyncExternalStore(
    subscribe,
    () => readBest(slug)?.best ?? null,
    () => null,
  );
  return player ? (player.bests[slug] ?? null) : deviceBest;
}
