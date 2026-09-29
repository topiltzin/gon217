"use client";

import type { Ref } from "react";
import { Badge } from "@/components/Badge";
import { useLocale, useT } from "@/components/I18nProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { GameResult } from "@/games/types";

type Props = {
  result: GameResult;
  isNewBest: boolean;
  onPlayAgain: () => void;
  headingRef: Ref<HTMLHeadingElement>;
};

export function ResultPanel({ result, isNewBest, onPlayAgain, headingRef }: Props) {
  const t = useT();
  const locale = useLocale();
  return (
    <section
      aria-labelledby="result-heading"
      className="mx-auto flex max-w-md animate-pop flex-col items-center gap-4 rounded-(--radius-card) bg-card p-8 text-center"
    >
      <Icon name="trophy" className="size-16 text-sun" />
      <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-4xl font-bold outline-none">
        {result.headline}
      </h2>
      {result.detail && <p className="text-xl text-card-foreground">{result.detail}</p>}
      {isNewBest && <Badge kind="new-best" locale={locale} />}
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
