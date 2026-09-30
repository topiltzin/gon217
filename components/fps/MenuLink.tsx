"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { menuClick } from "@/games/fps/audio";
import styles from "./fps.module.css";

/** Pixel-style menu button that blips when clicked. */
export function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.button} onClick={menuClick}>
      {children}
    </Link>
  );
}
