import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getDictionary, type Locale } from "@/lib/i18n";

/** Home-page banner for RUSTFALL, which lives in its own /play section rather than the game grid. */
export function PlayPromo({ locale }: { locale: Locale }) {
  const f = getDictionary(locale).fps;
  return (
    <section aria-labelledby="play-promo-heading" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-(--radius-card) border border-[#7c2d12] bg-linear-to-r from-[#2a1208] via-card to-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <span aria-hidden="true" className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.18)_0_2px,transparent_2px_4px)]" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-accent text-on-accent shadow-[0_0_24px_rgb(244_63_94/0.45)]">
            <Icon name="gamepad" className="size-9" />
          </span>
          <div>
            <h2 id="play-promo-heading" className="text-2xl uppercase sm:text-3xl">
              {f.promo.heading}
            </h2>
            <p className="text-card-foreground">{f.promo.body}</p>
          </div>
        </div>
        <ButtonLink href={`/${locale}/play`} variant="accent" className="relative">
          <Icon name="play" />
          {f.promo.cta}
        </ButtonLink>
      </div>
    </section>
  );
}
