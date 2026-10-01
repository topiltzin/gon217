import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Site } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

type Stats = { games: number; fresh: number };

/** HUD-style frame corners drawn around the player card. */
function Corners() {
  const corner = "absolute size-5 border-sun";
  return (
    <>
      <span className={`${corner} -top-1 -left-1 border-t-2 border-l-2`} />
      <span className={`${corner} -top-1 -right-1 border-t-2 border-r-2`} />
      <span className={`${corner} -bottom-1 -left-1 border-b-2 border-l-2`} />
      <span className={`${corner} -right-1 -bottom-1 border-r-2 border-b-2`} />
    </>
  );
}

export function Hero({ site, locale, stats }: { site: Site; locale: Locale; stats: Stats }) {
  const t = getDictionary(locale);
  const readouts: [string, string][] = [
    [String(stats.games), t.heroStats.games],
    [String(stats.fresh), t.heroStats.new],
    ["0", t.heroStats.ads],
  ];
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-12 sm:px-6 md:grid-cols-[1.25fr_1fr] md:pt-14">
      <div>
        <p className="eyebrow inline-flex items-center gap-2 rounded-md border border-sun/40 bg-sun/10 px-3 py-1.5 text-sun">
          <Icon name="sparkles" className="size-4" />
          {t.hostedBy(site.host.name)}
        </p>
        <h1 className="mt-5 text-4xl uppercase sm:text-6xl lg:text-7xl">
          <span className="bg-linear-to-r from-foreground via-secondary to-accent bg-clip-text text-transparent">
            {site.name}
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl">{site.tagline}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="#games" variant="accent" className="!min-h-14 !px-8 !text-lg">
            <Icon name="play" className="size-6" />
            {t.playNow}
          </ButtonLink>
          <ButtonLink href={`/${locale}/play`} variant="ghost" className="!min-h-14 !px-6">
            <Icon name="gamepad" className="size-6" />
            RUSTFALL
          </ButtonLink>
        </div>
      </div>

      {/* Player card: the host's pixel avatar in a HUD frame. Decorative apart from the stats, which repeat what the page lists. */}
      <div className="relative mx-auto w-full max-w-sm">
        <div className="relative rounded-(--radius-card) border border-secondary/30 bg-card/80 p-5 shadow-[0_0_60px_rgb(124_58_237/0.25)] backdrop-blur-sm">
          <Corners />
          <div className="flex items-center justify-between">
            <p className="eyebrow text-secondary">{t.player1}</p>
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <span className="size-2 animate-pulse rounded-full bg-mint" />
              <span className="size-2 rounded-full bg-sun" />
              <span className="size-2 rounded-full bg-accent" />
            </span>
          </div>
          <div aria-hidden="true" className="relative mx-auto mt-4 aspect-square w-3/4 overflow-hidden rounded-lg border border-white/10 bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny pixel-art PNG, must stay unsmoothed */}
            <img src="/sprites/gonzalo-face.png" alt="" width={48} height={48} className="size-full [image-rendering:pixelated]" />
            {/* Scanlines */}
            <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.18)_0_2px,transparent_2px_4px)]" />
            <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgb(124_58_237/0.45)]" />
          </div>
          <p className="mt-4 text-center font-display text-3xl uppercase">{site.host.name}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {readouts.map(([value, label]) => (
              <div key={label} className="rounded-md border border-white/10 bg-background/60 px-2 py-2">
                <dt className="eyebrow !text-[0.6875rem] text-muted-foreground">{label}</dt>
                <dd className="font-display text-2xl text-sun">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
