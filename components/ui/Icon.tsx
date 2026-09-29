import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Brain,
  BrickWall,
  Circle,
  Clock,
  Coins,
  Crown,
  ExternalLink,
  Flag,
  Flower2,
  Gamepad2,
  Grid3x3,
  Heart,
  House,
  Languages,
  Lock,
  Megaphone,
  Palette,
  Play,
  Puzzle,
  Rocket,
  RotateCcw,
  Snail,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Trophy,
  Tv,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/lib/icon-names";

const icons: Record<IconName | UiIconName, LucideIcon> = {
  puzzle: Puzzle,
  zap: Zap,
  grid: Grid3x3,
  star: Star,
  rocket: Rocket,
  gamepad: Gamepad2,
  sparkles: Sparkles,
  trophy: Trophy,
  palette: Palette,
  brain: Brain,
  flag: Flag,
  sprout: Sprout,
  "arrow-left": ArrowLeft,
  home: House,
  play: Play,
  replay: RotateCcw,
  megaphone: Megaphone,
  crown: Crown,
  clock: Clock,
  lock: Lock,
  heart: Heart,
  x: X,
  circle: Circle,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  coins: Coins,
  external: ExternalLink,
  languages: Languages,
  tv: Tv,
  flower: Flower2,
  "brick-wall": BrickWall,
  sun: Sun,
  snail: Snail,
};

type UiIconName =
  | "arrow-left"
  | "home"
  | "play"
  | "replay"
  | "megaphone"
  | "crown"
  | "clock"
  | "lock"
  | "heart"
  | "x"
  | "circle"
  | "arrow-right"
  | "arrow-up"
  | "coins"
  | "external"
  | "languages"
  | "tv"
  | "flower"
  | "brick-wall"
  | "sun"
  | "snail";

type Props = {
  name: IconName | UiIconName;
  /** Accessible name. Omit for decorative icons next to visible text. */
  label?: string;
  className?: string;
  strokeWidth?: number;
};

export function Icon({ name, label, className = "size-6", strokeWidth = 2.5 }: Props) {
  const Svg = icons[name];
  return label ? (
    <Svg role="img" aria-label={label} className={className} strokeWidth={strokeWidth} />
  ) : (
    <Svg aria-hidden="true" focusable="false" className={className} strokeWidth={strokeWidth} />
  );
}
