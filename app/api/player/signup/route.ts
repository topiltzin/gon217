import { NextResponse, type NextRequest } from "next/server";
import { credentialsSchema } from "@/lib/player-schemas";
import { hashPin, isSameOrigin, startSession } from "@/lib/server/auth";
import { accountsUnavailable, getSql } from "@/lib/server/db";

export async function POST(request: NextRequest) {
  const sql = getSql();
  if (!sql) return accountsUnavailable();
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const { adjective, animal, number, pin } = parsed.data;
  const rows = await sql`
    INSERT INTO players (adjective, animal, number, pin_hash)
    VALUES (${adjective}, ${animal}, ${number}, ${await hashPin(pin)})
    ON CONFLICT (adjective, animal, number) DO NOTHING
    RETURNING id`;
  if (!rows[0]) return Response.json({ error: "taken" }, { status: 409 });

  const response = NextResponse.json(
    { player: { adjective, animal, number }, bests: {} },
    { status: 201 },
  );
  await startSession(sql, rows[0].id, response);
  return response;
}
