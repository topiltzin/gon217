import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPanel } from "@/components/player/PlayerPanel";
import { gameScoring } from "@/games/scoring";
import { getPlayableGames } from "@/lib/content";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/player">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).player.title } : {};
}

export default async function PlayerPage({ params }: PageProps<"/[lang]/player">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const games = getPlayableGames(lang)
    .filter((g) => gameScoring[g.slug])
    .map((g) => ({ slug: g.slug, title: g.title, unit: gameScoring[g.slug].unit }));
  return <PlayerPanel games={games} />;
}
