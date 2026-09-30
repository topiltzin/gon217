import { useId } from "react";

/**
 * Gonzalo's brand mark: a chunky white "G" with a yellow play triangle inside
 * its bowl, pointing into the crossbar,
 * on a purple-to-magenta tile with the same tactile shadow as the site's buttons.
 * Keep app/icon.svg in sync with this drawing.
 */
export function LogoMark({ className = "size-11", title }: { className?: string; title?: string }) {
  const gradient = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
      </defs>
      <rect x="2" y="6" width="60" height="56" rx="18" fill="#4c1d95" />
      <rect x="2" y="2" width="60" height="56" rx="18" fill={`url(#${gradient})`} />
      {/* A white "G" with a straight crossbar (what keeps it readable when small)... */}
      <path
        d="M41.8 21.2A14.5 14.5 0 1 0 45.5 32H37"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* ...and a yellow play triangle in the bowl, pointing into the crossbar. */}
      <path d="M24.5 27v10l7-5z" fill="#facc15" stroke="#facc15" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M52 7.5l1.6 4.3 4.4 1.6-4.4 1.6L52 19.3l-1.6-4.3-4.4-1.6 4.4-1.6z" fill="#facc15" />
    </svg>
  );
}

/** Mark plus two-line wordmark: host name, and a small tag line under it. */
export function Logo({ name, tag }: { name: string; tag: string }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark className="size-11 shrink-0 transition-transform duration-(--duration-fast) group-hover:-rotate-6" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-2xl font-bold tracking-tight">{name}</span>
        <span className="mt-0.5 text-[0.7rem] font-extrabold tracking-[0.2em] text-sun uppercase">{tag}</span>
      </span>
    </span>
  );
}
