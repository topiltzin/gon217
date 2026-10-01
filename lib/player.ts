import type { Locale } from "./i18n";

/**
 * Player names are built only from these preset words plus a number, so kids
 * never type (or show on the leaderboard) a real name or anything unkind.
 * The database stores the word keys; each locale renders its own words.
 * Spanish adjectives are gender-neutral so they fit every animal.
 */
export const ADJECTIVES = {
  brave: { en: "Brave", es: "Valiente" },
  speedy: { en: "Speedy", es: "Veloz" },
  happy: { en: "Happy", es: "Feliz" },
  clever: { en: "Clever", es: "Inteligente" },
  sparkly: { en: "Sparkly", es: "Brillante" },
  mighty: { en: "Mighty", es: "Fuerte" },
  jolly: { en: "Jolly", es: "Alegre" },
  stellar: { en: "Stellar", es: "Estelar" },
  radiant: { en: "Radiant", es: "Radiante" },
  nimble: { en: "Nimble", es: "Ágil" },
  giant: { en: "Giant", es: "Gigante" },
  awesome: { en: "Awesome", es: "Genial" },
  kind: { en: "Kind", es: "Amable" },
  wild: { en: "Wild", es: "Salvaje" },
  noble: { en: "Noble", es: "Noble" },
  cheeky: { en: "Cheeky", es: "Bromista" },
} as const;

export const ANIMALS = {
  tiger: { en: "Tiger", es: "Tigre" },
  panda: { en: "Panda", es: "Panda" },
  dolphin: { en: "Dolphin", es: "Delfín" },
  fox: { en: "Fox", es: "Zorro" },
  owl: { en: "Owl", es: "Búho" },
  turtle: { en: "Turtle", es: "Tortuga" },
  rabbit: { en: "Rabbit", es: "Conejo" },
  dragon: { en: "Dragon", es: "Dragón" },
  penguin: { en: "Penguin", es: "Pingüino" },
  koala: { en: "Koala", es: "Koala" },
  lion: { en: "Lion", es: "León" },
  shark: { en: "Shark", es: "Tiburón" },
  eagle: { en: "Eagle", es: "Águila" },
  frog: { en: "Frog", es: "Sapo" },
  bear: { en: "Bear", es: "Oso" },
  unicorn: { en: "Unicorn", es: "Unicornio" },
} as const;

export type Adjective = keyof typeof ADJECTIVES;
export type Animal = keyof typeof ANIMALS;
export const MAX_NICK_NUMBER = 99;

export type Nickname = { adjective: Adjective; animal: Animal; number: number };

/** What a player types to sign up or log in. Validated on the server by `credentialsSchema` (lib/player-schemas.ts). */
export type Credentials = Nickname & { pin: string };

/**
 * Client-side check of the sign-up/log-in form (the server re-checks with
 * `credentialsSchema`). Plain code rather than Zod, so Zod stays off the client.
 */
export function parseCredentials(input: { adjective: string; animal: string; number: number; pin: string }): Credentials | null {
  const { adjective, animal, number, pin } = input;
  if (!Object.hasOwn(ADJECTIVES, adjective) || !Object.hasOwn(ANIMALS, animal)) return null;
  if (!Number.isInteger(number) || number < 1 || number > MAX_NICK_NUMBER) return null;
  if (!/^\d{4}$/.test(pin)) return null;
  return { adjective: adjective as Adjective, animal: animal as Animal, number, pin };
}

/** English "Brave Tiger 7", Spanish "Tigre Valiente 7". */
export function formatNickname({ adjective, animal, number }: Nickname, locale: Locale): string {
  const adj = ADJECTIVES[adjective][locale];
  const noun = ANIMALS[animal][locale];
  return locale === "es" ? `${noun} ${adj} ${number}` : `${adj} ${noun} ${number}`;
}

/** Highest sensible score for any game; anything else is rejected by the API. */
export const MAX_SCORE = 100_000;

