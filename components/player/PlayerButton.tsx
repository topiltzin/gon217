"use client";

import Link from "next/link";
import { useLocale, useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { formatNickname } from "@/lib/player";
import { usePlayer } from "./PlayerProvider";

/** Header link to the player page: "Log in", or the player's name once logged in. */
export function PlayerButton() {
  const { state } = usePlayer();
  const locale = useLocale();
  const t = useT();
  if (state.status === "unavailable") return null;
  const label =
    state.status === "ready" && state.player
      ? formatNickname(state.player, locale)
      : t.player.logIn;

  return (
    <Link
      href={`/${locale}/player`}
      aria-label={label}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-card px-3 font-display text-sm uppercase sm:px-4 sm:text-base sm:tracking-wide transition-colors duration-(--duration-fast) hover:bg-muted sm:px-4"
    >
      <Icon name="user" className="size-5 text-sun" />
      <span className="hidden max-w-48 truncate sm:inline">{label}</span>
    </Link>
  );
}
