import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuLink } from "@/components/fps/MenuLink";
import { RetroFrame } from "@/components/fps/RetroFrame";
import styles from "@/components/fps/fps.module.css";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/play/instructions">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const f = getDictionary(lang).fps;
  return { title: `${f.title} · ${f.menu.instructions}` };
}

export default async function Instructions({ params }: PageProps<"/[lang]/play/instructions">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const f = getDictionary(lang).fps;
  return (
    <RetroFrame>
      <h1 className={`${styles.logo} !text-3xl sm:!text-4xl`}>{f.menu.instructions}</h1>

      <section aria-labelledby="controls" className={`${styles.panel} w-full p-5 text-left sm:p-6`}>
        <h2 id="controls" className="mb-4 text-sm text-[#ffb13b]">
          {f.controlsTitle}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-[0.65rem] leading-relaxed sm:text-xs">
          {f.controls.map(([key, action]) => (
            <div key={key} className="contents">
              <dt className="text-[#ffe08a]">{key}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="how" className={`${styles.panel} w-full p-5 text-left sm:p-6`}>
        <h2 id="how" className="mb-4 text-sm text-[#ffb13b]">
          {f.howTitle}
        </h2>
        <ul className="flex list-none flex-col gap-3 text-[0.65rem] leading-relaxed sm:text-xs">
          {f.how.map((line) => (
            <li key={line}>▸ {line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="enemies" className={`${styles.panel} w-full p-5 text-left sm:p-6`}>
        <h2 id="enemies" className="mb-4 text-sm text-[#ffb13b]">
          {f.enemiesTitle}
        </h2>
        <dl className="flex flex-col gap-3 text-[0.65rem] leading-relaxed sm:text-xs">
          {f.enemies.map(([name, text]) => (
            <div key={name}>
              <dt className="text-[#ff3b1f]">{name}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <MenuLink href={`/${lang}/play`}>{f.menu.back}</MenuLink>
    </RetroFrame>
  );
}
