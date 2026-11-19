import "server-only";
import { and, asc, eq, getTableColumns, gte, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialAccounts, plaidAccounts, plaidItems, plaidTransactions, transactionShares, transactions } from "@/lib/db/schema";
import { asTransfer, endedBillChargeNote, extraBillChargeNote, merchantRulesFor, transferRulesFor } from "@/lib/finance/ingest";
import { categorizeMerchant, type MerchantRule } from "@/lib/finance/sms";
import { spendCategoryFor } from "@/lib/finance/categorize";
import { ruleShare, spendRulesFor } from "@/lib/queries/finance-categories";
import { reserveTransactionIds } from "@/lib/queries/finance-transactions";
import { getGroupTimezone } from "@/lib/queries/group";
import { type BookRef } from "@/lib/books";
import { pickMatch, pickSplit } from "@/lib/finance/match";
import { bankDate, bankKind, fromPaymentApp, ledgerAmount, type BankKind } from "@/lib/plaid/map";

// ─────────────────────────────────────────────────────────────────────────────
// APPLY — the bank's staged rows (plaid_transactions with applied_at null)
// become ledger rows. A bank row either refreshes the ledger row it already
// owns, takes over its pending row's entry when it posts, claims a card alert
// or manual row that already recorded it, pairs with the other leg of a
// transfer, or becomes a new row categorized like a card alert. The ledger row
// stays the household's: a refresh changes only what the bank owns (the posted
// amount, while nobody has adjusted it, and the pending flag). Re-runnable.
// ─────────────────────────────────────────────────────────────────────────────

export type ApplyStats = {
  inserted: number;
  claimed: number;
  updated: number;
  removed: number;
  skipped: number;
  review: number;
};

type Staged = typeof plaidTransactions.$inferSelect & {
  financialAccountId: number | null;
  accountType: string;
  /** The bank's own statement text (the wording card alerts use), when Plaid sent it. */
  statementText: string | null;
};

/** Every spelling the bank gives, most literal first: its statement text, Plaid's
 *  description, then Plaid's clean merchant name. Rules written from card alerts
 *  match the statement text; ones written from Plaid's names still match. */
const spellings = (r: Staged, withMerchant = true): string[] =>
  [r.statementText, r.name, withMerchant ? r.merchantName : null].filter((s): s is string => Boolean(s));

const DAY = 86_400_000;
const shiftDays = (iso: string, n: number) =>
  new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);

const DROPPED_NOTE = "The bank dropped this charge. Delete it if it never went through.";
const PAYMENT_APP_NOTE =
  "Money in from a payment app. Keep it as income (and pick a fund if it is one person's), or re-file it as a reimbursement.";

/**
 * True when a batch lost to another sync: `claim` found a bank row already linked
 * (Postgres division by zero), or Postgres stopped one of two syncs that locked each other.
 */
function lostToOtherSync(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if ("code" in e && (e.code === "22012" || e.code === "40P01")) return true;
  }
  return false;
}

