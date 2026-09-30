import { useId } from "react";
import type { PlantKind } from "./logic";

/**
 * Garden Guard's illustrations as inline SVG: soft gradients, outlines and
 * shading for a storybook look. All decorative (aria-hidden); the buttons and
 * cells around them carry the names.
 */

type ArtProps = { className?: string };

const svgProps = { "aria-hidden": true, focusable: false } as const;

export function Sunflower({ className }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <defs>
        <radialGradient id={`${id}c`} cx="45%" cy="40%">
          <stop offset="0" stopColor="#8b5a2b" />
          <stop offset="1" stopColor="#4a2c12" />
        </radialGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f59f00" />
        </linearGradient>
      </defs>
      <path d="M50 58 C48 72 52 84 50 98" stroke="#2b8a3e" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M50 80 C36 70 24 74 18 82 C30 88 42 86 50 80Z" fill="#40c057" stroke="#2b8a3e" strokeWidth="2" />
      <path d="M51 72 C64 62 76 66 82 72 C70 80 58 78 51 72Z" fill="#51cf66" stroke="#2b8a3e" strokeWidth="2" />
      <g transform="translate(50 36)">
        {Array.from({ length: 14 }, (_, i) => (
          <ellipse
            key={i}
            rx="7"
            ry="16"
            cy="-20"
            transform={`rotate(${(i * 360) / 14})`}
            fill={`url(#${id}p)`}
            stroke="#e67700"
            strokeWidth="1.5"
          />
        ))}
        <circle r="17" fill={`url(#${id}c)`} stroke="#3b2208" strokeWidth="2" />
        {Array.from({ length: 10 }, (_, i) => (
          <circle key={i} r="1.4" cx={Math.cos(i * 2.4) * (4 + (i % 3) * 3.5)} cy={Math.sin(i * 2.4) * (4 + (i % 3) * 3.5)} fill="#2b1705" />
        ))}
        <circle cx="-6" cy="-3" r="2.6" fill="#111" />
        <circle cx="6" cy="-3" r="2.6" fill="#111" />
        <circle cx="-5.2" cy="-4" r="0.9" fill="#fff" />
        <circle cx="6.8" cy="-4" r="0.9" fill="#fff" />
        <path d="M-6 5 Q0 11 6 5" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="-10" cy="4" rx="3" ry="1.8" fill="#ff8787" opacity="0.7" />
        <ellipse cx="10" cy="4" rx="3" ry="1.8" fill="#ff8787" opacity="0.7" />
      </g>
    </svg>
  );
}

export function PeaShooter({ className }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <defs>
        <radialGradient id={`${id}h`} cx="40%" cy="35%">
          <stop offset="0" stopColor="#8ce99a" />
          <stop offset="0.6" stopColor="#40c057" />
          <stop offset="1" stopColor="#2b8a3e" />
        </radialGradient>
      </defs>
      <path d="M44 60 C42 74 48 86 46 98" stroke="#2b8a3e" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M46 88 C30 80 18 86 12 94 C26 99 38 96 46 88Z" fill="#40c057" stroke="#2b8a3e" strokeWidth="2" />
      <path d="M47 86 C62 78 76 82 84 92 C70 98 56 96 47 86Z" fill="#51cf66" stroke="#2b8a3e" strokeWidth="2" />
      {/* Leaf crest */}
      <path d="M26 30 C14 22 10 12 14 8 C22 12 28 20 30 28Z" fill="#37b24d" stroke="#2b8a3e" strokeWidth="2" />
      <circle cx="40" cy="40" r="24" fill={`url(#${id}h)`} stroke="#2b8a3e" strokeWidth="2.5" />
      {/* Pod mouth pointing at the snails */}
      <path d="M58 30 L84 28 C92 28 94 52 84 52 L58 50Z" fill={`url(#${id}h)`} stroke="#2b8a3e" strokeWidth="2.5" />
      <ellipse cx="86" cy="40" rx="6" ry="11" fill="#1b5e20" stroke="#2b8a3e" strokeWidth="2" />
      <circle cx="44" cy="32" r="6" fill="#fff" stroke="#1b5e20" strokeWidth="1.5" />
      <circle cx="46" cy="32" r="3.2" fill="#111" />
      <circle cx="47" cy="31" r="1" fill="#fff" />
      <ellipse cx="32" cy="30" rx="6" ry="3" fill="#b2f2bb" opacity="0.7" />
    </svg>
  );
}

