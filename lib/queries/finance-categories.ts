import "server-only";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchantCategories, transactions } from "@/lib/db/schema";
import { requireBook, type BookRef } from "@/lib/books";
import { longestMatchingRule, type SpendRule } from "@/lib/finance/categorize";
import {
  IN_CATEGORIES,
  OUT_CATEGORIES,
  RULE_CATEGORIES,
  flowOf,
  type Flow,
} from "@/lib/finance/cashflow";

// Starters offered in the tag dropdowns even before any exist; the group's
// actually-used tags (incl. inherited bill categories) get merged in. Kept
// short + generic so a new household grows its own from here. Spending and
// income keep separate lists — a paycheck is never "Groceries".
export const STARTER_SPEND_CATEGORIES = [
  "Groceries",
  "Dining",
  "Gas",
  "Shopping",
  "Home",
  "Health",
  "Kids",
  "Car",
  "Entertainment",
];
export const STARTER_INCOME_CATEGORIES = [
  "Paycheck",
  "Interest",
  "Side income",
  "Tax refund",
  "Gift",
  "Refund",
];

const FLOW_CATEGORIES: Record<Flow, readonly string[]> = { out: OUT_CATEGORIES, in: IN_CATEGORIES };

/** A group's merchant → tag rules (both flows), for ingest + the backfill. */
export async function spendRulesFor(book: BookRef): Promise<SpendRule[]> {
  const rows = await db
    .select({
      pattern: merchantCategories.pattern,
      category: merchantCategories.category,
      flow: merchantCategories.flow,
    })
    .from(merchantCategories)
    .where(eq(merchantCategories.bookId, book.id));
  return rows.map((r) => ({ ...r, flow: r.flow === "in" ? "in" : "out" }));
}

/** Tags in use for one flow — on its transactions and its rules — plus starters. */
async function tagsForFlow(book: BookRef, flow: Flow): Promise<string[]> {
  const [used, ruled] = await Promise.all([
    db
      .selectDistinct({ c: transactions.spendCategory })
      .from(transactions)
      .where(
        and(
          eq(transactions.bookId, book.id),
          isNotNull(transactions.spendCategory),
          inArray(transactions.category, [...FLOW_CATEGORIES[flow]]),
        ),
      ),
    db
      .selectDistinct({ c: merchantCategories.category })
      .from(merchantCategories)
      .where(and(eq(merchantCategories.bookId, book.id), eq(merchantCategories.flow, flow))),
  ]);
  const set = new Set<string>(flow === "in" ? STARTER_INCOME_CATEGORIES : STARTER_SPEND_CATEGORIES);
  for (const r of [...used, ...ruled]) if (r.c) set.add(r.c);
  return [...set].sort();
}

/** Spending tags (money-out rows), sorted. */
export async function listSpendCategoriesForBook(book: BookRef): Promise<string[]> {
  return tagsForFlow(book, "out");
}

/** Income tags (money-in rows), sorted. */
export async function listIncomeCategoriesForBook(book: BookRef): Promise<string[]> {
  return tagsForFlow(book, "in");
}

export async function listSpendCategories(): Promise<string[]> {
  return listSpendCategoriesForBook(await requireBook());
}

export async function listIncomeCategories(): Promise<string[]> {
  return listIncomeCategoriesForBook(await requireBook());
}

export type SetCategoryResult = { merchant: string | null; affected: number };

/**
 * Set (or clear, with null) a transaction's tag. When `applyToMerchant` and the
 * row has a merchant, ALSO: (1) upsert an exact-merchant rule for the row's
 * flow so future txns from it inherit the tag — the "learns from you" behavior
 * — and (2) sweep every existing row from that merchant on the same side of
 * the ledger. The exact-merchant pattern is the most specific, so longest-match
 * lets it override any broader group rule (e.g. `WM SUPERCENTER #4279` beats
 * `WALMART`). Excluded rows are never tagged.
 */
export async function setSpendCategoryForBook(
  book: BookRef,
  txnId: number,
  category: string | null,
  applyToMerchant: boolean,
): Promise<SetCategoryResult> {
  const [txn] = await db
    .select({ merchant: transactions.merchant, category: transactions.category })
    .from(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.bookId, book.id)))
    .limit(1);
  if (!txn) return { merchant: null, affected: 0 };
  const flow = flowOf(txn.category);
  if (!flow) return { merchant: txn.merchant, affected: 0 };

  // ALWAYS tag the tapped row first, even when the merchant sweep below
  // matches nothing.
  await db
    .update(transactions)
    .set({ spendCategory: category })
    .where(and(eq(transactions.id, txnId), eq(transactions.bookId, book.id)));

  if (applyToMerchant && txn.merchant && category) {
    const [rule] = await db
      .select({ id: merchantCategories.id })
      .from(merchantCategories)
      .where(
        and(
          eq(merchantCategories.bookId, book.id),
          eq(merchantCategories.pattern, txn.merchant),
          eq(merchantCategories.flow, flow),
        ),
      )
      .limit(1);
    if (rule) {
      await db.update(merchantCategories).set({ category }).where(eq(merchantCategories.id, rule.id));
    } else {
      // New inline rule starts as its own group (name = the merchant).
      await db.insert(merchantCategories).values({
        groupId: book.groupId,
        bookId: book.id,
        pattern: txn.merchant,
        category,
        groupName: txn.merchant,
        flow,
      });
    }

    const scope = and(
      eq(transactions.bookId, book.id),
      eq(transactions.merchant, txn.merchant),
      inArray(transactions.category, [...FLOW_CATEGORIES[flow]]),
    );
    await db.update(transactions).set({ spendCategory: category }).where(scope);
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(transactions).where(scope);
    return { merchant: txn.merchant, affected: c?.n ?? 1 };
  }

  return { merchant: txn.merchant, affected: 1 };
}

