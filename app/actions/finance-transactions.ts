"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactionShares, transactions } from "@/lib/db/schema";
import { requireEditor } from "@/lib/auth";
import { requireBook, requireMemberOf } from "@/lib/books";
import { flowOf } from "@/lib/finance/cashflow";
import type { TxnRowData } from "@/components/finance/TransactionRow";
import {
  getTransactionDetail,
  searchTransactions,
  toBookRows,
  type TxnDetail,
  type TxnFilters,
  type TxnPage,
} from "@/lib/queries/finance-transactions";
import {
  setMerchantShare,
  setSpendCategoryForBook,
  type SetCategoryResult,
} from "@/lib/queries/finance-categories";
import { requireApp } from "@/lib/hub-apps";

// The explorer's "load more" — the client hands back the filters it's showing
// plus the last cursor; we re-derive the group from the session (never trust a
// client-supplied group) and return the next page. Read-only, so no revalidate.
export async function loadMoreTransactionsAction(
  filters: TxnFilters,
  cursor: string | null,
): Promise<TxnPage> {
  await requireApp("finance");
  return searchTransactions(filters, cursor);
}

/** One transaction's details for its popup: where it came from, when, and the bank's wording. */
export async function getTransactionDetailAction(id: number): Promise<TxnDetail | null> {
  await requireApp("finance");
  return getTransactionDetail(await requireBook(), id);
}

/**
 * Tag (or clear) one transaction's spend-category inline. `applyToMerchant`
 * also teaches the merchant → category rule and sweeps its siblings. The client
 * updates its own list optimistically; we still revalidate the budget page so
 * its chips reflect the change on next view.
 */
export async function setSpendCategoryAction(
  txnId: number,
  category: string | null,
  applyToMerchant: boolean,
): Promise<SetCategoryResult> {
  await requireApp("finance");
  await requireEditor();
  const book = await requireBook();
  const clean = category && category.trim() ? category.trim().slice(0, 40) : null;
  const result = await setSpendCategoryForBook(book, txnId, clean, applyToMerchant);
  revalidatePath("/finance");
  revalidatePath("/finance/transactions");
  return result;
}

/**
 * Count one of this book's charges or deposits in another of your books too
 * ("Also count for"), or stop. `always` makes it this merchant's rule, so its
 * future rows are shared on their own; a rule needs the row to have a tag.
 * Returns the row as this book now shows it.
 */
export async function setShareAction(
  txnId: number,
  otherBookId: number,
  on: boolean,
  always: boolean,
): Promise<TxnRowData | { error: string }> {
  await requireApp("finance");
  await requireEditor();
  const book = await requireBook();
  if (otherBookId === book.id) return { error: "That is this book." };
  await requireMemberOf(otherBookId);
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.bookId, book.id)))
    .limit(1);
  if (!row) return { error: "That transaction is not in this book." };
  const flow = flowOf(row.category);
  if (!flow) return { error: "Only spending and money in can be counted by another book." };
  if (always && !row.spendCategory) return { error: "Tag it first: a merchant rule needs a tag." };

  if (on) {
    await db
      .insert(transactionShares)
      .values({ transactionId: row.id, bookId: otherBookId, spendCategory: row.spendCategory })
      .onConflictDoNothing();
  } else {
    await db
      .delete(transactionShares)
      .where(and(eq(transactionShares.transactionId, row.id), eq(transactionShares.bookId, otherBookId)));
  }

  if (always && row.merchant) {
    await setMerchantShare(book, row.merchant, flow, row.spendCategory!, on ? otherBookId : null);
  }
  revalidatePath("/finance", "layout");
  return (await toBookRows(book, [row]))[0];
}

/** Stop counting another book's charge in this book; its own book keeps it. */
export async function removeShareHereAction(txnId: number): Promise<{ ok: true }> {
  await requireApp("finance");
  await requireEditor();
  const book = await requireBook();
  await db
    .delete(transactionShares)
    .where(and(eq(transactionShares.transactionId, txnId), eq(transactionShares.bookId, book.id)));
  revalidatePath("/finance", "layout");
  return { ok: true };
}
