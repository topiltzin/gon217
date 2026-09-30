import { type NextRequest } from "next/server";
import { gameScoring } from "@/games/scoring";
import { scoreSubmissionSchema } from "@/lib/player";
import { getSessionPlayer, isSameOrigin } from "@/lib/server/auth";
import { accountsUnavailable, getSql } from "@/lib/server/db";

/** Saves a round's score for the logged-in player if it beats their best. */
export async function POST(request: NextRequest) {
  const sql = getSql();
  if (!sql) return accountsUnavailable();
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const player = await getSessionPlayer(sql, request);
  if (!player) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = scoreSubmissionSchema.safeParse(await request.json().catch(() => null));
  const scoring = parsed.success ? gameScoring[parsed.data.slug] : undefined;
  if (!parsed.success || !scoring) return Response.json({ error: "invalid" }, { status: 400 });

  const { slug, score } = parsed.data;
  const higher = scoring.direction === "higher";
  const saved = await sql`
    INSERT INTO scores (player_id, slug, best) VALUES (${player.id}, ${slug}, ${score})
    ON CONFLICT (player_id, slug) DO UPDATE SET best = EXCLUDED.best, updated_at = now()
    WHERE (${higher} AND EXCLUDED.best > scores.best) OR (NOT ${higher} AND EXCLUDED.best < scores.best)
    RETURNING best`;
  return Response.json({ isNewBest: saved.length > 0 });
}
