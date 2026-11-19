import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { funds, recurringExpenses, transactions } from "@/lib/db/schema";
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
  const [first, ...rest] = tagged;
  const money = (n: number) => n.toFixed(2);
  const restValues = sql.join(
    rest.map(
      (p, i) =>
        sql`(${i}::int, ${money(p.amount)}::numeric, ${p.category}::text, ${p.fundId}::int, ${p.recurringExpenseId}::int, ${p.spendCategory}::text)`,
    ),
    sql`, `,
  );

  // One statement, so a failure saves nothing, and the amount guard makes a second
  // request for the same purchase change nothing. The new parts are shared with every
  // book the purchase was, under each book's own tag, and the bank payment covers them.
  const added = await db.execute<{ id: number }>(sql`
    with original as (
      update transactions
      set amount = ${money(first.amount)}, original_amount = ${money(first.amount)}, category = ${first.category},
          fund_id = ${first.fundId}, recurring_expense_id = ${first.recurringExpenseId},
          spend_category = ${first.spendCategory}, needs_review = false
      where id = ${id} and book_id = ${book.id} and amount = ${row.amount}
      returning group_id, book_id, account_id, posted_on, merchant, source, bank_status
    ),
    parts as (
      insert into transactions (group_id, book_id, account_id, posted_on, merchant, source, bank_status,
        amount, original_amount, category, fund_id, recurring_expense_id, spend_category)
      select o.group_id, o.book_id, o.account_id, o.posted_on, o.merchant, o.source, o.bank_status,
        p.amount, p.amount, p.category, p.fund_id, p.recurring_expense_id, p.spend_category
      from original o cross join (values ${restValues}) as p(ord, amount, category, fund_id, recurring_expense_id, spend_category)
      order by p.ord
      returning id
    ),
    shares as (
      insert into transaction_shares (transaction_id, book_id, spend_category)
      select parts.id, s.book_id, s.spend_category
      from parts cross join transaction_shares s
      where s.transaction_id = ${id}
    ),
    bank as (
      update plaid_transactions
      set split_ledger_ids = coalesce(split_ledger_ids, '{}') || (select array_agg(id order by id) from parts)
      where removed_at is null
        and (ledger_transaction_id = ${id} or ${id} = any(split_ledger_ids))
        and exists (select 1 from parts)
    )
    select id from parts order by id`);
  if (!added.rows.length) throw new Error("This purchase changed. Reload and split it again.");
  return [id, ...added.rows.map((r) => r.id)];
}
