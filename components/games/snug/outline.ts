// Prototype, outline first: a month is a designed shape (pumpkin, tree, heart, quilt) drawn on the square grid.
// The shape is cut into one wavy-edged region per day, and each region is filled exactly with patches, so the
// finished month always reads as the shape and every day keeps a guaranteed perfect fill.

import { addDays, makeRng, weekday, type Rng } from "../daily";
import { LEVELS, MAX_BOARD, handed, hasHoles, randomTurn, type Level, type PieceDef, type Puzzle, type SolvedPiece } from "./generator";
import { SHAPES, cellKey, rotations, type Cell } from "./pieces";

export type Outline =
  | "pumpkin" | "tree" | "heart" | "ghost" | "star" | "snowflake" | "mitten" | "shamrock" | "egg" | "flower" | "sun" | "watermelon" | "apple" | "leaf"
  | "quilt" | "hexagon" | "diamond" | "plus" | "house" | "octagon" | "bowtie";

/**
 * Each calendar month draws from its own pool, and no outline is in two months' pools, so a year never repeats one.
 * Years step through the pools: 2027 takes the first entry (a themed year), 2026 and 2028 the second (quilt blocks).
 */
const MONTH_POOLS: Outline[][] = [
  ["mitten", "hexagon"],
  ["heart", "diamond"],
  ["shamrock", "plus"],
  ["egg", "house"],
  ["flower", "octagon"],
  ["sun", "bowtie"],
  ["star", "quilt"],
  ["watermelon"],
  ["apple"],
  ["ghost", "pumpkin"],
  ["leaf"],
  ["snowflake", "tree"],
];

export function outlineFor(monthKey: string): Outline {
  const pool = MONTH_POOLS[Number(monthKey.slice(5, 7)) - 1]!;
  const step = Number(monthKey.slice(0, 4)) - 2027;
  return pool[((step % pool.length) + pool.length) % pool.length]!;
}

export interface MonthDay {
  dateKey: string;
  level: Level;
  puzzle: Puzzle;
  /** Where the day's board sits in the month quilt, in squares. */
  offset: { x: number; y: number };
}

export function monthDates(monthKey: string): string[] {
  const out: string[] = [];
  for (let k = `${monthKey}-01`; k.startsWith(monthKey); k = addDays(k, 1)) out.push(k);
  return out;
}

export interface OutlineMonth {
  monthKey: string;
  outline: Outline;
  days: MonthDay[];
  minX: number;
  minY: number;
  width: number;
  height: number;
  squares: number;
  carves: number;
}

const NEIGHBORS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const parse = (k: string) => k.split(",").map(Number) as [number, number];
/** Average squares per patch in a day, which sizes the outline. */
const SQUARES_PER_PIECE = 4.3;
/** How far the noise field bends the cut lines between days, in squares. */
const WAVE = 1.8;
const WAVE_GRID = 5;
const BALANCE_ROUNDS = 70;
const CARVE_TRIES = 80;
/** Single-square moves allowed when repairing day regions. */
const REPAIR_ROUNDS = 1500;

