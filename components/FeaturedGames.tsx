import { Badge } from "@/components/Badge";
import { tileClass } from "@/components/colors";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Game } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

export function FeaturedGames({ games, hostName, locale }: { games: Game[]; hostName: string; locale: Locale }) {
  if (games.length === 0) return null;
  const t = getDictionary(locale);
  return (
    <section aria-labelledby="featured-heading" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <h2 id="featured-heading" className="text-4xl font-bold">
        {t.hostPick(hostName)}
      </h2>
      <div className="mt-6 grid gap-5">
        {games.map((game) => (
          <article
            key={game.slug}
            className="flex flex-col items-start gap-6 rounded-(--radius-card) border-2 border-sun bg-card p-6 sm:flex-row sm:items-center sm:p-8"
          >
            <span className={`grid size-28 shrink-0 place-items-center rounded-[2rem] ${tileClass[game.color]}`}>
              <Icon name={game.icon} className="size-16" />
            </span>
            <div className="flex-1">
              <Badge kind="featured" locale={locale} />
              <h3 className="mt-3 text-3xl font-bold sm:text-4xl">{game.title}</h3>
              <p className="mt-2 text-lg text-card-foreground">{game.description}</p>
            </div>
            <ButtonLink href={`/${locale}/games/${game.slug}`} variant="accent">
              <Icon name="play" />
              {t.playGame(game.title)}
            </ButtonLink>
          </article>
        ))}
      </div>
    </section>
  );
}
