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
      <p aria-hidden="true" className="font-display text-8xl text-transparent [-webkit-text-stroke:2px_var(--color-secondary)] sm:text-9xl">
        404
      </p>
      <h1 className="text-4xl uppercase sm:text-5xl">{t.notFound.title}</h1>
      <p className="text-xl text-muted-foreground">{t.notFound.body}</p>
      <ButtonLink href={`/${locale}`} variant="accent">
        <Icon name="home" />
        {t.notFound.home}
      </ButtonLink>
    </section>
  );
}