/** A stone wall that shows cracks as it gets chewed (`health` from 1 down to 0). */
export function StoneWall({ className, health = 1 }: ArtProps & { health?: number }) {
  const id = useId();
  const stones: [number, number, number, number][] = [
    [8, 58, 28, 20],
    [38, 60, 26, 18],
    [66, 58, 26, 20],
    [14, 36, 26, 20],
    [42, 38, 28, 20],
    [70, 38, 20, 18],
    [24, 16, 26, 20],
    [52, 16, 28, 20],
    [8, 80, 40, 16],
    [50, 80, 42, 16],
  ];
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ced4da" />
          <stop offset="1" stopColor="#868e96" />
        </linearGradient>
      </defs>
      {stones.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="7" fill={`url(#${id}s)`} stroke="#495057" strokeWidth="2.5" />
      ))}
      {/* Moss */}
      <path d="M24 16 q6 -5 12 0 q6 -5 12 0" stroke="#40c057" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M66 58 q5 -4 10 0" stroke="#40c057" strokeWidth="4" fill="none" strokeLinecap="round" />
      {health < 0.66 && <path d="M50 40 l6 8 -5 6 7 8" stroke="#343a40" strokeWidth="2.5" fill="none" />}
      {health < 0.33 && <path d="M20 60 l8 6 -3 7 M76 20 l-5 9 6 5" stroke="#343a40" strokeWidth="2.5" fill="none" />}
    </svg>
  );
}

export function Chili({ className }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6b6b" />
          <stop offset="1" stopColor="#c92a2a" />
        </linearGradient>
      </defs>
      <path
        d="M58 24 C80 26 86 50 72 70 C62 84 40 94 22 92 C40 82 50 70 52 52 C53 40 50 30 58 24Z"
        fill={`url(#${id}r)`}
        stroke="#862e2e"
        strokeWidth="2.5"
      />
      <path d="M62 34 C70 40 70 52 64 60" stroke="#ffc9c9" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M58 24 C58 16 64 10 72 8" stroke="#2b8a3e" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M50 26 C54 18 64 20 68 26 C62 30 56 30 50 26Z" fill="#40c057" stroke="#2b8a3e" strokeWidth="2" />
      {/* Angry little face */}
      <path d="M50 46 l8 3 M70 44 l-8 4" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="55" cy="53" r="2.5" fill="#111" />
      <circle cx="66" cy="52" r="2.5" fill="#111" />
      <path d="M54 64 Q60 60 66 64" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PlantArt({ kind, className, health }: ArtProps & { kind: PlantKind; health?: number }) {
  switch (kind) {
    case "sunflower":
      return <Sunflower className={className} />;
    case "peashooter":
      return <PeaShooter className={className} />;
    case "wall":
      return <StoneWall className={className} health={health} />;
    case "chili":
      return <Chili className={className} />;
  }
}

/** A snail with a spiral shell and eyes on stalks. Big ones wear a helmet; fast ones are pink with speed stripes. */
export function SnailArt({ className, big, fast }: ArtProps & { big: boolean; fast: boolean }) {
  const id = useId();
  const body = fast ? "#faa2c1" : "#e9c46a";
  const bodyDark = fast ? "#d6336c" : "#b08900";
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <defs>
        <radialGradient id={`${id}s`} cx="40%" cy="35%">
          <stop offset="0" stopColor={fast ? "#e599f7" : "#e8a86b"} />
          <stop offset="1" stopColor={fast ? "#9c36b5" : "#8d4f1f"} />
        </radialGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={body} />
          <stop offset="1" stopColor={bodyDark} />
        </linearGradient>
      </defs>
      {/* Slime trail */}
      <path d="M60 94 H98" stroke="#a5d8ff" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      {fast && <path d="M78 58 h18 M82 68 h14 M80 78 h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />}
      {/* Body, head on the left (snails crawl toward the house) */}
      <path d="M8 92 C8 78 16 68 26 66 L80 80 C90 82 94 88 92 94 Z" fill={`url(#${id}b)`} stroke={bodyDark} strokeWidth="2" />
      <path d="M20 68 L14 44 M28 68 L28 42" stroke={bodyDark} strokeWidth="4" strokeLinecap="round" />
      <circle cx="14" cy="42" r="6" fill="#fff" stroke={bodyDark} strokeWidth="2" />
      <circle cx="28" cy="40" r="6" fill="#fff" stroke={bodyDark} strokeWidth="2" />
      <circle cx="12.5" cy="42" r="3" fill="#111" />
      <circle cx="26.5" cy="40" r="3" fill="#111" />
      <path d="M10 84 Q16 88 22 84" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Shell */}
      <circle cx="62" cy="58" r={big ? 32 : 28} fill={`url(#${id}s)`} stroke="#5c2d0e" strokeWidth="3" />
      <path
        d="M62 58 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a13 13 0 1 1 -13 -13 a18 18 0 1 1 18 18"
        stroke="#5c2d0e"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity="0.8"
      />
      <ellipse cx="52" cy="42" rx="8" ry="4" fill="#fff" opacity="0.35" transform="rotate(-30 52 42)" />
      {big && (
        <g>
          <path d="M34 38 C36 14 88 14 90 38 Z" fill="#adb5bd" stroke="#343a40" strokeWidth="3" />
          <rect x="30" y="36" width="64" height="7" rx="3" fill="#868e96" stroke="#343a40" strokeWidth="2.5" />
          <circle cx="62" cy="24" r="3" fill="#495057" />
        </g>
      )}
    </svg>
  );
}

