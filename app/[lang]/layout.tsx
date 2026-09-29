import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui/Icon";
import { getSite } from "@/lib/content";
import { LOCALES, getDictionary, isLocale } from "@/lib/i18n";
import "../globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

// Only /en and /es exist; any other first segment is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const site = getSite(lang);
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.tagline,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f0f23",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const site = getSite(lang);
  const t = getDictionary(lang);

  return (
    <html lang={lang} className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={lang}>
          <a
            href="#main"
            className="sr-only z-50 rounded-xl bg-sun px-4 py-3 font-bold text-on-sun focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            {t.skip}
          </a>
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Link
              href={`/${lang}`}
              aria-label={site.name}
              className="group flex min-h-11 items-center rounded-2xl pr-3"
            >
              <Logo name={site.host.name} tag={t.brandTag} />
            </Link>
            <LanguageSwitcher />
          </header>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-muted-foreground sm:px-6">
            <Icon name="heart" className="mr-1 inline size-4 text-accent" />
            {t.footer(site.host.name)}
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
