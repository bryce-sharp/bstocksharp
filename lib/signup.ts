import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Self sign-up guards. Sign-up is open to anyone and needs no email, so it
// leans on three things: Cloudflare Turnstile (a free bot check), a daily cap
// on new games-only hubs, and a sweep of hubs that never saved a game.

/** The apps a self sign-up's hub gets. */
export const SIGNUP_APPS = ["games"];

// The bstocksharp.dev widget's public key; development uses Cloudflare's
// published test keys, which always pass, unless TURNSTILE_SECRET_KEY is set.
const SITE_KEY = "0x4AAAAAAFnKXNBBkccYYR2Y";
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET = "1x0000000000000000000000000000000AA";
const isProd = process.env.NODE_ENV === "production";
const realKeys = isProd || !!process.env.TURNSTILE_SECRET_KEY;

/** The widget's action name, checked on both sides. */
export const TURNSTILE_ACTION = "signup";
/** Hosts a real token may come from (TURNSTILE_HOSTNAMES, comma-separated, overrides). */
const HOSTNAMES = (process.env.TURNSTILE_HOSTNAMES ?? "bstocksharp.dev,www.bstocksharp.dev").split(",").map((h) => h.trim());

/** Turnstile's public key for the page, or null when sign-up has no secret to check it (closed). */
export function turnstileSiteKey(): string | null {
  if (!realKeys) return TEST_SITE_KEY;
  return process.env.TURNSTILE_SECRET_KEY ? SITE_KEY : null;
}

/** Asks Cloudflare whether the widget's token came from a person on this site; fails closed. */
export async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = realKeys ? process.env.TURNSTILE_SECRET_KEY : TEST_SECRET;
  if (!secret || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const out = (await res.json()) as { success?: boolean; action?: string; hostname?: string };
    if (out.success !== true) return false;
    // Test keys answer with a placeholder host and action, so only real tokens are held to them.
    return !realKeys || (out.action === TURNSTILE_ACTION && HOSTNAMES.includes(out.hostname ?? ""));
  } catch {
    return false;
  }
}

/** New games-only hubs allowed per day (SIGNUP_DAILY_CAP, default 25). */
export function dailyCap(): number {
  const n = Number(process.env.SIGNUP_DAILY_CAP);
  return Number.isInteger(n) && n >= 0 ? n : 25;
}

/** Games-only hubs made in the last 24 hours. */
export async function signupsToday(): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM groups
    WHERE apps = ${JSON.stringify(SIGNUP_APPS)}::jsonb AND created_at > now() - interval '1 day'`);
  return rows.rows[0]?.n ?? 0;
}

/** Deletes games-only hubs older than 30 days that never saved a game; returns how many. */
export async function pruneIdleGamesHubs(): Promise<number> {
  const rows = await db.execute<{ id: number }>(sql`
    DELETE FROM groups g
    WHERE g.apps = ${JSON.stringify(SIGNUP_APPS)}::jsonb
      AND g.created_at < now() - interval '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM snug_days s JOIN profiles p ON p.id = s.profile_id WHERE p.group_id = g.id
      )
    RETURNING g.id`);
  return rows.rows.length;
}