export async function applyPlaidItem(plaidItemId: number): Promise<ApplyStats> {
  const stats: ApplyStats = { inserted: 0, claimed: 0, updated: 0, removed: 0, skipped: 0, review: 0 };
  const [item] = await db
    .select({ id: plaidItems.id, groupId: plaidItems.groupId, bookId: plaidItems.bookId, syncFrom: plaidItems.syncFrom })
    .from(plaidItems)
    .where(eq(plaidItems.id, plaidItemId))
    .limit(1);
  if (!item) return stats;
  const book: BookRef = { id: item.bookId, groupId: item.groupId };

  const accounts = await db
    .select({ id: plaidAccounts.id, financialAccountId: plaidAccounts.financialAccountId })
    .from(plaidAccounts)
    .where(eq(plaidAccounts.plaidItemId, item.id));
  const mappedIds = accounts.filter((a) => a.financialAccountId !== null).map((a) => a.id);
  const unmappedIds = accounts.filter((a) => a.financialAccountId === null).map((a) => a.id);

  // A pending copy whose posted copy has arrived is gone, and its ledger row has
  // moved to the posted copy. A full re-read never lists it as removed, so retire it.
  const retireSupersededPending = () =>
    db
      .update(plaidTransactions)
      .set({ removedAt: new Date() })
      .where(
        and(
          eq(plaidTransactions.pending, true),
          isNull(plaidTransactions.removedAt),
          isNull(plaidTransactions.ledgerTransactionId),
          inArray(plaidTransactions.plaidAccountId, accounts.map((a) => a.id)),
          sql`exists (select 1 from plaid_transactions q where q.pending_transaction_id = ${plaidTransactions.transactionId} and q.removed_at is null)`,
        ),
      );
  const now = new Date();

  // Rows that never reach the ledger: unmapped accounts (mapping one later
  // re-queues its rows) and history from before the cutover.
  if (unmappedIds.length) {
    await db
      .update(plaidTransactions)
      .set({ appliedAt: now })
      .where(
        and(
          isNull(plaidTransactions.appliedAt),
          isNull(plaidTransactions.ledgerTransactionId),
          inArray(plaidTransactions.plaidAccountId, unmappedIds),
        ),
      );
  }
  if (!mappedIds.length) return stats;
  await db
    .update(plaidTransactions)
    .set({ appliedAt: now })
    .where(
      and(
        isNull(plaidTransactions.appliedAt),
        isNull(plaidTransactions.ledgerTransactionId),
        inArray(plaidTransactions.plaidAccountId, mappedIds),
        sql`coalesce(${plaidTransactions.authorizedDate}, ${plaidTransactions.date}) < ${item.syncFrom}`,
      ),
    );

  const staged: Staged[] = await db
    .select({
      ...getTableColumns(plaidTransactions),
      financialAccountId: plaidAccounts.financialAccountId,
      accountType: plaidAccounts.type,
      statementText: sql<string | null>`${plaidTransactions.raw}->>'original_description'`,
    })
    .from(plaidTransactions)
    .innerJoin(plaidAccounts, eq(plaidTransactions.plaidAccountId, plaidAccounts.id))
    .where(and(isNull(plaidTransactions.appliedAt), inArray(plaidTransactions.plaidAccountId, mappedIds)))
    .orderBy(asc(plaidTransactions.date), asc(plaidTransactions.id));
  if (!staged.length) {
    await retireSupersededPending();
    return stats;
  }

  const tz = await getGroupTimezone(item.groupId);
  const [spendRules, transferRules] = await Promise.all([
    spendRulesFor(book),
    transferRulesFor(book),
  ]);
  const billRules = new Map<string, MerchantRule[]>();
  const rulesOn = async (date: string) => {
    let rules = billRules.get(date);
    if (!rules) {
      rules = await merchantRulesFor(book, date);
      billRules.set(date, rules);
    }
    return rules;
  };
  const dateOf = (r: Staged) =>
    bankDate(
      {
        authorizedDatetime: (r.raw as { authorized_datetime?: string | null }).authorized_datetime ?? null,
        authorizedDate: r.authorizedDate,
        date: r.date,
      },
      tz,
    );
  const kindOf = (r: Pick<Staged, "amount" | "pfcPrimary" | "pfcDetailed" | "accountType" | "name" | "statementText">): BankKind =>
    bankKind({
      amount: Number(r.amount),
      pfcPrimary: r.pfcPrimary,
      pfcDetailed: r.pfcDetailed,
      accountType: r.accountType,
      name: r.name,
      statementText: r.statementText,
    });

  // Rows a bank transaction may claim: not from a bank feed, not already owned
  // by a live bank row, on a mapped account, near the batch's dates.
  const live = staged.filter((r) => r.removedAt === null);
  const removedRows = staged.filter((r) => r.removedAt !== null);
  const finIds = [...new Set(live.map((r) => r.financialAccountId!))];
  const dates = live.map(dateOf).sort();
  const pool = live.length
    ? await db
        .select({
          id: transactions.id,
          accountId: transactions.accountId,
          transferAccountId: transactions.transferAccountId,
          postedOn: transactions.postedOn,
          merchant: transactions.merchant,
          originalAmount: transactions.originalAmount,
          category: transactions.category,
          source: transactions.source,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.bookId, book.id),
            ne(transactions.source, "plaid"),
            or(inArray(transactions.accountId, finIds), inArray(transactions.transferAccountId, finIds)),
            gte(transactions.postedOn, shiftDays(dates[0], -7)),
            lte(transactions.postedOn, shiftDays(dates[dates.length - 1], 7)),
            sql`not exists (select 1 from plaid_transactions p where p.removed_at is null and (p.ledger_transaction_id = ${transactions.id} or ${transactions.id} = any(p.split_ledger_ids)))`,
          ),
        )
    : [];
  const taken = new Set<number>();
  const handled = new Set<number>();

  const markApplied = (rawId: number, ledgerId: number | null, splitIds: number[] | null = null) =>
    db
      .update(plaidTransactions)
      .set({ appliedAt: new Date(), ledgerTransactionId: ledgerId, splitLedgerIds: splitIds })
      .where(eq(plaidTransactions.id, rawId));

  /**
   * Link bank rows to a ledger row. Each must still be waiting: not linked, not yet
   * applied, not removed by the bank, not dismissed by the household. If any raw bank
   * record is not, the SQL statement raises a division-by-zero error, and the
   * transaction rolls back the entire batch. `onlyIf` adds a condition.
   */
  const claim = (rawIds: number[], ledgerId: number, onlyIf = sql`true`) =>
    db.execute(sql`
      with claimed as (
        update plaid_transactions
        set applied_at = now(), ledger_transaction_id = ${ledgerId}, split_ledger_ids = null
        where id = any(${sql.param(rawIds)}::int[])
          and ledger_transaction_id is null and applied_at is null and removed_at is null and dismissed_at is null
          and ${onlyIf}
        returning id
      )
      select count(*) / (case when count(*) = ${rawIds.length} then 1 else 0 end) as claimed from claimed`);

  /**
   * The one rule for whether an existing ledger row can become the transfer `from` →
   * `into`: it is still a transfer, its accounts are empty or already these, and
   * exactly `owners` live bank rows link it (1 for a one-sided bank row, 0 for a row
   * entered by hand). A null `from` or `into` skips that account check: a single bank
   * leg checks its one known account exactly instead. Pairing checks the rule when
   * reading, and the claim checks it again under the row lock, so a household edit
   * made in between always wins.
   */
  const fitsPair = (ledgerId: SQL, from: SQL | null, into: SQL | null, owners: 0 | 1) => sql`exists (
    select 1 from transactions t
    where t.id = ${ledgerId} and t.category = 'transfer'
      and ${from === null ? sql`true` : sql`(t.account_id is null or t.account_id = ${from})`}
      and ${into === null ? sql`true` : sql`(t.transfer_account_id is null or t.transfer_account_id = ${into})`}
      and (select count(*) from plaid_transactions q
           where q.removed_at is null and (q.ledger_transaction_id = t.id or t.id = any(q.split_ledger_ids))) = ${owners})`;

  /**
   * Bring a ledger row up to date with the bank, keeping the household's edits.
   * A payment recorded in parts only gets its status: the parts are the household's.
   * An empty list still means parts: the household deleted all but one.
   */
  async function refresh(ledgerId: number, kind: BankKind, r: Staged, splitIds: number[] | null = null) {
    if (splitIds !== null) {
      await db
        .update(transactions)
        .set({ bankStatus: r.pending ? "pending" : "posted" })
        .where(inArray(transactions.id, [ledgerId, ...splitIds]));
      return;
    }
    const [row] = await db
      .select({ amount: transactions.amount, originalAmount: transactions.originalAmount })
      .from(transactions)
      .where(eq(transactions.id, ledgerId))
      .limit(1);
    if (!row) return;
    // The bank owns the size; the row keeps its sign, so a refund re-filed as a
    // reimbursement (stored positive) stays positive.
    const bank = Number(ledgerAmount(kind, Number(r.amount)));
    const sign = Math.sign(Number(row.originalAmount)) || Math.sign(bank) || 1;
    const amount = (sign * Math.abs(bank)).toFixed(2);
    const untouched = Number(row.amount) === Number(row.originalAmount);
    await db
      .update(transactions)
      .set({
        originalAmount: amount,
        ...(untouched ? { amount } : {}),
        bankStatus: r.pending ? "pending" : "posted",
      })
      .where(eq(transactions.id, ledgerId));
  }

  async function insertRow(values: {
    r: Staged;
    date: string;
    accountId: number | null;
    transferAccountId: number | null;
    amount: string;
    category: string;
    recurringExpenseId: number | null;
    spendCategory: string | null;
    needsReview: boolean;
    /** Why a row in review needs a look. */
    note?: string | null;
    /** A transfer between books lives in the book the money left. */
    bookId?: number;
    /** The bank rows this row records, linked in the same batch so a retry finds it. */
    rawIds: number[];
  }): Promise<number | null> {
    const [id] = await reserveTransactionIds(1);
    // Plaid's clean merchant name reads best in lists; the popup shows the bank's wording.
    const merchant = (values.r.merchantName ?? values.r.name).slice(0, 200);
    const share = ruleShare(book, { id, merchant, category: values.category, spendCategory: values.spendCategory }, spendRules);
    const saved = await db.batch([
      db.insert(transactions).values({
        id,
        groupId: item.groupId,
        bookId: values.bookId ?? book.id,
        accountId: values.accountId,
        transferAccountId: values.transferAccountId,
        postedOn: values.date,
        merchant,
        amount: values.amount,
        originalAmount: values.amount,
        category: values.category,
        recurringExpenseId: values.recurringExpenseId,
        spendCategory: values.spendCategory,
        source: "plaid",
        needsReview: values.needsReview,
        note: values.note ?? null,
        bankStatus: values.r.pending ? "pending" : "posted",
      }),
      ...(share ? [db.insert(transactionShares).values(share).onConflictDoNothing()] : []),
      claim(values.rawIds, id),
    ]).catch((err: unknown) => {
      if (lostToOtherSync(err)) return null;
      throw err;
    });
    if (saved === null) return null;
    if (values.needsReview) stats.review++;
    return id;
  }

  /** Purchases, refunds, and income: categorized the way a card alert would be. Null when another run recorded it first. */
  async function insertCategorized(r: Staged, kind: BankKind, date: string): Promise<number | null> {
    let amount = ledgerAmount(kind, Number(r.amount));
    let accountId: number | null = r.financialAccountId;
    let transferAccountId: number | null = null;
    let category = "income";
    let recurringExpenseId: number | null = null;
    let billCategory: string | null = null;
    if (kind !== "income") {
      // Transfer words read the bank's own text, never the merchant name a store shares.
      const transfer =
        spellings(r, false)
          .map((s) => asTransfer(s, amount, accountId, transferRules))
          .find((t) => t !== null) ?? null;
      if (transfer) {
        category = "transfer";
        accountId = transfer.accountId;
        transferAccountId = transfer.transferAccountId;
        amount = transfer.amount;
      } else {
        const rules = await rulesOn(date);
        // Bills match the most literal spelling that names one; the amount, then
        // the due month, picks between bills that share a merchant.
        const paid = Math.abs(Number(r.amount));
        let bill = categorizeMerchant("", rules, paid, date);
        for (const s of spellings(r)) {
          bill = categorizeMerchant(s, rules, paid, date);
          if (bill.recurringExpenseId !== null) break;
        }
        ({ category, recurringExpenseId } = bill);
        billCategory = rules.find((b) => b.recurringExpenseId === recurringExpenseId)?.category ?? null;
      }
    }
    const spendCategory =
      category === "transfer"
        ? null
        : (spellings(r)
            .map((s) => spendCategoryFor(category, s, billCategory, spendRules))
            .find((tag) => tag !== null) ?? null);
    // Money from a payment app may be someone's pay or a payback, an extra charge on a
    // paid bill may not be the bill, and a charge like an ended bill may mean the cancel
    // failed: all of them wait for the household.
    let note: string | null = null;
    if (kind === "income" && fromPaymentApp(r.pfcDetailed)) note = PAYMENT_APP_NOTE;
    else if (category === "fixed") note = await extraBillChargeNote(book, recurringExpenseId, Number(amount), date);
    else if (kind === "spend" && category !== "transfer" && recurringExpenseId === null) {
      note = await endedBillChargeNote(book, spellings(r), Number(amount), date);
    }
    return insertRow({
      r, date, accountId, transferAccountId, amount, category, recurringExpenseId, spendCategory,
      needsReview: note !== null, note, rawIds: [r.id],
    });
  }

  /**
   * Find raw bank records on the hub's other mapped accounts with the opposite amount
   * and a nearby date. Counterparts may belong to another money book. A leg can pair
   * only while it is still waiting, or when its one-sided row fits this pair (fitsPair).
   */
  async function transferSides(amount: number, onDate: string, financialAccountId: number) {
    const mine = sql`${financialAccountId}::int`;
    const theirs = sql`${plaidAccounts.financialAccountId}`;
    const [from, into] = amount > 0 ? [mine, theirs] : [theirs, mine];
    const rows = await db
      .select({
        id: plaidTransactions.id,
        ledgerId: plaidTransactions.ledgerTransactionId,
        financialAccountId: plaidAccounts.financialAccountId,
        accountType: plaidAccounts.type,
        amount: plaidTransactions.amount,
        onDate: sql<string>`coalesce(${plaidTransactions.authorizedDate}, ${plaidTransactions.date})::text`,
        pfcPrimary: plaidTransactions.pfcPrimary,
        pfcDetailed: plaidTransactions.pfcDetailed,
        name: plaidTransactions.name,
        statementText: sql<string | null>`${plaidTransactions.raw}->>'original_description'`,
        free: sql<boolean>`(
          (${plaidTransactions.ledgerTransactionId} is null and ${plaidTransactions.appliedAt} is null)
          or ${fitsPair(sql`${plaidTransactions.ledgerTransactionId}`, from, into, 1)})`,
      })
      .from(plaidTransactions)
      .innerJoin(plaidAccounts, eq(plaidTransactions.plaidAccountId, plaidAccounts.id))
      .innerJoin(plaidItems, eq(plaidAccounts.plaidItemId, plaidItems.id))
      .where(
        and(
          eq(plaidItems.groupId, item.groupId),
          isNull(plaidTransactions.removedAt),
          isNull(plaidTransactions.dismissedAt),
          isNotNull(plaidAccounts.financialAccountId),
          ne(plaidAccounts.financialAccountId, financialAccountId),
          eq(plaidTransactions.amount, (-amount).toFixed(2)),
          sql`coalesce(${plaidTransactions.authorizedDate}, ${plaidTransactions.date}) between ${shiftDays(onDate, -3)} and ${shiftDays(onDate, 3)}`,
        ),
      )
      .orderBy(asc(plaidTransactions.id));
    return {
      cardPayment: rows.some((o) => o.accountType === "credit" && kindOf(o) === "skip"),
      legs: rows.filter((o) => o.accountType !== "credit" && o.free && kindOf(o) === "transfer"),
    };
  }

  /** A transfer the household already recorded (by hand, an alert or a Shortcut) for this pair, owned by no bank row. */
  async function recordedTransfer(r: Staged, date: string, bookId: number, fromId: number, intoId: number, amount: string) {
    const candidates = await db
      .select({
        id: transactions.id,
        postedOn: transactions.postedOn,
        merchant: transactions.merchant,
        originalAmount: transactions.originalAmount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.bookId, bookId),
          ne(transactions.source, "plaid"),
          // Match the original amount; refresh keeps a household-adjusted amount.
          eq(transactions.originalAmount, amount),
          or(eq(transactions.accountId, fromId), eq(transactions.transferAccountId, intoId)),
          gte(transactions.postedOn, shiftDays(date, -7)),
          lte(transactions.postedOn, shiftDays(date, 7)),
          fitsPair(sql`${transactions.id}`, sql`${fromId}::int`, sql`${intoId}::int`, 0),
        ),
      );
    return pickMatch(
      { date, amount: Number(amount), names: spellings(r) },
      candidates.filter((c) => !taken.has(c.id)).map((c) => ({ ...c, originalAmount: Number(c.originalAmount) })),
      { allowTip: false },
    );
  }

  /**
   * Money between accounts. A matching card-payment leg makes this a skipped card
   * payment. Pair two bank legs only when each has exactly one eligible counterpart;
   * the pair completes a transfer the household already recorded, the other leg's
   * one-sided row, or a new row. Otherwise, try transfer words and a hand-entered
   * transfer. If neither matches, create a one-sided row in Needs review.
   */
  async function applyTransfer(r: Staged, date: string, retried = false): Promise<void> {
    const amount = Number(r.amount);
    const abs = Math.abs(amount).toFixed(2);
    // If another sync linked this raw record, keep its ledger link. If the household
    // deleted it meanwhile, keep it deleted. Otherwise, reload eligibility and retry once.
    const lostRace = async () => {
      const [now] = await db
        .select({ ledgerId: plaidTransactions.ledgerTransactionId, dismissedAt: plaidTransactions.dismissedAt })
        .from(plaidTransactions)
        .where(eq(plaidTransactions.id, r.id));
      if (now?.dismissedAt) await markApplied(r.id, null);
      else if (now?.ledgerId == null && !retried) await applyTransfer(r, date, true);
    };
    const lost = (err: unknown) => {
      if (lostToOtherSync(err)) return null;
      throw err;
    };

    const { cardPayment, legs } = await transferSides(amount, date, r.financialAccountId!);
    if (cardPayment) {
      await markApplied(r.id, null);
      stats.skipped++;
      return;
    }

    // Pair two bank legs only when each has exactly one eligible counterpart, and the
    // other leg is not a card payment. Leave ambiguous matches in review.
    let leg = legs.length === 1 ? legs[0] : undefined;
    if (leg) {
      const back = await transferSides(Number(leg.amount), leg.onDate, leg.financialAccountId!);
      if (back.cardPayment || back.legs.length !== 1 || back.legs[0].id !== r.id) leg = undefined;
    }
    if (leg) {
      const [fromId, intoId] =
        amount > 0 ? [r.financialAccountId!, leg.financialAccountId!] : [leg.financialAccountId!, r.financialAccountId!];
      const [from] = await db
        .select({ bookId: financialAccounts.bookId })
        .from(financialAccounts)
        .where(eq(financialAccounts.id, fromId))
        .limit(1);
      const fromBook = from?.bookId ?? book.id;
      const pairAs = (ledgerId: number) =>
        db
          .update(transactions)
          .set({ category: "transfer", accountId: fromId, transferAccountId: intoId, spendCategory: null, needsReview: false, bookId: fromBook })
          .where(eq(transactions.id, ledgerId));
      const [fromSql, intoSql] = [sql`${fromId}::int`, sql`${intoId}::int`];

      if (leg.ledgerId === null) {
        // Both legs are new: complete a transfer the household already recorded before making one.
        const recorded = await recordedTransfer(r, date, fromBook, fromId, intoId, abs);
        if (recorded) {
          const done = await db
            .batch([
              db.execute(sql`select 1 from transactions where id = ${recorded.id} for update`),
              claim([r.id, leg.id], recorded.id, fitsPair(sql`${recorded.id}::int`, fromSql, intoSql, 0)),
              pairAs(recorded.id),
            ])
            .catch(lost);
          if (done === null) return lostRace();
          taken.add(recorded.id);
          handled.add(leg.id);
          await refresh(recorded.id, "transfer", r);
          stats.claimed++;
          return;
        }
        const id = await insertRow({
          r, date, accountId: fromId, transferAccountId: intoId, amount: abs,
          category: "transfer", recurringExpenseId: null, spendCategory: null, needsReview: false,
          bookId: fromBook, rawIds: [r.id, leg.id],
        });
        if (id === null) return lostRace();
        handled.add(leg.id);
        stats.inserted++;
        return;
      }

      // The other leg's one-sided row. The lock makes a competing leg or household edit
      // wait or win; the same rule is then checked again before anything changes.
      const ledgerId = leg.ledgerId;
      const paired = await db
        .batch([
          db.execute(sql`select 1 from transactions where id = ${ledgerId} for update`),
          claim([r.id], ledgerId, fitsPair(sql`${ledgerId}::int`, fromSql, intoSql, 1)),
          pairAs(ledgerId),
          // A transfer is never counted by another book.
          db.delete(transactionShares).where(eq(transactionShares.transactionId, ledgerId)),
        ])
        .catch(lost);
      if (paired === null) return lostRace();
      await refresh(ledgerId, "transfer", r);
      stats.updated++;
      return;
    }

    const byWords = asTransfer(r.name, amount.toFixed(2), r.financialAccountId, transferRules);
    if (byWords) {
      const id = await insertRow({
        r, date, accountId: byWords.accountId, transferAccountId: byWords.transferAccountId, amount: byWords.amount,
        category: "transfer", recurringExpenseId: null, spendCategory: null, needsReview: false, rawIds: [r.id],
      });
      if (id === null) return lostRace();
      stats.inserted++;
      return;
    }

    // A transfer recorded by hand: an outgoing bank row matches its source account, an incoming row its destination.
    const known = amount > 0 ? sql`account_id` : sql`transfer_account_id`;
    const handEntered = pickMatch(
      { date, amount: Number(abs), names: spellings(r) },
      pool
        .filter(
          (c) =>
            !taken.has(c.id) &&
            c.category === "transfer" &&
            (amount > 0 ? c.accountId : c.transferAccountId) === r.financialAccountId,
        )
        .map((c) => ({ ...c, originalAmount: Number(c.originalAmount) })),
      { allowTip: false },
    );
    if (handEntered) {
      // Marked taken before the claim, so a retry never picks the same row again.
      taken.add(handEntered.id);
      const id = sql`${handEntered.id}::int`;
      const done = await db
        .batch([
          db.execute(sql`select 1 from transactions where id = ${id} for update`),
          claim(
            [r.id],
            handEntered.id,
            sql`${fitsPair(id, null, null, 0)}
              and exists (select 1 from transactions where id = ${id} and ${known} = ${r.financialAccountId}::int)`,
          ),
        ])
        .catch(lost);
      if (done === null) return lostRace();
      await refresh(handEntered.id, "transfer", r);
      stats.claimed++;
      return;
    }

    const id = await insertRow({
      r, date,
      accountId: amount > 0 ? r.financialAccountId : null,
      transferAccountId: amount > 0 ? null : r.financialAccountId,
      amount: abs, category: "transfer", recurringExpenseId: null, spendCategory: null, needsReview: true,
      rawIds: [r.id],
    });
    if (id === null) return lostRace();
    stats.inserted++;
  }

  for (const r of live) {
    if (handled.has(r.id)) continue;
    // The household deleted this one; the bank's updates never bring it back.
    if (r.dismissedAt) {
      await markApplied(r.id, null);
      continue;
    }
    const kind = kindOf(r);
    const date = dateOf(r);

    if (r.ledgerTransactionId !== null) {
      await refresh(r.ledgerTransactionId, kind, r, r.splitLedgerIds);
      await markApplied(r.id, r.ledgerTransactionId, r.splitLedgerIds);
      stats.updated++;
      continue;
    }

    // A posted row takes over the entry (or parts) its pending row created or claimed.
    if (r.pendingTransactionId) {
      const [pendingRow] = await db
        .select({
          id: plaidTransactions.id,
          ledgerId: plaidTransactions.ledgerTransactionId,
          splitIds: plaidTransactions.splitLedgerIds,
          dismissedAt: plaidTransactions.dismissedAt,
        })
        .from(plaidTransactions)
        .where(eq(plaidTransactions.transactionId, r.pendingTransactionId))
        .limit(1);
      // Deleting a pending charge also deletes it once it posts.
      if (pendingRow?.dismissedAt) {
        await db
          .update(plaidTransactions)
          .set({ dismissedAt: new Date(), appliedAt: new Date(), ledgerTransactionId: null })
          .where(eq(plaidTransactions.id, r.id));
        continue;
      }
      if (pendingRow?.ledgerId) {
        await refresh(pendingRow.ledgerId, kind, r, pendingRow.splitIds);
        // One batch, so the entry is never left with no bank row owning it.
        await db.batch([
          db
            .update(plaidTransactions)
            .set({ ledgerTransactionId: null, splitLedgerIds: null })
            .where(eq(plaidTransactions.id, pendingRow.id)),
          markApplied(r.id, pendingRow.ledgerId, pendingRow.splitIds),
        ]);
        stats.updated++;
        continue;
      }
    }

    if (kind === "skip") {
      await markApplied(r.id, null);
      stats.skipped++;
      continue;
    }
    if (kind === "transfer") {
      await applyTransfer(r, date);
      continue;
    }

    const amount = Number(ledgerAmount(kind, Number(r.amount)));
    const bankFacts = { date, amount, names: spellings(r) };
    const candidates = pool
      .filter((c) => {
        if (taken.has(c.id) || c.accountId !== r.financialAccountId) return false;
        if (kind === "income") return c.category === "income";
        return c.category !== "income" && c.category !== "reimbursement" && c.category !== "transfer";
      })
      .map((c) => ({ ...c, originalAmount: Number(c.originalAmount) }));
    const match = pickMatch(bankFacts, candidates);
    if (match) {
      taken.add(match.id);
      await refresh(match.id, kind, r);
      await markApplied(r.id, match.id);
      stats.claimed++;
      continue;
    }

    // One payment the household recorded in parts claims all of them.
    const parts = kind === "spend" ? pickSplit(bankFacts, candidates) : null;
    if (parts) {
      const [primary, ...rest] = [...parts].sort((a, b) => b.originalAmount - a.originalAmount).map((p) => p.id);
      for (const id of [primary, ...rest]) taken.add(id);
      await refresh(primary, kind, r, rest);
      await markApplied(r.id, primary, rest);
      stats.claimed++;
      continue;
    }

    if ((await insertCategorized(r, kind, date)) !== null) stats.inserted++;
  }

  // Removals last, so a pending row that posted in this batch has already
  // handed its ledger entry to the posted row.
  for (const r of removedRows) {
    const covered = r.ledgerTransactionId === null ? [] : [r.ledgerTransactionId, ...(r.splitLedgerIds ?? [])];
    let dropped = false;
    for (const ledgerId of covered) {
      const [stillOwned] = await db
        .select({ id: plaidTransactions.id })
        .from(plaidTransactions)
        .where(
          and(
            isNull(plaidTransactions.removedAt),
            ne(plaidTransactions.id, r.id),
            sql`(${plaidTransactions.ledgerTransactionId} = ${ledgerId} or ${ledgerId} = any(${plaidTransactions.splitLedgerIds}))`,
          ),
        )
        .limit(1);
      if (stillOwned) continue;
      const [row] = await db
        .select({ source: transactions.source, note: transactions.note })
        .from(transactions)
        .where(eq(transactions.id, ledgerId))
        .limit(1);
      if (row?.source === "plaid") {
        await db.delete(transactions).where(eq(transactions.id, ledgerId));
      } else if (row) {
        await db
          .update(transactions)
          .set({ needsReview: true, bankStatus: null, ...(row.note ? {} : { note: DROPPED_NOTE }) })
          .where(eq(transactions.id, ledgerId));
        stats.review++;
      }
      dropped = true;
    }
    if (dropped) stats.removed++;
    await markApplied(r.id, null);
  }

  await retireSupersededPending();
  return stats;
}

/**
 * Before deleting a split part, remove its link and keep the remaining parts covered.
 * Keep an empty split list when one part remains, so refresh preserves its amount.
 * Dismiss an unsplit bank row so later updates cannot recreate the deleted transaction.
 */
export async function releaseBankLinks(ledgerId: number): Promise<void> {
  await db.execute(sql`
    update plaid_transactions
    set split_ledger_ids = array_remove(split_ledger_ids, ${ledgerId})
    where ${ledgerId} = any(split_ledger_ids)`);
  await db.execute(sql`
    update plaid_transactions
    set ledger_transaction_id = split_ledger_ids[1], split_ledger_ids = split_ledger_ids[2:]
    where ledger_transaction_id = ${ledgerId} and cardinality(split_ledger_ids) > 0`);
  await db
    .update(plaidTransactions)
    .set({ dismissedAt: new Date() })
    .where(eq(plaidTransactions.ledgerTransactionId, ledgerId));
}
