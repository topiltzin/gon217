import { type NextRequest } from "next/server";
import { getSessionPlayer } from "@/lib/server/auth";
import { getSql } from "@/lib/server/db";

/** Who is logged in on this browser, and their saved bests. */
export async function GET(request: NextRequest) {
  const sql = getSql();
  if (!sql) return Response.json({ available: false, player: null, bests: {} });
  const player = await getSessionPlayer(sql, request);
  if (!player) return Response.json({ available: true, player: null, bests: {} });
  const rows = await sql`SELECT slug, best FROM scores WHERE player_id = ${player.id}`;
  const bests = Object.fromEntries(rows.map((r) => [r.slug, r.best]));
  const { adjective, animal, number } = player;
  return Response.json({ available: true, player: { adjective, animal, number }, bests });
}
