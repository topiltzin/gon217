import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Token --color-${name} not found in globals.css`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text, background] pairs actually used by components.
const pairs: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["foreground", "muted"],
  ["secondary", "background"],
  ["secondary", "card"],
  ["accent", "background"],
  ["sun", "background"],
  ["sun", "card"],
  ["on-primary", "primary"],
  ["on-secondary", "secondary"],
  ["on-accent", "accent"],
  ["on-sun", "sun"],
  ["on-mint", "mint"],
  ["on-sky", "sky"],
];

describe("colour tokens", () => {
  it.each(pairs)("%s on %s meets 4.5:1", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("uses dark text on the rose accent (white fails)", () => {
    expect(contrast("#ffffff", token("accent"))).toBeLessThan(4.5);
  });
});
