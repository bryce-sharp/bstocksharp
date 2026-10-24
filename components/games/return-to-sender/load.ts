// Each day's puzzles come from the months the server hands out (app/games/return-to-sender/month/[month]). A copy of
// each month is kept in the browser, so days already reached load at once.

import { BOARD_IDS } from "./boards";
import { GAME } from "./records";
import { PUZZLE_VERSION, type DayPuzzles } from "./schedule";

export type MonthDays = { monthKey: string; version: number; through: string; days: DayPuzzles[] };

const cacheKey = (monthKey: string) => `${GAME}.month.${monthKey}`;

function readCache(monthKey: string): MonthDays | null {
  try {
    const raw = localStorage.getItem(cacheKey(monthKey));
    return raw ? (JSON.parse(raw) as MonthDays) : null;
  } catch {
    return null;
  }
}

function writeCache(data: MonthDays) {
  try {
    localStorage.setItem(cacheKey(data.monthKey), JSON.stringify(data));
  } catch {
    // Storage can be full or blocked; the month is fetched again next time.
  }
}

/** The month's days up to at least `upTo`, from the browser's copy when it reaches that far and has every board. */
export async function loadMonth(monthKey: string, upTo: string): Promise<MonthDays> {
  const cached = readCache(monthKey);
  const usable =
    cached?.version === PUZZLE_VERSION &&
    cached.days.some((d) => d.dateKey >= upTo) &&
    cached.days.every((d) => BOARD_IDS.every((b) => d.puzzles[b]));
  if (usable) return cached;
  try {
    const response = await fetch(`/games/return-to-sender/month/${monthKey}`);
    if (!response.ok) throw new Error(`Return to Sender month ${monthKey}: ${response.status}`);
    const fresh = (await response.json()) as MonthDays;
    writeCache(fresh);
    return fresh;
  } catch (err) {
    // Offline or a server hiccup: an older copy still serves the days it has.
    if (cached) return cached;
    throw err;
  }
}

/** One day's puzzles; rejects when the day is not served yet or cannot be reached. */
export async function loadDay(dateKey: string): Promise<DayPuzzles> {
  const month = await loadMonth(dateKey.slice(0, 7), dateKey);
  const day = month.days.find((d) => d.dateKey === dateKey);
  if (!day) throw new Error(`Return to Sender: no puzzles for ${dateKey}`);
  return day;
}
