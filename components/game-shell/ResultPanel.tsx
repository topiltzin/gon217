"use client";

import type { Ref } from "react";
import { Badge } from "@/components/Badge";
import { useLocale, useT } from "@/components/I18nProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { GameResult } from "@/games/types";
import type { AchievementId } from "@/lib/achievements";

type Props = {
  result: GameResult;
  isNewBest: boolean;
  fresh: AchievementId[];
  onPlayAgain: () => void;
  headingRef: Ref<HTMLHeadingElement>;
};

export function ResultPanel({ result, isNewBest, fresh, onPlayAgain, headingRef }: Props) {
  const t = useT();
  const locale = useLocale();
  return (
    <section
      aria-labelledby="result-heading"
      className="relative mx-auto flex max-w-lg animate-pop flex-col items-center gap-4 overflow-hidden rounded-(--radius-card) border border-sun/40 bg-card p-8 text-center shadow-[0_0_60px_rgb(250_204_21/0.12)]"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-accent to-sun" />
      <span className="grid size-20 place-items-center rounded-full border border-sun/40 bg-sun/10 shadow-[0_0_30px_rgb(250_204_21/0.3)]">
        <Icon name="trophy" className="size-10 text-sun" />
      </span>
      <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-3xl uppercase outline-none sm:text-4xl">
        {result.headline}
      </h2>
      {result.detail && <p className="text-lg text-card-foreground">{result.detail}</p>}
      {isNewBest && <Badge kind="new-best" locale={locale} />}
      {fresh.length > 0 && (
        <div className="w-full rounded-lg border border-sun/50 bg-sun/10 p-4 text-left">
          <p className="eyebrow flex items-center gap-2 text-sun">
            <Icon name="trophy" className="size-4" />
            {t.shell.newAchievements}
          </p>
          <ul className="mt-2 grid gap-2">
            {fresh.map((id) => (
              <li key={id} className="animate-pop">
                <span className="block font-display text-lg uppercase">{t.achievements[id].title}</span>
                <span className="block text-sm text-card-foreground">{t.achievements[id].desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button variant="accent" onClick={onPlayAgain}>
          <Icon name="replay" />
          {t.shell.playAgain}
        </Button>
        <ButtonLink href={`/${locale}`} variant="ghost">
          <Icon name="home" />
          {t.shell.back}
        </ButtonLink>
      </div>
    </section>
  );
}