// ── The Categories management page (F4d): named merchant GROUPS ───────────────
// A group = a name + a shared tag + several match-name patterns. Several rules
// (WM SUPERCENTER, WAL-MART, WALMART.COM) can share one group_name ("Walmart").
// Categorization is unchanged (longest pattern wins → its tag); group_name is
// purely how the page organizes them. Spending and income groups live apart
// (the page's Spending | Income toggle) — every call here takes a flow.

export type MerchantGroup = {
  name: string;
  category: string;
  names: { ruleId: number; pattern: string }[]; // the match-name patterns
  merchants: { merchant: string; count: number }[];
  txns: number;
};
export type MerchantGroupsView = {
  flow: Flow;
  groups: MerchantGroup[];
  ungrouped: { merchant: string; count: number }[];
  categories: string[];
};

// A group is identified by its name within a flow; be defensive about legacy
// null group_name rows (fall back to the pattern being the name).
function groupMatch(name: string, flow: Flow) {
  return and(
    eq(merchantCategories.flow, flow),
    or(
      eq(merchantCategories.groupName, name),
      and(isNull(merchantCategories.groupName), eq(merchantCategories.pattern, name)),
    ),
  );
}

async function allRules(book: BookRef, flow: Flow) {
  const rows = await db
    .select({
      id: merchantCategories.id,
      pattern: merchantCategories.pattern,
      category: merchantCategories.category,
      groupName: merchantCategories.groupName,
    })
    .from(merchantCategories)
    .where(and(eq(merchantCategories.bookId, book.id), eq(merchantCategories.flow, flow)));
  return rows.map((r) => ({ ...r, groupName: r.groupName ?? r.pattern }));
}

// Re-tag only the rule-governed rows (bills keep their inherited tag) whose
// merchant is touched by the given patterns — recompute each via longest-match
// over ALL current rules of the flow, and update the ones that changed. Scoped
// so unrelated (incl. manual) tags are left alone; longest-match-aware so a
// more-specific override still wins.
async function sweepForPatterns(book: BookRef, patterns: string[], flow: Flow): Promise<void> {
  const lows = patterns.map((p) => p.toLowerCase()).filter(Boolean);
  if (!lows.length) return;
  const rules = await allRules(book, flow);
  const txns = await db
    .select({
      id: transactions.id,
      merchant: transactions.merchant,
      spendCategory: transactions.spendCategory,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.bookId, book.id),
        inArray(transactions.category, [...RULE_CATEGORIES[flow]]),
        isNotNull(transactions.merchant),
      ),
    );

  const byCat = new Map<string | null, number[]>();
  for (const t of txns) {
    if (!t.merchant) continue;
    const m = t.merchant.toLowerCase();
    if (!lows.some((p) => m.includes(p))) continue;
    const cat = longestMatchingRule(t.merchant, rules)?.category ?? null;
    if (cat !== t.spendCategory) {
      const arr = byCat.get(cat) ?? [];
      arr.push(t.id);
      byCat.set(cat, arr);
    }
  }
  for (const [cat, ids] of byCat) {
    if (ids.length) await db.update(transactions).set({ spendCategory: cat }).where(inArray(transactions.id, ids));
  }
}

/** Groups that actually catch a merchant, biggest first, + the ungrouped tail. */
export async function getMerchantGroupsForBook(
  book: BookRef,
  flow: Flow = "out",
): Promise<MerchantGroupsView> {
  const rules = await allRules(book, flow);
  const merchants = await db
    .select({ merchant: transactions.merchant, n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.bookId, book.id),
        inArray(transactions.category, [...RULE_CATEGORIES[flow]]),
        isNotNull(transactions.merchant),
      ),
    )
    .groupBy(transactions.merchant);

  const groupMap = new Map<string, MerchantGroup>();
  for (const r of rules) {
    let g = groupMap.get(r.groupName);
    if (!g) {
      g = { name: r.groupName, category: r.category, names: [], merchants: [], txns: 0 };
      groupMap.set(r.groupName, g);
    }
    g.names.push({ ruleId: r.id, pattern: r.pattern });
  }

  const ungrouped: { merchant: string; count: number }[] = [];
  for (const m of merchants) {
    if (!m.merchant) continue;
    const rule = longestMatchingRule(m.merchant, rules);
    if (rule) {
      const g = groupMap.get(rule.groupName);
      if (g) {
        g.merchants.push({ merchant: m.merchant, count: m.n });
        g.txns += m.n;
      }
    } else {
      ungrouped.push({ merchant: m.merchant, count: m.n });
    }
  }

  const groups = [...groupMap.values()]
    .filter((g) => g.merchants.length > 0)
    .sort((a, b) => b.txns - a.txns);
  for (const g of groups) g.merchants.sort((a, b) => b.count - a.count);
  ungrouped.sort((a, b) => b.count - a.count);

  return { flow, groups, ungrouped, categories: await tagsForFlow(book, flow) };
}

