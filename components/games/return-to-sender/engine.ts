// Return to Sender's engine: boards, regulations, the examples a puzzle opens with, and inspection bags.

import type { Rng } from "../daily";

export type BoardId = "sheet";

/** An item's contents; each board defines what the numbers mean. */
export type Cells = number[];

export interface Regulation {
  /** Stable forever: month files name it, so a regulation that changes meaning needs a new id. */
  id: string;
  text: string;
  test: (cells: Cells) => boolean;
  /** Builds an item this regulation approves. */
  make: (rng: Rng) => Cells;
}

export interface Board {
  id: BoardId;
  name: string;
  regulations: readonly Regulation[];
  random: (rng: Rng) => Cells;
  /** A small change of one or two cells. */
  mutate: (cells: Cells, rng: Rng) => Cells;
  /** How much is on the item; 0 means it is empty. */
  filled: (cells: Cells) => number;
  /** Whether the cells are a well-formed item for this board. */
  valid: (cells: Cells) => boolean;
}

export interface Item {
  board: BoardId;
  cells: Cells;
}
export interface Sample extends Item {
  follows: boolean;
}
export interface BagItem extends Item {
  truth: boolean;
}

/** A board and the regulation it follows; Super Sunday puzzles will have two parts sharing one idea. */
export interface Part {
  board: BoardId;
  regulation: string;
}
export interface Puzzle {
  seed: string;
  parts: Part[];
  examples: Sample[];
}

export const BAG_SIZE = 8;
export const MIN_APPROVED = 3;
export const MAX_APPROVED = 5;

export const itemKey = (item: Item) => `${item.board}:${item.cells.join(",")}`;
export const passes = (regulation: Regulation, cells: Cells) => !!regulation.test(cells);

/** One item the regulation approves, with at least 3 things on it, and a near copy it returns. */
export function makeExamples(board: Board, regulation: Regulation, rng: Rng): [Sample, Sample] | null {
  let yes: Cells | null = null;
  for (let t = 0; t < 300 && !yes; t++) {
    const cells = regulation.make(rng);
    if (passes(regulation, cells) && board.filled(cells) >= 3) yes = cells;
  }
  if (!yes) return null;
  let no: Cells | null = null;
  for (let t = 0; t < 300 && !no; t++) {
    const cells = board.mutate(yes, rng);
    if (board.filled(cells) > 0 && !passes(regulation, cells)) no = cells;
  }
  for (let t = 0; t < 300 && !no; t++) {
    const cells = board.random(rng);
    if (board.filled(cells) > 0 && !passes(regulation, cells)) no = cells;
  }
  if (!no) return null;
  return [
    { board: board.id, cells: yes, follows: true },
    { board: board.id, cells: no, follows: false },
  ];
}

/** How many approved items each part gets: 3 to 5 in all, and with two parts at least one of each per part. */
function quotas(rng: Rng, parts: number): number[] {
  const total = MIN_APPROVED + rng.int(MAX_APPROVED - MIN_APPROVED + 1);
  if (parts === 1) return [total];
  if (parts !== 2) throw new Error("Inspection bags support one or two boards.");
  const per = BAG_SIZE / 2, lo = Math.max(1, total - (per - 1)), hi = Math.min(per - 1, total - 1);
  const first = lo + rng.int(hi - lo + 1);
  return [first, total - first];
}

/**
 * Eight new items split across the parts' boards, picked so that no other regulation on the same board sorts
 * them all the same way. Items in `exclude` (the player's log) are never used.
 */
export function buildBag(parts: { board: Board; regulation: Regulation }[], rng: Rng, exclude: Set<string>): BagItem[] {
  const per = BAG_SIZE / parts.length, approved = quotas(rng, parts.length), out: BagItem[] = [];
  parts.forEach(({ board, regulation }, n) => {
    const decoys = board.regulations.filter((r) => r.id !== regulation.id);
    const pool = new Map<string, Cells>();
    const add = (cells: Cells) => {
      const key = itemKey({ board: board.id, cells });
      if (board.filled(cells) > 0 && !exclude.has(key) && !pool.has(key)) pool.set(key, cells);
    };
    for (let i = 0; i < 60; i++) {
      const cells = regulation.make(rng);
      add(cells);
      add(board.mutate(cells, rng));
    }
    for (const decoy of decoys) {
      for (let i = 0; i < 10; i++) {
        const cells = decoy.make(rng);
        add(cells);
        add(board.mutate(cells, rng));
      }
    }
    for (let i = 0; i < 60; i++) add(board.random(rng));

    const items = rng.shuffle([...pool.values()]).map((cells) => ({ cells, truth: passes(regulation, cells) }));
    const open = new Set(decoys), chosen: typeof items = [], wants: boolean[] = [];
    for (let t = approved[n]!, f = per - approved[n]!; t || f; ) {
      if (t) { wants.push(true); t--; }
      if (f) { wants.push(false); f--; }
    }
    for (const want of wants) {
      let best: (typeof items)[number] | null = null, bestScore = -1;
      for (const item of items) {
        if (item.truth !== want || chosen.includes(item)) continue;
        let score = 0;
        for (const decoy of open) if (passes(decoy, item.cells) !== item.truth) score++;
        if (score > bestScore) { best = item; bestScore = score; }
      }
      if (!best) break;
      chosen.push(best);
      for (const decoy of [...open]) if (passes(decoy, best.cells) !== best.truth) open.delete(decoy);
    }
    out.push(...chosen.map((item) => ({ board: board.id, cells: item.cells, truth: item.truth })));
  });
  return rng.shuffle(out);
}
