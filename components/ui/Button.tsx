import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "accent" | "ghost";

const base =
  "inline-flex min-h-12 min-w-12 cursor-pointer select-none items-center justify-center gap-2 rounded-lg px-6 py-3 font-display text-base uppercase tracking-wider " +
  "transition-[transform,box-shadow,background-color] duration-(--duration-fast) ease-out " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

// Neon buttons: a soft glow that brightens on hover.
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_0_18px_rgb(124_58_237/0.35)] hover:bg-[#8b4ef5] hover:shadow-[0_0_28px_rgb(124_58_237/0.6)]",
  accent:
    "bg-accent text-on-accent shadow-[0_0_18px_rgb(244_63_94/0.35)] hover:bg-[#f65a75] hover:shadow-[0_0_28px_rgb(244_63_94/0.6)]",
  ghost:
    "border border-white/10 bg-muted text-foreground hover:border-secondary/60 hover:bg-[#32324a]",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant };

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

type ButtonLinkProps = { href: string; variant?: Variant; className?: string; children: ReactNode };

export function ButtonLink({ href, variant = "primary", className = "", children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
