// The shared result: a silhouette of the quilt (orange) with holes (brown), never which patch went where.

import { cellKey, type Cell } from "./pieces";
import type { PieceState } from "./parts";

const FILLED = "\u{1F7E7}";
const HOLE = "\u{1F7EB}";
const OUTSIDE = "⬜";

/** One line per board row; squares outside the quilt are white, so every square is the same width and the shape lines up. */
export function quiltGrid(board: readonly Cell[], cols: number, rows: number, pieces: readonly PieceState[]): string {
  const inBoard = new Set(board.map(([x, y]) => cellKey(x, y)));
  const filled = new Set<string>();
  for (const p of pieces) {
    if (!p.at || p.loose) continue;
    for (const [x, y] of p.cells) filled.add(cellKey(x + p.at.x, y + p.at.y));
  }
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const k = cellKey(x, y);
      line += !inBoard.has(k) ? OUTSIDE : filled.has(k) ? FILLED : HOLE;
    }
    lines.push(line);
  }
  return lines.join("\n");
}
