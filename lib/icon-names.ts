// Icon keys content files may reference. Mapped to SVG components in components/ui/Icon.tsx.
export const ICON_NAMES = [
  "puzzle",
  "zap",
  "grid",
  "star",
  "rocket",
  "gamepad",
  "sparkles",
  "trophy",
  "palette",
  "brain",
  "flag",
  "sprout",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const CARD_COLORS = ["primary", "secondary", "accent", "sun", "mint", "sky"] as const;

export type CardColor = (typeof CARD_COLORS)[number];
