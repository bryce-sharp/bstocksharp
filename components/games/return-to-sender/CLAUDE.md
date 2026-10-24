# Return to Sender

Daily hidden-rule puzzle at a post office: build mail, the clerk stamps it APPROVED or RETURN TO SENDER by a secret regulation, then pass an inspection of 8 new items. Design and decisions: `docs/games/return-to-sender.md`; playable mockup source: `docs/games/return-to-sender-mockup.html`. Stage 2 (rough page, testing phase): unlisted at `/games/return-to-sender` (not in `lib/games.ts`, `robots: noindex`), saved on the device only.

- **Routes**: `/games/return-to-sender` (play), `/games/return-to-sender/lab` (signed in only: any regulation and seed, or any scheduled day, with its examples, first 3 bags and checks; it reads every month file, future days included), `/games/return-to-sender/month/[month]` (only days reached: UTC tomorrow in production, every day in development). `Client.tsx` loads the game and lab in the browser only.
- `ReturnToSender.tsx` — the page: the testing-phase board picker (`Board (testing)`, remembered as `return-to-sender.testBoard`), and `Counter` for one board's puzzle: build and submit (a repeat shows its old stamp and costs nothing), the log (examples first, tap to bring an item back), the inspection (filing wrong says how many, never which; the next try is a new bag), and the head office memo with the share line (filled and hollow squares) and practice replays.
- `records.ts` — device-only saving: the scored first run per day and board through `saveAttempt` (`return-to-sender.<board>.attempt.<date>`, with the submissions so a finished day keeps its log), the run in progress (`return-to-sender.<board>.progress.<date>`), all stamped with `PUZZLE_VERSION`. `load.ts` caches each month as `return-to-sender.month.<YYYY-MM>` and refetches when a board is missing.
- `views.ts` — how each board is built and drawn (`Editor`, `Thumb`, `describe`, `howTo`, `submitLabel`); `boards/SheetView.tsx` for the stamp sheet. Editors get `onChange(update)` with an updater, so every square of one drag lands.
- `parts.tsx` (stamp, paper panel, log card), `palette.ts`, `fonts.ts` (Oswald and Courier Prime as `--rts-font-display` and `--rts-font-type`).

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
