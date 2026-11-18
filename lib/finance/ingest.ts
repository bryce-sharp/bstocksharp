import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, recurringExpenses, financialAccounts } from "@/lib/db/schema";
import { parseAlertText, categorizeMerchant, type MerchantRule } from "@/lib/finance/sms";
import { longestMatchingRule, spendCategoryFor } from "@/lib/finance/categorize";
import { ruleShare, spendRulesFor } from "@/lib/queries/finance-categories";
import { reserveTransactionIds } from "@/lib/queries/finance-transactions";
import { todayISO, dateInTz } from "@/lib/finance/parse";
import { formatDate } from "@/lib/format";
import { getGroupTimezone } from "@/lib/queries/group";
import { type BookRef } from "@/lib/books";

// ─────────────────────────────────────────────────────────────────────────────
// INGEST — the shared "an alert text becomes a transaction row" pipeline, used
// by the API route today and (same code) a future bulk import of the old
// iCloud transactions.txt. Text seeds a row; the row is the truth thereafter.
// Server-side because it writes; the pure parsing/categorizing lives in sms.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type IngestResult =
  | { ok: true; id: number; deduped: false; needsReview: boolean; category: string }
  | { ok: true; id: number; deduped: true }
  | { ok: false; reason: "empty" };

const DEDUPE_WINDOW_MS = 10 * 60 * 1000; // Shortcuts double-fires within seconds

// A card alert is a couple hundred characters. Cap the body so a runaway (or
// hostile) POST can't become a multi-megabyte rawText row. Truncating rather
// than rejecting keeps the "never silently dropped" promise — an oversized body
// still lands as a needs-review row you can see.
const MAX_ALERT_CHARS = 2000;

/** Recurring-bill matching rules effective on a given date, for this group.
 *  Exported so manual "Auto-detect" add can categorize like the SMS path. */
export async function merchantRulesFor(book: BookRef, onDate: string): Promise<MerchantRule[]> {
  const rows = await db
    .select({
      id: recurringExpenses.id,
      paymentsPerYear: recurringExpenses.paymentsPerYear,
      merchantPatterns: recurringExpenses.merchantPatterns,
      category: recurringExpenses.category,
      amount: recurringExpenses.amount,
      dueMonths: recurringExpenses.dueMonths,
    })
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.bookId, book.id),
        lte(recurringExpenses.startDate, onDate),
        or(isNull(recurringExpenses.endDate), gte(recurringExpenses.endDate, onDate)),
      ),
    );
  return rows.map((r) => ({
    recurringExpenseId: r.id,
    paymentsPerYear: r.paymentsPerYear,
    patterns: r.merchantPatterns ?? [],
    category: r.category,
    amount: Number(r.amount),
    dueMonths: r.dueMonths,
  }));
}

export type TransferRule = { pattern: string; category: string; accountId: number };

/** Each open account's transfer words. Wallets are spending money, so money
 *  moved into one is never a transfer. */
export async function transferRulesFor(book: BookRef): Promise<TransferRule[]> {
  const rows = await db
    .select({
      id: financialAccounts.id,
      kind: financialAccounts.kind,
      patterns: financialAccounts.transferPatterns,
    })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.bookId, book.id), isNull(financialAccounts.archivedAt)));
  return rows
    .filter((r) => r.kind !== "wallet")
    .flatMap((r) => (r.patterns ?? []).map((pattern) => ({ pattern, category: "transfer", accountId: r.id })));
}

/**
 * A row whose merchant names another account's transfer words is money moving
 * between your accounts. A charge (positive) moves money from the row's
 * account into the matched one; a credit (negative) moves it back, so the
 * stored transfer is always positive, from → into.
 */
export function asTransfer(
  merchant: string | null,
  amount: string,
  accountId: number | null,
  rules: TransferRule[],
): { accountId: number | null; transferAccountId: number; amount: string } | null {
  if (!merchant) return null;
  const hit = longestMatchingRule(merchant, rules.filter((r) => r.accountId !== accountId));
  if (!hit) return null;
  const n = Number(amount);
  if (n >= 0) return { accountId, transferAccountId: hit.accountId, amount };
  if (accountId == null) return null; // a credit needs to know where it landed
  return { accountId: hit.accountId, transferAccountId: accountId, amount: Math.abs(n).toFixed(2) };
}

/**
 * The spend-category for a row entered or fixed BY HAND — the same resolution
 * as ingest (bill inherit for fixed/amortized, else the Categories-tab merchant
 * rules), so a manual "Gas" lands tagged exactly like a texted one would.
 */
