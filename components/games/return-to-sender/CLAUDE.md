# Return to Sender

Daily hidden-rule puzzle at a post office: build mail, the clerk stamps it APPROVED or RETURN TO SENDER by a secret regulation, then pass an inspection of 8 new items. Design and decisions: `docs/games/return-to-sender.md`; playable mockup source: `docs/games/return-to-sender-mockup.html`. Stage 1 (engine only): there is no page yet.

- `engine.ts` — types (`Board`, `Regulation`, `Puzzle`, `Sample`, `BagItem`), `makeExamples` (an approved item with at least 3 things, then a near copy that is returned), and `buildBag`: 8 items, 3 to 5 approved (two boards: at least one of each per board), picked so no other regulation on the same board sorts the whole bag right.
- `boards/` — one file per board; `boards/index.ts` lists the built boards (`BOARDS`, `BOARD_IDS`). Only the stamp sheet (`sheet.ts`, 8 regulations) is built.
- `puzzle.ts` — `createPuzzle(seed, parts)`, `approves`, `inspectionBag(puzzle, attempt, exclude)` where `exclude` holds the keys of the player's log, and `checkPuzzle` with every rule a puzzle must pass.
- `schedule.ts` — month files. While testing, every built board gets a puzzle every day and the player picks the board. A board's regulations reshuffle on each pass through the list and never repeat two days running. `generateMonth` keeps a month's existing puzzles and only fills in boards built since.
- `npm run return-to-sender:check` — every regulation: 300 items it must approve, and 40 sample puzzles with 3 bags each.
- `npm run return-to-sender:months -- YYYY-MM [YYYY-MM] [--force]` — writes `data/return-to-sender/months/` and its index, checking every month before saving (including puzzles already on disk).

## Gotchas
- Month files name regulations by id: never change what an id means; add a new id instead.
- Inspection bags are not stored: they come from the puzzle seed, the try number, and the player's log. Changing a regulation's `make` or a board's `random` or `mutate` changes future bags, so rerun both scripts.
- Seeds are strings through `makeRng` in `../daily.ts`, so puzzles differ from the mockup's numeric seeds.
- Tests must return booleans; `passes` coerces them before any comparison.
- Never let color carry meaning alone (Bryce is colorblind): shapes, sizes, numbers, and badges first.
