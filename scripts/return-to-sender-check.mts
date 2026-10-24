// Checks Return to Sender's regulations and puzzles: every regulation builds valid items it approves, random and
// changed items stay valid, and sample puzzles pass every puzzle check. Exits with an error if anything fails.
//
//   npm run return-to-sender:check

import { makeRng } from "../components/games/daily.ts";
import { BOARDS } from "../components/games/return-to-sender/boards/index.ts";
import { checkPuzzle, createPuzzle } from "../components/games/return-to-sender/puzzle.ts";

const ITEMS = 300, PUZZLES = 40;
const problems = new Map<string, number>();
const note = (problem: string) => problems.set(problem, (problems.get(problem) ?? 0) + 1);

for (const board of Object.values(BOARDS)) {
  for (let i = 0; i < ITEMS; i++) {
    const rng = makeRng(`check:${board.id}:random:${i}`);
    const cells = board.random(rng);
    if (!board.valid(cells) || !board.valid(board.mutate(cells, rng))) note(`${board.id}: a random or changed item is not valid`);
  }
  for (const regulation of board.regulations) {
    let made = 0, clean = 0;
    for (let i = 0; i < ITEMS; i++) {
      const cells = regulation.make(makeRng(`check:${regulation.id}:make:${i}`));
      if (!board.valid(cells)) note(`${regulation.id}: make built an invalid item`);
      else if (!regulation.test(cells)) note(`${regulation.id}: make built an item it returns`);
      else if (!board.filled(cells)) note(`${regulation.id}: make built an empty item`);
      else made++;
    }
    for (let i = 0; i < PUZZLES; i++) {
      const puzzle = createPuzzle(`check:${regulation.id}:puzzle:${i}`, [{ board: board.id, regulation: regulation.id }]);
      if (!puzzle) {
        note(`${regulation.id}: no examples`);
        continue;
      }
      const found = checkPuzzle(puzzle, 3);
      for (const p of found) note(`${regulation.id}: ${p}`);
      if (!found.length) clean++;
    }
    console.log(`${regulation.id}: ${made}/${ITEMS} items approved, ${clean}/${PUZZLES} puzzles clean`);
  }
}

if (problems.size) {
  console.error(`\n${problems.size} kinds of problem:`);
  for (const [problem, times] of problems) console.error(`  ${problem}${times > 1 ? ` (x${times})` : ""}`);
  process.exit(1);
}
console.log("\nAll checks passed.");
