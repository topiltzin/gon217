import { NextResponse, type NextRequest } from "next/server";
import { endSession, isSameOrigin } from "@/lib/server/auth";
import { accountsUnavailable, getSql } from "@/lib/server/db";

export async function POST(request: NextRequest) {
  const sql = getSql();
  if (!sql) return accountsUnavailable();
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  await endSession(sql, request, response);
  return response;
}
