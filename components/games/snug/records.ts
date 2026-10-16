// Per-day results: the scored first run, the best run ever (any mode), and a status for the calendar.

import { addDays, loadAttempt } from "../daily";
import { hintsUsed, type Attempt, type PieceState } from "./parts";
import { isCurrent } from "./version";

export const GAME = "snug";
/** Backdated a week so there were past quilts to play from day one. */
export const LAUNCH_DATE = "2026-10-01";

const bestKey = (dateKey: string) => `${GAME}.best.${dateKey}`;
const progressPrefix = `${GAME}.progress.`;

/** Fewer holes wins, then fewer hints, then the faster time. */
export function isBetter(a: Attempt, b: Attempt | null): boolean {
  if (!b) return true;
  if (a.gaps !== b.gaps) return a.gaps < b.gaps;
  if (hintsUsed(a) !== hintsUsed(b)) return hintsUsed(a) < hintsUsed(b);
  return a.timeMs < b.timeMs;
}

export function loadBest(dateKey: string): Attempt | null {
  try {
    const raw = localStorage.getItem(bestKey(dateKey));
    return raw ? (JSON.parse(raw) as Attempt) : null;
  } catch {
    return null;
  }
}

/** Keeps the better of the saved best and `run`, returning whichever is now the best. */
export function saveBest(dateKey: string, run: Attempt): Attempt {
  const best = loadBest(dateKey);
  if (!isBetter(run, best)) return best!;
  try {
    localStorage.setItem(bestKey(dateKey), JSON.stringify(run));
  } catch {
    // Storage can be blocked; the best then only lasts for this visit.
  }
  return run;
}

export type DayStatus = "perfect" | "completedLater" | "holes" | "tried" | "inProgress" | "none";

export interface DayRecord {
  status: DayStatus;
  /** Holes in the scored run, or in the best practice run for a day only practiced. */
  holes?: number;
  /** The quilt to draw for the day: the scored run, or the best practice run. */
  pieces?: PieceState[];
}

/** What the calendar shows for a day, from the scored run, the best run, and any unfinished game. */
export function dayRecord(dateKey: string): DayRecord {
  const scored = loadAttempt<Attempt>(GAME, dateKey);
  const best = loadBest(dateKey) ?? scored;
  if (scored?.gaps === 0) return { status: "perfect", pieces: scored.pieces };
  if (best?.gaps === 0) return { status: "completedLater", holes: scored?.gaps, pieces: scored?.pieces ?? best.pieces };
  if (scored) return { status: "holes", holes: scored.gaps, pieces: scored.pieces };
  if (best) return { status: "tried", holes: best.gaps, pieces: best.pieces };
  try {
    // Older versions saved a day as soon as it was opened; only a started game counts.
    const raw = localStorage.getItem(progressPrefix + dateKey);
    if (raw && (JSON.parse(raw) as { started?: boolean }).started) return { status: "inProgress" };
  } catch {
    // Unreadable storage just reads as unplayed.
  }
  return { status: "none" };
}

export interface Stats {
  played: number;
  perfect: number;
  /** Days in a row, ending today or yesterday, finished on the day. */
  streak: number;
  bestStreak: number;
}

/** Totals across scored runs only, so practice on past quilts never counts. */
export function playerStats(launch: string, today: string): Stats {
  let played = 0;
  let perfect = 0;
  let run = 0;
  let bestStreak = 0;
  for (let k = launch; k <= today; k = addDays(k, 1)) {
    const scored = loadAttempt<Attempt>(GAME, k);
    if (scored) {
      played++;
      if (scored.gaps === 0) perfect++;
      bestStreak = Math.max(bestStreak, ++run);
    } else if (k !== today) {
      run = 0;
    }
  }
  return { played, perfect, streak: run, bestStreak };
}

/** Today's unfinished scored game, saved as it goes so leaving and returning cannot reset the clock. */
export interface Progress {
  pieces: PieceState[];
  elapsedMs: number;
  started: boolean;
  /** The pieces the hints placed, so a reload cannot earn extra hints. */
  hintIds?: string[];
  /** Spares marked as left over in the intended fill, which stay marked after a reload. */
  pulledIds?: string[];
  /** Saved by games from before the second hint. */
  hintId?: string | null;
  /** The puzzle version it was played on (see version.ts). */
  v?: number;
}

const SAVED_DAY = new RegExp(`^${GAME}\\.(attempt|best|progress)\\.\\d{4}-\\d{2}-\\d{2}$`);

/** Removes saved runs and unfinished games from older puzzles, whose boards no longer exist. */
export function clearStaleRecords() {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      if (!SAVED_DAY.test(key)) continue;
      let record: unknown = null;
      try {
        record = JSON.parse(localStorage.getItem(key) ?? "null");
      } catch {
        // Unreadable counts as stale.
      }
      if (!isCurrent(record)) stale.push(key);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Unreadable storage holds nothing to clear.
  }
}
