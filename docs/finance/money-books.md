# Money books

Status: agreed 2026-10-27. PR 1 and PR 2 are live; PR 3 (charges another book also counts, money between books, the book lane) is built.

Decided: every active person starts in their hub's Family book; any member manages a
book; one book per pay plan (no split paychecks); it ships as the three PRs in
"Build order".

## The idea

Finance stops being "the hub's money". It is split into **books**. A book is one
set of money that is tracked together, with its own members:

| Book | Members | Holds |
| --- | --- | --- |
| Family | Bryce, Lauren | Joint checking, family cards, the family budget |
| Business A | Bryce | Business A's accounts, tags, bills and budget |
| Lauren's company | Lauren | Hers alone, unless she adds Bryce |
| Kid 1 allowance | Kid 1, Bryce, Lauren | The allowance account and goals |

- One person can be in many books. A book is not tied to one person or to the whole hub.
- **The member list is the privacy rule.** A book shows only to its members, so
  Finance needs no separate "who can see" setting.
- Today's finance data becomes each hub's **Family** book, so nothing moves on day one.

## Who sees a book

- The viewer is the person the login is tied to (the same rule as sharing).
- A login sees the books its person is a member of. Nobody else does: not the hub
  owner, not the hub login, not a login with no person.
- Any member can rename the book and add or remove members. A book always keeps at
  least one member with a login, so it never becomes unreachable.
- Deleting a book needs it to be empty, or a typed confirmation that erases it.

## What belongs to a book

Every table that is scoped by `groupId` today gets a `bookId` too. `groupId` stays,
for tenancy, hub deletion and the demo seed.

