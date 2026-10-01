import { NextResponse, type NextRequest } from "next/server";
import { credentialsSchema } from "@/lib/player-schemas";
import {
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  isSameOrigin,
  startSession,
  verifyPin,
} from "@/lib/server/auth";
import { accountsUnavailable, getSql } from "@/lib/server/db";

export async function POST(request: NextRequest) {
  const sql = getSql();
  if (!sql) return accountsUnavailable();
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const { adjective, animal, number, pin } = parsed.data;
  const [player] = await sql`
    SELECT id, pin_hash, locked_until > now() AS locked
    FROM players WHERE adjective = ${adjective} AND animal = ${animal} AND number = ${number}`;
  if (!player) return Response.json({ error: "wrong" }, { status: 401 });
  // A 4-digit PIN is easy to guess, so a few wrong tries pause the player for a while.
  if (player.locked) return Response.json({ error: "locked" }, { status: 423 });

  if (!(await verifyPin(pin, player.pin_hash))) {
    const [{ locked }] = await sql`
      UPDATE players SET
        failed_attempts = CASE WHEN failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 0 ELSE failed_attempts + 1 END,
        locked_until = CASE WHEN failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS}
          THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE locked_until END
      WHERE id = ${player.id}
      RETURNING locked_until > now() AS locked`;
    return Response.json({ error: locked ? "locked" : "wrong" }, { status: locked ? 423 : 401 });
  }

  await sql`UPDATE players SET failed_attempts = 0, locked_until = NULL WHERE id = ${player.id}`;
  const rows = await sql`SELECT slug, best FROM scores WHERE player_id = ${player.id}`;
  const bests = Object.fromEntries(rows.map((r) => [r.slug, r.best]));
  const response = NextResponse.json({ player: { adjective, animal, number }, bests });
  await startSession(sql, player.id, response);
  return response;
}
