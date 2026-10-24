// Saved on this device only while testing: the scored first run for each day and board, the unfinished run in
// progress, and which board the testing picker last chose.

import { loadAttempt, saveAttempt } from "../daily";
import { BOARD_IDS } from "./boards";
import type { BoardId, Sample } from "./engine";
import { PUZZLE_VERSION } from "./schedule";

export const GAME = "return-to-sender";
/** Puzzle numbers count from this day, the first day of the first generated month. */
export const LAUNCH_DATE = "2026-10-01";

/** An item in the trays: a submission, or half of a supervisor's hint pair. */
export interface Entry extends Sample {
  hint?: boolean;
}

export interface Result {
  version: number;
  submissions: number;
  /** Shifts worked, counting the perfect one (or the shifts before giving up). */
  tries: number;
  /** Each submission's stamp in order: true for approved. Hints are not included. */
  history: boolean[];
  /** Everything in the trays, so a finished day still shows its log. */
  submitted?: Entry[];
  hints?: number;
  /** Asked head office for the memo instead of finishing a perfect shift. */
  gaveUp?: boolean;
}
export interface Progress {
  version: number;
  submitted: Entry[];
  /** Shifts finished so far. */
  tries: number;
  /** A shift underway: the answers given so far. Its bag is rebuilt from the puzzle, the try number and the trays. */
  shift?: { answers: boolean[] };
}

const boardGame = (board: BoardId) => `${GAME}.${board}`;
const progressKey = (dateKey: string, board: BoardId) => `${GAME}.${board}.progress.${dateKey}`;
const TEST_BOARD_KEY = `${GAME}.testBoard`;

export function loadResult(dateKey: string, board: BoardId): Result | null {
  const result = loadAttempt<Result>(boardGame(board), dateKey);
  return result?.version === PUZZLE_VERSION ? result : null;
}

export function saveResult(dateKey: string, board: BoardId, result: Result) {
  saveAttempt(boardGame(board), dateKey, result);
}

export function loadProgress(dateKey: string, board: BoardId): Progress | null {
  try {
    const raw = localStorage.getItem(progressKey(dateKey, board));
    const progress = raw ? (JSON.parse(raw) as Progress) : null;
    return progress?.version === PUZZLE_VERSION ? progress : null;
  } catch {
    return null;
  }
}

export function saveProgress(dateKey: string, board: BoardId, progress: Progress) {
  try {
    localStorage.setItem(progressKey(dateKey, board), JSON.stringify(progress));
  } catch {
    // Storage can be full or blocked; the run still plays, it is just not kept.
  }
}

export function clearProgress(dateKey: string, board: BoardId) {
  try {
    localStorage.removeItem(progressKey(dateKey, board));
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

export function loadTestBoard(): BoardId {
  try {
    const board = localStorage.getItem(TEST_BOARD_KEY) as BoardId | null;
    if (board && BOARD_IDS.includes(board)) return board;
  } catch {
    // Fall through to the first board.
  }
  return BOARD_IDS[0]!;
}

/** Testing only: forget today's result and run for a board, so the day can be played again as if new. */
export function resetDay(dateKey: string, board: BoardId) {
  clearProgress(dateKey, board);
  try {
    localStorage.removeItem(`${boardGame(board)}.attempt.${dateKey}`);
  } catch {
    // Nothing to reset when storage is blocked.
  }
}

const HOW_TO_KEY = `${GAME}.howToSeen`;

export function howToSeen(): boolean {
  try {
    return localStorage.getItem(HOW_TO_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHowToSeen() {
  try {
    localStorage.setItem(HOW_TO_KEY, "1");
  } catch {
    // It just opens again next time.
  }
}

export function saveTestBoard(board: BoardId) {
  try {
    localStorage.setItem(TEST_BOARD_KEY, board);
  } catch {
    // The picker just starts on the first board next time.
  }
}
