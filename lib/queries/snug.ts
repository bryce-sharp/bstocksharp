import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { snugDays } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { profileInGroup } from "./scope";
import type { CrowdRow } from "@/components/games/snug/crowd";

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
export async function listSnugCrowd(from: string, to: string, version: number): Promise<CrowdRow[]> {
  // Read as text and numbers only when they are numbers, so one malformed row is left out instead of failing the query.
  const current = (col: string) => sql.raw(`${col}->>'v' = '${Number(version)}'`);
  const num = (field: string) => sql.raw(`CASE WHEN jsonb_typeof(attempt->'${field}') = 'number' THEN (attempt->>'${field}')::float END`);
  return db
    .select({
      profileId: snugDays.profileId,
      gaps: sql<number | null>`CASE WHEN ${current("attempt")} THEN ${num("gaps")} END`,
      timeMs: sql<number | null>`CASE WHEN ${current("attempt")} THEN ${num("timeMs")} END`,
      // Older runs saved only `hinted`, which counts as one hint.
      hints: sql<number | null>`CASE WHEN ${current("attempt")} THEN COALESCE(${num("hints")}, CASE WHEN ${snugDays.attempt}->>'hinted' = 'true' THEN 1 ELSE 0 END) END`,
      bestGaps: sql<number | null>`CASE WHEN ${current("best")} THEN ${snugDays.bestGaps} END`,
    })
    .from(snugDays)
    .where(and(gte(snugDays.dateKey, from), lte(snugDays.dateKey, to)));
}
