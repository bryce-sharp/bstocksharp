"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  funds,
  financialAccounts,
  recurringExpenses,
  profiles,
  transactionShares,
} from "@/lib/db/schema";
import { requireEditor } from "@/lib/auth";
import { requireBook, viewerBooks, type BookRef } from "@/lib/books";
import { getGroupTimezone } from "@/lib/queries/group";
import { parseMoney, parseStr, parseInt as parseBoundedInt, todayISO } from "@/lib/finance/parse";
import { categorizeMerchant } from "@/lib/finance/sms";
import { asTransfer, merchantRulesFor, resolveSpendCategory, transferRulesFor } from "@/lib/finance/ingest";
import { toBookRows } from "@/lib/queries/finance-transactions";
import { shareFromRules } from "@/lib/queries/finance-categories";
import { moneyDirection, signedAmount } from "@/lib/finance/cashflow";
import { releaseBankLinks } from "@/lib/plaid/apply";
import type { TxnRowData } from "@/components/finance/TransactionRow";
import { requireApp } from "@/lib/hub-apps";

// Budget writes — HOUSEHOLD data (requireEditor). The transaction TABLE is the
// point of the whole app: SMS seeds a row, then anyone edits the row freely.

const BUDGET = "/finance"; // the Budget tab is the finance app's landing page
const EXPLORER = "/finance/transactions";

const TXN_CATEGORIES = new Set([
  "discretionary",
  "fixed",
  "amortized",
  "savings",
  "reimbursement",
  "fund",
  "income",
  "transfer",
  "ignored",
]);

/** A tag typed or picked in a form: trimmed to the column's 40 characters; empty = none. */
function parseTag(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, 40) : "";
  return s || null;
}

/** A transaction row in OUR group, or throw. */
async function scopedTxn(id: number) {
  const book = await requireBook();
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.bookId, book.id)))
    .limit(1);
  if (!row) throw new Error("Transaction not found.");
  return { row, book };
}

/** Validate a fund id belongs to the group (or null). */
async function validFund(book: BookRef, id: number | null): Promise<number | null> {
  if (id === null) return null;
  const [f] = await db
    .select({ id: funds.id })
    .from(funds)
    .where(and(eq(funds.id, id), eq(funds.bookId, book.id)))
    .limit(1);
  return f ? id : null;
}

/** Validate a recurring-bill id belongs to the group (or null). */
async function validBill(book: BookRef, id: number | null): Promise<number | null> {
  if (id === null) return null;
  const [b] = await db
    .select({ id: recurringExpenses.id })
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.bookId, book.id)))
    .limit(1);
  return b ? id : null;
}

/** Validate an account id belongs to the group (or null), with its kind. */
async function validAccount(
  book: BookRef,
  id: number | null,
): Promise<{ id: number; kind: string } | null> {
  if (id === null) return null;
  const [a] = await db
    .select({ id: financialAccounts.id, kind: financialAccounts.kind })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.id, id), eq(financialAccounts.bookId, book.id)))
    .limit(1);
  return a ?? null;
}

/**
 * An account for one side of a transfer: any account in the viewer's books, so
 * money can move between two of them ("Between books").
 */
async function transferAccount(id: number | null): Promise<{ id: number; kind: string; bookId: number } | null> {
  if (id === null) return null;
  const mine = (await viewerBooks()).map((b) => b.id);
  if (!mine.length) return null;
  const [a] = await db
    .select({ id: financialAccounts.id, kind: financialAccounts.kind, bookId: financialAccounts.bookId })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.id, id), inArray(financialAccounts.bookId, mine)))
    .limit(1);
  return a ?? null;
}

/** Both sides of a transfer: two different accounts, neither a spending wallet
 *  (money into a wallet is spent; money out of one was never counted). */
function checkTransfer(from: { kind: string } | null, into: { id: number; kind: string } | null, fromId: number | null) {
  if (!into) throw new Error("Pick the account the money moved into.");
  if (into.id === fromId) throw new Error("A transfer needs two different accounts.");
  if (into.kind === "wallet" || from?.kind === "wallet") {
    throw new Error("Money into a spending wallet counts as spending, so record it as Discretionary instead.");
  }
}

