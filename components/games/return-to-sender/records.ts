// Saved on this device only while testing: the scored first run for each day and board, the unfinished run in
// progress, and which board the testing picker last chose.

import { loadAttempt, saveAttempt } from "../daily";
import { BOARD_IDS } from "./boards";
import type { BoardId, Sample } from "./engine";
import { PUZZLE_VERSION } from "./schedule";

export const GAME = "return-to-sender";
/** Puzzle numbers count from this day, the first day of the first generated month. */
export const LAUNCH_DATE = "2026-10-01";

export interface Result {
  version: number;
  submissions: number;
  /** The inspection try that passed, counting from 1. */
  tries: number;
  /** Each submission's stamp in order: true for approved. */
  history: boolean[];
  /** The submissions themselves, so a finished day still shows its log. */
  submitted?: Sample[];
}
export interface Progress {
  version: number;
  submitted: Sample[];
  tries: number;
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

export function saveTestBoard(board: BoardId) {
  try {
    localStorage.setItem(TEST_BOARD_KEY, board);
  } catch {
    // The picker just starts on the first board next time.
  }
}
