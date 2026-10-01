import { z } from "zod";
import { ADJECTIVES, ANIMALS, MAX_NICK_NUMBER, MAX_SCORE, type Adjective, type Animal } from "./player";

/*
 * Request validation for the player API. Kept apart from lib/player.ts, which
 * client components import, so Zod never ships to the browser.
 */

export const nicknameSchema = z.object({
  adjective: z.enum(Object.keys(ADJECTIVES) as [Adjective, ...Adjective[]]),
  animal: z.enum(Object.keys(ANIMALS) as [Animal, ...Animal[]]),
  number: z.number().int().min(1).max(MAX_NICK_NUMBER),
});

export const credentialsSchema = nicknameSchema.extend({
  pin: z.string().regex(/^\d{4}$/),
});

export const scoreSubmissionSchema = z.object({
  slug: z.string().max(64),
  score: z.number().int().min(0).max(MAX_SCORE),
});