/**
 * Edit a transaction — the Lauren-proof path. PARTIAL: only fields present in
 * the form are touched, so an inline one-field save (tap a new category) never
 * blanks the note. Any edit clears needsReview (a human has looked at it now).
 * The amount arrives as a size; its sign follows the row's direction (money in
 * or out) and the lane, so re-filing a refund as a reimbursement stays money in.
 * Returns the saved row so a paged list can patch it in place.
 */
export async function updateTransactionAction(
  id: number,
  formData: FormData,
): Promise<TxnRowData> {
  await requireApp("finance");
  await requireEditor();
  const { row, book } = await scopedTxn(id);
  const has = (k: string) => formData.has(k);

  const set: Record<string, unknown> = { needsReview: false };

  if (has("category")) {
    const c = String(formData.get("category"));
    if (TXN_CATEGORIES.has(c)) set.category = c;
  }

  if (has("merchant")) set.merchant = parseStr(formData.get("merchant"));
  if (has("note")) set.note = parseStr(formData.get("note"));
  if (has("postedOn")) {
    const d = parseStr(formData.get("postedOn"));
    if (d) set.postedOn = d;
  }
  if (has("fundId")) {
    set.fundId = await validFund(
      book,
      parseBoundedInt(formData.get("fundId"), 1, 2 ** 31),
    );
  }
  if (has("recurringExpenseId")) {
    set.recurringExpenseId = await validBill(
      book,
      parseBoundedInt(formData.get("recurringExpenseId"), 1, 2 ** 31),
    );
  }
  if (has("accountId")) {
    set.accountId =
      (await transferAccount(parseBoundedInt(formData.get("accountId"), 1, 2 ** 31)))?.id ?? null;
  }
  if (has("transferAccountId")) {
    set.transferAccountId =
      (await transferAccount(parseBoundedInt(formData.get("transferAccountId"), 1, 2 ** 31)))?.id ?? null;
  }

  // Links only mean something for their category; keep them honest whether the
  // category changed in THIS save or was already set. fund ↔ a fund purchase or
  // income put into the fund, recurring bill ↔ fixed/amortized.
  const effectiveCategory = (set.category as string | undefined) ?? row.category;
  if (effectiveCategory !== "fund" && effectiveCategory !== "income") set.fundId = null;

  // The money keeps its direction; the lane decides the stored sign.
  const direction = moneyDirection(row.category, Number(row.amount), row.accountId, row.transferAccountId);
  const size = has("amount") ? parseMoney(formData.get("amount")) : null;
  if (size !== null || effectiveCategory !== row.category) {
    const amount = signedAmount(effectiveCategory, Number(size ?? row.amount), direction);
    set.amount = amount.toFixed(2);
    if (Math.sign(amount) !== Math.sign(Number(row.amount))) {
      set.originalAmount = ((Math.sign(amount) || 1) * Math.abs(Number(row.originalAmount))).toFixed(2);
    }
  }
  // Money that came in from outside as a one-sided transfer keeps the account it landed in.
  if (row.category === "transfer" && effectiveCategory !== "transfer" && !has("accountId") && row.accountId == null) {
    set.accountId = row.transferAccountId;
  }
  if (effectiveCategory !== "fixed" && effectiveCategory !== "amortized") {
    set.recurringExpenseId = null;
  }
  if (effectiveCategory === "transfer") {
    const fromId = ("accountId" in set ? set.accountId : row.accountId) as number | null;
    const intoId = ("transferAccountId" in set ? set.transferAccountId : row.transferAccountId) as number | null;
    const from = await transferAccount(fromId);
    const into = await transferAccount(intoId);
    checkTransfer(from, into, fromId);
    set.spendCategory = null; // transfers are never tagged
    // A transfer lives in the book the money left (lib/finance/book-rows).
    set.bookId = (from ?? into)!.bookId;
  } else {
    set.transferAccountId = null;
    // Any other row stays in the book of its own account.
    if (row.accountId != null && !has("accountId")) {
      const own = await transferAccount(row.accountId);
      if (own) set.bookId = own.bookId;
    }
  }
  // Only spending and income can be counted by another book.
  if (effectiveCategory === "transfer" || effectiveCategory === "ignored") {
    await db.delete(transactionShares).where(eq(transactionShares.transactionId, id));
  }

  // A tag picked in the form wins (a reimbursement's is what it pays back); an
  // untagged row otherwise picks one up from the merchant rules (e.g. fixing an
  // unreadable alert's merchant), and an existing tag is never overwritten here.
  const pickedTag = has("spendCategory") ? parseTag(formData.get("spendCategory")) : null;
  if (pickedTag && effectiveCategory !== "transfer") {
    set.spendCategory = pickedTag;
  } else if (has("spendCategory") && row.spendCategory != null && effectiveCategory !== "transfer") {
    set.spendCategory = null;
  } else if (row.spendCategory == null && effectiveCategory !== "transfer") {
    set.spendCategory = await resolveSpendCategory(
      book,
      effectiveCategory,
      "merchant" in set ? (set.merchant as string | null) : row.merchant,
      "recurringExpenseId" in set
        ? (set.recurringExpenseId as number | null)
        : row.recurringExpenseId,
    );
  }

  const [saved] = await db
    .update(transactions)
    .set(set)
    .where(eq(transactions.id, id))
    .returning();
  revalidatePath(BUDGET);
  revalidatePath(EXPLORER);
  return (await toBookRows(book, [saved]))[0];
}

