import Link from "next/link";
import { Badge } from "@/components/Badge";
import { glowClass, tileClass } from "@/components/colors";
import { Icon } from "@/components/ui/Icon";
import type { Game } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

export function GameCard({ game, locale }: { game: Game; locale: Locale }) {
  const comingSoon = game.status === "coming-soon";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-16 shrink-0 place-items-center rounded-2xl ${tileClass[game.color]}`}>
          <Icon name={comingSoon ? "lock" : game.icon} className="size-9" />
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {game.featured && !comingSoon && <Badge kind="featured" locale={locale} />}
          {game.status === "new" && <Badge kind="new" locale={locale} />}
          {comingSoon && <Badge kind="coming-soon" locale={locale} />}
        </div>
      </div>
      <h3 className="mt-5 text-2xl font-bold">{game.title}</h3>
      <p className="mt-1 text-card-foreground">{game.description}</p>
      {!comingSoon && (
        <span className="mt-auto inline-flex items-center gap-2 pt-5 font-display text-lg font-semibold text-sun">
          <Icon name="play" className="size-5" />
          {getDictionary(locale).play}
        </span>
      )}
    </>
  );

  const shape = "flex h-full min-h-56 flex-col rounded-(--radius-card) border-2 p-6";

  if (comingSoon) {
    // Not a link: it can't be opened yet, so it isn't focusable or clickable.
    return <div className={`${shape} border-dashed border-muted bg-card/60`}>{body}</div>;
  }

  return (
    <Link
      href={`/${locale}/games/${game.slug}`}
      className={`${shape} group cursor-pointer border-transparent bg-card shadow-lg shadow-black/30 transition-[transform,box-shadow,border-color] duration-(--duration-base) ease-out hover:-translate-y-1 hover:border-secondary hover:shadow-2xl active:translate-y-0 ${glowClass[game.color]}`}
    >
      {body}
    </Link>
  );
}
