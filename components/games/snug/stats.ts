// Snug stats from this browser's runs: a month's times and an all-time page. Only scored first runs count, and times
// come from perfect runs, since holes outrank time. The typical (median) time leads; the average sits beside it.

import { addDays, loadAttempt, weekday } from "../daily";
import { hintsUsed, type Attempt } from "./parts";
import { levelFor } from "./generator";
import { GAME, loadBest } from "./records";
import { isCurrent } from "./version";
import { mean, median } from "./average";

export { mean, median };

/** One scored first run, as the stats read it. */
export type TimedDay = { dateKey: string; timeMs: number; gaps: number; hints: number; finishedAt?: number };

export type TimeSummary = {
  count: number;
  fastest: TimedDay;
  slowest: TimedDay;
  medianMs: number;
  meanMs: number;
};

/** Fastest, slowest, typical and average time across perfect runs; null with none. */
export function timeSummary(runs: TimedDay[]): TimeSummary | null {
  const perfect = runs.filter((r) => r.gaps === 0);
  if (!perfect.length) return null;
  const times = perfect.map((r) => r.timeMs);
  return {
    count: perfect.length,
    fastest: perfect.reduce((a, r) => (r.timeMs < a.timeMs ? r : a)),
    slowest: perfect.reduce((a, r) => (r.timeMs > a.timeMs ? r : a)),
    medianMs: median(times)!,
    meanMs: mean(times)!,
  };
}

/** The most days in a row with a scored run. */
export function longestRun(dateKeys: string[]): number {
  const days = new Set(dateKeys);
  let best = 0;
  for (const k of days) {
    if (days.has(addDays(k, -1))) continue;
    let n = 0;
    for (let d = k; days.has(d); d = addDays(d, 1)) n++;
    best = Math.max(best, n);
  }
  return best;
}

export type MonthStats = { times: TimeSummary | null; played: number; hints: number; longestRun: number };

export function monthStats(runs: TimedDay[]): MonthStats {
  return { times: timeSummary(runs), played: runs.length, hints: runs.reduce((s, r) => s + r.hints, 0), longestRun: longestRun(runs.map((r) => r.dateKey)) };
}

const toTimed = (dateKey: string, run: Attempt): TimedDay => ({ dateKey, timeMs: run.timeMs, gaps: run.gaps, hints: hintsUsed(run), finishedAt: run.finishedAt });

/** Every scored first run from `launch` through `today`, oldest first. */
export function scoredRuns(launch: string, today: string): TimedDay[] {
  const out: TimedDay[] = [];
  for (let k = launch; k <= today; k = addDays(k, 1)) {
    const run = loadAttempt<Attempt>(GAME, k);
    if (run && isCurrent(run)) out.push(toTimed(k, run));
  }
  return out;
}

export const TIMES_OF_DAY = ["Morning", "Afternoon", "Evening", "Night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** Morning 5 to noon, afternoon to 5pm, evening to 9pm, night until 5am, in this browser's time zone. */
export function timeOfDay(at: number): TimeOfDay {
  const h = new Date(at).getHours();
  return h >= 5 && h < 12 ? "Morning" : h >= 12 && h < 17 ? "Afternoon" : h >= 17 && h < 21 ? "Evening" : "Night";
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Difficulty names in the order they get harder. */
export const LEVEL_ORDER = ["Gentle", "Easy", "Steady", "Tricky", "Tough"];

export type AllTimeStats = {
  runs: TimedDay[];
  /** Scored runs by holes left: 0, 1, 2, 3, then 4 or more. */
  holes: number[];
  byLevel: { name: string; count: number; medianMs: number; meanMs: number }[];
  /** The last 30 perfect scored runs, oldest first. */
  recent: TimedDay[];
  times: TimeSummary | null;
  /** Scored runs by when they were finished; only runs that recorded it. */
  timesOfDay: Record<TimeOfDay, number>;
  favoriteWeekday: string | null;
  squares: number;
  hints: number;
  perfectNoHints: number;
  caughtUp: number;
  longestRun: number;
};

export function allTimeStats(launch: string, today: string): AllTimeStats {
  const runs = scoredRuns(launch, today);
  const holes = [0, 0, 0, 0, 0];
  for (const r of runs) holes[Math.min(r.gaps, 4)]!++;

  const byLevel = LEVEL_ORDER.flatMap((name) => {
    const times = runs.filter((r) => r.gaps === 0 && levelFor(r.dateKey)?.name === name).map((r) => r.timeMs);
    return times.length ? [{ name, count: times.length, medianMs: median(times)!, meanMs: mean(times)! }] : [];
  });

  const timesOfDay = Object.fromEntries(TIMES_OF_DAY.map((t) => [t, 0])) as Record<TimeOfDay, number>;
  for (const r of runs) if (r.finishedAt) timesOfDay[timeOfDay(r.finishedAt)]++;

  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const r of runs) perWeekday[weekday(r.dateKey)]!++;
  const top = Math.max(...perWeekday);

  // Squares stitched and days caught up count every finish, practice included.
  let squares = 0;
  let caughtUp = 0;
  for (let k = launch; k <= today; k = addDays(k, 1)) {
    const scored = loadAttempt<Attempt>(GAME, k);
    const best = loadBest(k) ?? scored;
    if (!best || !isCurrent(best)) continue;
    squares += best.pieces.filter((p) => p.at && !p.loose).reduce((s, p) => s + p.cells.length, 0);
    if (best.gaps === 0 && (!scored || scored.gaps > 0)) caughtUp++;
  }

  return {
    runs,
    holes,
    byLevel,
    recent: runs.filter((r) => r.gaps === 0).slice(-30),
    times: timeSummary(runs),
    timesOfDay,
    favoriteWeekday: top > 0 ? WEEKDAY_NAMES[perWeekday.indexOf(top)]! : null,
    squares,
    hints: runs.reduce((s, r) => s + r.hints, 0),
    perfectNoHints: runs.filter((r) => r.gaps === 0 && r.hints === 0).length,
    caughtUp,
    longestRun: longestRun(runs.map((r) => r.dateKey)),
  };
}
