// Per-day results: the scored first run, the best run ever (any mode), and a status for the calendar.

import { addDays, loadAttempt } from "../daily";
import type { Attempt } from "./parts";

export const GAME = "snug";

const bestKey = (dateKey: string) => `${GAME}.best.${dateKey}`;
const progressPrefix = `${GAME}.progress.`;

/** Fewer holes wins, then not using the hint, then the faster time. */
export function isBetter(a: Attempt, b: Attempt | null): boolean {
  if (!b) return true;
  if (a.gaps !== b.gaps) return a.gaps < b.gaps;
  if (!!a.hinted !== !!b.hinted) return !a.hinted;
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
}

/** What the calendar shows for a day, from the scored run, the best run, and any unfinished game. */
export function dayRecord(dateKey: string): DayRecord {
  const scored = loadAttempt<Attempt>(GAME, dateKey);
  const best = loadBest(dateKey) ?? scored;
  if (scored?.gaps === 0) return { status: "perfect" };
  if (best?.gaps === 0) return { status: "completedLater", holes: scored?.gaps };
  if (scored) return { status: "holes", holes: scored.gaps };
  if (best) return { status: "tried", holes: best.gaps };
  try {
    if (localStorage.getItem(progressPrefix + dateKey)) return { status: "inProgress" };
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
