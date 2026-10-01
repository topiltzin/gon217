import { notFound } from "next/navigation";
import { AnnouncementList } from "@/components/AnnouncementList";
import { FeaturedGames } from "@/components/FeaturedGames";
import { GameCard } from "@/components/GameCard";
import { Hero } from "@/components/Hero";
import { HostWelcome } from "@/components/HostWelcome";
import { PlayPromo } from "@/components/PlayPromo";
import { VideoList } from "@/components/VideoList";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getAnnouncements, getGames, getSite, getVideos } from "@/lib/content";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const site = getSite(lang);
  const games = getGames(lang);
  const featured = games.filter((g) => g.featured && g.status !== "coming-soon");
  const stats = { games: games.filter((g) => g.status !== "coming-soon").length, fresh: games.filter((g) => g.status === "new").length };

  return (
    <>
      <Hero site={site} locale={lang} stats={stats} />

      <FeaturedGames games={featured} hostName={site.host.name} locale={lang} />

      <PlayPromo locale={lang} />

      <section
        id="games"
        aria-labelledby="games-heading"
        className="mx-auto w-full max-w-6xl scroll-mt-6 px-4 py-10 sm:px-6"
      >
        <h2 id="games-heading" className="text-3xl uppercase sm:text-4xl">
          {t.allGames}
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <li key={game.slug}>
              <GameCard game={game} locale={lang} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="host-heading" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="host-heading" className="text-3xl uppercase sm:text-4xl">
          {t.fromHost(site.host.name)}
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
          <HostWelcome host={site.host} locale={lang} />
          <AnnouncementList
            announcements={getAnnouncements(lang)}
            games={games}
            hostName={site.host.name}
            locale={lang}
          />
        </div>
      </section>

      <VideoList videos={getVideos(lang)} hostName={site.host.name} />

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-(--radius-card) border border-accent/40 bg-card px-6 py-12 text-center shadow-[0_0_60px_rgb(244_63_94/0.15)]">
          <h2 className="text-3xl uppercase sm:text-4xl">{t.anotherRound}</h2>
          <p className="text-lg text-card-foreground">{t.challenge}</p>
          <ButtonLink href="#games" variant="accent">
            <Icon name="play" />
            {t.pickGame}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