/** The outline in unit coordinates, roughly within -1..1. */
function unitOutline(outline: Outline): (x: number, y: number) => boolean {
  switch (outline) {
    case "pumpkin": {
      const lobe = (x: number, y: number, cx: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - 0.08) / ry) ** 2 <= 1;
      return (x, y) =>
        lobe(x, y, 0, 0.42, 0.78) || lobe(x, y, -0.42, 0.46, 0.7) || lobe(x, y, 0.42, 0.46, 0.7) || (Math.abs(x + 0.04 * (y + 0.8)) < 0.1 && y < -0.62 && y > -0.98);
    }
    case "tree":
      return (x, y) => {
        // Three stacked tiers and a trunk.
        const tier = (top: number, bottom: number, half: number) => y >= top && y <= bottom && Math.abs(x) <= (half * (y - top)) / (bottom - top) + 0.08;
        return tier(-1, -0.35, 0.5) || tier(-0.62, 0.15, 0.72) || tier(-0.2, 0.68, 0.95) || (Math.abs(x) < 0.16 && y > 0.6 && y < 0.98);
      };
    case "heart":
      return (x, y) => {
        const yy = -y * 1.1 + 0.15;
        return (x * x + yy * yy - 0.55) ** 3 - x * x * yy ** 3 <= 0;
      };
    case "ghost":
      // A domed head, a wavy hem, and two eyes left open.
      return (x, y) => {
        const eye = (x - 0.3) ** 2 / 0.018 + (y + 0.22) ** 2 / 0.03 <= 1 || (x + 0.3) ** 2 / 0.018 + (y + 0.22) ** 2 / 0.03 <= 1;
        const dome = y < -0.15 && (x / 0.78) ** 2 + ((y + 0.15) / 0.82) ** 2 <= 1;
        const body = y >= -0.15 && Math.abs(x) <= 0.78 && y <= 0.72 + 0.16 * Math.cos(x * Math.PI * 2.6);
        return (dome || body) && !eye;
      };
    case "star": {
      // Five points, kept stout so every point is wide enough for a day.
      const outer = 1;
      const inner = 0.58;
      const pts: [number, number][] = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? outer : inner;
        return [r * Math.cos(a), r * Math.sin(a) + 0.08];
      });
      return (x, y) => inPolygon(x, y, pts);
    }
    case "snowflake":
      // Six thick arms around a hexagon, each with a little cross-bar.
      return (x, y) => {
        const r = Math.hypot(x, y);
        if (r <= 0.32) return true;
        const a = Math.atan2(y, x);
        const arm = Math.round(a / (Math.PI / 3)) * (Math.PI / 3);
        const along = r * Math.cos(a - arm);
        const across = Math.abs(r * Math.sin(a - arm));
        return (along <= 1 && across <= 0.13) || (Math.abs(along - 0.62) <= 0.12 && across <= 0.3);
      };
    case "hexagon":
      return (x, y) => Math.max(Math.abs(x) * 0.866 + Math.abs(y) * 0.5, Math.abs(y)) <= 0.82;
    case "diamond":
      // A rhombus with its points blunted, so the tips stay wide enough for a day.
      return (x, y) => Math.abs(x) / 1.05 + Math.abs(y) / 0.85 <= 1 && Math.abs(x) <= 0.86 && Math.abs(y) <= 0.7;
    case "plus":
      // A cross-shaped quilt, like four blocks around a center.
      return (x, y) => (Math.abs(x) <= 1 && Math.abs(y) <= 0.42) || (Math.abs(x) <= 0.42 && Math.abs(y) <= 1);
    case "mitten":
      // A rounded hand, a thumb, and a ribbed cuff.
      return (x, y) =>
        ((x - 0.08) / 0.52) ** 4 + ((y + 0.22) / 0.66) ** 4 <= 1 ||
        ((x + 0.5) / 0.26) ** 2 + ((y + 0.02) / 0.36) ** 2 <= 1 ||
        (Math.abs(x - 0.08) <= 0.6 && y >= 0.4 && y <= 0.9);
    case "shamrock": {
      // Three round leaves on a short, stout stem.
      const leaf = (cx: number, cy: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= 0.42 ** 2;
      const leaves = [leaf(0, -0.5), leaf(-0.46, 0.04), leaf(0.46, 0.04)];
      return (x, y) => leaves.some((l) => l(x, y)) || x * x + (y + 0.12) ** 2 <= 0.3 ** 2 || (Math.abs(x - 0.18 * (y - 0.35)) <= 0.14 && y >= 0.3 && y <= 0.92);
    }
    case "egg":
      // Wider at the bottom than the top.
      return (x, y) => (x / (0.68 * (1 + 0.22 * y))) ** 2 + (y / 0.96) ** 2 <= 1;
    case "flower":
      // Five round petals around a round middle.
      return (x, y) =>
        x * x + y * y <= 0.36 ** 2 ||
        Array.from({ length: 5 }, (_, k) => -Math.PI / 2 + (k * 2 * Math.PI) / 5).some((a) => (x - 0.58 * Math.cos(a)) ** 2 + (y - 0.58 * Math.sin(a)) ** 2 <= 0.36 ** 2);
    case "sun":
      // A round middle with eight broad rays.
      return (x, y) => {
        const r = Math.hypot(x, y);
        const a = Math.atan2(y, x);
        // cos(8a) peaks eight times around the circle, one ray each.
        return r <= 0.6 + 0.4 * Math.max(0, Math.cos(8 * a)) ** 1.5;
      };
    case "watermelon":
      // A half-round slice, rind side down.
      return (x, y) => y >= -0.42 && x * x + (y + 0.42) ** 2 <= 1.02;
    case "apple":
      // Two round cheeks, a dip on top, a stem and a leaf.
      return (x, y) =>
        (x + 0.3) ** 2 + (y - 0.08) ** 2 <= 0.62 ** 2 ||
        (x - 0.3) ** 2 + (y - 0.08) ** 2 <= 0.62 ** 2 ||
        (Math.abs(x - 0.02) <= 0.1 && y >= -0.88 && y <= -0.4) ||
        ((x - 0.32) / 0.26) ** 2 + ((y + 0.72) / 0.12) ** 2 <= 1;
    case "leaf": {
      // An almond-shaped leaf on a slant, with a short stem.
      const c = Math.SQRT1_2;
      return (x, y) => {
        const u = (x - y) * c;
        const v = (x + y) * c;
        return (Math.abs(u) <= 1.08 && Math.abs(v) <= 0.56 * Math.cos((u / 1.08) * (Math.PI / 2))) || (u >= 0.95 && u <= 1.25 && Math.abs(v) <= 0.1);
      };
    }
    case "house":
      // A square house with a pitched roof.
      return (x, y) => (Math.abs(x) <= 0.78 && y >= -0.12 && y <= 0.9) || (y >= -0.95 && y < -0.12 && Math.abs(x) <= (0.98 * (y + 0.95)) / 0.83);
    case "octagon":
      return (x, y) => Math.abs(x) <= 0.86 && Math.abs(y) <= 0.86 && Math.abs(x) + Math.abs(y) <= 1.22;
    case "bowtie":
      // Two triangles meeting at a knot in the middle.
      return (x, y) => Math.abs(x) <= 1 && Math.abs(y) <= Math.min(0.82, 0.26 + 0.62 * Math.abs(x));
    case "quilt":
      // A rounded rectangle with scalloped edges, like a bound quilt.
      return (x, y) => {
        const scallop = 0.035 * Math.cos(Math.atan2(y, x) * 18);
        return Math.abs(x) <= 1 + scallop && Math.abs(y) <= 0.78 + scallop;
      };
  }
}