/** Retag a whole group (all its names) and sweep its merchants. */
export async function retagGroupForBook(
  book: BookRef,
  flow: Flow,
  name: string,
  category: string,
): Promise<void> {
  const cat = category.trim().slice(0, 40);
  if (!cat) return;
  const rows = await db
    .select({ pattern: merchantCategories.pattern })
    .from(merchantCategories)
    .where(and(eq(merchantCategories.bookId, book.id), groupMatch(name, flow)));
  await db
    .update(merchantCategories)
    .set({ category: cat })
    .where(and(eq(merchantCategories.bookId, book.id), groupMatch(name, flow)));
  await sweepForPatterns(book, rows.map((r) => r.pattern), flow);
}

/** Add/move a match-name into a group (also: adopt a merchant, or create a
 *  group when `name` is new). Upserts by pattern, then sweeps that pattern. */
export async function upsertNameForBook(
  book: BookRef,
  flow: Flow,
  name: string,
  category: string,
  pattern: string,
): Promise<void> {
  const pat = pattern.trim().slice(0, 100);
  const nm = name.trim().slice(0, 60);
  const cat = category.trim().slice(0, 40);
  if (!pat || !nm || !cat) return;
  const [existing] = await db
    .select({ id: merchantCategories.id })
    .from(merchantCategories)
    .where(
      and(
        eq(merchantCategories.bookId, book.id),
        eq(merchantCategories.pattern, pat),
        eq(merchantCategories.flow, flow),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(merchantCategories)
      .set({ groupName: nm, category: cat })
      .where(eq(merchantCategories.id, existing.id));
  } else {
    await db
      .insert(merchantCategories)
      .values({ groupId: book.groupId, bookId: book.id, pattern: pat, category: cat, groupName: nm, flow });
  }
  await sweepForPatterns(book, [pat], flow);
}

/** Remove a single match-name; its merchants re-fall to whatever now matches. */
export async function removeNameForBook(book: BookRef, ruleId: number): Promise<void> {
  const [rule] = await db
    .select({ pattern: merchantCategories.pattern, flow: merchantCategories.flow })
    .from(merchantCategories)
    .where(and(eq(merchantCategories.id, ruleId), eq(merchantCategories.bookId, book.id)))
    .limit(1);
  if (!rule) return;
  await db
    .delete(merchantCategories)
    .where(and(eq(merchantCategories.id, ruleId), eq(merchantCategories.bookId, book.id)));
  await sweepForPatterns(book, [rule.pattern], rule.flow === "in" ? "in" : "out");
}

/** Rename a group. If `newName` already exists, the two MERGE (moved names adopt
 *  the target's tag, which sweeps their merchants). */
export async function renameGroupForBook(
  book: BookRef,
  flow: Flow,
  oldName: string,
  newName: string,
): Promise<void> {
  const nm = newName.trim().slice(0, 60);
  if (!nm || nm === oldName) return;
  const [target] = await db
    .select({ category: merchantCategories.category })
    .from(merchantCategories)
    .where(and(eq(merchantCategories.bookId, book.id), groupMatch(nm, flow)))
    .limit(1);
  const rows = await db
    .select({ pattern: merchantCategories.pattern })
    .from(merchantCategories)
    .where(and(eq(merchantCategories.bookId, book.id), groupMatch(oldName, flow)));
  await db
    .update(merchantCategories)
    .set(target ? { groupName: nm, category: target.category } : { groupName: nm })
    .where(and(eq(merchantCategories.bookId, book.id), groupMatch(oldName, flow)));
  if (target) await sweepForPatterns(book, rows.map((r) => r.pattern), flow);
}

/** Delete a whole group (all its names); its merchants re-fall or go ungrouped. */
export async function deleteGroupForBook(book: BookRef, flow: Flow, name: string): Promise<void> {
  const rows = await db
    .select({ pattern: merchantCategories.pattern })
    .from(merchantCategories)
    .where(and(eq(merchantCategories.bookId, book.id), groupMatch(name, flow)));
  await db
    .delete(merchantCategories)
    .where(and(eq(merchantCategories.bookId, book.id), groupMatch(name, flow)));
  await sweepForPatterns(book, rows.map((r) => r.pattern), flow);
}
