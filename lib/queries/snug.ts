import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { snugDays } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { profileInGroup } from "./scope";

/** Every saved Snug day for one person in this household. */
export async function listSnugDays(profileId: number) {
  const groupId = await requireGroupId();
  return db
    .select({ dateKey: snugDays.dateKey, attempt: snugDays.attempt, best: snugDays.best, progress: snugDays.progress })
    .from(snugDays)
    .where(and(eq(snugDays.profileId, profileId), profileInGroup(snugDays.profileId, groupId)));
}

/**
 * Every player's Snug results between two dates, for the stats everyone sees: the scored first run's holes and time,
 * and the best run's holes. Not scoped to a household; callers only ever return totals, never one person's row.
 */
export async function listSnugCrowd(from: string, to: string, version: number) {
  const current = (col: string) => sql.raw(`(${col}->>'v')::int = ${Number(version)}`);
  return db
    .select({
      profileId: snugDays.profileId,
      dateKey: snugDays.dateKey,
      gaps: sql<number | null>`CASE WHEN ${current("attempt")} THEN (${snugDays.attempt}->>'gaps')::int END`,
      timeMs: sql<number | null>`CASE WHEN ${current("attempt")} THEN (${snugDays.attempt}->>'timeMs')::float END`,
      // Older runs saved only `hinted`, which counts as one hint.
      hints: sql<number | null>`CASE WHEN ${current("attempt")} THEN COALESCE((${snugDays.attempt}->>'hints')::int, CASE WHEN ${snugDays.attempt}->>'hinted' = 'true' THEN 1 ELSE 0 END) END`,
      bestGaps: sql<number | null>`CASE WHEN ${current("best")} THEN ${snugDays.bestGaps} END`,
    })
    .from(snugDays)
    .where(and(gte(snugDays.dateKey, from), lte(snugDays.dateKey, to)));
}
