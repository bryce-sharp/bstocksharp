import "server-only";
import { eq, or, sql, type SQL } from "drizzle-orm";
import { transactions as t } from "@/lib/db/schema";
import type { BookRef } from "@/lib/books";

// Which ledger rows a money book counts (docs/finance/money-books.md), in one
// place so every list and total agrees:
//   • its own rows (the card or account is in this book);
//   • rows another book shares into it ("Also count for"), under this book's tag;
//   • money moved into one of its accounts from another book ("Between books").
// A transfer row lives in the book of the account the money left.

/** The book a transfer's money went into; null for anything else. */
export const intoBookOf = sql<number | null>`(select fa.book_id from financial_accounts fa where fa.id = ${t.transferAccountId})`;

const sharedInto = (book: BookRef) =>
  sql`exists (select 1 from transaction_shares s where s.transaction_id = ${t.id} and s.book_id = ${book.id})`;

/** Rows this book counts. */
export function inBook(book: BookRef): SQL {
  return or(eq(t.bookId, book.id), sharedInto(book), betweenIn(book))!;
}

/** This book's tag for a row: the row's own tag at home, the share's tag elsewhere. */
export function tagIn(book: BookRef) {
  return sql<string | null>`case when ${t.bookId} = ${book.id} then ${t.spendCategory} else (select s.spend_category from transaction_shares s where s.transaction_id = ${t.id} and s.book_id = ${book.id}) end`;
}

/** Money that left this book for an account in another book. */
export function betweenOut(book: BookRef): SQL {
  return sql`(${t.category} = 'transfer' and ${t.bookId} = ${book.id} and ${intoBookOf} <> ${book.id})`;
}

/** Money that came into this book from an account in another book. */
export function betweenIn(book: BookRef): SQL {
  return sql`(${t.category} = 'transfer' and ${t.bookId} <> ${book.id} and ${intoBookOf} = ${book.id})`;
}

/**
 * A row's lane as this book counts it. A charge shared in from another book
 * points at that book's bills and funds, which this book does not have, so it
 * counts here as plain spending rather than vanishing.
 */
export function laneHere(
  book: BookRef,
  row: { bookId: number; category: string; recurringExpenseId: number | null; fundId: number | null },
): { category: string; recurringExpenseId: number | null; fundId: number | null } {
  if (row.bookId === book.id) return row;
  const borrowed = row.category === "fixed" || row.category === "amortized" || row.category === "fund";
  return { category: borrowed ? "discretionary" : row.category, recurringExpenseId: null, fundId: null };
}