export async function resolveSpendCategory(
  book: BookRef,
  category: string,
  merchant: string | null,
  recurringExpenseId: number | null,
): Promise<string | null> {
  let billCategory: string | null = null;
  if (recurringExpenseId != null && (category === "fixed" || category === "amortized")) {
    const [bill] = await db
      .select({ category: recurringExpenses.category })
      .from(recurringExpenses)
      .where(
        and(eq(recurringExpenses.id, recurringExpenseId), eq(recurringExpenses.bookId, book.id)),
      )
      .limit(1);
    billCategory = bill?.category ?? null;
  }
  return spendCategoryFor(category, merchant, billCategory, await spendRulesFor(book));
}

/** The spend-category a matched bill contributes (for fixed/amortized inherit). */
function billCategoryOf(
  recurringExpenseId: number | null,
  rules: MerchantRule[],
): string | null {
  if (recurringExpenseId == null) return null;
  return rules.find((r) => r.recurringExpenseId === recurringExpenseId)?.category ?? null;
}

/**
 * Why a new charge on a monthly bill needs a look, or null. A second charge that
 * takes the month past the bill's amount (an extra donation, a double charge)
 * would quietly cut the budget, so it waits in review instead. A bill's first
 * charge of the month never does, whatever its size.
 */
export async function extraBillChargeNote(
  book: BookRef,
  recurringExpenseId: number | null,
  amount: number,
  postedOn: string,
): Promise<string | null> {
  if (recurringExpenseId == null) return null;
  const [bill] = await db
    .select({
      name: recurringExpenses.name,
      amount: recurringExpenses.amount,
      paymentsPerYear: recurringExpenses.paymentsPerYear,
    })
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, recurringExpenseId), eq(recurringExpenses.bookId, book.id)))
    .limit(1);
  if (!bill || bill.paymentsPerYear !== 12) return null;

  const [{ paid }] = await db
    .select({ paid: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.bookId, book.id),
        eq(transactions.recurringExpenseId, recurringExpenseId),
        eq(transactions.category, "fixed"),
        eq(transactions.needsReview, false),
        sql`to_char(${transactions.postedOn}, 'YYYY-MM') = ${postedOn.slice(0, 7)}`,
      ),
    );
  const paidC = Math.round(Number(paid) * 100);
  const billC = Math.round(Number(bill.amount) * 100);
  if (paidC <= 0 || paidC + Math.round(amount * 100) <= billC) return null;
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  return `${bill.name} already has ${money(paidC)} of its ${money(billC)} this month. Keep this on the bill, or file it elsewhere.`;
}

/**
 * Why a charge that no current bill claims needs a look, or null: it looks like a
 * bill the household ended in the last year (its words, and within a quarter of
 * its amount), so the cancel may not have gone through.
 */
export async function endedBillChargeNote(
  book: BookRef,
  names: string[],
  amount: number,
  postedOn: string,
): Promise<string | null> {
  if (amount <= 0 || !names.length) return null;
  const ended = await db
    .select({
      id: recurringExpenses.id,
      name: recurringExpenses.name,
      amount: recurringExpenses.amount,
      paymentsPerYear: recurringExpenses.paymentsPerYear,
      merchantPatterns: recurringExpenses.merchantPatterns,
      category: recurringExpenses.category,
      dueMonths: recurringExpenses.dueMonths,
      endDate: recurringExpenses.endDate,
    })
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.bookId, book.id),
        lt(recurringExpenses.endDate, postedOn),
        sql`${recurringExpenses.endDate} >= ${postedOn}::date - interval '1 year'`,
        // The whole bill ended: no version of it runs on this day or later.
        sql`not exists (select 1 from recurring_expenses v
          where coalesce(v.series_id, v.id) = coalesce(recurring_expenses.series_id, recurring_expenses.id)
            and (v.end_date is null or v.end_date >= ${postedOn}))`,
        // Only its last version (latest start, then highest id, since a replacement can
        // start the same day): the price and end date it had when the household ended it.
        sql`not exists (select 1 from recurring_expenses w
          where coalesce(w.series_id, w.id) = coalesce(recurring_expenses.series_id, recurring_expenses.id)
            and (w.start_date > recurring_expenses.start_date
              or (w.start_date = recurring_expenses.start_date and w.id > recurring_expenses.id)))`,
      ),
    );
  const rules: MerchantRule[] = ended.map((b) => ({
    recurringExpenseId: b.id,
    paymentsPerYear: b.paymentsPerYear,
    patterns: b.merchantPatterns,
    category: b.category,
    amount: Number(b.amount),
    dueMonths: b.dueMonths,
  }));
  for (const name of names) {
    const { recurringExpenseId } = categorizeMerchant(name, rules, amount, postedOn);
    const bill = ended.find((b) => b.id === recurringExpenseId);
    if (bill && Math.abs(amount - Number(bill.amount)) <= Number(bill.amount) * 0.25) {
      return `You ended ${bill.name} on ${formatDate(bill.endDate)}, but this looks like its charge. Check that the cancel went through.`;
    }
  }
  return null;
}

