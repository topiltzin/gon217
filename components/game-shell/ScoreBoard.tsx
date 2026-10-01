"use client";

import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { useBestScore } from "./useBestScore";

export function ScoreBoard({ slug, unit }: { slug: string; unit: string }) {
  const best = useBestScore(slug);
  const t = useT();
  return (
    <p className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-card px-4 font-semibold text-card-foreground">
      <Icon name="trophy" className="size-5 text-sun" />
      {best === null ? t.shell.noBest : t.shell.best(best, unit)}
    </p>
  );
}
