import { Press_Start_2P } from "next/font/google";

// Self-hosted at build time by next/font, so no request ever goes to Google.
// "block": the retro titles wait for this font instead of swapping in late and
// shifting the layout (its metrics are far from any fallback).
const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel", display: "block" });

export default function PlayLayout({ children }: LayoutProps<"/[lang]/play">) {
  return <div className={pixel.variable}>{children}</div>;
}
