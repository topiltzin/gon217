/** The fighters. Kept apart from models.ts so the menus don't pull in Three.js. */
export const CHARACTERS = ["blocky", "pixel", "sparky", "turbo"] as const;
export type Character = (typeof CHARACTERS)[number];
