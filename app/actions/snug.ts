"use server";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { snugDays } from "@/lib/db/schema";
import { requireEditorFor } from "@/lib/auth";
import { getActiveProfile } from "@/lib/profile";
import { listSnugDays } from "@/lib/queries/snug";
import { isCurrent } from "@/components/games/snug/version";

// Snug results belong to the ACTIVE person, like weigh-ins; the browser never names a profile, so it cannot write anyone else's.

type Json = Record<string, unknown>;

export type RemoteSnugDay = { dateKey: string; attempt: Json | null; best: Json | null; progress: Json | null };

/** A day to save: a finished run (`attempt` only when scored), or the unfinished game. Shapes are checked here. */
export type SnugUpload = { dateKey: string; attempt?: object | null; best?: object | null; progress?: object | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;
const MAX_DAY_BYTES = 40_000;

async function activeProfileId(): Promise<number> {
  const active = await getActiveProfile();
  if (!active) throw new Error("No one is signed in.");
  await requireEditorFor(active.id);
  return active.id;
}

function isRun(v: unknown): v is Json & { gaps: number; timeMs: number; hints?: number; hinted?: boolean; pieces: unknown[] } {
  if (!v || typeof v !== "object") return false;
  const r = v as Json;
  return Number.isInteger(r.gaps) && (r.gaps as number) >= 0 && Number.isFinite(r.timeMs) && (r.timeMs as number) >= 0 && Array.isArray(r.pieces);
}

export async function loadSnugDays(): Promise<RemoteSnugDay[]> {
  return listSnugDays(await activeProfileId());
}

export async function saveSnugDays(days: SnugUpload[]): Promise<void> {
  const profileId = await activeProfileId();
  if (!Array.isArray(days) || days.length > MAX_DAYS) throw new Error("Too many days.");

  for (const day of days) {
    if (!DATE_RE.test(day?.dateKey ?? "") || JSON.stringify(day).length > MAX_DAY_BYTES) throw new Error("Bad Snug day.");
    // A browser that has not yet cleared runs from older puzzles cannot write them back.
    if (![day.attempt, day.best, day.progress].filter((r) => r != null).every(isCurrent)) continue;
    const run = day.best ?? day.attempt;

    if (run !== undefined && run !== null) {
      if (!isRun(run) || (day.attempt != null && !isRun(day.attempt))) throw new Error("Bad Snug run.");
      const hints = typeof run.hints === "number" ? run.hints : run.hinted ? 1 : 0;
      // The stored best is replaced only by a better run: fewer holes, then fewer hints, then faster.
      const better = sql`(${snugDays.best} IS NULL OR (excluded.best_gaps, excluded.best_hints, excluded.best_time_ms) < (${snugDays.bestGaps}, ${snugDays.bestHints}, ${snugDays.bestTimeMs}))`;
      await db
        .insert(snugDays)
        .values({
          profileId,
          dateKey: day.dateKey,
          attempt: (day.attempt ?? null) as Json | null,
          best: run,
          bestGaps: run.gaps,
          bestHints: hints,
          bestTimeMs: Math.round(run.timeMs),
          progress: null,
        })
        .onConflictDoUpdate({
          target: [snugDays.profileId, snugDays.dateKey],
          set: {
            // The first scored run stands; a later one never replaces it.
            attempt: sql`COALESCE(${snugDays.attempt}, excluded.attempt)`,
            best: sql`CASE WHEN ${better} THEN excluded.best ELSE ${snugDays.best} END`,
            bestGaps: sql`CASE WHEN ${better} THEN excluded.best_gaps ELSE ${snugDays.bestGaps} END`,
            bestHints: sql`CASE WHEN ${better} THEN excluded.best_hints ELSE ${snugDays.bestHints} END`,
            bestTimeMs: sql`CASE WHEN ${better} THEN excluded.best_time_ms ELSE ${snugDays.bestTimeMs} END`,
            progress: sql`NULL`,
            updatedAt: sql`now()`,
          },
        });
    } else if ("progress" in day) {
      await db
        .insert(snugDays)
        .values({ profileId, dateKey: day.dateKey, progress: (day.progress ?? null) as Json | null })
        .onConflictDoUpdate({
          target: [snugDays.profileId, snugDays.dateKey],
          set: { progress: sql`excluded.progress`, updatedAt: sql`now()` },
        });
    }
  }
}
