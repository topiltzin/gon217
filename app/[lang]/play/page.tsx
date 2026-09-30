import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuLink } from "@/components/fps/MenuLink";
import { RetroFrame } from "@/components/fps/RetroFrame";
import styles from "@/components/fps/fps.module.css";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/play">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const f = getDictionary(lang).fps;
  return { title: f.title, description: f.tagline };
}

export default async function PlayTitle({ params }: PageProps<"/[lang]/play">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const f = getDictionary(lang).fps;
  return (
    <RetroFrame>
      <h1 className={styles.logo}>{f.title}</h1>
      <p className="max-w-md text-xs leading-relaxed text-[#d8cfae]">{f.tagline}</p>
      <nav aria-label={f.title} className="flex flex-col items-center gap-4">
        <MenuLink href={`/${lang}/play/game`}>{f.menu.play}</MenuLink>
        <MenuLink href={`/${lang}/play/instructions`}>{f.menu.instructions}</MenuLink>
        <MenuLink href={`/${lang}/play/credits`}>{f.menu.credits}</MenuLink>
      </nav>
      <Link href={`/${lang}`} className="inline-flex min-h-11 items-center text-xs text-[#ffb13b] underline underline-offset-4">
        {f.menu.site}
      </Link>
    </RetroFrame>
  );
}
