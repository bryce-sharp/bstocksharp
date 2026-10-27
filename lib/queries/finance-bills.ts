import "server-only";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { type BookRef } from "@/lib/books";
import { recurringExpenses, transactions } from "@/lib/db/schema";
import { addMonths } from "@/lib/finance/net-worth";
import {
  billHistory,
  monthlyPrices,
  priceSuggestion,
  type BillHistory,
  type BillPayment,
  type PriceSuggestion,
} from "@/lib/finance/bill-history";

// A bill's price history and the "did the price change?" suggestion. A bill is
// every version of it (seriesId), and its payments are the ledger rows linked
// to any version, counted the way the budget counts them (bill lanes only,
// never rows waiting in review).

/** Versions of one bill share this key: the first version's id. */
const seriesKey = sql<number>`coalesce(${recurringExpenses.seriesId}, ${recurringExpenses.id})`;

const BILL_LANES = ["fixed", "amortized"];

export type BillHistoryView = {
  name: string;
  isEstimate: boolean;
  paymentsPerYear: number;
  history: BillHistory;
};

/** One bill's price history, from any of its versions; null when it is not this group's. */
export async function getBillHistory(book: BookRef, billId: number, currentMonth: string): Promise<BillHistoryView | null> {
  const [row] = await db
    .select({ key: seriesKey })
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, billId), eq(recurringExpenses.bookId, book.id)))
    .limit(1);
  if (!row) return null;
  const versions = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.bookId, book.id), sql`${seriesKey} = ${row.key}`))
    .orderBy(recurringExpenses.startDate);
  const payments = await db
    .select({ postedOn: transactions.postedOn, amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        eq(transactions.bookId, book.id),
        inArray(transactions.recurringExpenseId, versions.map((v) => v.id)),
        inArray(transactions.category, BILL_LANES),
        eq(transactions.needsReview, false),
      ),
    );
  const current = versions.find((v) => v.endDate === null) ?? versions.at(-1)!;
  return {
    name: current.name,
    isEstimate: current.isEstimate,
    paymentsPerYear: current.paymentsPerYear,
    history: billHistory({
      versions: versions.map((v) => ({ id: v.id, amount: Number(v.amount), startDate: v.startDate, endDate: v.endDate })),
      payments: payments.map((p) => ({ postedOn: p.postedOn, amount: Number(p.amount) })),
      isEstimate: current.isEstimate,
      ignoredPrice: current.ignoredPrice === null ? null : Number(current.ignoredPrice),
      currentMonth,
    }),
  };
}

export type BillPriceSuggestion = { billId: number; name: string; suggestion: PriceSuggestion };

/** Current bills whose latest payment, within the last year, suggests a new price. */
export async function listPriceSuggestions(book: BookRef, currentMonth: string): Promise<BillPriceSuggestion[]> {
  const bills = await db
    .select({
      id: recurringExpenses.id,
      key: seriesKey,
      name: recurringExpenses.name,
      amount: recurringExpenses.amount,
      startDate: recurringExpenses.startDate,
      isEstimate: recurringExpenses.isEstimate,
      ignoredPrice: recurringExpenses.ignoredPrice,
    })
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.bookId, book.id),
        isNull(recurringExpenses.endDate),
        eq(recurringExpenses.isEstimate, false),
      ),
    );
  if (!bills.length) return [];
  const payments = await db
    .select({ key: seriesKey, postedOn: transactions.postedOn, amount: transactions.amount })
    .from(transactions)
    .innerJoin(recurringExpenses, eq(recurringExpenses.id, transactions.recurringExpenseId))
    .where(
      and(
        eq(transactions.bookId, book.id),
        inArray(transactions.category, BILL_LANES),
        eq(transactions.needsReview, false),
        gte(transactions.postedOn, addMonths(currentMonth, -12)),
      ),
    );
  const bySeries = new Map<number, BillPayment[]>();
  for (const p of payments) {
    const key = Number(p.key);
    bySeries.set(key, [...(bySeries.get(key) ?? []), { postedOn: p.postedOn, amount: Number(p.amount) }]);
  }
  const found: BillPriceSuggestion[] = [];
  for (const b of bills) {
    const suggestion = priceSuggestion({
      current: { id: b.id, amount: Number(b.amount), startDate: b.startDate, endDate: null },
      prices: monthlyPrices(bySeries.get(Number(b.key)) ?? []),
      isEstimate: b.isEstimate,
      ignoredPrice: b.ignoredPrice === null ? null : Number(b.ignoredPrice),
    });
    if (suggestion) found.push({ billId: b.id, name: b.name, suggestion });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}
