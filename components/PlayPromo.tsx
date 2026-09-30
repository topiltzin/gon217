import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getDictionary, type Locale } from "@/lib/i18n";

/** Home-page banner for RUSTFALL, which lives in its own /play section rather than the game grid. */
export function PlayPromo({ locale }: { locale: Locale }) {
  const f = getDictionary(locale).fps;
  return (
    <section aria-labelledby="play-promo-heading" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-col items-start gap-4 rounded-(--radius-card) bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent">
            <Icon name="gamepad" className="size-9" />
          </span>
          <div>
            <h2 id="play-promo-heading" className="text-2xl font-bold">
              {f.promo.heading}
            </h2>
            <p className="text-card-foreground">{f.promo.body}</p>
          </div>
        </div>
        <ButtonLink href={`/${locale}/play`} variant="accent">
          <Icon name="play" />
          {f.promo.cta}
        </ButtonLink>
      </div>
    </section>
  );
}
