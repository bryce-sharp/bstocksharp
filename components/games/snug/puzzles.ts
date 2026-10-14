// Each day's puzzle comes from the month quilts the server hands out (app/games/snug/month/[month]). A copy of
// each month is kept in the browser, so days already reached load at once and replay offline.

import type { Puzzle } from "./generator";

/** The month's whole outline and size, sent only once every day of the month has been reached. */
export type MonthShape = { outline: string; minX: number; minY: number; width: number; height: number };

export type MonthDays = {
  monthKey: string;
  version: number;
  through: string;
  /** Each day reached so far, with where its board sits in the month quilt. */
  days: { dateKey: string; puzzle: Puzzle; offset: { x: number; y: number } }[];
  shape?: MonthShape;
};

const cacheKey = (monthKey: string) => `snug.month.${monthKey}`;
const inFlight = new Map<string, Promise<MonthDays>>();

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

/** The month's days up to at least `upTo`, from the browser's copy when it reaches that far, else from the server. */
export async function loadMonth(monthKey: string, upTo: string): Promise<MonthDays> {
  const cached = readCache(monthKey);
  // Copies from before positions were sent lack offsets and are fetched again.
  if (cached?.days.every((d) => d.offset) && cached.days.some((d) => d.dateKey >= upTo)) return cached;
  let request = inFlight.get(monthKey);
  if (!request) {
    request = fetch(`/games/snug/month/${monthKey}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Snug month ${monthKey}: ${r.status}`);
        return r.json() as Promise<MonthDays>;
      })
      .finally(() => inFlight.delete(monthKey));
    inFlight.set(monthKey, request);
  }
  try {
    const fresh = await request;
    writeCache(fresh);
    return fresh;
  } catch (err) {
    // Offline or a server hiccup: an older copy still serves the days it has.
    if (cached) return cached;
    throw err;
  }
}

/** The last day of a month, "YYYY-MM-DD". */
export function lastDayOf(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${monthKey}-${String(new Date(y!, m!, 0).getDate()).padStart(2, "0")}`;
}

/** One day's puzzle; rejects when the day is not served yet or cannot be reached. */
export async function loadPuzzle(dateKey: string): Promise<Puzzle> {
  const month = await loadMonth(dateKey.slice(0, 7), dateKey);
  const day = month.days.find((d) => d.dateKey === dateKey);
  if (!day) throw new Error(`Snug: no puzzle for ${dateKey}`);
  return day.puzzle;
}