/** Quick-add a transaction the bank didn't text (gas), or income (paycheck,
 *  a gift). Income is entered positive; it's excluded from all spend math. */
export async function addManualTransactionAction(formData: FormData): Promise<void> {
  await requireApp("finance");
  await requireEditor();
  const book = await requireBook();

  const amount = parseMoney(formData.get("amount"));
  if (amount === null || Number(amount) <= 0) throw new Error("Enter an amount.");
  const postedOn = parseStr(formData.get("postedOn")) ?? todayISO(await getGroupTimezone(book.groupId));
  const merchant = parseStr(formData.get("merchant"));
  const kindRaw = formData.get("kind");
  const kind = kindRaw === "income" ? "income" : kindRaw === "transfer" ? "transfer" : "expense";
  const categoryRaw = String(formData.get("category") ?? "auto");

  // Category resolution: income is forced by the toggle; "auto" runs the same
  // merchant categorizer the SMS path uses (so "Progressive" → amortized on its
  // bill); an explicit non-income choice is honored as-is.
  let category: string;
  let autoRecurringId: number | null = null;
  let transferAccountId: number | null = null;
  if (kind === "transfer") {
    category = "transfer";
  } else if (kind === "income") {
    // Money in is income (yours: pay, a gift) or a reimbursement (pays back a
    // purchase, so it nets against spending under the tag it pays back).
    category = formData.get("moneyKind") === "reimbursement" ? "reimbursement" : "income";
  } else if (categoryRaw === "auto") {
    const rules = await merchantRulesFor(book, postedOn);
    const c = categorizeMerchant(merchant ?? "", rules, Number(amount), postedOn);
    category = c.category;
    autoRecurringId = c.recurringExpenseId;
    // An account's transfer words beat the bill and tag rules.
    const t = asTransfer(
      merchant,
      amount,
      parseBoundedInt(formData.get("accountId"), 1, 2 ** 31),
      await transferRulesFor(book),
    );
    if (t) {
      category = "transfer";
      autoRecurringId = null;
      transferAccountId = t.transferAccountId;
    }
  } else if (TXN_CATEGORIES.has(categoryRaw) && categoryRaw !== "income" && categoryRaw !== "reimbursement") {
    category = categoryRaw;
  } else {
    category = "discretionary";
  }

  // Optional account attribution (which card/bank), scoped to the group.
  let accountId = parseBoundedInt(formData.get("accountId"), 1, 2 ** 31);
  if (accountId !== null) {
    const [a] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.bookId, book.id)))
      .limit(1);
    if (!a) accountId = null;
  }
  let rowBook = book;
  if (kind === "transfer") {
    // Either side can be in another of your books ("Between books"); the row lives where the money left.
    const from = await transferAccount(parseBoundedInt(formData.get("accountId"), 1, 2 ** 31));
    const into = await transferAccount(parseBoundedInt(formData.get("transferAccountId"), 1, 2 ** 31));
    checkTransfer(from, into, from?.id ?? null);
    accountId = from?.id ?? null;
    transferAccountId = into!.id;
    rowBook = { id: (from ?? into)!.bookId, groupId: book.groupId };
  }
  // A fund purchase draws its fund; income can be put into one instead.
  const fundId =
    category === "fund" || category === "income"
      ? await validFund(book, parseBoundedInt(formData.get("fundId"), 1, 2 ** 31))
      : null;
  // Auto-detect already resolved a bill link; an explicit fixed/amortized pick
  // takes it from the form.
  const recurringExpenseId =
    category === "fixed" || category === "amortized"
      ? autoRecurringId ??
        (await validBill(book, parseBoundedInt(formData.get("recurringExpenseId"), 1, 2 ** 31)))
      : null;

  const [added] = await db.insert(transactions).values({
    groupId: book.groupId,
    bookId: rowBook.id,
    accountId,
    transferAccountId,
    postedOn,
    merchant,
    amount,
    originalAmount: amount,
    category,
    fundId,
    recurringExpenseId,
    spendCategory:
      category === "transfer"
        ? null
        : category === "reimbursement"
          ? parseTag(formData.get("spendCategory"))
          : await resolveSpendCategory(book, category, merchant, recurringExpenseId),
    source: "manual",
    note: parseStr(formData.get("note")),
  }).returning();
  await shareFromRules(rowBook, added);
  revalidatePath(BUDGET);
}

