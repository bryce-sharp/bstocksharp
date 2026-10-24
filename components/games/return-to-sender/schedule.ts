// Return to Sender's months: every built board gets a puzzle each day, generated ahead into
// data/return-to-sender/months/ so a puzzle never changes once played. While testing, the player picks which board to play.

import { addDays, makeRng } from "../daily";
import { BOARD_IDS, BOARDS } from "./boards";
import type { BoardId, Puzzle } from "./engine";
import { checkPuzzle, createPuzzle } from "./puzzle";

/** Bump when month files change shape. */
export const PUZZLE_VERSION = 1;

export interface DayPuzzles {
  dateKey: string;
  puzzles: Partial<Record<BoardId, Puzzle>>;
}
export interface MonthFile {
  version: number;
  monthKey: string;
  days: DayPuzzles[];
}

export function monthDays(monthKey: string): string[] {
  const out: string[] = [];
  for (let key = `${monthKey}-01`; key.startsWith(monthKey); key = addDays(key, 1)) out.push(key);
  return out;
}

/** A board's regulation for each day: reshuffled each time through the list, and never the same two days running. */
function regulationOrder(monthKey: string, board: BoardId, days: number): string[] {
  const rng = makeRng(`return-to-sender:v${PUZZLE_VERSION}:${monthKey}:${board}:order`);
  const ids = BOARDS[board].regulations.map((r) => r.id), order: string[] = [];
  while (order.length < days) {
    const round = rng.shuffle(ids);
    if (round.length > 1 && round[0] === order[order.length - 1]) [round[0], round[1]] = [round[1]!, round[0]!];
    order.push(...round);
  }
  return order.slice(0, days);
}

/** The day's puzzle for one board; a seed whose puzzle fails a check moves on to the next one. */
function dayPuzzle(dateKey: string, board: BoardId, regulation: string): Puzzle {
  for (let n = 0; n < 50; n++) {
    const puzzle = createPuzzle(`return-to-sender:v${PUZZLE_VERSION}:${dateKey}:${board}${n ? `:${n}` : ""}`, [{ board, regulation }]);
    if (puzzle && !checkPuzzle(puzzle).length) return puzzle;
  }
  throw new Error(`No clean ${board} puzzle for ${dateKey} (${regulation}).`);
}

/** A month with a puzzle for every built board each day, keeping every puzzle `existing` already has. */
export function generateMonth(monthKey: string, existing?: MonthFile): MonthFile {
  const keys = monthDays(monthKey);
  const orders = Object.fromEntries(BOARD_IDS.map((b) => [b, regulationOrder(monthKey, b, keys.length)])) as Record<BoardId, string[]>;
  const days = keys.map((dateKey, i) => {
    const puzzles: DayPuzzles["puzzles"] = { ...existing?.days.find((d) => d.dateKey === dateKey)?.puzzles };
    for (const board of BOARD_IDS) puzzles[board] ??= dayPuzzle(dateKey, board, orders[board][i]!);
    return { dateKey, puzzles };
  });
  return { version: PUZZLE_VERSION, monthKey, days };
}

/** Everything wrong with a month; empty means every day has a clean puzzle for every built board. */
export function checkMonth(month: MonthFile): string[] {
  const problems: string[] = [];
  if (month.version !== PUZZLE_VERSION) problems.push(`version ${month.version}, expected ${PUZZLE_VERSION}`);
  if (month.days.map((d) => d.dateKey).join() !== monthDays(month.monthKey).join()) problems.push("days do not match the month");
  for (const day of month.days) {
    for (const board of BOARD_IDS) {
      const puzzle = day.puzzles[board];
      if (!puzzle) problems.push(`${day.dateKey}: no ${board} puzzle`);
      else problems.push(...checkPuzzle(puzzle).map((p) => `${day.dateKey} ${board}: ${p}`));
    }
  }
  return problems;
}
