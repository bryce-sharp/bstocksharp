// Stamp sheet: a 5 by 5 sheet of stamp spots; cell 1 means a stamp, read row by row from the top left.

import type { Rng } from "../../daily";
import type { Board, Cells, Regulation } from "../engine";

const G = 5, SIZE = G * G, CENTER = 12;
const LINE = [0, 1, 2, 3, 4];
const at = (r: number, c: number) => r * G + c;
const count = (g: Cells) => g.filter(Boolean).length;

/** Side neighbors of each square. */
const NB: number[][] = Array.from({ length: SIZE }, (_, i) => {
  const r = Math.floor(i / G), c = i % G, out: number[] = [];
  if (r > 0) out.push(i - G);
  if (r < G - 1) out.push(i + G);
  if (c > 0) out.push(i - 1);
  if (c < G - 1) out.push(i + 1);
  return out;
});

function reach(g: Cells, starts: number[]): Set<number> {
  const seen = new Set(starts), queue = [...starts];
  while (queue.length) {
    const i = queue.pop()!;
    for (const j of NB[i]!) if (g[j] && !seen.has(j)) { seen.add(j); queue.push(j); }
  }
  return seen;
}

/** A piece of up to `k` stamps grown from `start` through squares that `allowed` accepts. */
function grow(rng: Rng, k: number, allowed: (i: number) => boolean, start: number): Cells {
  const g: Cells = new Array(SIZE).fill(0), cells = [start];
  g[start] = 1;
  for (let tries = 0; cells.length < k && tries < 400; tries++) {
    const from = rng.pick(cells);
    const options = NB[from]!.filter((j) => !g[j] && allowed(j));
    if (!options.length) continue;
    const j = rng.pick(options);
    g[j] = 1;
    cells.push(j);
  }
  return g;
}

const randomSheet = (rng: Rng, p: number): Cells => Array.from({ length: SIZE }, () => (rng.next() < p ? 1 : 0));
const mirrorSheet = (g: Cells): Cells => g.map((_, i) => g[at(Math.floor(i / G), Math.min(i % G, G - 1 - (i % G)))]!);
const blockFull = (g: Cells, r: number, c: number) => !!(g[at(r, c)] && g[at(r, c + 1)] && g[at(r + 1, c)] && g[at(r + 1, c + 1)]);

const REGULATIONS: Regulation[] = [
  {
    id: "sheet.no-touch",
    text: "No two stamps touch side to side.",
    test: (g) => g.every((v, i) => !v || NB[i]!.every((j) => !g[j])),
    make: (rng) => {
      const g: Cells = new Array(SIZE).fill(0);
      for (const i of rng.shuffle([...Array(SIZE).keys()])) {
        if (rng.next() < 0.55 && NB[i]!.every((j) => !g[j])) g[i] = 1;
      }
      return g;
    },
  },
  {
    id: "sheet.mirror",
    text: "The sheet is a mirror image, left to right.",
    test: (g) => g.every((v, i) => v === g[at(Math.floor(i / G), G - 1 - (i % G))]),
    make: (rng) => {
      const g = mirrorSheet(randomSheet(rng, 0.3 + rng.next() * 0.25));
      if (!count(g)) g[at(rng.int(G), 2)] = 1;
      return g;
    },
  },
  {
    id: "sheet.one-piece",
    text: "All the stamps join into one piece.",
    test: (g) => {
      const filled = g.flatMap((v, i) => (v ? [i] : []));
      return filled.length > 0 && reach(g, [filled[0]!]).size === filled.length;
    },
    make: (rng) => grow(rng, 4 + rng.int(9), () => true, rng.int(SIZE)),
  },
  {
    id: "sheet.odd-count",
    text: "The sheet holds an odd number of stamps.",
    test: (g) => count(g) % 2 === 1,
    make: (rng) => {
      const g = randomSheet(rng, 0.25 + rng.next() * 0.3);
      if (count(g) % 2 === 0) {
        const i = rng.int(SIZE);
        g[i] = g[i] ? 0 : 1;
      }
      return g;
    },
  },
  {
    id: "sheet.every-row",
    text: "Every row has at least one stamp.",
    test: (g) => LINE.every((r) => LINE.some((c) => g[at(r, c)] === 1)),
    make: (rng) => {
      const g = randomSheet(rng, 0.2);
      for (const r of LINE) if (!LINE.some((c) => g[at(r, c)])) g[at(r, rng.int(G))] = 1;
      return g;
    },
  },
  {
    id: "sheet.no-block",
    text: "No 2 by 2 block is fully stamped.",
    test: (g) => LINE.slice(0, -1).every((r) => LINE.slice(0, -1).every((c) => !blockFull(g, r, c))),
    make: (rng) => {
      const g = randomSheet(rng, 0.5 + rng.next() * 0.15);
      for (let r = 0; r < G - 1; r++) {
        for (let c = 0; c < G - 1; c++) if (blockFull(g, r, c)) g[at(r + rng.int(2), c + rng.int(2))] = 0;
      }
      return g;
    },
  },
  {
    id: "sheet.center",
    text: "The center square has a stamp.",
    test: (g) => g[CENTER] === 1,
    make: (rng) => {
      const g = randomSheet(rng, 0.3);
      g[CENTER] = 1;
      return g;
    },
  },
  {
    id: "sheet.top-to-bottom",
    text: "Stamps link the top row to the bottom row.",
    test: (g) => {
      const top = LINE.filter((c) => g[c]);
      return top.length > 0 && [...reach(g, top)].some((i) => i >= SIZE - G);
    },
    make: (rng) => {
      const g = randomSheet(rng, 0.1);
      let r = 0, c = rng.int(G);
      g[at(r, c)] = 1;
      while (r < G - 1) {
        if (rng.next() < 0.6) r++;
        else c = Math.max(0, Math.min(G - 1, c + (rng.next() < 0.5 ? -1 : 1)));
        g[at(r, c)] = 1;
      }
      return g;
    },
  },
];

export const SHEET: Board = {
  id: "sheet",
  name: "Stamp sheet",
  regulations: REGULATIONS,
  random: (rng) => randomSheet(rng, 0.2 + rng.next() * 0.4),
  mutate: (g, rng) => {
    const m = [...g], flips = rng.next() < 0.3 ? 2 : 1;
    for (let k = 0; k < flips; k++) {
      const i = rng.int(SIZE);
      m[i] = m[i] ? 0 : 1;
    }
    return m;
  },
  filled: count,
  valid: (g) => g.length === SIZE && g.every((v) => v === 0 || v === 1),
};
