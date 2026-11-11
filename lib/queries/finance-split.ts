import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { funds, plaidTransactions, recurringExpenses, transactions } from "@/lib/db/schema";
import { resolveSpendCategory } from "@/lib/finance/ingest";
import { SPLIT_LANES, canSplit, splitProblem, type SplitPart } from "@/lib/finance/split";
import { type BookRef } from "@/lib/books";

/** A fund of this book, or null. */
async function bookFund(book: BookRef, id: number | null): Promise<number | null> {
  if (id === null) return null;
  const [f] = await db
    .select({ id: funds.id })
    .from(funds)
    .where(and(eq(funds.id, id), eq(funds.bookId, book.id)))
    .limit(1);
  return f ? id : null;
}

/** A bill of this book, or null. */
async function bookBill(book: BookRef, id: number | null): Promise<number | null> {
  if (id === null) return null;
  const [b] = await db
    .select({ id: recurringExpenses.id })
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.bookId, book.id)))
    .limit(1);
  return b ? id : null;
}

/** One part as the popup sent it, checked: a spending lane, its fund or bill, a tag of 40 characters at most. */
async function cleanPart(book: BookRef, raw: unknown): Promise<SplitPart> {
  const p = (raw ?? {}) as Record<string, unknown>;
  const category = String(p.category ?? "");
  if (!SPLIT_LANES.includes(category)) throw new Error("Pick a category for every part.");
  const idOf = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const fundId = category === "fund" ? await bookFund(book, idOf(p.fundId)) : null;
  if (category === "fund" && fundId === null) throw new Error("Pick the fund for each Fund part.");
  const recurringExpenseId =
    category === "fixed" || category === "amortized" ? await bookBill(book, idOf(p.recurringExpenseId)) : null;
  const tag = typeof p.spendCategory === "string" ? p.spendCategory.trim().slice(0, 40) : "";
  return { amount: Number(p.amount), category, fundId, recurringExpenseId, spendCategory: tag || null };
}

/**
 * Split a purchase into parts that add up to it. The row keeps the first part;
 * the others become new rows on its day, merchant, and account. A bank payment
 * that already claimed the row covers every part, as if they were entered in
 * parts; an unclaimed row's parts are claimed together when the bank reports it.
 * Returns the row ids, the original first.
 */
export async function splitTransactionForBook(book: BookRef, id: number, input: unknown[]): Promise<number[]> {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.bookId, book.id)))
    .limit(1);
  if (!row) throw new Error("Transaction not found.");
  if (!canSplit(row.category, Number(row.amount))) throw new Error("Only a purchase can be split.");

  const parts = await Promise.all(input.map((p) => cleanPart(book, p)));
  const problem = splitProblem(Number(row.amount), parts);
  if (problem) throw new Error(problem);

  // An untagged part picks up its bill's or merchant's tag, like a row added by hand.
  const tagged = await Promise.all(
    parts.map(async (p) => ({
      ...p,
      spendCategory:
        p.spendCategory ?? (await resolveSpendCategory(book, p.category, row.merchant, p.recurringExpenseId)),
    })),
  );
  const lane = (p: SplitPart) => ({
    amount: p.amount.toFixed(2),
    originalAmount: p.amount.toFixed(2),
    category: p.category,
    fundId: p.fundId,
    recurringExpenseId: p.recurringExpenseId,
    spendCategory: p.spendCategory,
  });
  const [first, ...rest] = tagged;

  const added = await db
    .insert(transactions)
    .values(
      rest.map((p) => ({
        groupId: row.groupId,
        bookId: row.bookId,
        accountId: row.accountId,
        postedOn: row.postedOn,
        merchant: row.merchant,
        source: row.source,
        bankStatus: row.bankStatus,
        ...lane(p),
      })),
    )
    .returning({ id: transactions.id });
  const newIds = added.map((a) => a.id);

  await db
    .update(transactions)
    .set({ ...lane(first), needsReview: false })
    .where(eq(transactions.id, id));
  // The bank payment that covers the row covers its new parts too.
  await db
    .update(plaidTransactions)
    .set({ splitLedgerIds: sql`coalesce(${plaidTransactions.splitLedgerIds}, '{}') || ${sql.param(newIds)}::int[]` })
    .where(
      and(
        isNull(plaidTransactions.removedAt),
        or(eq(plaidTransactions.ledgerTransactionId, id), sql`${id} = any(${plaidTransactions.splitLedgerIds})`),
      ),
    );
  return [id, ...newIds];
}
