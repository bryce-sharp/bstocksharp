// Pure bill price-history math, shared by the server query and the ATLAS bill
// view. A bill's price in a month is its largest payment that month, so a late
// payment doubling up, or a small add-on charged alongside, never reads as a
// price change. ATLAS's own price comes from the bill's versions ("price
// changed as of a month"). Months are YYYY-MM-01.

import { addMonths, monthDiff } from "@/lib/finance/net-worth";

export type BillVersion = { id: number; amount: number; startDate: string; endDate: string | null };
export type BillPayment = { postedOn: string; amount: number };

export type PriceMonth = { month: string; paid: number | null; atlas: number | null };
export type PricePoint = { month: string; amount: number };
export type PriceChange = { month: string; from: number; to: number };
/** The latest payment differs from the price ATLAS expects for that month. */
export type PriceSuggestion = { amount: number; month: string; expected: number };

export type BillHistory = {
  /** Chart rows, oldest first. */
  months: PriceMonth[];
  /** Price changes, newest first; empty for a bill marked as an estimate. */
  changes: PriceChange[];
  latest: PricePoint | null;
  yearAgo: PricePoint | null;
  first: PricePoint | null;
  /** Average price over the 12 months up to the latest payment. */
  average12: number | null;
  suggestion: PriceSuggestion | null;
};

// The chart's reach back from the current month.
const MAX_MONTHS = 36;

const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A move worth calling a price change: at least $1 and at least 1%. */
export function priceMoved(from: number, to: number): boolean {
  return Math.abs(to - from) >= Math.max(1, Math.abs(from) * 0.01);
}

/** Each month's price: its largest payment. */
export function monthlyPrices(payments: BillPayment[]): Map<string, number> {
  const prices = new Map<string, number>();
  for (const p of payments) {
    const month = monthOf(p.postedOn);
    prices.set(month, Math.max(prices.get(month) ?? -Infinity, p.amount));
  }
  return prices;
}

/** The version in effect during a month (the latest to start, if two overlap). */
function versionIn(versions: BillVersion[], month: string): BillVersion | null {
  let found: BillVersion | null = null;
  for (const v of versions) {
    if (monthOf(v.startDate) > month) continue;
    if (v.endDate && monthOf(v.endDate) < month) continue;
    if (!found || v.startDate > found.startDate) found = v;
  }
  return found;
}

/**
 * Whether ATLAS should offer a new price: the bill's latest payment, in or after
 * the month its current version starts, differs from that version's price and
 * from any price the household already declined. Estimates vary by design.
 */
export function priceSuggestion(input: {
  current: BillVersion;
  prices: Map<string, number>;
  isEstimate: boolean;
  ignoredPrice: number | null;
}): PriceSuggestion | null {
  if (input.isEstimate || input.current.endDate) return null;
  const months = [...input.prices.keys()].sort();
  const month = months.at(-1);
  if (!month || month < monthOf(input.current.startDate)) return null;
  const amount = input.prices.get(month)!;
  if (!priceMoved(input.current.amount, amount)) return null;
  if (input.ignoredPrice !== null && !priceMoved(input.ignoredPrice, amount)) return null;
  return { amount: round2(amount), month, expected: input.current.amount };
}

export function billHistory(input: {
  versions: BillVersion[];
  payments: BillPayment[];
  isEstimate: boolean;
  ignoredPrice: number | null;
  currentMonth: string;
}): BillHistory {
  const now = monthOf(input.currentMonth);
  const prices = monthlyPrices(input.payments);
  const paidMonths = [...prices.keys()].sort();
  const firstVersion = [...input.versions].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const dataStart = paidMonths[0] ?? (firstVersion ? monthOf(firstVersion.startDate) : now);
  const start = [dataStart, addMonths(now, -(MAX_MONTHS - 1))].sort().at(-1)!;

  const months: PriceMonth[] = [];
  for (let m = start; m <= now; m = addMonths(m, 1)) {
    months.push({ month: m, paid: prices.get(m) ?? null, atlas: versionIn(input.versions, m)?.amount ?? null });
  }

  const points: PricePoint[] = paidMonths.filter((m) => m >= start).map((m) => ({ month: m, amount: prices.get(m)! }));
  const changes: PriceChange[] = [];
  if (!input.isEstimate) {
    for (let i = 1; i < points.length; i++) {
      if (priceMoved(points[i - 1].amount, points[i].amount)) {
        changes.push({ month: points[i].month, from: points[i - 1].amount, to: points[i].amount });
      }
    }
    changes.reverse();
  }

  const latest = points.at(-1) ?? null;
  // A year earlier: the payment month nearest 12 months back, within a month either way.
  const yearAgo = latest
    ? (points
        .filter((p) => Math.abs(monthDiff(p.month, latest.month) - 12) <= 1)
        .sort((a, b) => Math.abs(monthDiff(a.month, latest.month) - 12) - Math.abs(monthDiff(b.month, latest.month) - 12))[0] ?? null)
    : null;
  const lastYear = latest ? points.filter((p) => monthDiff(p.month, latest.month) < 12) : [];
  const average12 = lastYear.length ? round2(lastYear.reduce((s, p) => s + p.amount, 0) / lastYear.length) : null;

  const current = input.versions.find((v) => v.endDate === null) ?? null;
  return {
    months,
    changes,
    latest,
    yearAgo,
    first: points[0] ?? null,
    average12,
    suggestion: current
      ? priceSuggestion({ current, prices, isEstimate: input.isEstimate, ignoredPrice: input.ignoredPrice })
      : null,
  };
}
