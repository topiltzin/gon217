import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuLink } from "@/components/fps/MenuLink";
import { RetroFrame } from "@/components/fps/RetroFrame";
import styles from "@/components/fps/fps.module.css";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/play/credits">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const f = getDictionary(lang).fps;
  return { title: `${f.title} · ${f.menu.credits}` };
}

export default async function Credits({ params }: PageProps<"/[lang]/play/credits">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const f = getDictionary(lang).fps;
  return (
    <RetroFrame>
      <h1 className={`${styles.logo} !text-3xl sm:!text-4xl`}>{f.menu.credits}</h1>
      <section className={`${styles.panel} flex w-full flex-col gap-4 p-5 text-[0.65rem] leading-relaxed sm:p-6 sm:text-xs`}>
        {f.creditsLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
      <MenuLink href={`/${lang}/play`}>{f.menu.back}</MenuLink>
    </RetroFrame>
  );
}
