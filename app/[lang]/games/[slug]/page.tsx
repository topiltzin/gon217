import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameShell } from "@/components/game-shell/GameShell";
import { gameRegistry } from "@/games/registry";
import { getGame, getPlayableGames } from "@/lib/content";
import { isLocale } from "@/lib/i18n";

// Only pre-rendered games exist; unknown and coming-soon slugs are 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  const games = getPlayableGames();
  const missing = games.filter((g) => !gameRegistry[g.slug]).map((g) => g.slug);
  if (missing.length) {
    throw new Error(
      `content/games.json lists playable games with no entry in games/registry.ts: ${missing.join(", ")}`,
    );
  }
  return games.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/games/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const game = isLocale(lang) ? getGame(slug, lang) : undefined;
  return game ? { title: game.title, description: game.description } : {};
}

export default async function GamePage({ params }: PageProps<"/[lang]/games/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const game = getGame(slug, lang);
  if (!game || !gameRegistry[slug]) notFound();
  return <GameShell game={game} />;
}
