"use server";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { snugDays } from "@/lib/db/schema";
import { requireEditorFor } from "@/lib/auth";
import { listSnugCrowd, listSnugDays } from "@/lib/queries/snug";
import { PUZZLE_VERSION, isCurrent } from "@/components/games/snug/version";
import { mean, median } from "@/components/games/snug/average";

// Snug results belong to one person. The browser names whose board it is, and the server refuses anyone this login may not play for.

type Json = Record<string, unknown>;

export type RemoteSnugDay = { dateKey: string; attempt: Json | null; best: Json | null; progress: Json | null };

/** A day to save: a finished run (`attempt` only when scored), or the unfinished game. Shapes are checked here. */
export type SnugUpload = { dateKey: string; attempt?: object | null; best?: object | null; progress?: object | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;
const MAX_DAY_BYTES = 40_000;

/** The person a board belongs to, refused unless this login may play for them (themselves, or someone without a login). */
async function playerId(profileId: number): Promise<number> {
  if (!Number.isInteger(profileId)) throw new Error("No one to save for.");
  await requireEditorFor(profileId);
  return profileId;
}

function isRun(v: unknown): v is Json & { gaps: number; timeMs: number; hints?: number; hinted?: boolean; pieces: unknown[] } {
  if (!v || typeof v !== "object") return false;
  const r = v as Json;
  return Number.isInteger(r.gaps) && (r.gaps as number) >= 0 && Number.isFinite(r.timeMs) && (r.timeMs as number) >= 0 && Array.isArray(r.pieces);
}

export async function loadSnugDays(profileId: number): Promise<RemoteSnugDay[]> {
  return listSnugDays(await playerId(profileId));
}

export async function saveSnugDays(player: number, days: SnugUpload[]): Promise<void> {
  const profileId = await playerId(player);
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

/** Fewer players than this and everyone's numbers stay hidden: they would be one or two people's times. */
const MIN_CROWD = 3;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** How everyone did on one day; times only once enough people played. `beat` is the share of other runs `mine` beats. */
export type DayCrowd = { players: number; perfect: number; enough: boolean; medianMs: number | null; meanMs: number | null; beat: number | null };

/** How everyone did in one month; the quilt counts only once the month is over. */
export type MonthCrowd = {
  players: number;
  enough: boolean;
  medianDays: number | null;
  medianMs: number | null;
  meanMs: number | null;
  completed: number | null;
  perfectMonths: number | null;
};

/** The game's order for runs: fewer holes, then fewer hints, then faster. Negative when `a` is better. */
const compareRuns = (a: { gaps: number; hints: number; timeMs: number }, b: { gaps: number; hints: number; timeMs: number }) =>
  a.gaps - b.gaps || a.hints - b.hints || a.timeMs - b.timeMs;

export async function loadSnugDayCrowd(dateKey: string, mine?: { gaps: number; hints: number; timeMs: number }): Promise<DayCrowd> {
  if (!DATE_RE.test(dateKey)) throw new Error("Bad Snug day.");
  const runs = (await listSnugCrowd(dateKey, dateKey, PUZZLE_VERSION)).filter((r) => r.gaps !== null && r.timeMs !== null);
  const perfect = runs.filter((r) => r.gaps === 0).map((r) => r.timeMs!);
  const enough = runs.length >= MIN_CROWD;
  let beat: number | null = null;
  if (enough && mine && [mine.gaps, mine.hints, mine.timeMs].every(Number.isFinite)) {
    // Ties, your own run among them, count neither way.
    const order = runs.map((r) => compareRuns({ gaps: r.gaps!, hints: r.hints ?? 0, timeMs: r.timeMs! }, mine));
    const better = order.filter((o) => o < 0).length;
    const worse = order.filter((o) => o > 0).length;
    beat = better + worse ? worse / (better + worse) : null;
  }
  return { players: runs.length, perfect: perfect.length, enough, medianMs: enough ? median(perfect) : null, meanMs: enough ? mean(perfect) : null, beat };
}

export async function loadSnugMonthCrowd(monthKey: string): Promise<MonthCrowd> {
  if (!MONTH_RE.test(monthKey)) throw new Error("Bad Snug month.");
  const [y, m] = monthKey.split("-").map(Number);
  const days = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const rows = await listSnugCrowd(`${monthKey}-01`, `${monthKey}-${String(days).padStart(2, "0")}`, PUZZLE_VERSION);
  const scored = rows.filter((r) => r.gaps !== null && r.timeMs !== null);
  const perPlayer = new Map<number, { played: number; perfect: number; filled: number }>();
  for (const r of rows) {
    const p = perPlayer.get(r.profileId) ?? { played: 0, perfect: 0, filled: 0 };
    if (r.gaps !== null) p.played++;
    if (r.gaps === 0) p.perfect++;
    if (r.gaps === 0 || r.bestGaps === 0) p.filled++;
    perPlayer.set(r.profileId, p);
  }
  const players = [...perPlayer.values()].filter((p) => p.played > 0);
  const enough = players.length >= MIN_CROWD;
  const over = monthKey < new Date().toISOString().slice(0, 7);
  const perfect = scored.filter((r) => r.gaps === 0).map((r) => r.timeMs!);
  return {
    players: players.length,
    enough,
    medianDays: enough ? median(players.map((p) => p.played)) : null,
    medianMs: enough ? median(perfect) : null,
    meanMs: enough ? mean(perfect) : null,
    completed: enough && over ? [...perPlayer.values()].filter((p) => p.filled === days).length : null,
    perfectMonths: enough && over ? players.filter((p) => p.perfect === days).length : null,
  };
}