/**
 * Save the alert and its rule share. If the same account received the alert in the
 * last ten minutes, return the existing row. An advisory lock serializes duplicate deliveries.
 */
async function saveOnce(
  book: BookRef,
  accountId: number | null,
  alert: string,
  values: Omit<typeof transactions.$inferInsert, "id" | "groupId" | "bookId" | "rawHash"> & { category: string },
): Promise<{ ok: true; id: number; deduped: true } | { ok: true; id: number; deduped: false }> {
  const rawHash = createHash("sha256").update(`${values.source}|${accountId ?? ""}|${alert}`).digest("hex");
  const [id] = await reserveTransactionIds(1);
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const share = ruleShare(
    book,
    { id, merchant: values.merchant ?? null, category: values.category, spendCategory: values.spendCategory ?? null },
    await spendRulesFor(book),
  );
  const sameAlert = sql`d.book_id = ${book.id} and d.raw_hash = ${rawHash} and d.created_at >= ${since} and d.id <> ${id}`;
  const [, , , dropped] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(hashtext(${`ingest:${book.id}:${rawHash}`}))`),
    db.insert(transactions).values({ ...values, id, groupId: book.groupId, bookId: book.id, rawHash }),
    db.execute(sql`
      insert into transaction_shares (transaction_id, book_id, spend_category)
      select ${id}::int, ${share?.bookId ?? null}::int, ${share?.spendCategory ?? null}::text
      where ${share?.bookId ?? null}::int is not null`),
    db.execute<{ earlier: number | null }>(sql`
      with dropped as (
        delete from transactions where id = ${id} and exists (select 1 from transactions d where ${sameAlert})
      )
      select (select max(d.id) from transactions d where ${sameAlert})::int as earlier`),
  ]);
  const earlier = dropped.rows[0]?.earlier;
  return earlier ? { ok: true, id: earlier, deduped: true } : { ok: true, id, deduped: false };
}

/**
 * Turn one raw alert into a stored transaction.
 *  - Parseable → categorized against the effective recurring rules.
 *  - Unparseable → a needs-review row (amount 0, rawText kept) — NEVER dropped.
 *  - A byte-identical text already stored in the last 10 min → skipped (dedupe;
 *    NOT a unique constraint, so two real identical same-day purchases both land).
 */
export async function ingestAlert(
  book: BookRef,
  text: string,
  accountId: number | null,
): Promise<IngestResult> {
  const body = text.trim().slice(0, MAX_ALERT_CHARS);
  if (!body) return { ok: false, reason: "empty" };

  const tz = await getGroupTimezone(book.groupId);
  const parsed = parseAlertText(body);

  if (!parsed) {
    const saved = await saveOnce(book, accountId, body, {
      accountId,
      postedOn: todayISO(tz),
      merchant: null,
      amount: "0.00",
      originalAmount: "0.00",
      category: "discretionary",
      source: "sms",
      rawText: body,
      needsReview: true,
    });
    return saved.deduped ? saved : { ...saved, needsReview: true, category: "review" };
  }

  // Chase clocks its alerts in Eastern; when the alert carried a time we know the
  // exact instant, so date it in the HOUSEHOLD zone (12:52 AM ET → the day before
  // out in Central). No time/zone in the text → the written date stands.
  const postedOn =
    parsed.instant != null ? dateInTz(parsed.instant, tz) : parsed.postedOn;

  const rules = await merchantRulesFor(book, postedOn);
  const transfer = asTransfer(parsed.merchant, parsed.amount, accountId, await transferRulesFor(book));
  const matched = categorizeMerchant(parsed.merchant, rules, Number(parsed.amount), postedOn);
  const category = transfer ? "transfer" : matched.category;
  const recurringExpenseId = transfer ? null : matched.recurringExpenseId;
  const spendCategory = transfer
    ? null
    : spendCategoryFor(
        category,
        parsed.merchant,
        billCategoryOf(recurringExpenseId, rules),
        await spendRulesFor(book),
      );
  const note =
    category === "fixed"
      ? await extraBillChargeNote(book, recurringExpenseId, Number(parsed.amount), postedOn)
      : !transfer && recurringExpenseId === null
        ? await endedBillChargeNote(book, [parsed.merchant], Number(parsed.amount), postedOn)
        : null;

  const saved = await saveOnce(book, accountId, body, {
    accountId: transfer ? transfer.accountId : accountId,
    transferAccountId: transfer?.transferAccountId ?? null,
    postedOn,
    merchant: parsed.merchant,
    amount: transfer?.amount ?? parsed.amount,
    originalAmount: transfer?.amount ?? parsed.amount,
    category,
    recurringExpenseId,
    spendCategory,
    source: "sms",
    rawText: body,
    needsReview: note !== null,
    note,
  });
  return saved.deduped ? saved : { ...saved, needsReview: note !== null, category };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED INGEST — the generic shape for anyone NOT sending a raw Chase text:
// POST { amount, merchant?, date?, note? }. Only `amount` is required; a missing
// date defaults to the household's today, and a missing merchant lands the row in
// review so it's never lost. Same dedupe + merchant categorization as the SMS
// path, so a structured feed behaves identically once the fields are known.
// ─────────────────────────────────────────────────────────────────────────────

export type StructuredInput = {
  amount?: unknown;
  merchant?: unknown;
  date?: unknown;
  note?: unknown;
  /** Optional explicit spend-category (Groceries/Dining…) — wins over the
   *  merchant-rule guess when a sender knows it. */
  category?: unknown;
};

export type StructuredResult =
  | { ok: true; id: number; deduped: false; needsReview: boolean; category: string }
  | { ok: true; id: number; deduped: true }
  | { ok: false; reason: "bad_amount" };

/** "$1,234.5" | "1234.5" | 1234.5 → "1234.50"; null unless a finite, nonzero
 *  number. Sign is preserved so a caller CAN send a credit as a negative. */
function parseAmountLoose(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return n.toFixed(2);
}

/** Trimmed + length-capped, or null for empty/absent. */
function cleanStr(raw: unknown, max: number): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, max);
  return s === "" ? null : s;
}

/** Accept "YYYY-MM-DD" (or the date half of an ISO datetime); null otherwise. */
function normalizeDateLoose(raw: unknown): string | null {
  if (raw == null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).trim());
  if (!m) return null;
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export async function ingestStructured(
  book: BookRef,
  input: StructuredInput,
  accountId: number | null,
): Promise<StructuredResult> {
  const amount = parseAmountLoose(input.amount);
  if (amount === null) return { ok: false, reason: "bad_amount" };

  const merchant = cleanStr(input.merchant, 200);
  const note = cleanStr(input.note, 500);
  const tz = await getGroupTimezone(book.groupId);
  const postedOn = normalizeDateLoose(input.date) ?? todayISO(tz);

  // Dedupe on the canonical (amount|merchant|date), same 10-min window as SMS:
  // Shortcuts double-fires here too.
  const rawText = JSON.stringify({ amount, merchant, date: postedOn, note });

  // A merchant lets us categorize (same rules as SMS); without one the row is
  // valid but uncategorizable, so it surfaces for review rather than hiding.
  let category = "discretionary";
  let recurringExpenseId: number | null = null;
  let rules: MerchantRule[] = [];
  if (merchant) {
    rules = await merchantRulesFor(book, postedOn);
    ({ category, recurringExpenseId } = categorizeMerchant(merchant, rules, Number(amount), postedOn));
  }
  const transfer = asTransfer(merchant, amount, accountId, await transferRulesFor(book));
  if (transfer) {
    category = "transfer";
    recurringExpenseId = null;
  }
  const extra =
    category === "fixed"
      ? await extraBillChargeNote(book, recurringExpenseId, Number(amount), postedOn)
      : !transfer && merchant && recurringExpenseId === null
        ? await endedBillChargeNote(book, [merchant], Number(amount), postedOn)
        : null;
  const needsReview = merchant === null || extra !== null;

  // An explicit API category wins; otherwise derive it (bill inherit / rules).
  // Transfers are never tagged.
  let spendCategory = transfer ? null : cleanStr(input.category, 40);
  if (spendCategory == null && !transfer) {
    spendCategory = spendCategoryFor(
      category,
      merchant,
      billCategoryOf(recurringExpenseId, rules),
      await spendRulesFor(book),
    );
  }

  const saved = await saveOnce(book, accountId, rawText, {
    accountId: transfer ? transfer.accountId : accountId,
    transferAccountId: transfer?.transferAccountId ?? null,
    postedOn,
    merchant,
    amount: transfer?.amount ?? amount,
    originalAmount: transfer?.amount ?? amount,
    category,
    recurringExpenseId,
    spendCategory,
    source: "api",
    rawText,
    needsReview,
    note: note ?? extra,
  });
  return saved.deduped ? saved : { ...saved, needsReview, category };
}
