import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "accent" | "ghost";

const base =
  "inline-flex min-h-12 min-w-12 cursor-pointer select-none items-center justify-center gap-2 rounded-2xl px-6 py-3 font-display text-lg font-semibold " +
  "transition-[transform,box-shadow,background-color] duration-(--duration-fast) ease-out " +
  "active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-60";

// "Tactile" buttons: a solid bottom shadow that collapses when pressed.
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_5px_0_0_var(--color-border)] hover:bg-[#8b4ef5] active:shadow-[0_1px_0_0_var(--color-border)]",
  accent:
    "bg-accent text-on-accent shadow-[0_5px_0_0_#9f1239] hover:bg-[#f65a75] active:shadow-[0_1px_0_0_#9f1239]",
  ghost:
    "bg-muted text-foreground shadow-[0_5px_0_0_#15152a] hover:bg-[#32324a] active:shadow-[0_1px_0_0_#15152a]",
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
