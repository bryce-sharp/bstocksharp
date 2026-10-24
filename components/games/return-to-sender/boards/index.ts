import type { Board, BoardId, Part, Regulation } from "../engine";
import { SHEET } from "./sheet";

/** Every built board, in the order the week will use them. */
export const BOARDS: Record<BoardId, Board> = { sheet: SHEET };
export const BOARD_IDS = Object.keys(BOARDS) as BoardId[];

export function findRegulation(part: Part): { board: Board; regulation: Regulation } | null {
  const board = BOARDS[part.board];
  const regulation = board?.regulations.find((r) => r.id === part.regulation);
  return board && regulation ? { board, regulation } : null;
}
