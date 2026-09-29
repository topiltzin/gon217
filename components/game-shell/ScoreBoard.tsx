"use client";

import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { useBestScore } from "./useBestScore";

export function ScoreBoard({ slug, unit }: { slug: string; unit: string }) {
  const best = useBestScore(slug);
  const t = useT();
  return (
    <p className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-card px-4 font-bold text-card-foreground">
      <Icon name="trophy" className="size-5 text-sun" />
      {best === null ? t.shell.noBest : t.shell.best(best, unit)}
    </p>
  );
}
