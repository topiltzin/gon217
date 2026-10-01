import Link from "next/link";
import { Badge } from "@/components/Badge";
import { coverClass, glowClass, tileClass } from "@/components/colors";
import { Icon } from "@/components/ui/Icon";
import type { Game } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

/** The decorative "cover art" band: a neon gradient, diagonal stripes and the game's icon, big and faint. */
export function GameCover({ game, className = "h-28" }: { game: Game; className?: string }) {
  const comingSoon = game.status === "coming-soon";
  return (
    <div aria-hidden="true" className={`relative overflow-hidden bg-linear-to-br to-transparent ${coverClass[game.color]} ${className}`}>
      <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.05)_0_2px,transparent_2px_14px)]" />
      <Icon
        name={comingSoon ? "lock" : game.icon}
        className="absolute -right-4 -bottom-6 size-32 rotate-[-12deg] text-white/15 transition-transform duration-(--duration-slow) group-hover:scale-110 group-hover:rotate-0"
      />
      <span className={`absolute bottom-3 left-5 grid size-12 place-items-center rounded-lg shadow-lg shadow-black/40 ${tileClass[game.color]}`}>
        <Icon name={comingSoon ? "lock" : game.icon} className="size-7" />
      </span>
    </div>
  );
}

export function GameCard({ game, locale }: { game: Game; locale: Locale }) {
  const comingSoon = game.status === "coming-soon";

  const body = (
    <>
      <GameCover game={game} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          {game.featured && !comingSoon && <Badge kind="featured" locale={locale} />}
          {game.status === "new" && <Badge kind="new" locale={locale} />}
          {comingSoon && <Badge kind="coming-soon" locale={locale} />}
        </div>
        <h3 className="mt-3 text-2xl uppercase">{game.title}</h3>
        <p className="mt-1 text-card-foreground">{game.description}</p>
        {!comingSoon && (
          <span className="eyebrow mt-auto inline-flex items-center gap-2 pt-5 text-sun">
            {getDictionary(locale).play}
            <Icon name="arrow-right" className="size-4 transition-transform duration-(--duration-fast) group-hover:translate-x-1" />
          </span>
        )}
      </div>
    </>
  );

  const shape = "flex h-full min-h-72 flex-col overflow-hidden rounded-(--radius-card) border";

  if (comingSoon) {
    // Not a link: it can't be opened yet, so it isn't focusable or clickable.
    return <div className={`${shape} border-dashed border-muted bg-card/60 opacity-80 grayscale-[60%]`}>{body}</div>;
  }

  return (
    <Link
      href={`/${locale}/games/${game.slug}`}
      className={`${shape} group cursor-pointer border-white/10 bg-card shadow-lg shadow-black/30 transition-[transform,box-shadow,border-color] duration-(--duration-base) ease-out hover:-translate-y-1 hover:border-secondary/70 hover:shadow-2xl active:translate-y-0 ${glowClass[game.color]}`}
    >
      {body}
    </Link>
  );
}
