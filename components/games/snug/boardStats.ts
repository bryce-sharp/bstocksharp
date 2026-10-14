// How organic a board is, for comparing generators: fill, the longest straight run of edge, and how often the edge turns.

import { outlineLoops, type Cell } from "./pieces";

export interface BoardStats {
  squares: number;
  fill: number;
  /** Longest straight stretch of the board's edge, in squares. */
  longestEdge: number;
  /** Share of the edge in straight stretches of 4 squares or more. */
  straightShare: number;
  /** Corners in the outline per 10 squares of edge; higher is more organic. */
  turnsPer10: number;
}

export function boardStats(board: readonly Cell[]): BoardStats {
  const cols = Math.max(...board.map((c) => c[0])) + 1;
  const rows = Math.max(...board.map((c) => c[1])) + 1;
  let perimeter = 0;
  let longestEdge = 0;
  let straight = 0;
  let corners = 0;
  for (const loop of outlineLoops(board)) {
    corners += loop.length;
    for (let i = 0; i < loop.length; i++) {
      const [ax, ay] = loop[i]!;
      const [bx, by] = loop[(i + 1) % loop.length]!;
      const len = Math.abs(bx - ax) + Math.abs(by - ay);
      perimeter += len;
      longestEdge = Math.max(longestEdge, len);
      if (len >= 4) straight += len;
    }
  }
  return {
    squares: board.length,
    fill: board.length / (cols * rows),
    longestEdge,
    straightShare: straight / perimeter,
    turnsPer10: (corners / perimeter) * 10,
  };
}
