// A day's puzzle: making it from a seed, stamping submissions, inspection bags, and the checks every puzzle must pass.

import { makeRng } from "../daily";
import { findRegulation } from "./boards";
import { BAG_SIZE, MAX_APPROVED, MIN_APPROVED, buildBag, itemKey, makeExamples, passes, type BagItem, type Item, type Part, type Puzzle } from "./engine";

function resolve(part: Part) {
  const found = findRegulation(part);
  if (!found) throw new Error(`Unknown regulation ${part.regulation} on board ${part.board}.`);
  return found;
}

export function createPuzzle(seed: string, parts: Part[]): Puzzle | null {
  const examples: Puzzle["examples"] = [];
  for (const part of parts) {
    const { board, regulation } = resolve(part);
    const pair = makeExamples(board, regulation, makeRng(`${seed}:examples:${part.board}`));
    if (!pair) return null;
    examples.push(...pair);
  }
  return { seed, parts, examples };
}

/** Whether the clerk approves an item under the puzzle's regulation for its board. */
export function approves(puzzle: Puzzle, item: Item): boolean {
  const part = puzzle.parts.find((p) => p.board === item.board);
  if (!part) throw new Error(`This puzzle has no ${item.board} board.`);
  return passes(resolve(part).regulation, item.cells);
}

/** The bag for an inspection try; `exclude` holds the keys of items already in the player's log. */
export function inspectionBag(puzzle: Puzzle, attempt: number, exclude: Iterable<string>): BagItem[] {
  return buildBag(puzzle.parts.map(resolve), makeRng(`${puzzle.seed}:bag:${attempt}`), new Set(exclude));
}

/** Everything wrong with a puzzle, checked over its first `attempts` inspection bags; empty means it is fine. */
export function checkPuzzle(puzzle: Puzzle, attempts = 3): string[] {
  const problems: string[] = [];
  const found = puzzle.parts.map(findRegulation);
  if (found.some((f) => !f)) return [`unknown regulation in ${JSON.stringify(puzzle.parts)}`];

  for (const [n, part] of puzzle.parts.entries()) {
    const { board, regulation } = found[n]!;
    const samples = puzzle.examples.filter((e) => e.board === part.board);
    if (samples.length !== 2 || !samples.some((s) => s.follows) || !samples.some((s) => !s.follows)) problems.push(`${part.board}: needs one approved and one returned example`);
    for (const s of samples) {
      if (!board.valid(s.cells)) problems.push(`${part.board}: example is not a valid item`);
      else if (passes(regulation, s.cells) !== s.follows) problems.push(`${part.board}: example is stamped wrong`);
      else if (s.follows && board.filled(s.cells) < 3) problems.push(`${part.board}: approved example has fewer than 3 things`);
    }
  }

  const exclude = new Set(puzzle.examples.map(itemKey));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const bag = inspectionBag(puzzle, attempt, exclude);
    const approved = bag.filter((b) => b.truth).length;
    const label = `bag ${attempt + 1}`;
    if (bag.length !== BAG_SIZE) problems.push(`${label}: has ${bag.length} items`);
    if (approved < MIN_APPROVED || approved > MAX_APPROVED) problems.push(`${label}: approves ${approved}`);
    if (new Set(bag.map(itemKey)).size !== bag.length) problems.push(`${label}: repeats an item`);
    if (bag.some((b) => exclude.has(itemKey(b)))) problems.push(`${label}: reuses an example`);
    for (const [n, part] of puzzle.parts.entries()) {
      const { board, regulation } = found[n]!;
      const items = bag.filter((b) => b.board === part.board);
      if (items.some((b) => !board.valid(b.cells) || passes(regulation, b.cells) !== b.truth)) problems.push(`${label}: ${part.board} item is invalid or sorted wrong`);
      if (puzzle.parts.length > 1 && (items.every((b) => b.truth) || items.every((b) => !b.truth))) problems.push(`${label}: ${part.board} items are all one way`);
      const lucky = board.regulations.filter((r) => r.id !== regulation.id && items.every((b) => passes(r, b.cells) === b.truth));
      if (lucky.length) problems.push(`${label}: ${lucky.map((r) => r.id).join(", ")} also sorts every ${part.board} item right`);
    }
  }
  return problems;
}
