// Polyomino shapes and grid geometry. Coordinates are [x, y] with y pointing down.

export type Cell = readonly [number, number];

const SHAPE_ART: Record<string, string[]> = {
  I3: ["###"],
  V3: ["#.", "##"],
  I4: ["####"],
  O4: ["##", "##"],
  T4: ["###", ".#."],
  S4: [".##", "##."],
  L4: ["#.", "#.", "##"],
  F5: [".##", "##.", ".#."],
  I5: ["#####"],
  L5: ["#.", "#.", "#.", "##"],
  N5: [".#", "##", "#.", "#."],
  P5: ["##", "##", "#."],
  T5: ["###", ".#.", ".#."],
  U5: ["#.#", "###"],
  V5: ["#..", "#..", "###"],
  W5: ["#..", "##.", ".##"],
  X5: [".#.", "###", ".#."],
  Y5: [".#", "##", ".#", ".#"],
  Z5: ["##.", ".#.", ".##"],
};

export const SHAPES: Record<string, Cell[]> = Object.fromEntries(
  Object.entries(SHAPE_ART).map(([name, rows]) => [
    name,
    rows.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === "#" ? [[x, y] as Cell] : []))),
  ]),
);

export const cellKey = (x: number, y: number) => `${x},${y}`;

/** Order-independent key for a normalized shape, for comparing orientations. */
export const shapeKey = (cells: readonly Cell[]) => cells.map(([x, y]) => cellKey(x, y)).sort().join("|");

/** Shifts cells so the minimum x and y are 0, preserving cell order. */
export function normalize(cells: readonly Cell[]): Cell[] {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY] as Cell);
}

/** Rotates 90 degrees clockwise on screen; cell order is preserved so a held cell can be tracked. */
export const rotateCW = (cells: readonly Cell[]) => normalize(cells.map(([x, y]) => [-y, x] as Cell));

export const rotateCCW = (cells: readonly Cell[]) => normalize(cells.map(([x, y]) => [y, -x] as Cell));

export const flipH = (cells: readonly Cell[]) => normalize(cells.map(([x, y]) => [-x, y] as Cell));

export function bounds(cells: readonly Cell[]) {
  return {
    w: Math.max(...cells.map((c) => c[0])) + 1,
    h: Math.max(...cells.map((c) => c[1])) + 1,
  };
}

/** The distinct rotations of a shape (no reflections; players can only turn pieces). */
export function rotations(cells: readonly Cell[]): Cell[][] {
  const seen = new Set<string>();
  const out: Cell[][] = [];
  let cur = normalize(cells);
  for (let r = 0; r < 4; r++) {
    const sig = shapeKey(cur);
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(cur);
    }
    cur = rotateCW(cur);
  }
  return out;
}

/** The same key for every turn of a shape, so patches with equal keys are interchangeable. */
export const shapeClass = (cells: readonly Cell[]) => rotations(cells).map(shapeKey).sort()[0]!;

/** Boundary loops of a set of cells, as corner points in cell units. */
export function outlineLoops(cells: readonly Cell[]): [number, number][][] {
  const has = new Set(cells.map(([x, y]) => cellKey(x, y)));
  const edges = new Map<string, [number, number][]>();
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const k = cellKey(ax, ay);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k)!.push([bx, by]);
  };
  for (const [x, y] of cells) {
    if (!has.has(cellKey(x, y - 1))) add(x, y, x + 1, y);
    if (!has.has(cellKey(x + 1, y))) add(x + 1, y, x + 1, y + 1);
    if (!has.has(cellKey(x, y + 1))) add(x + 1, y + 1, x, y + 1);
    if (!has.has(cellKey(x - 1, y))) add(x, y + 1, x, y);
  }

  const loops: [number, number][][] = [];
  for (const [start, outs] of edges) {
    while (outs.length) {
      const [sx, sy] = start.split(",").map(Number) as [number, number];
      const pts: [number, number][] = [[sx, sy]];
      let next = outs.pop()!;
      while (!(next[0] === sx && next[1] === sy)) {
        pts.push(next);
        const more = edges.get(cellKey(next[0], next[1]));
        if (!more?.length) break;
        next = more.pop()!;
      }
      loops.push(
        pts.filter((p, i) => {
          const a = pts[(i - 1 + pts.length) % pts.length]!;
          const b = pts[(i + 1) % pts.length]!;
          return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
        }),
      );
    }
  }
  return loops;
}

/** SVG path tracing the outer boundary of a set of cells, as closed loops in `unit`-sized cells. */
export function outlinePath(cells: readonly Cell[], unit: number): string {
  return outlineLoops(cells)
    .map((corners) => "M" + corners.map(([x, y]) => `${x * unit} ${y * unit}`).join("L") + "Z")
    .join("");
}
