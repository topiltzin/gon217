"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { dictionaries, otherLocale } from "@/lib/i18n";

/** Links to the same page in the other language (/en/… ⇄ /es/…). */
export function LanguageSwitcher() {
  const locale = useLocale();
  const target = otherLocale(locale);
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(en|es)(?=\/|$)/, "");

  return (
    <Link
      href={`/${target}${rest}`}
      hrefLang={target}
      lang={target}
      aria-label={dictionaries[locale].switchLanguage}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-card px-3 font-display text-sm uppercase sm:px-4 sm:text-base sm:tracking-wide transition-colors duration-(--duration-fast) hover:bg-muted"
    >
      <Icon name="languages" className="size-5 text-sun" />
      {dictionaries[target].languageName}
    </Link>
  );
}
