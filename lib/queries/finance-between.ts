import "server-only";
import { and, eq, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { books, transactionShares, transactions as t } from "@/lib/db/schema";
import { type BookRef } from "@/lib/books";
import { intoBookOf } from "@/lib/finance/book-rows";
import { REIMBURSEMENT, SPEND_CATEGORIES } from "@/lib/finance/cashflow";

// The book lane (docs/finance/money-books.md): for each other book this one has
// dealt with, what each put into the other this month, and overall. "Put in"
// means paying for the other's charges, sending it money, or holding its income
// (her client paid into family checking). Paying back and paying yourself are
// the same thing, so nothing labels them apart.

export type BookLaneSide = { paidFor: number; sent: number; heldIncome: number };
export type BookLane = {
  bookId: number;
  name: string;
  /** This month: what this book put into the other, and what the other put into this one. */
  ours: BookLaneSide;
  theirs: BookLaneSide;
  /** Overall up to the end of the month: positive = this book has put in more than it got back. */
  net: number;
};

const list = (cats: readonly string[]) => sql.raw(cats.map((c) => `'${c}'`).join(", "));
const spendOf = sql<string>`case when ${t.needsReview} then 0 when ${t.category} in (${list(SPEND_CATEGORIES)}) then ${t.amount} when ${t.category} = 'fund' then greatest(${t.amount}, 0) when ${t.category} = ${REIMBURSEMENT} then -${t.amount} else 0 end`;
const incomeOf = sql<string>`case when not ${t.needsReview} and ${t.category} = 'income' then ${t.amount} else 0 end`;

const cents = (v: string | number | null | undefined) => Math.round(Number(v ?? 0) * 100);
const empty = (): { ours: BookLaneSide; theirs: BookLaneSide } => ({
  ours: { paidFor: 0, sent: 0, heldIncome: 0 },
  theirs: { paidFor: 0, sent: 0, heldIncome: 0 },
});

/** Every other book this one has dealt with, for the month starting `start` and ending `end`. */
export async function listBookLanes(book: BookRef, start: string, end: string): Promise<BookLane[]> {
  const inMonth = sql<boolean>`${t.postedOn} >= ${start}`;

  // Shared charges and deposits, either way: ours shared to them, or theirs shared to us.
  const otherOfShare = sql<number>`case when ${t.bookId} = ${book.id} then ${transactionShares.bookId} else ${t.bookId} end`;
  const shared = await db
    .select({
      other: otherOfShare,
      ours: sql<boolean>`${t.bookId} = ${book.id}`,
      inMonth,
      spend: sql<string>`sum(${spendOf})`,
      income: sql<string>`sum(${incomeOf})`,
    })
    .from(transactionShares)
    .innerJoin(t, eq(t.id, transactionShares.transactionId))
    .where(
      and(
        or(eq(t.bookId, book.id), eq(transactionShares.bookId, book.id)),
        ne(t.bookId, transactionShares.bookId),
        lte(t.postedOn, end),
      ),
    )
    .groupBy(sql`1, 2, 3`);

  // Money moved between our accounts and theirs (a transfer lives in the book it left).
  const otherOfMove = sql<number>`case when ${t.bookId} = ${book.id} then ${intoBookOf} else ${t.bookId} end`;
  const moved = await db
    .select({
      other: otherOfMove,
      ours: sql<boolean>`${t.bookId} = ${book.id}`,
      inMonth,
      amount: sql<string>`sum(${t.amount})`,
    })
    .from(t)
    .where(
      and(
        eq(t.category, "transfer"),
        eq(t.needsReview, false),
        lte(t.postedOn, end),
        sql`((${t.bookId} = ${book.id} and ${intoBookOf} <> ${book.id}) or (${t.bookId} <> ${book.id} and ${intoBookOf} = ${book.id}))`,
      ),
    )
    .groupBy(sql`1, 2, 3`);

  const lanes = new Map<number, ReturnType<typeof empty> & { net: number; active: boolean }>();
  const lane = (id: number) => {
    const found = lanes.get(id);
    if (found) return found;
    const made = { ...empty(), net: 0, active: false };
    lanes.set(id, made);
    return made;
  };
  for (const r of shared) {
    const l = lane(Number(r.other));
    const spend = cents(r.spend);
    const income = cents(r.income);
    // Our charge counted for them: we paid for them. Our deposit counted for them: we hold their income.
    if (r.ours) {
      l.net += spend - income;
      if (r.inMonth) {
        l.ours.paidFor += spend;
        l.theirs.heldIncome += income;
      }
    } else {
      l.net -= spend - income;
      if (r.inMonth) {
        l.theirs.paidFor += spend;
        l.ours.heldIncome += income;
      }
    }
    if (r.inMonth && (spend || income)) l.active = true;
  }
  for (const r of moved) {
    const l = lane(Number(r.other));
    const amount = cents(r.amount);
    l.net += r.ours ? amount : -amount;
    if (r.inMonth) {
      if (r.ours) l.ours.sent += amount;
      else l.theirs.sent += amount;
      if (amount) l.active = true;
    }
  }

  const ids = [...lanes.keys()];
  if (!ids.length) return [];
  const names = await db.select({ id: books.id, name: books.name }).from(books).where(eq(books.groupId, book.groupId));
  const dollars = (c: number) => c / 100;
  const side = (s: BookLaneSide): BookLaneSide => ({
    paidFor: dollars(s.paidFor),
    sent: dollars(s.sent),
    heldIncome: dollars(s.heldIncome),
  });
  return ids
    .map((id) => ({ id, l: lanes.get(id)! }))
    // Shown in months with activity, or while one book has put in more than the other.
    .filter(({ l }) => l.active || l.net !== 0)
    .map(({ id, l }) => ({
      bookId: id,
      name: names.find((n) => n.id === id)?.name ?? "Another book",
      ours: side(l.ours),
      theirs: side(l.theirs),
      net: dollars(l.net),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
