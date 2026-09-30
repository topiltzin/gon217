"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { gameScoring, isBetter } from "@/games/scoring";
import type { Credentials, Nickname } from "@/lib/player";
import { readBest } from "@/lib/storage";

export type PlayerError = "taken" | "wrong" | "locked" | "invalid" | "unavailable";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; player: Nickname | null; bests: Record<string, number> };

type PlayerContextValue = {
  state: State;
  /** Bumps whenever a saved score changes, so leaderboards know to refetch. */
  scoresVersion: number;
  signUp: (credentials: Credentials) => Promise<PlayerError | null>;
  logIn: (credentials: Credentials) => Promise<PlayerError | null>;
  logOut: () => Promise<void>;
  /** Saves a score for the logged-in player. Returns true if it beats their best. */
  recordPlayerScore: (slug: string, score: number) => boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/**
 * Optional login. Pages stay static; this asks /api/player/me who is logged in.
 * Nobody gets a cookie until they choose to log in or create a player.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [scoresVersion, setScoresVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/player/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        if (!active) return;
        setState(
          data.available
            ? { status: "ready", player: data.player, bests: data.bests }
            : { status: "unavailable" },
        );
      })
      .catch(() => active && setState({ status: "unavailable" }));
    return () => {
      active = false;
    };
  }, []);

  const authenticate = useCallback(
    async (url: string, credentials: Credentials): Promise<PlayerError | null> => {
      try {
        const res = await post(url, credentials);
        const data = await res.json();
        if (!res.ok) return (data.error as PlayerError) ?? "unavailable";
        setState({ status: "ready", player: data.player, bests: data.bests });
        return null;
      } catch {
        return "unavailable";
      }
    },
    [],
  );

  const signUp = useCallback(
    async (credentials: Credentials) => {
      const error = await authenticate("/api/player/signup", credentials);
      if (error) return error;
      // Bring along the best scores already saved on this device.
      const local = Object.keys(gameScoring).flatMap((slug) => {
        const best = readBest(slug)?.best;
        return best === undefined ? [] : [{ slug, score: best }];
      });
      if (local.length) {
        setState((s) =>
          s.status === "ready"
            ? { ...s, bests: Object.fromEntries(local.map((l) => [l.slug, l.score])) }
            : s,
        );
        await Promise.allSettled(local.map((l) => post("/api/scores", l)));
        setScoresVersion((v) => v + 1);
      }
      return null;
    },
    [authenticate],
  );

  const logIn = useCallback(
    (credentials: Credentials) => authenticate("/api/player/login", credentials),
    [authenticate],
  );

  const logOut = useCallback(async () => {
    await post("/api/player/logout").catch(() => undefined);
    setState((s) => (s.status === "ready" ? { status: "ready", player: null, bests: {} } : s));
  }, []);

  const recordPlayerScore = useCallback(
    (slug: string, score: number) => {
      const scoring = gameScoring[slug];
      if (state.status !== "ready" || !state.player || !scoring) return false;
      if (!isBetter(score, state.bests[slug], scoring.direction)) return false;
      setState((s) => (s.status === "ready" ? { ...s, bests: { ...s.bests, [slug]: score } } : s));
      post("/api/scores", { slug, score })
        .then(() => setScoresVersion((v) => v + 1))
        .catch(() => undefined);
      return true;
    },
    [state],
  );

  const value = useMemo(
    () => ({ state, scoresVersion, signUp, logIn, logOut, recordPlayerScore }),
    [state, scoresVersion, signUp, logIn, logOut, recordPlayerScore],
  );
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return value;
}

/** The logged-in player, or null when logged out, loading, or accounts are off. */
export function useCurrentPlayer(): (Nickname & { bests: Record<string, number> }) | null {
  const { state } = usePlayer();
  return state.status === "ready" && state.player ? { ...state.player, bests: state.bests } : null;
}
