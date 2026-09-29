"use client";

import { useT, useLocale } from "@/components/I18nProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// not-found pages receive no params, so the language comes from the layout's provider.
export default function NotFound() {
  const t = useT();
  const locale = useLocale();
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-5 px-4 py-16 text-center">
      <span className="grid size-28 rotate-6 place-items-center rounded-[2rem] bg-sky text-on-sky shadow-[0_8px_0_0_#0369a1]">
        <Icon name="rocket" className="size-16" />
      </span>
      <h1 className="text-5xl font-bold">{t.notFound.title}</h1>
      <p className="text-xl text-muted-foreground">{t.notFound.body}</p>
      <ButtonLink href={`/${locale}`} variant="accent">
        <Icon name="home" />
        {t.notFound.home}
      </ButtonLink>
    </section>
  );
}
