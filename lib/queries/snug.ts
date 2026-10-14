import "server-only";
import { and, eq } from "drizzle-orm";
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
