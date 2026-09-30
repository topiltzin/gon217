import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FpsGame } from "@/components/fps/FpsGame";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/play/game">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).fps.title } : {};
}

export default async function PlayGame({ params }: PageProps<"/[lang]/play/game">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <FpsGame />;
}
