# Return to Sender (working title)

_Designed 2026-10-22 to 2026-10-23. The next game for `/games` after Snug. Nothing is
built in the app yet; the playable mockup is
[this artifact](https://claude.ai/artifact/8nfLeeStWz1e3LxZ9TCpLb) (private to Bryce),
and its source is [return-to-sender-mockup.html](return-to-sender-mockup.html) in this
folder (open it in a browser)._

## The pitch

A daily puzzle at a post office. Every day the clerk follows one secret regulation.
You build a piece of mail, submit it, and the clerk stamps it **APPROVED** or
**RETURN TO SENDER**. When you think you know the regulation, you ask for an
inspection: sort a mail bag of 8 new items into approved and returned. Get all 8
right and the day closes with a memo from head office that reveals the regulation.
Your score is how many items you submitted.

The mechanic is hidden-rule induction, the same idea as the board game Zendo and
Peter Wason's 2-4-6 task (1960).

## Decisions

| Question | Decision |
|---|---|
| Game type | Hidden-rule induction ("The Rule"). Chosen over Secret Neighbors (Minesweeper where the numbers count a secret set of squares) and Loop (a Masyu-style loop puzzle) after playing mockups of the first two. |
| Format | Daily on the web, the same puzzle for everyone, with a weekly rhythm. One-time story games are saved for a future Godot project. |
| Theme | A post office ("Stamp Office"): rubber stamps, forms, a stern clerk, memos from head office. Papers, Please (Lucas Pope, 2013) is the tone reference, kept cozy rather than grim. |
| Name | **Return to Sender** (decided 2026-10-23, unless something better comes up). Code lives under `return-to-sender`. |
| The week | Monday to Saturday each have their own board (kind of mail). **Super Sunday** puts one regulation on **two** boards at once, and the pair changes from week to week. Never all boards at once. |
| Proving it | An inspection of 8 items. Each bag approves **3, 4 or 5** items, never a fixed half, so splitting the bag evenly is not a safe guess. On Super Sunday each board in the bag has at least one approved and one returned item. |
| Wrong inspection | Says how many are filed wrong (not which), sends you back to the counter, and the next inspection is a new bag. There is no way to fail. |
| Scoring | Submissions used, plus the inspection try that passed. No stars, no par, no failing: the PlateUp 3-star system is the stress to avoid. |
| Share | Text line plus one square per submission: filled for approved, hollow for returned. Never reveals the regulation. |
| Accessibility | Bryce is colorblind. Color never carries meaning alone: parcels and stamp pictures are shapes, boxes are sizes with weights printed, mail is a badge. Colors avoid red-green pairs. |
| Every board | Must make the legal moves obvious (the first route playtest failed this). |
| Build order | One board at a time. **Stamp sheet first**, then polish and lab it before adding the next. Adding all six at once would be too much. |
| Testing phase | Every built board gets a puzzle every day, and a test-only picker chooses which one to play (Monday could be Parcel row or Envelope). Once every board feels good, the picker goes away and the boards spread back out to their weekdays. |
| Saving while testing | On the device only. Nothing goes to the database until the kinks are worked out (stage 5 of the build plan). |
| Hints | Wanted, not designed yet (see Open questions). |
| Gallery | A "Coming soon" card on `/games` until the first board ships. It can tease the name with something postal, such as a package on its way. |

## How a puzzle plays

1. The log starts with two examples: one item that is approved, and a near copy
   that is returned.
2. Build an item at the counter and press Submit. A big rubber stamp lands on it.
   Submitting an item already in the log shows its old stamp and costs nothing.
3. Every submission goes into the log (newest first). Tapping one loads it back
   onto the counter to change it.
4. **Request inspection** opens a mail bag of 8 new items (never ones already in the
   log). Mark each Approve or Return, then file it.
5. All 8 right: the head office memo shows the regulation number and text, a note
   for Super Sunday explaining how it reads on each board, the submission count,
   the inspection try, and the share preview.

## The boards

Each board below lists what the player builds, how the mockup stores it, and the
regulations in the mockup. Every regulation has one sentence of text, a `test`, and
a `make` that builds an item the regulation approves.

### Stamp sheet (Mondays)

- **Build**: tap or drag to place postage stamps on a 5 by 5 sheet.
- **Data**: 25 cells, `1` is a stamp.
- **Regulations (8)**: no two stamps touch side to side; mirror image left to right;
  all stamps join into one piece; odd number of stamps; every row has a stamp; no
  2 by 2 block fully stamped; the center square has a stamp; stamps link the top
  row to the bottom row.
- **Mockup puzzles**: No. 101 (no two touch), No. 102 (one piece).

### Parcel row (Tuesdays)

- **Build**: pick a parcel (circle, square, triangle, diamond, or empty), then tap or
  drag along 7 slots on a conveyor belt.
- **Data**: 7 slots, `0` empty, `1` to `4` circle, square, triangle, diamond.
- **Regulations (10)**: no two neighbors the same shape; every circle has a square
  right after it; reads the same from both ends; all parcels in one unbroken run;
  no two parcels side by side; odd number of parcels; all four shapes appear;
  neither end holds a circle; more squares than circles; first and last slots hold
  the same thing.
- **Mockup puzzles**: No. 201 (neighbors differ), No. 202 (circle then square).

### Envelope (Wednesdays)

- **Build**: pick one of 9 stamps from a tray (picture: sun, star or mountain;
  value 1, 2 or 3) and place three on an envelope. Submit needs all three.
- **Data**: 3 spots, `1` to `9` = picture times 3 plus value.
- **Regulations (9)**: total postage is even; three different pictures; values never
  go down left to right; middle stamp worth more than both others; at least two
  share a picture; exactly one star; no two neighbors share a value; total postage
  6 or more; first and last stamps identical.
- **Mockup puzzles**: No. 301 (different pictures), No. 302 (values never go down).

### House numbers (Thursdays)

- **Build**: a street with odd houses 1, 3, 5, 7, 9 on the top side and even houses
  2 to 10 on the bottom, each facing its pair (1 faces 2). Tap houses to deliver mail.
- **Data**: 10 cells indexed by house number minus 1, `1` gets mail.
- **Regulations (9)**: only even houses; mailed numbers add up to 15 or more; no two
  neighbors on the same side; every mailed house faces a mailed house; exactly
  three houses; more odd houses than even; at least one house numbered 7 or
  higher; mailed numbers add up to an even number; every mailed house is in the 3
  times table.
- **Mockup puzzles**: No. 401 (only even), No. 402 (15 or more).

### Delivery route (Fridays)

- **Build**: every route starts at the post office (PO) on a 4 by 4 street map. Tap a
  highlighted corner to drive there; tap the last stop to back up; drive back into
  the post office to close a loop. A route never crosses itself.
- **Data**: corner indices in travel order, always starting at corner 5 (row 2,
  column 2); a closed route ends with 5 again.
- **Regulations (9)**: never turns left; turns at every corner; ends back at the post
  office; touches all four edges; passes at least 8 corners; ends at least 3 blocks
  from the post office; never heads up the map; even number of turns; ends on the
  edge of the map.
- **Mockup puzzles**: No. 501 (never heads up), No. 502 (never turns left).

### Truck load (Saturdays)

- **Build**: top-down truck with the cab at the front, 2 lanes by 4 rows. Pick a box
  (small 1, medium 2, large 3, drawn at different sizes with the weight printed)
  and tap spots to load or unload.
- **Data**: 8 spots, row 0 at the cab, left lane then right; `0` empty, `1` to `3`
  weight.
- **Regulations (9)**: left and right lanes weigh the same; boxes never get heavier
  toward the back; front half heavier than the back half; whole load 10 or less;
  no empty spot in front of a box in the same lane; every box has a box across the
  aisle; no two large boxes next to each other; left lane matches right lane row by
  row; exactly four boxes.
- **Mockup puzzles**: No. 601 (balanced), No. 602 (never heavier toward the back).

### Super Sunday

One regulation, two boards, one shared idea. The memo explains how it reads on
each board. Pairs rotate weekly so each comes back about every six weeks with a
different shared regulation.

| Pair | Shared regulation | First board | Second board |
|---|---|---|---|
| Stamp sheet + Parcel row | Mirror image (mockup No. 701) | Sheet mirrors left to right | Row reads the same from both ends |
| Envelope + House numbers | Numbers add to an even total (mockup No. 702) | Stamp values | Numbers of houses that get mail |
| Parcel row + House numbers | No two neighbors | No two parcels side by side | No two neighboring houses get mail |
| Truck load + Envelope | Total of 6 or more | Load weight | Postage |
| Delivery route + Stamp sheet | Touches all four edges | Route reaches every edge | A stamp on every edge |

## Rule families

Every regulation belongs to a family, the kind of idea the player discovers. The
six boards were picked so every family has a home.

| Family | Boards |
|---|---|
| Counting | Stamp sheet, Parcel row, House numbers, Truck load |
| Number math (totals, odd or even) | Envelope, House numbers, Truck load |
| Neighbors | Stamp sheet, Parcel row, Envelope, House numbers, Truck load |
| Mirror and matching ends | Stamp sheet, Parcel row, Envelope, Truck load |
| Joined together | Stamp sheet, Parcel row |
| Position | Stamp sheet, Parcel row, Envelope, House numbers, Delivery route |
| Order | Envelope, Parcel row, Truck load |
| Variety | Stamp sheet, Parcel row, Envelope, Delivery route |
| Movement and turns | Delivery route |
| Comparing two groups | Parcel row, House numbers, Truck load |
| Limits | Truck load |

## Making puzzles (how the mockup does it)

- **Seeded**: `mulberry32`, the same generator as `components/games/daily.ts`, so a
  puzzle is identical for everyone.
- **Examples**: run the regulation's `make` until it gives an approved item with at
  least 3 things in it, then change it slightly until it is returned.
- **Inspection bag**: build a pool from the regulation's `make`, small changes to
  those items, every other regulation's `make` on the same board, and random items.
  Skip anything already in the log. Pick 3 to 5 approved items and the rest
  returned, greedily choosing items that disagree with as many other regulations
  as possible, so no other regulation on the board passes the whole bag.
- **Checked in Node** for every sample puzzle: all examples stamp correctly, every
  bag approves 3 to 5 items, and across 60 bags per puzzle no other regulation on
  the board passed a bag (0 lucky bags). Every `make`, random item and small change
  produces valid mail.

## Lessons from playtests

- **Secret Neighbors** was rejected: there was no way to start testing ideas, and
  even with a tap-to-open start, a list of possible shapes, and a Check button it
  did not click. The Rule was easy to pick up straight away.
- **Delivery route** felt unclear with no start or finish. Fixed with a fixed post
  office start and highlighted next corners. Every board needs that kind of
  "here is what you can do next".
- **Performance**: sizing the stamp pictures with container query units (`cqw`) made
  every envelope tap re-lay out the page (600 to 1,300 ms per tap). Fixed sizes made
  it about 1 ms. Time real interactions on each board.
- **Colorblind**: parcels went from colors to shapes, thumbnails show the shapes,
  and the share row uses filled versus hollow squares.

## How long the content lasts

Each board runs once a week, so a year needs about **52 puzzles per board** and 52
Super Sundays. The mockup has 8 to 10 regulations per board, about 2 months. Give
regulations settings ("add up to 15 or more" becomes 12, 15 or 18; "exactly three
houses" becomes 2, 3 or 4): about 15 ideas with about 3 settings each is roughly 45
per board, close to a year. Players will learn the ideas over time, so later
difficulty should come from settings and less obvious ideas.

## Open questions

- **Visual identity**: Snug-level polish for the counter, stamps, sound, and the
  stamp landing.
- **Hints**: for example, after a number of submissions, show an approved item that
  looks very different from yours. Counted like Snug's hints, never a failure.
- **Difficulty**: boards have fixed weekdays, so difficulty comes from the
  regulation. Rate each one easy, medium or hard and mix them through the month.
- **First-time help**: a short tutorial puzzle.
- **Monthly collection**: a stamp album that fills over the month, like Snug's
  month quilt.
- **Stats**: the median submissions per puzzle, to tune difficulty and retire
  regulations that feel unfair.

## Stage 3 decisions (polish)

Agreed 2026-10-24, before building.

| Area | Decision |
|---|---|
| Scene | A top-down post office desk: your item lies on the counter like real mail, and the rubber stamp is the hero. Cozy, not grim. |
| Theme | Its own look; it does not follow the site's light or dark mode (like Snug). |
| Type | A typewriter face for the clerk's voice, with a few options to compare; a bold face for stamps. |
| The stamp | Must look great, both the stamping motion and the ink. A hand only if it looks good; otherwise the stamp alone, maybe with the shadow of a hand or arm. |
| Header colors | An "unlisted" flag in `lib/games.ts` so the site header takes the game's colors before it is in the gallery. |
| No plain header | Diegetic pieces instead where they help, for example a hanging sign with the name and number. Actions stay clear. |
| Diegetic UI | Lean into objects on the desk: a binder for How to play, and more (see open questions). |
| Phone screen | The playable area fits without scrolling (instructions and the full log may scroll). Show the last 2 submissions; open the full log as a popup. Look at how other apps do this. |
| Wider screens | Two columns: the counter and the log. |
| Stamp moment | A slam with ink texture, and a vibration on phones that support it. No sound for now: sound comes later in one pass across every game. |
| The item | Submitting never wipes it; the stamp stays until the item changes. Repeats are free. |
| The log | Two piles, Approved and Returned. It must work for all six boards. |
| Names | **The desk**: build and submit items, free and unlimited (the testing ground). **Your shift**: the live sort of 8 items. **The timesheet**: prints after a shift with how many of 8 were right. **A perfect shift**: 8 of 8, which closes the day and brings the head office memo. |
| Your shift | The desk clears, the lighting changes to show you are "live", items come in one at a time to stamp, and the timesheet prints. No grid, desktop included. |
| Starting a shift | Locked in until the bag is sorted, so you cannot peek at items and then test them. |
| After a failed shift | The timesheet shows only how many were right, never which ones or their answers (decided 2026-10-24; open to revisiting). |
| Score | The main number is which shift was perfect ("Perfect on shift 2"); desk submissions come second ("7 submissions"). "Ask head office for the memo" gives up: the regulation is shown and the day counts as played, not solved. |
| Share | Text plus a picture on phones, like Snug. Two picture ideas to compare on the art sheet: the timesheet slip, and a postcard. |
| Stats | Saved on the device (like Snug signed out), then to the account in Stage 5. |
| How to play | Essential, since every board needs its own. Combined with the tutorial, perhaps taught by the clerk in their dry voice. |
| Hints | A service bell on the desk, ringable after your first submission, at most 2 rings a day. Each ring gives a nudge (for example two items one square apart, one approved and one returned), never the rule. Each ring is noted on the timesheet ("with 1 hint"). |
| Desk objects | Try them all and keep the game obvious: a hanging sign (name and number), a desk calendar (date and testing past-day arrows), a clipboard (testing board picker), an employee handbook binder (How to play and a first-day tutorial taught by the clerk), the service bell (hints), two trays (the log piles), a desk lamp (shift lighting), the timesheet, and the head office memo. Anything that hides an action becomes a plain button instead. |
| Tone | Dry, bureaucratic humor in small doses. Words can change once the board is polished. |
| Accessibility | Keyboard play. Colorblind-safe by design (no setting needed). Reduced motion is not a priority. |
| Sound | None until the later all-games sound pass. |
| Testing tools | A small testing pill for the board picker, past-day arrows for practice, and a testing-only "Reset today". |

### Art sheet picks (2026-10-24)

From `/games/return-to-sender/art`:

| Section | Pick |
|---|---|
| Typewriter face | Special Elite |
| Stamp face | Oswald |
| Ink | Dated, with easier-to-read text and a toned-down version of the inked roughness (softer options added to compare) |
| Stamp landing | The stamp only, with no arm shadow |
| Desk surface | Oak desk |
| Hanging sign | Blue enamel |
| Desk objects and log piles | As drawn |
| Desk on a computer | Good, but the handbook label overflowed and the bell looked out of place; the bell gets a home (a plaque beside the trays) |
| Phone layout | Two trays under the sheet |
| Your shift and the memo | As drawn |
| Share picture | The postcard |

## Build plan

The Coming soon card on `/games` shipped first (PR #56). Then Stamp sheet, in stages,
unlisted at its own URL until it is polished:

1. **Engine**: the regulations, the example and inspection builders, and a check
   script, in `components/games/return-to-sender/`, using `makeRng` from
   `components/games/daily.ts`. Puzzles are generated months ahead into
   `data/return-to-sender/months/`, like Snug's, so a puzzle never changes once
   played.
2. **Rough playable page** at `/games/return-to-sender` plus a signed-in lab page
   like `/games/snug/lab`. Saved on the device only. (Stages 1 and 2 built
   2026-10-23.)
3. **Polish**, with lots of back and forth: the look, the stamp landing, sound, a
   How to play and tutorial, hints, accessibility, and above all an easy phone
   layout.
4. **Content**: grow from 8 regulations to about 45 with settings, rate their
   difficulty, and review each in the lab.
5. **Accounts and stats**: Snug syncs through `snug_days`. For this game, consider
   one shared table keyed by game, added with an idempotent
   `scripts/migrate-<name>.mjs` run on dev and then live (never `npm run db:push`;
   see the root `CLAUDE.md`). Streaks and the median submissions per puzzle.
6. **Launch Stamp sheet**: an entry in `lib/games.ts`, a 1200 by 630 preview image,
   and the gallery card.

Then the next board, one at a time: lab it, playtest it, ship it. Super Sunday comes
once at least two boards are live.
