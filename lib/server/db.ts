import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/** The Neon client, or null when DATABASE_URL isn't set (accounts are then switched off). */
export function getSql(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  client ??= neon(url);
  return client;
}

export const accountsUnavailable = () => Response.json({ error: "unavailable" }, { status: 503 });
