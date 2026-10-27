import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { DEFAULT_TZ } from "@/lib/finance/parse";
import { getSessionGroupId } from "@/lib/session";

/**
 * The household's IANA timezone, memoized per request (React cache) so the many
 * date computations in one render share a single lookup. Falls back to Central.
 * This is what pins server-side "today"/"current month" to the household's day
 * instead of Vercel's UTC.
 */
export const getGroupTimezone = cache(async (groupId: number): Promise<string> => {
  const [g] = await db
    .select({ tz: groups.timezone })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  return g?.tz || DEFAULT_TZ;
});

/** The signed-in hub's name (Home, …), or null when signed out. The shared login goes by it. */
export const getHubName = cache(async (): Promise<string | null> => {
  const groupId = await getSessionGroupId();
  if (groupId === null) return null;
  const [g] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId)).limit(1);
  return g?.name ?? null;
});
