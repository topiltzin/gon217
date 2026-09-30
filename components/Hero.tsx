import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Site } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

export function Hero({ site, locale }: { site: Site; locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-12 sm:px-6 md:grid-cols-[1.2fr_1fr] md:pt-12">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 font-bold text-sun">
          <Icon name="sparkles" className="size-5" />
          {t.hostedBy(site.host.name)}
        </p>
        <h1 className="mt-5 text-5xl font-bold sm:text-6xl lg:text-7xl">{site.name}</h1>
        <p className="mt-4 max-w-xl text-xl text-muted-foreground sm:text-2xl">{site.tagline}</p>
        <ButtonLink href="#games" variant="accent" className="mt-8 !min-h-16 !px-10 !text-2xl">
          <Icon name="play" className="size-7" />
          {t.playNow}
        </ButtonLink>
      </div>

      {/* Decorative tile stack; only the centre tile animates (and not with reduced motion). */}
      <div aria-hidden="true" className="relative mx-auto hidden aspect-square w-full max-w-sm sm:block">
        <span className="absolute top-2 left-4 grid size-28 rotate-[-10deg] place-items-center rounded-3xl bg-sun text-on-sun shadow-[0_8px_0_0_#a16207]">
          <Icon name="star" className="size-14" />
        </span>
        <span className="absolute top-10 right-2 grid size-24 rotate-12 place-items-center rounded-3xl bg-mint text-on-mint shadow-[0_8px_0_0_#047857]">
          <Icon name="grid" className="size-12" />
        </span>
        <span className="absolute inset-0 m-auto size-56 animate-float drop-shadow-[0_12px_24px_rgb(192_38_211/0.35)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny pixel-art PNG, must stay unsmoothed */}
          <img
            src="/sprites/gonzalo-face.png"
            alt=""
            width={48}
            height={48}
            className="size-full [image-rendering:pixelated]"
          />
        </span>
        <span className="absolute bottom-4 left-10 grid size-24 rotate-6 place-items-center rounded-3xl bg-sky text-on-sky shadow-[0_8px_0_0_#0369a1]">
          <Icon name="brain" className="size-12" />
        </span>
        <span className="absolute right-8 bottom-0 grid size-20 -rotate-12 place-items-center rounded-3xl bg-accent text-on-accent shadow-[0_8px_0_0_#9f1239]">
          <Icon name="heart" className="size-10" />
        </span>
      </div>
    </section>
  );
}
