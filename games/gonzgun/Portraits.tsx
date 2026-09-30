import type { Character } from "./models";

const BLOCKY_FACE = ["hhhhhhhh", "hhHhhhhh", "hsssssSh", "swessews", "ssssssss", "sssnnsss", "ssmmmmss", "ssmsssms"];
const BLOCKY_COLORS: Record<string, string> = {
  h: "#4a2f1b",
  H: "#3a2412",
  s: "#c89370",
  S: "#b07b58",
  w: "#ffffff",
  e: "#4b3aa8",
  n: "#8f5a3e",
  m: "#6b3d26",
};

/** Small flat portraits of the two fighters for the menus and HUD. Decorative: names are always shown as text. */
export function Portrait({ kind, className = "size-16" }: { kind: Character; className?: string }) {
  if (kind === "blocky") {
    return (
      <svg viewBox="0 0 8 8" className={className} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
        {BLOCKY_FACE.flatMap((row, y) =>
          [...row].map((ch, x) => <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={BLOCKY_COLORS[ch]} />),
        )}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d="M14 30 L4 2 L24 22 Z" fill="#ffd21f" />
      <path d="M4 2 L9 16 L13 12 Z" fill="#1a1a1a" />
      <path d="M50 30 L60 2 L40 22 Z" fill="#ffd21f" />
      <path d="M60 2 L55 16 L51 12 Z" fill="#1a1a1a" />
      <ellipse cx="32" cy="38" rx="24" ry="21" fill="#ffd21f" />
      <circle cx="23" cy="34" r="4" fill="#1a1a1a" />
      <circle cx="41" cy="34" r="4" fill="#1a1a1a" />
      <circle cx="24.3" cy="32.6" r="1.4" fill="#fff" />
      <circle cx="42.3" cy="32.6" r="1.4" fill="#fff" />
      <circle cx="15" cy="44" r="5" fill="#e8453c" />
      <circle cx="49" cy="44" r="5" fill="#e8453c" />
      <path d="M28 44 Q30 47 32 44 Q34 47 36 44" stroke="#8a5a2b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
