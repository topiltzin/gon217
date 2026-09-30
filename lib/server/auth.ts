import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Nickname } from "@/lib/player";

const scryptAsync = promisify(scrypt) as (
  pin: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "gks_session";
const SESSION_DAYS = 180;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/** "scrypt$<salt>$<hash>", both base64url. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(pin, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Rejects cross-site writes. SameSite=Lax already blocks cross-site POST cookies;
 * this is a second guard for browsers that don't honour it.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === request.nextUrl.origin;
}

export async function startSession(
  sql: NeonQueryFunction<false, false>,
  playerId: string,
  response: NextResponse,
) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO sessions (token_hash, player_id, expires_at) VALUES (${sha256(token)}, ${playerId}, ${expires})`;
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession(
  sql: NeonQueryFunction<false, false>,
  request: NextRequest,
  response: NextResponse,
) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  response.cookies.delete(SESSION_COOKIE);
}

export type SessionPlayer = Nickname & { id: string };

export async function getSessionPlayer(
  sql: NeonQueryFunction<false, false>,
  request: NextRequest,
): Promise<SessionPlayer | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql`
    SELECT p.id, p.adjective, p.animal, p.number
    FROM sessions s JOIN players p ON p.id = s.player_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now()`;
  return (rows[0] as SessionPlayer | undefined) ?? null;
}
