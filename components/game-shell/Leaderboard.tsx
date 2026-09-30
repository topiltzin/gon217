"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { useCurrentPlayer, usePlayer } from "@/components/player/PlayerProvider";
import { Icon } from "@/components/ui/Icon";
import { formatNickname, type Nickname } from "@/lib/player";

type Entry = Nickname & { best: number };

/** Top 10 players for a game. Hidden entirely when accounts are switched off. */
export function Leaderboard({ slug, unit }: { slug: string; unit: string }) {
  const { state, scoresVersion } = usePlayer();
  const me = useCurrentPlayer();
  const t = useT();
  const locale = useLocale();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const available = state.status === "ready";

  useEffect(() => {
    if (!available) return;
    let active = true;
    fetch(`/api/leaderboard/${slug}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => active && setEntries(data.entries))
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [slug, available, scoresVersion]);

  if (!available || entries === null) return null;
  const isMe = (e: Entry) =>
    me && e.adjective === me.adjective && e.animal === me.animal && e.number === me.number;

  return (
    <section
      aria-labelledby={`${slug}-leaders`}
      className="mx-auto mt-6 w-full max-w-md rounded-(--radius-card) bg-card p-6 text-card-foreground"
    >
      <h2 id={`${slug}-leaders`} className="mb-3 flex items-center gap-2 text-2xl font-bold">
        <Icon name="crown" className="size-6 text-sun" />
        {t.player.leaderboard}
      </h2>
      {entries.length === 0 ? (
        <p>{t.player.noLeaders}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {entries.map((e, i) => (
            <li
              key={`${e.adjective}-${e.animal}-${e.number}`}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${isMe(e) ? "bg-muted font-bold text-foreground" : ""}`}
            >
              <span>
                <span className="mr-2 inline-block w-6 text-right text-muted-foreground">
                  {i + 1}.
                </span>
                {formatNickname(e, locale)}
                {isMe(e) && ` (${t.player.you})`}
              </span>
              <span className="shrink-0 font-bold">
                {e.best} {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
