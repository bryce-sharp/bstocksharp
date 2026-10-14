// Builds each day's puzzle by tiling real pieces into a blob, so a zero-gap fill always exists.

import { makeRng, weekday, type Rng } from "../daily";
import { SHAPES, bounds, cellKey, flipH, normalize, rotateCW, rotations, shapeKey, type Cell } from "./pieces";

export const MAX_BOARD = 9;
const LEGACY_SPARES = 2;

/** Quilts from this date on follow the weekly difficulty curve; earlier ones keep their original puzzles. */
export const CURVE_START = "2026-10-19";

export interface Level {
  name: string;
  pieces: number;
  spares: number;
}

/** Gentle on Monday, toughest on Sunday; indexed by day of the week (0 = Sunday). */
const LEVELS: Level[] = [
  { name: "Tough", pieces: 10, spares: 3 },
  { name: "Gentle", pieces: 7, spares: 1 },
  { name: "Easy", pieces: 7, spares: 2 },
  { name: "Steady", pieces: 8, spares: 2 },
  { name: "Steady", pieces: 8, spares: 2 },
  { name: "Tricky", pieces: 9, spares: 2 },
  { name: "Tricky", pieces: 9, spares: 3 },
];

/** The day's difficulty, or null for quilts made before the curve. */
export function levelFor(dateKey: string): Level | null {
  return dateKey >= CURVE_START ? LEVELS[weekday(dateKey)]! : null;
}

export interface PieceDef {
  id: string;
  /** Shape name; a trailing apostrophe marks the mirrored form. */
  shape: string;
  /** Starting orientation in the basket. */
  cells: Cell[];
  color: number;
}

export interface SolvedPiece {
  cells: Cell[];
  x: number;
  y: number;
}

export interface Puzzle {
  dateKey: string;
  cols: number;
  rows: number;
  board: Cell[];
  /** Basket order; includes the decoys. */
  pieces: PieceDef[];
  /** One known perfect fill, keyed by piece id; decoys are absent. */
  solution: Record<string, SolvedPiece>;
  spares: number;
  level: Level | null;
}

const SHAPE_WEIGHTS: [string, number][] = [
  ["I3", 1], ["V3", 2],
  ["I4", 2], ["O4", 2], ["T4", 3], ["S4", 3], ["L4", 3],
  ["F5", 3], ["I5", 1], ["L5", 3], ["N5", 3], ["P5", 3], ["T5", 2],
  ["U5", 2], ["V5", 2], ["W5", 2], ["X5", 1], ["Y5", 3], ["Z5", 2],
];


function pickShape(rng: Rng, counts: Map<string, number>): string {
  const pool = SHAPE_WEIGHTS.filter(([name]) => (counts.get(name) ?? 0) < (name === "I5" || name === "X5" ? 1 : 2));
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [name, w] of pool) {
    r -= w;
    if (r <= 0) return name;
  }
  return pool[pool.length - 1]![0];
}

