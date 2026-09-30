import { type NextRequest } from "next/server";
import { gameScoring } from "@/games/scoring";
import { getSql } from "@/lib/server/db";

const LIMIT = 10;

/** Top scores for one game. Only nicknames (preset words) and scores are shared. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/leaderboard/[slug]">) {
  const { slug } = await ctx.params;
  const scoring = gameScoring[slug];
  if (!scoring) return Response.json({ error: "not found" }, { status: 404 });
  const sql = getSql();
  if (!sql) return Response.json({ available: false, entries: [] });

  const rows =
    scoring.direction === "higher"
      ? await sql`
          SELECT p.adjective, p.animal, p.number, s.best FROM scores s JOIN players p ON p.id = s.player_id
          WHERE s.slug = ${slug} ORDER BY s.best DESC, s.updated_at ASC LIMIT ${LIMIT}`
      : await sql`
          SELECT p.adjective, p.animal, p.number, s.best FROM scores s JOIN players p ON p.id = s.player_id
          WHERE s.slug = ${slug} ORDER BY s.best ASC, s.updated_at ASC LIMIT ${LIMIT}`;
  return Response.json({ available: true, entries: rows });
}
