import type { Character } from "./characters";

// Same faces and colours as the 3D heads in art.ts.
const FACES = {
  blocky: {
    rows: ["hhhhhhhh", "hhHhhhhh", "hsssssSh", "swessews", "ssssssss", "sssnnsss", "ssmmmmss", "ssmsssms"],
    colors: { h: "#4a2f1b", H: "#3a2412", s: "#c89370", S: "#b07b58", w: "#ffffff", e: "#4b3aa8", n: "#8f5a3e", m: "#6b3d26" },
  },
  pixel: {
    rows: ["hhhhhhhh", "hhhhhhHh", "hhhhssss", "hwessewh", "hssssssh", "hsssSssh", "hssmmssh", "hsssssss"],
    colors: { h: "#e2701f", H: "#c75a12", s: "#f1c9a5", S: "#e3b08a", w: "#ffffff", e: "#2f9e44", n: "#e3b08a", m: "#e0707a" },
  },
} as const;

/** Small flat portraits of the two fighters for the menus and HUD. Decorative: names are always shown as text. */
export function Portrait({ kind, className = "size-16" }: { kind: Character; className?: string }) {
  if (kind === "blocky" || kind === "pixel") {
    const { rows, colors } = FACES[kind];
    return (
      <svg viewBox="0 0 8 8" className={className} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
        {rows.flatMap((row, y) =>
          [...row].map((ch, x) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={colors[ch as keyof typeof colors]} />
          )),
        )}
      </svg>
    );
  }
  if (kind === "turbo") {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
        <path
          d="M10 34 L2 22 L14 24 L8 8 L22 16 L26 0 L34 13 L44 2 L44 16 L58 8 L52 24 L62 22 L54 34 Z"
          fill="#111"
        />
        <ellipse cx="32" cy="40" rx="16" ry="19" fill="#f2c29b" />
        <path d="M17 30 L24 22 L28 30 L34 21 L38 30 L45 23 L47 32 Z" fill="#111" />
        <ellipse cx="25" cy="39" rx="3.4" ry="4.2" fill="#fff" />
        <ellipse cx="39" cy="39" rx="3.4" ry="4.2" fill="#fff" />
        <circle cx="25.6" cy="39.6" r="2" fill="#111" />
        <circle cx="38.4" cy="39.6" r="2" fill="#111" />
        <path d="M20 33 L29 35 M44 33 L35 35" stroke="#111" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 50 Q32 53 36 50" stroke="#7c3f1d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M18 58 L32 64 L46 58 L46 64 L18 64 Z" fill="#f97316" />
        <path d="M27 60 L32 64 L37 60 Z" fill="#1e40af" />
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
