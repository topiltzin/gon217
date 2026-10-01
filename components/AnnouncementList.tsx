import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Announcement, Game } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

type Props = {
  announcements: Announcement[];
  games: Pick<Game, "slug" | "title">[];
  hostName: string;
  locale: Locale;
};


export function AnnouncementList({ announcements, games, hostName, locale }: Props) {
  const t = getDictionary(locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <section aria-labelledby="news-heading" className="rounded-(--radius-card) bg-card p-6 sm:p-8">
      <h3 id="news-heading" className="flex items-center gap-2 text-2xl uppercase sm:text-3xl">
        <Icon name="megaphone" className="size-7 text-accent" />
        {t.news}
      </h3>
      {announcements.length === 0 ? (
        <p className="mt-4 text-lg text-card-foreground">
          {t.noNews(hostName)}
        </p>
      ) : (
        <ol className="mt-5 space-y-4">
          {announcements.map((a) => {
            const game = games.find((g) => g.slug === a.gameSlug);
            return (
              <li key={a.id}>
                <article className="rounded-lg border-l-2 border-secondary bg-muted p-5">
                  <time dateTime={a.date} className="eyebrow text-sun">
                    {dateFormat.format(new Date(`${a.date}T00:00:00Z`))}
                  </time>
                  <h4 className="mt-1 font-display text-2xl font-semibold">{a.title}</h4>
                  <p className="mt-2 whitespace-pre-line text-foreground">{a.body}</p>
                  {game && (
                    <Link
                      href={`/${locale}/games/${game.slug}`}
                      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl font-display text-lg font-semibold text-secondary underline-offset-4 hover:underline"
                    >
                      <Icon name="play" className="size-5" />
                      {t.playGame(game.title)}
                    </Link>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
