# Money books

Status: agreed 2026-10-27. PR 1 (books underneath) is built.

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
| `transactions` | hub | book (can differ from its account's book, see "Moving a charge") |
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

- **Book switcher:** Finance gets a book picker in its header, like the person menu.
  The choice is remembered per device (an `active_book` cookie), validated on every
  request against the login's books.
- **No books:** a login whose person is in no book sees "Create a book" instead of Finance.
- **Bank links and tokens:** linking a bank or minting an ingest token happens inside
  a book, and its data lands in that book. The bank-admin rule (owner plus
  `BANK_USERS`) stays, and the admin must also be a member of the book.

## Moving a charge

A family card bought something for the business. The fix is to **move the whole
charge** to the other book (no splitting for now).

- `transactions.bookId` decides which book counts the charge. `accountId` stays as
  "which card paid".
- The charge leaves the Family budget and counts as Business A spending.
- In Business A it shows as "Paid from Family Visa".
- Later, if useful: a "moved charges" total that shows what Business A owes Family.

## Money between books

- Paying yourself from Business A into Family is two ordinary rows:
  - In Business A: money out, as a transfer to another book, so not spending.
  - In Family: money in, as income.
- They are not linked to each other in v1.

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
3. **Moving a charge** between books.