| Table | Today | With books |
| --- | --- | --- |
| `financial_accounts` | hub | book |
| `transactions` | hub | book (its card's book; another book can also count it, see "Charges another book also counts") |
| `recurring_expenses` (bills) | hub | book |
| `savings_goals` | hub | book |
| `merchant_categories` (tag rules) | hub | book |
| `funds` | hub | book |
| `api_tokens` (ingest, widget) | hub | book |
| `plaid_items` (bank links) | hub | book |
| `compensation_plans` (pay) | person | person, plus the book the pay lands in |
| `income_deductions` | person | person, plus the book whose pay it comes out of |
| `account_snapshots`, `plaid_accounts`, `plaid_transactions` | via parent | unchanged (via parent) |

- **Pay:** a person's pay plan says which book it lands in. Bryce's salary lands in
  Family; Lauren's company income lands in her company's book. ATLAS and the budget
  for a book count only the pay that lands in it.
- **Hub-wide settings stay hub-wide:** the timezone.
- **New books start empty:** no accounts, bills or tag rules. Copying tag rules from
  another book is a later nicety.

## Using it

- **Book switcher:** the books are listed under Finance in the app menu, from any app,
  with a check on the current one and "Manage books…". In Finance the menu's label reads
  "Finance · Business". The choice is remembered per device (an `active_book` cookie),
  validated on every request against the login's books.
- **Books page** (Finance > Books, from "Manage books…"): new book, rename, members, and
  delete by typing the book's name. A hub keeps at least one book, and a book with linked
  banks must disconnect them first.
- **The shared login** (named after the hub, like "Home") is no person, so it is never a
  member. A book's members can tick it to let it open the book too; it also needs Finance
  among its apps. It cannot manage books.
- **No books:** a login whose person is in no book sees a note with "New book" instead of Finance.
- **New people** join no book on their own; a member adds them on the Books page.
- **Bank links and tokens:** linking a bank or minting an ingest token happens inside
  a book, and its data lands in that book. The bank-admin rule (owner plus
  `BANK_USERS`) stays, and the admin must also be a member of the book.

## Charges another book also counts (PR 3)

Lauren runs a small business and sometimes pays for it with the family Visa. Two
things are true at once: the money left the family, and it is a business expense.
So one charge is **counted by two books**, each in its own way. It is never copied
(two rows would drift apart) and never moved (Family really did pay it).

Example month: Bryce spends $50 on the Visa; Lauren spends $100 on it for her
business.

| | Family | Lauren's business |
| --- | --- | --- |
| Bryce's $50 | Spent | Not there |
| Lauren's $100 | Spent, in a "Lauren's business" lane | Spent, as a business expense, "Paid from Family Visa" |
| Total spent | $150 | $100 |

- **"Also count for…"** on a charge or a deposit picks the other book. The row stays in
  its own book (its card's book). The other book counts it too and keeps its **own tag**
  for it. There, it is read-only apart from that tag and "Remove from this book".
- Books are never added together: each answers its own question, and the shared row is
  labeled on both sides.
- **Merchant rules** can do it automatically (her supplier always counts for her book).
- **Refunds** of a shared charge are shared by the merchant rule ("Always for …"); a refund
  of a charge shared by hand is shared by hand too.
- **Plaid** swapping a pending charge for the posted one keeps the share (same row). In the
  rare case the bank drops the pending charge before posting it, a hand-made share is lost;
  a rule shares the posted one again.
- **In the other book** a shared bill or fund charge counts as plain spending, because
  that book has no such bill or fund.
- Only books you are a member of can be picked. Deleting the other book drops its shares;
  the charge goes back to plain Family spending.
- **Not included:** splitting one receipt across books.

## Money between books (PR 3)

Money moving from an account in one book to an account in another book (Lauren's
business checking paying back Family, or paying herself) is **"Between books"**: like a
transfer between two of your own accounts, it is neither spending nor earned income in
either book, but "All money" shows it as out for one and in for the other. The row lives in
the book the money left. Plaid pairs the two sides across the hub's banks; by hand, a
transfer's From or Into can be an account in any of your books. Account transfer words
("SCHWAB") still match only within one book. Paying back and paying yourself are the same
thing; no labels tell them apart.

## The book lane and its running total (PR 3)

Family shows a lane per other book it has dealt with: what Family paid for that book
(shared charges) and what came from it or went to it (between books). Because months
mislead on their own (paid for her in July, paid back in August), the lane also shows a
**running total**: "Lauren's business owes Family $100", "Even", or "It has sent $300
more than it cost". The lane appears only in months with activity, so a hub that never
uses any of this never sees it.

Timing follows the two existing lenses: **spending** counts a charge when it was bought
(July), and **money out** ("All money") counts the payback when the account dropped
(August).

## How the code changes

The finance code already passes a group around (`XForGroup(groupId)`, 52 query
functions, 49 actions, 7 pages, 3 API routes, Plaid sync and ingest). The change is
mostly mechanical:

- `requireBook()` replaces `requireGroupId()` in Finance. It returns
  `{ bookId, groupId, timezone }` after checking that the book is in the hub and
  that the viewer is a member.
- `XForGroup(groupId)` becomes `XForBook(book)`. Every finance query filters by
  `bookId`.
- Ingest and the widget resolve a token to its book. Plaid webhooks resolve an item
  to its book. The cron still syncs every item.
- `lib/demo.ts` seeds the demo hub's Family book.

## Migration (expand, then contract)

1. **Before deploy:**
   - Create the `books` and `book_members` tables.
   - Add a nullable `book_id` to the tables above.
   - Create a Family book for every hub that has any finance data. Its members are
     every active person in the hub (today everyone can see Finance), and the owner
     can remove the kids afterwards.
   - Backfill `book_id`.
   - It is additive, so today's code ignores it.
2. **Deploy.**
3. **After deploy:**
   - Backfill again, to catch rows written in between.
   - Set `book_id` NOT NULL.

## What PR 1 settled

- **The starter book:** each hub's first book (`books.starter`, one per hub) is made
  by the migration, or on first use of Finance. Every active person is a member.
- **People added later** are not members of an existing book. Until PR 2 adds member
  management, they do not see Finance.
- **The demo hub:** its shared login has no person, so it sees the demo's own book.
  The demo reseed wipes its books and makes a fresh one with Alex and Sam.
- **Bank activity (the Plaid event log)** is still per hub. Before a hub can have two
  books (PR 2), the activity list must show only the book's own banks.

## Build order

1. **Books underneath:**
   - The schema, the migration, and `requireBook`.
   - Every query, action, route and the Plaid code scoped by book.
   - The membership check.
   - There is no switcher yet. Every hub has exactly one book, so nothing visible changes.
2. **Books you can see:**
   - The switcher.
   - Create, rename and members.
   - Empty-book screens.
   - Bank links and tokens per book.
   - Choosing the book for each pay plan.
3. **Charges another book also counts**, money between books, and the book lane (above).
