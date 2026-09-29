import type { CardColor } from "@/lib/icon-names";

// Static class names so Tailwind can see them; each pair passes the contrast test.
export const tileClass: Record<CardColor, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary text-on-secondary",
  accent: "bg-accent text-on-accent",
  sun: "bg-sun text-on-sun",
  mint: "bg-mint text-on-mint",
  sky: "bg-sky text-on-sky",
};

export const glowClass: Record<CardColor, string> = {
  primary: "hover:shadow-primary/40",
  secondary: "hover:shadow-secondary/40",
  accent: "hover:shadow-accent/40",
  sun: "hover:shadow-sun/40",
  mint: "hover:shadow-mint/40",
  sky: "hover:shadow-sky/40",
};
