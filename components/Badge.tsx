import { Icon } from "@/components/ui/Icon";
import { getDictionary, type Locale } from "@/lib/i18n";

export type BadgeKind = "featured" | "new" | "coming-soon" | "new-best";

// Every badge has a text label and an icon, so meaning never relies on colour alone.
const styles: Record<
  BadgeKind,
  { label: "featured" | "new" | "comingSoon" | "newBest"; icon: "crown" | "sparkles" | "clock" | "trophy"; className: string }
> = {
  featured: { label: "featured", icon: "crown", className: "bg-sun text-on-sun" },
  new: { label: "new", icon: "sparkles", className: "bg-accent text-on-accent" },
  "coming-soon": { label: "comingSoon", icon: "clock", className: "bg-muted text-foreground" },
  "new-best": { label: "newBest", icon: "trophy", className: "bg-sun text-on-sun" },
};

export function Badge({ kind, locale }: { kind: BadgeKind; locale: Locale }) {
  const { label, icon, className } = styles[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${className}`}
    >
      <Icon name={icon} className="size-4" />
      {getDictionary(locale).badges[label]}
    </span>
  );
}
