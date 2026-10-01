import { Badge } from "@/components/Badge";
import { GameCover } from "@/components/GameCard";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Game } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

/**
 * Stretches the last card so the bottom row has no gap: on md (2 columns) the
 * big card fills a row and the rest pair up; on lg (3 columns) it takes two
 * columns and two rows, so two cards sit beside it and the rest go three a row.
 */
function fillSpan(i: number, count: number): string {
  if (i !== count - 1) return "";
  const md = (count - 1) % 2 === 1 ? "md:col-span-2" : "";
  const rest = count - 3;
  const lg = rest <= 0 ? "lg:col-span-1" : rest % 3 === 1 ? "lg:col-span-3" : rest % 3 === 2 ? "lg:col-span-2" : "lg:col-span-1";
  return `${md} ${lg}`;
}

/** The host's picks as a bento grid: the first one big, the rest beside and below it. */
export function FeaturedGames({ games, hostName, locale }: { games: Game[]; hostName: string; locale: Locale }) {
  if (games.length === 0) return null;
  const t = getDictionary(locale);
  return (
    <section aria-labelledby="featured-heading" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <p className="eyebrow text-sun">{t.badges.featured}</p>
      <h2 id="featured-heading" className="mt-1 text-3xl uppercase sm:text-4xl">
        {t.hostPick(hostName)}
      </h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {games.map((game, i) => {
          const hero = i === 0;
          return (
            <article
              key={game.slug}
              className={`group flex flex-col overflow-hidden rounded-(--radius-card) border bg-card shadow-lg shadow-black/30 ${
                hero ? "border-sun/60 md:col-span-2 lg:row-span-2" : `border-white/10 ${fillSpan(i, games.length)}`
              }`}
            >
              <GameCover game={game} className={hero ? "h-40 sm:h-56 lg:h-72" : "h-28"} />
              <div className="flex flex-1 flex-col items-start p-5 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  <Badge kind="featured" locale={locale} />
                  {game.status === "new" && <Badge kind="new" locale={locale} />}
                </div>
                <h3 className={`mt-3 uppercase ${hero ? "text-3xl sm:text-5xl" : "text-2xl"}`}>{game.title}</h3>
                <p className={`mt-2 text-card-foreground ${hero ? "text-lg" : ""}`}>{game.description}</p>
                <div className="mt-auto pt-5">
                  <ButtonLink href={`/${locale}/games/${game.slug}`} variant="accent">
                    <Icon name="play" />
                    {t.playGame(game.title)}
                  </ButtonLink>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