export function Pea({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...svgProps}>
      <circle cx="10" cy="10" r="8.5" fill="#51cf66" stroke="#2b8a3e" strokeWidth="2" />
      <circle cx="7" cy="7" r="2.6" fill="#d3f9d8" />
    </svg>
  );
}

export function SunDropArt({ className }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <defs>
        <radialGradient id={`${id}g`}>
          <stop offset="0" stopColor="#fff9db" />
          <stop offset="0.45" stopColor="#ffd43b" />
          <stop offset="1" stopColor="#ffd43b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}g)`} />
      <g className="origin-center animate-spin-slow">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M50 6 L55 22 L45 22Z" fill="#fab005" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="22" fill="#ffd43b" stroke="#f08c00" strokeWidth="3" />
      <circle cx="43" cy="46" r="2.5" fill="#7c4a03" />
      <circle cx="57" cy="46" r="2.5" fill="#7c4a03" />
      <path d="M43 56 Q50 62 57 56" stroke="#7c4a03" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MowerArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <path d="M20 50 L6 14" stroke="#495057" strokeWidth="5" strokeLinecap="round" />
      <rect x="2" y="8" width="16" height="7" rx="3" fill="#212529" />
      <path d="M14 50 H86 C92 50 96 56 96 64 V72 H14 Z" fill="#e03131" stroke="#862e2e" strokeWidth="3" />
      <rect x="40" y="40" width="30" height="12" rx="4" fill="#495057" stroke="#212529" strokeWidth="2" />
      <path d="M20 58 H90" stroke="#ffa8a8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="78" r="12" fill="#212529" />
      <circle cx="28" cy="78" r="5" fill="#adb5bd" />
      <circle cx="80" cy="78" r="12" fill="#212529" />
      <circle cx="80" cy="78" r="5" fill="#adb5bd" />
    </svg>
  );
}

export function BoomArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...svgProps}>
      <path
        d="M50 2 L60 30 L90 14 L72 42 L98 52 L70 60 L86 90 L56 72 L48 98 L40 70 L10 86 L28 58 L2 48 L30 40 L14 12 L42 28 Z"
        fill="#ff922b"
        stroke="#e8590c"
        strokeWidth="3"
      />
      <path d="M50 22 L56 40 L74 34 L62 50 L76 62 L56 60 L50 78 L44 60 L24 64 L38 50 L26 34 L44 40 Z" fill="#ffe066" />
    </svg>
  );
}

export function HouseArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 40 100" className={className} {...svgProps} preserveAspectRatio="xMidYMid slice">
      <rect width="40" height="100" fill="#f1e3c8" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M0 ${i * 10 + 9} H40`} stroke="#d9c49e" strokeWidth="1.5" />
      ))}
      <rect x="10" y="30" width="20" height="24" rx="2" fill="#a5d8ff" stroke="#6b4f2a" strokeWidth="3" />
      <path d="M20 30 V54 M10 42 H30" stroke="#6b4f2a" strokeWidth="2" />
      <rect x="6" y="54" width="28" height="5" fill="#6b4f2a" />
      <path d="M8 62 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0" fill="#e64980" />
    </svg>
  );
}
