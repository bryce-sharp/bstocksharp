// Splitting one purchase into parts: groceries and clothes from one Target run,
// or a fund covering what it can of a price. Pure: the rules the popup and the
// server both check; lib/queries/finance-split writes the rows.

/** The money-out lanes a part can take. */
export const SPLIT_LANES = ["discretionary", "fixed", "amortized", "savings", "fund"];

/** The bank sync claims at most three hand-entered parts as one payment. */
export const MAX_SPLIT_PARTS = 3;

export type SplitPart = {
  amount: number;
  category: string;
  fundId: number | null;
  recurringExpenseId: number | null;
  spendCategory: string | null;
};

/** A row can be split when it is money out on a spending lane. */
export function canSplit(category: string, amount: number): boolean {
  return SPLIT_LANES.includes(category) && amount > 0;
}

/** Why these parts cannot split a row of `total`, or null when they can. */
export function splitProblem(total: number, parts: { amount: number }[]): string | null {
  if (parts.length < 2 || parts.length > MAX_SPLIT_PARTS) return `Split it into 2 to ${MAX_SPLIT_PARTS} parts.`;
  const cents = parts.map((p) => Math.round(p.amount * 100));
  if (cents.some((c) => !Number.isFinite(c) || c <= 0)) return "Every part needs an amount above zero.";
  if (cents.reduce((s, c) => s + c, 0) !== Math.round(total * 100)) return "The parts must add up to the whole amount.";
  return null;
}