const NEIGHBORS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Grows a connected blob piece by piece, preferring snug spots with some randomness. */
function growBlob(rng: Rng, shapes: { name: string; cells: Cell[] }[]): { shape: string; cells: Cell[] }[] | null {
  const occupied = new Set<string>();
  const placed: { shape: string; cells: Cell[] }[] = [];
  let minX = 0, minY = 0, maxX = 0, maxY = 0;

  for (const shape of shapes) {
    const options = rotations(shape.cells);
    let best: Cell[] | null = null;
    let bestScore = -Infinity;

    if (placed.length === 0) {
      best = rng.pick(options);
    } else {
      const frontier = new Set<string>();
      for (const k of occupied) {
        const [x, y] = k.split(",").map(Number) as [number, number];
        for (const [dx, dy] of NEIGHBORS) {
          const nk = cellKey(x + dx, y + dy);
          if (!occupied.has(nk)) frontier.add(nk);
        }
      }
      for (const fk of frontier) {
        const [fx, fy] = fk.split(",").map(Number) as [number, number];
        for (const orient of options) {
          for (const [ax, ay] of orient) {
            const cells = orient.map(([x, y]) => [x - ax + fx, y - ay + fy] as Cell);
            if (cells.some(([x, y]) => occupied.has(cellKey(x, y)))) continue;
            const xs = cells.map((c) => c[0]);
            const ys = cells.map((c) => c[1]);
            const w = Math.max(maxX, ...xs) - Math.min(minX, ...xs) + 1;
            const h = Math.max(maxY, ...ys) - Math.min(minY, ...ys) + 1;
            if (w > MAX_BOARD || h > MAX_BOARD) continue;
            let contacts = 0;
            for (const [x, y] of cells) {
              for (const [dx, dy] of NEIGHBORS) if (occupied.has(cellKey(x + dx, y + dy))) contacts++;
            }
            const score = contacts + rng.next() * 2.5;
            if (score > bestScore) {
              bestScore = score;
              best = cells;
            }
          }
        }
      }
    }

    if (!best) return null;
    for (const [x, y] of best) {
      occupied.add(cellKey(x, y));
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    placed.push({ shape: shape.name, cells: best });
  }

  return placed.map((p) => ({ shape: p.shape, cells: p.cells.map(([x, y]) => [x - minX, y - minY] as Cell) }));
}

function hasHoles(cells: Set<string>, cols: number, rows: number): boolean {
  const outside = new Set<string>();
  const stack: Cell[] = [[-1, -1]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    const k = cellKey(x, y);
    if (x < -1 || y < -1 || x > cols || y > rows || outside.has(k) || cells.has(k)) continue;
    outside.add(k);
    for (const [dx, dy] of NEIGHBORS) stack.push([x + dx, y + dy]);
  }
  return outside.size + cells.size < (cols + 2) * (rows + 2);
}

/** Picks a shape and a handedness; chiral shapes come mirrored half the time. */
function handed(rng: Rng, name: string): { name: string; cells: Cell[] } {
  const base = SHAPES[name]!;
  const mirrored = flipH(base);
  const isChiral = rotations(base).every((r) => shapeKey(r) !== shapeKey(mirrored));
  return isChiral && rng.next() < 0.5 ? { name: `${name}'`, cells: mirrored } : { name, cells: base };
}

function randomTurn(rng: Rng, cells: Cell[]): Cell[] {
  let out = normalize(cells);
  for (let r = rng.int(4); r > 0; r--) out = rotateCW(out);
  return out;
}

export function generatePuzzle(dateKey: string, colorCount: number): Puzzle {
  const rng = makeRng(`snug:${dateKey}`);
  const level = levelFor(dateKey);
  const spares = level?.spares ?? LEGACY_SPARES;

  for (let attempt = 0; attempt < 400; attempt++) {
    const count = level?.pieces ?? 8 + rng.int(2);
    const counts = new Map<string, number>();
    const shapes: { name: string; cells: Cell[] }[] = [];
    for (let i = 0; i < count; i++) {
      const s = pickShape(rng, counts);
      counts.set(s, (counts.get(s) ?? 0) + 1);
      shapes.push(handed(rng, s));
    }

    const blob = growBlob(rng, shapes);
    if (!blob) continue;
    const all = blob.flatMap((p) => p.cells);
    const { w: cols, h: rows } = bounds(all);
    const cellSet = new Set(all.map(([x, y]) => cellKey(x, y)));
    const fill = all.length / (cols * rows);
    if (cols < 5 || rows < 5 || fill < 0.55 || fill > 0.82 || hasHoles(cellSet, cols, rows)) continue;

    const decoys: { name: string; cells: Cell[] }[] = [];
    for (let i = 0; i < spares; i++) {
      const s = pickShape(rng, counts);
      counts.set(s, (counts.get(s) ?? 0) + 1);
      decoys.push(handed(rng, s));
    }

    const colors = rng.shuffle([...Array(colorCount).keys()]);
    const real = blob.map((p, i) => ({ id: `p${i}`, shape: p.shape, start: p.cells, solved: p.cells }));
    const fake = decoys.map((d, i) => ({ id: `d${i}`, shape: d.name, start: d.cells, solved: null as Cell[] | null }));
    const pieces = rng.shuffle([...real, ...fake]).map((p, i) => ({
      id: p.id,
      shape: p.shape,
      cells: randomTurn(rng, p.start),
      color: colors[i % colorCount]!,
    }));

    const solution: Record<string, SolvedPiece> = {};
    for (const p of real) {
      const x = Math.min(...p.solved.map((c) => c[0]));
      const y = Math.min(...p.solved.map((c) => c[1]));
      solution[p.id] = { x, y, cells: p.solved.map(([cx, cy]) => [cx - x, cy - y] as Cell) };
    }

    return { dateKey, cols, rows, board: all, pieces, solution, spares, level };
  }

  throw new Error(`Snug: no puzzle generated for ${dateKey}`);
}