export async function deleteTransactionAction(
  id: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("finance");
  await requireEditor();
  await scopedTxn(id); // group-scope check
  // A row the bank feed knows about stays deleted: later bank updates skip it.
  await releaseBankLinks(id);
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath(BUDGET);
  revalidatePath(EXPLORER);
}

// ── Funds — imaginary envelopes (balance disconnected from real accounts) ─────
export async function createFundAction(formData: FormData): Promise<void> {
  await requireApp("finance");
  await requireEditor();
  const book = await requireBook();
  const name = parseStr(formData.get("name"));
  if (!name) throw new Error("Name the fund.");
  const startingBalance = parseMoney(formData.get("startingBalance")) ?? "0.00";

  // Optional owner (Lauren's fund vs a shared pot), scoped to the group.
  let ownerProfileId = parseBoundedInt(formData.get("ownerProfileId"), 1, 2 ** 31);
  if (ownerProfileId !== null) {
    const [p] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.id, ownerProfileId), eq(profiles.groupId, book.groupId)))
      .limit(1);
    if (!p) ownerProfileId = null;
  }

  await db.insert(funds).values({ groupId: book.groupId, bookId: book.id, name, startingBalance, ownerProfileId });
  revalidatePath(BUDGET);
}

/** A fund row in OUR group, or throw. */
async function scopedFund(id: number) {
  const book = await requireBook();
  const [row] = await db
    .select()
    .from(funds)
    .where(and(eq(funds.id, id), eq(funds.bookId, book.id)))
    .limit(1);
  if (!row) throw new Error("Fund not found.");
  return { row, book };
}

/**
 * Adjust a fund's balance DIRECTLY — funds are imaginary envelopes, so this is
 * play money, NOT a real transaction, and never touches the ledger. A positive
 * amount adds, a negative removes / zeroes out. The set balance lives on the
 * fund; only real spends (fund-category ledger rows) draw it down elsewhere, so
 * balance = startingBalance − Σ(real draws).
 */
export async function adjustFundAction(
  fundId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("finance");
  await requireEditor();
  const { row } = await scopedFund(fundId);
  const amount = parseMoney(formData.get("amount"));
  if (amount === null || Number(amount) === 0) throw new Error("Enter an amount.");
  const next = (Number(row.startingBalance) + Number(amount)).toFixed(2);
  await db.update(funds).set({ startingBalance: next }).where(eq(funds.id, fundId));
  revalidatePath(BUDGET);
}

/** Close a fund (spent out / no longer used). History stays; it leaves the
 *  active list. */
export async function closeFundAction(id: number, _formData: FormData): Promise<void> {
  await requireApp("finance");
  await requireEditor();
  await scopedFund(id);
  await db.update(funds).set({ closedAt: new Date() }).where(eq(funds.id, id));
  revalidatePath(BUDGET);
}