function inPolygon(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The outline drawn on the grid at about `area` squares. */
function rasterize(outline: Outline, area: number): Set<string> {
  const unit = unitOutline(outline);
  const at = (r: number) => {
    const cells = new Set<string>();
    const span = Math.ceil(1.2 * r);
    for (let y = -span; y <= span; y++) for (let x = -span; x <= span; x++) if (unit((x + 0.5) / r, (y + 0.5) / r)) cells.add(cellKey(x, y));
    return cells;
  };
  let lo = 4;
  let hi = 80;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid).size < area) lo = mid;
    else hi = mid;
  }
  return at(hi);
}

/** Smooth random values over the grid, used to bend the cut lines. */
function noiseField(rng: Rng) {
  const lattice = new Map<string, number>();
  const at = (i: number, j: number) => {
    const k = cellKey(i, j);
    if (!lattice.has(k)) lattice.set(k, rng.next() * 2 - 1);
    return lattice.get(k)!;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const gx = x / WAVE_GRID;
    const gy = y / WAVE_GRID;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const tx = smooth(gx - i);
    const ty = smooth(gy - j);
    const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const bottom = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

/**
 * Cuts the outline into one region per day: each square goes to the day whose seed is nearest after a noise bend
 * and a per-day weight, and the weights are tuned until every region is near its target size.
 */
function carveRegions(rng: Rng, cells: Cell[], targets: number[]): Map<string, number> | null {
  const n = targets.length;
  const noise = [noiseField(rng), noiseField(rng)];
  // Spread-out seeds: each next one is the square farthest from all seeds so far.
  const seeds: [number, number][] = [cells[rng.int(cells.length)]!.slice() as [number, number]];
  while (seeds.length < n) {
    let far = cells[0]!;
    let farD = -1;
    for (const c of cells) {
      const d = Math.min(...seeds.map(([sx, sy]) => (c[0] - sx) ** 2 + (c[1] - sy) ** 2)) + rng.next();
      if (d > farD) {
        farD = d;
        far = c;
      }
    }
    seeds.push([far[0], far[1]]);
  }
  const weight = new Array<number>(n).fill(0);
  const bent = cells.map(([x, y]) => [x + WAVE * noise[0]!(x, y), y + WAVE * noise[1]!(x, y)] as [number, number]);
  let owner = new Array<number>(cells.length).fill(0);

  for (let round = 0; round < BALANCE_ROUNDS; round++) {
    owner = bent.map(([x, y]) => {
      let best = 0;
      let bestD = Infinity;
      for (let d = 0; d < n; d++) {
        const dd = Math.hypot(x - seeds[d]![0], y - seeds[d]![1]) - weight[d]!;
        if (dd < bestD) {
          bestD = dd;
          best = d;
        }
      }
      return best;
    });
    const area = new Array<number>(n).fill(0);
    const sum = seeds.map(() => [0, 0]);
    owner.forEach((d, i) => {
      area[d]!++;
      sum[d]![0]! += bent[i]![0];
      sum[d]![1]! += bent[i]![1];
    });
    for (let d = 0; d < n; d++) {
      weight[d]! += 0.12 * (targets[d]! - area[d]!) / Math.sqrt(targets[d]!);
      if (area[d]) seeds[d] = [sum[d]![0]! / area[d]!, sum[d]![1]! / area[d]!];
    }
  }

  // Bits cut off from their day join the neighbouring day they touch most.
  const index = new Map(cells.map(([x, y], i) => [cellKey(x, y), i]));
  for (let pass = 0; pass < 4; pass++) {
    for (let d = 0; d < n; d++) {
      const mine = owner.map((o, i) => (o === d ? i : -1)).filter((i) => i >= 0);
      if (!mine.length) return null;
      const parts: number[][] = [];
      const seen = new Set<number>();
      for (const start of mine) {
        if (seen.has(start)) continue;
        const part = [start];
        seen.add(start);
        for (let q = 0; q < part.length; q++) {
          const [x, y] = cells[part[q]!]!;
          for (const [dx, dy] of NEIGHBORS) {
            const j = index.get(cellKey(x + dx, y + dy));
            if (j !== undefined && owner[j] === d && !seen.has(j)) {
              seen.add(j);
              part.push(j);
            }
          }
        }
        parts.push(part);
      }
      parts.sort((a, b) => b.length - a.length);
      for (const part of parts.slice(1)) {
        for (const i of part) {
          const counts = new Map<number, number>();
          const [x, y] = cells[i]!;
          for (const [dx, dy] of NEIGHBORS) {
            const j = index.get(cellKey(x + dx, y + dy));
            if (j !== undefined && owner[j] !== d) counts.set(owner[j]!, (counts.get(owner[j]!) ?? 0) + 1);
          }
          const to = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
          if (to !== undefined) owner[i] = to;
        }
      }
    }
  }
  const map = new Map(cells.map(([x, y], i) => [cellKey(x, y), owner[i]!]));
  return repairRegions(rng, map, n) ? map : null;
}

/** A region's box, fill and what is wrong with it, if anything. */
function inspect(region: Cell[]) {
  const xs = region.map((c) => c[0]);
  const ys = region.map((c) => c[1]);
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const fill = region.length / (w * h);
  const local = new Set(region.map(([x, y]) => cellKey(x - box.minX, y - box.minY)));
  const problem =
    w > MAX_BOARD || h > MAX_BOARD ? "big" : w < 5 || h < 5 ? "narrow" : fill < 0.55 ? "sparse" : fill > 0.82 ? "dense" : hasHoles(local, w, h) ? "holey" : null;
  return { box, w, h, problem };
}

/** Moves single squares across day borders until every region keeps the board rules; false if it cannot. */
function repairRegions(rng: Rng, owner: Map<string, number>, n: number): boolean {
  const regionOf = (d: number) => [...owner].filter(([, o]) => o === d).map(([k]) => parse(k));
  const connectedWithout = (d: number, gone: string) => {
    const rest = regionOf(d).filter(([x, y]) => cellKey(x, y) !== gone);
    if (!rest.length) return false;
    const keys = new Set(rest.map(([x, y]) => cellKey(x, y)));
    const start = cellKey(rest[0]![0], rest[0]![1]);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const [x, y] = parse(stack.pop()!);
      for (const [dx, dy] of NEIGHBORS) {
        const k = cellKey(x + dx, y + dy);
        if (keys.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
      }
    }
    return seen.size === keys.size;
  };
  const fitsWith = (d: number, k: string) => {
    const [x, y] = parse(k);
    const { box } = inspect(regionOf(d));
    return Math.max(box.maxX, x) - Math.min(box.minX, x) + 1 <= MAX_BOARD && Math.max(box.maxY, y) - Math.min(box.minY, y) + 1 <= MAX_BOARD;
  };
  // Hands square `k` from region `from` to region `to` when both stay in shape.
  const move = (k: string, from: number, to: number) => {
    if (!connectedWithout(from, k) || !fitsWith(to, k)) return false;
    owner.set(k, to);
    return true;
  };

  for (let round = 0; round < REPAIR_ROUNDS; round++) {
    const bad = Array.from({ length: n }, (_, d) => d).filter((d) => inspect(regionOf(d)).problem);
    if (!bad.length) return true;
    const d = rng.pick(bad);
    const region = regionOf(d);
    const { box, w, h, problem } = inspect(region);
    const keys = new Set(region.map(([x, y]) => cellKey(x, y)));
    const border = region.filter(([x, y]) => NEIGHBORS.some(([dx, dy]) => owner.has(cellKey(x + dx, y + dy)) && !keys.has(cellKey(x + dx, y + dy))));
    const neighboursOf = ([x, y]: Cell) => NEIGHBORS.map(([dx, dy]) => owner.get(cellKey(x + dx, y + dy))).filter((o): o is number => o !== undefined && o !== d);
    let changed = false;

    if (problem === "big" || problem === "dense") {
      // Give away a square: from the far edge when too big, from anywhere on the border when too full.
      const edge = border.filter(([x, y]) =>
        problem === "dense" ? true : (w > MAX_BOARD && (x === box.minX || x === box.maxX)) || (h > MAX_BOARD && (y === box.minY || y === box.maxY)),
      );
      for (const c of rng.shuffle(edge)) {
        const to = rng.shuffle(neighboursOf(c))[0];
        if (to !== undefined && move(cellKey(c[0], c[1]), d, to)) {
          changed = true;
          break;
        }
      }
    } else {
      // Take a square: inside the box when too sparse or holey, just past the short side when too narrow.
      const outside: Cell[] = [];
      for (const [x, y] of border) for (const [dx, dy] of NEIGHBORS) {
        const k = cellKey(x + dx, y + dy);
        if (!owner.has(k) || keys.has(k)) continue;
        const inside = x + dx >= box.minX && x + dx <= box.maxX && y + dy >= box.minY && y + dy <= box.maxY;
        if (problem === "narrow" ? !inside : inside) outside.push([x + dx, y + dy]);
      }
      for (const c of rng.shuffle(outside)) {
        const k = cellKey(c[0], c[1]);
        if (move(k, owner.get(k)!, d)) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) continue;
  }
  return Array.from({ length: n }, (_, d) => d).every((d) => !inspect(regionOf(d)).problem);
}

type ShapeChoice = { name: string; orients: Cell[][]; size: number };
const CHOICES: ShapeChoice[] = Object.keys(SHAPES).flatMap((name) => {
  const base = handed({ next: () => 1, int: () => 0, pick: (a) => a[0]!, shuffle: (a) => [...a] }, name);
  const mirrored = handed({ next: () => 0, int: () => 0, pick: (a) => a[0]!, shuffle: (a) => [...a] }, name);
  const out: ShapeChoice[] = [{ name: base.name, orients: rotations(base.cells), size: base.cells.length }];
  if (mirrored.name !== base.name) out.push({ name: mirrored.name, orients: rotations(mirrored.cells), size: mirrored.cells.length });
  return out;
});
const TILE_STEPS = 60_000;

/** Fills `region` exactly with `count` patches (3 to 5 squares, at most two of a kind); null if it cannot. */
function tileRegion(rng: Rng, region: Cell[], count: number): { shape: string; cells: Cell[] }[] | null {
  if (region.length < count * 3 || region.length > count * 5) return null;
  const open = new Set(region.map(([x, y]) => cellKey(x, y)));
  // Scan order: always fill the first open square, top to bottom, left to right.
  const order = [...region].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([x, y]) => cellKey(x, y));
  const used = new Map<string, number>();
  const placed: { shape: string; cells: Cell[] }[] = [];
  let steps = 0;
  const choices = rng.shuffle(CHOICES);

  const solve = (): boolean => {
    if (++steps > TILE_STEPS) return false;
    const first = order.find((k) => open.has(k));
    if (!first) return placed.length === count;
    const left = placed.length;
    const remainingSquares = open.size;
    const piecesLeft = count - left;
    if (piecesLeft <= 0 || remainingSquares < piecesLeft * 3 || remainingSquares > piecesLeft * 5) return false;
    const [fx, fy] = parse(first);
    for (const choice of choices) {
      const base = choice.name.replace("'", "");
      if ((used.get(base) ?? 0) >= (base === "I5" || base === "X5" ? 1 : 2)) continue;
      for (const orient of choice.orients) {
        // The first open square must be the shape's first square in scan order, or squares above it would stay open.
        const anchor = [...orient].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]!;
        const cells = orient.map(([x, y]) => [x - anchor[0] + fx, y - anchor[1] + fy] as Cell);
        if (!cells.every(([x, y]) => open.has(cellKey(x, y)))) continue;
        for (const [x, y] of cells) open.delete(cellKey(x, y));
        used.set(base, (used.get(base) ?? 0) + 1);
        placed.push({ shape: choice.name, cells });
        if (solve()) return true;
        placed.pop();
        used.set(base, used.get(base)! - 1);
        for (const [x, y] of cells) open.add(cellKey(x, y));
      }
    }
    return false;
  };
  return solve() ? placed : null;
}

function regionOk(region: Cell[]) {
  const xs = region.map((c) => c[0]);
  const ys = region.map((c) => c[1]);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const w = Math.max(...xs) - minX + 1;
  const h = Math.max(...ys) - minY + 1;
  const fill = region.length / (w * h);
  const local = new Set(region.map(([x, y]) => cellKey(x - minX, y - minY)));
  if (w > MAX_BOARD || h > MAX_BOARD) outlineRejections.wide++;
  else if (w < 5 || h < 5) outlineRejections.small++;
  else if (fill < 0.55) outlineRejections.sparse++;
  else if (fill > 0.82) outlineRejections.dense++;
  else if (hasHoles(local, w, h)) outlineRejections.holey++;
  return w <= MAX_BOARD && h <= MAX_BOARD && w >= 5 && h >= 5 && fill >= 0.55 && fill <= 0.82 && !hasHoles(local, w, h);
}

/** Turns a filled region into a playable day with spares, like a single-day puzzle. */
function toPuzzle(rng: Rng, dateKey: string, level: Level, tiles: { shape: string; cells: Cell[] }[], colorCount: number) {
  const all = tiles.flatMap((t) => t.cells);
  const minX = Math.min(...all.map((c) => c[0]));
  const minY = Math.min(...all.map((c) => c[1]));
  const local = tiles.map((t) => ({ shape: t.shape, cells: t.cells.map(([x, y]) => [x - minX, y - minY] as Cell) }));
  const board = local.flatMap((t) => t.cells);
  const decoys = Array.from({ length: level.spares }, () => handed(rng, rng.pick(Object.keys(SHAPES))));
  const colors = rng.shuffle([...Array(colorCount).keys()]);
  const real = local.map((t, i) => ({ id: `p${i}`, shape: t.shape, start: t.cells, solved: t.cells as Cell[] | null }));
  const fake = decoys.map((d, i) => ({ id: `d${i}`, shape: d.name, start: d.cells, solved: null as Cell[] | null }));
  const pieces: PieceDef[] = rng.shuffle([...real, ...fake]).map((p, i) => ({ id: p.id, shape: p.shape, cells: randomTurn(rng, p.start), color: colors[i % colorCount]! }));
  const solution: Record<string, SolvedPiece> = {};
  for (const p of real) {
    const x = Math.min(...p.solved!.map((c) => c[0]));
    const y = Math.min(...p.solved!.map((c) => c[1]));
    solution[p.id] = { x, y, cells: p.solved!.map(([cx, cy]) => [cx - x, cy - y] as Cell) };
  }
  const cols = Math.max(...board.map((c) => c[0])) + 1;
  const rows = Math.max(...board.map((c) => c[1])) + 1;
  const puzzle: Puzzle = { dateKey, cols, rows, board, pieces, solution, spares: level.spares, level };
  return { puzzle, offset: { x: minX, y: minY } };
}

/** Why carvings were rejected, for tuning the prototype. */
export const outlineRejections = { region: 0, tile: 0, sizes: 0, wide: 0, small: 0, sparse: 0, dense: 0, holey: 0 };

export function generateOutlineMonth(monthKey: string, outline: Outline, colorCount: number, seed = ""): OutlineMonth {
  const rng = makeRng(`snug-outline:${monthKey}:${outline}:${seed}`);
  const dates = monthDates(monthKey);
  const levels = dates.map((d) => LEVELS[weekday(d)]!);
  const wanted = levels.map((l) => l.pieces * SQUARES_PER_PIECE);
  const mask = rasterize(outline, Math.round(wanted.reduce((a, b) => a + b, 0)));
  const cells = [...mask].map(parse);
  // Day sizes scaled to the drawn outline, gentle days smallest.
  const scale = cells.length / wanted.reduce((a, b) => a + b, 0);
  const targets = wanted.map((w) => w * scale);

  for (let carve = 1; carve <= CARVE_TRIES; carve++) {
    const owner = carveRegions(rng, cells, targets);
    if (!owner) continue;
    const regions = Array.from({ length: dates.length }, () => [] as Cell[]);
    for (const [k, d] of owner) regions[d]!.push(parse(k));
    if (!regions.map(regionOk).every(Boolean)) {
      outlineRejections.region++;
      continue;
    }
    // Regions match dates by size (smallest to the gentlest days), and each is filled with that day's patch count.
    const bySize = regions.map((r, i) => ({ r, i })).sort((a, b) => a.r.length - b.r.length);
    const byNeed = dates.map((_, i) => i).sort((a, b) => levels[a]!.pieces - levels[b]!.pieces || a - b);
    const regionFor: Cell[][] = [];
    byNeed.forEach((dateIndex, k) => (regionFor[dateIndex] = bySize[k]!.r));
    const tiles = regionFor.map((r, i) => tileRegion(rng, r, levels[i]!.pieces));
    if (tiles.some((t) => !t)) {
      outlineRejections.tile++;
      continue;
    }
    const days = dates.map((dateKey, i) => {
      const { puzzle, offset } = toPuzzle(rng, dateKey, levels[i]!, tiles[i]!, colorCount);
      return { dateKey, level: levels[i]!, puzzle, offset };
    });
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    return {
      monthKey, outline, days,
      minX: Math.min(...xs), minY: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1,
      squares: cells.length, carves: carve,
    };
  }
  throw new Error(`Snug: no ${outline} month for ${monthKey}`);
}

/** One saved month, as stored in data/snug/months and served day by day. */
export interface MonthFile {
  version: number;
  monthKey: string;
  outline: Outline;
  minX: number;
  minY: number;
  width: number;
  height: number;
  days: MonthDay[];
}

/** Every rule a month must keep, checked from the finished data; returns what is wrong, or nothing. */
export function checkMonth(month: { monthKey: string; days: MonthDay[] }): string[] {
  const problems: string[] = [];
  const dates = monthDates(month.monthKey);
  if (month.days.length !== dates.length || month.days.some((d, i) => d.dateKey !== dates[i])) problems.push("days do not match the calendar");
  const seen = new Set<string>();
  for (const d of month.days) {
    const p = d.puzzle;
    const board = new Set(p.board.map(([x, y]) => cellKey(x, y)));
    const fill = p.board.length / (p.cols * p.rows);
    if (p.cols > MAX_BOARD || p.rows > MAX_BOARD || p.cols < 5 || p.rows < 5) problems.push(`${d.dateKey}: board is ${p.cols} by ${p.rows}`);
    if (fill < 0.55 || fill > 0.82) problems.push(`${d.dateKey}: fill ${fill.toFixed(2)}`);
    if (hasHoles(board, p.cols, p.rows)) problems.push(`${d.dateKey}: board has a hole`);
    const covered = Object.values(p.solution).flatMap((s) => s.cells.map(([x, y]) => cellKey(x + s.x, y + s.y)));
    if (covered.length !== board.size || new Set(covered).size !== covered.length || !covered.every((k) => board.has(k))) problems.push(`${d.dateKey}: solution does not fill the board exactly`);
    const level = LEVELS[weekday(d.dateKey)]!;
    if (Object.keys(p.solution).length !== level.pieces || p.spares !== level.spares) problems.push(`${d.dateKey}: wrong patch or spare count`);
    for (const [x, y] of p.board) {
      const k = cellKey(x + d.offset.x, y + d.offset.y);
      if (seen.has(k)) problems.push(`${d.dateKey}: overlaps another day`);
      seen.add(k);
    }
  }
  return problems;
}
