// Checks the ledger's money paths (bank import, transfer pairing, splits, alert dedupe,
// sync lease, fund adjustments, ended-bill charges) against the dev database, in a
// throwaway household that is removed at the end. It adds and drops test triggers.
//
//   npm run finance:check
import assert from "node:assert/strict";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { applyPlaidItem, releaseBankLinks } from "@/lib/plaid/apply";
import { splitTransactionForBook } from "@/lib/queries/finance-split";
import { ingestAlert, ingestStructured } from "@/lib/finance/ingest";

if (!process.env.LIVE_POSTGRES_URL || process.env.POSTGRES_URL === process.env.LIVE_POSTGRES_URL) {
  throw new Error("This check writes test data, so it runs only against the dev database.");
}

const failed: string[] = [];
let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed.push(name);
    console.log(`FAIL ${name}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

const stamp = Date.now().toString(36);
// Per-run names, so two runs at once never replace or drop each other's test triggers.
const failFn = `audit_fail_${stamp}`;
const linkTrigger = `audit_fail_link_${stamp}`;
const shareTrigger = `audit_fail_share_${stamp}`;
const slowTrigger = `audit_slow_${stamp}`;
const [group] = await db.insert(s.groups).values({ name: `Finance audit check ${stamp}`, isDemo: true }).returning();
const G = group.id;

async function cleanup() {
  await db.execute(sql.raw(`drop trigger if exists ${linkTrigger} on plaid_transactions`));
  await db.execute(sql.raw(`drop trigger if exists ${shareTrigger} on transaction_shares`));
  await db.execute(sql.raw(`drop trigger if exists ${slowTrigger} on transactions`));
  await db.execute(sql.raw(`drop function if exists ${failFn}()`));
  await db.execute(sql.raw(`drop function if exists ${slowTrigger}()`));
  await db.delete(s.groups).where(eq(s.groups.id, G));
}

try {
  const [bookA, bookB] = await db
    .insert(s.books)
    .values([{ groupId: G, name: "Home" }, { groupId: G, name: "Business" }])
    .returning();
  const A = { id: bookA.id, groupId: G };
  const acct = async (name: string, kind: string) =>
    (await db.insert(s.financialAccounts).values({ groupId: G, bookId: A.id, name, kind }).returning())[0].id;
  const checking = await acct("Checking", "checking");
  const savings = await acct("Savings", "savings");
  const card = await acct("Card", "credit");
  const brokerage = await acct("Brokerage", "investment");
  await db.insert(s.merchantCategories).values({
    groupId: G, bookId: A.id, pattern: "SUPPLY CO", category: "Supplies", flow: "out", alsoBookId: bookB.id,
  });
  const [item] = await db
    .insert(s.plaidItems)
    .values({
      groupId: G, bookId: A.id, itemId: `audit-${stamp}`, environment: "sandbox", accessTokenEnc: "x",
      institutionName: "Audit Bank", syncFrom: "2026-01-01",
    })
    .returning();
  const pacct = async (financialAccountId: number, type: string) =>
    (
      await db
        .insert(s.plaidAccounts)
        .values({ plaidItemId: item.id, accountId: `audit-${stamp}-${financialAccountId}`, financialAccountId, name: "x", type })
        .returning()
    )[0].id;
  const pChecking = await pacct(checking, "depository");
  const pSavings = await pacct(savings, "depository");
  const pCard = await pacct(card, "credit");
  const pBrokerage = await pacct(brokerage, "depository");
  // A second bank, in the other book, for transfers that arrive through two syncs at once.
  const [creditUnion] = await db
    .insert(s.financialAccounts)
    .values({ groupId: G, bookId: bookB.id, name: "Credit union", kind: "savings" })
    .returning();
  const [item2] = await db
    .insert(s.plaidItems)
    .values({
      groupId: G, bookId: bookB.id, itemId: `audit-${stamp}-2`, environment: "sandbox", accessTokenEnc: "x",
      institutionName: "Audit Credit Union", syncFrom: "2026-01-01",
    })
    .returning();
  const [pCreditUnionRow] = await db
    .insert(s.plaidAccounts)
    .values({ plaidItemId: item2.id, accountId: `audit-${stamp}-cu`, financialAccountId: creditUnion.id, name: "x", type: "depository" })
    .returning();
  const pCreditUnion = pCreditUnionRow.id;

  type Raw = typeof s.plaidTransactions.$inferSelect;
  type Txn = typeof s.transactions.$inferSelect;
  let outRaw = {} as Raw;
  let m = {} as Txn;
  let part = {} as Txn;
  let mBank = {} as Raw;
  let n = 0;
  const raw = async (plaidAccountId: number, amount: string, pfcPrimary: string, name: string, date: string, pfcDetailed: string | null = null) =>
    (
      await db
        .insert(s.plaidTransactions)
        .values({
          plaidAccountId, transactionId: `audit-${stamp}-${++n}`, pending: false, amount, date, name,
          merchantName: name, pfcPrimary, pfcDetailed, raw: {},
        })
        .returning()
    )[0];
  const rawRow = async (id: number) => (await db.select().from(s.plaidTransactions).where(eq(s.plaidTransactions.id, id)))[0];
  const ledger = async (id: number) => (await db.select().from(s.transactions).where(eq(s.transactions.id, id)))[0];
  const groupRows = async (merchant: string) =>
    db.select().from(s.transactions).where(and(eq(s.transactions.groupId, G), eq(s.transactions.merchant, merchant)));

  // F01: a failed bank link saves nothing, and the retry saves exactly one row with its share.
  await check('F01: a failed bank link saves nothing, and the retry saves exactly one row with its share.', async () => {
    await db.execute(sql.raw(`create function ${failFn}() returns trigger language plpgsql as $$
      begin raise exception 'audit: injected failure'; end $$`));
    const f01 = await raw(pChecking, "25.00", "GENERAL_MERCHANDISE", "SUPPLY CO", "2026-11-02");
    await db.execute(sql.raw(`create trigger ${linkTrigger} before update on plaid_transactions
      for each row when (new.transaction_id = '${f01.transactionId}' and new.ledger_transaction_id is not null)
      execute function ${failFn}()`));
    try {
      await assert.rejects(applyPlaidItem(item.id));
    } finally {
      await db.execute(sql.raw(`drop trigger ${linkTrigger} on plaid_transactions`));
    }
    assert.equal((await groupRows("SUPPLY CO")).length, 0, "no row after a failed link");
    await applyPlaidItem(item.id);
    await db.update(s.plaidTransactions).set({ appliedAt: null }).where(eq(s.plaidTransactions.id, f01.id));
    await applyPlaidItem(item.id);
    const f01Rows = await groupRows("SUPPLY CO");
    assert.equal(f01Rows.length, 1, "one row after retry and refresh");
    assert.equal((await rawRow(f01.id)).ledgerTransactionId, f01Rows[0].id);
    const f01Shares = await db.select().from(s.transactionShares).where(eq(s.transactionShares.transactionId, f01Rows[0].id));
    assert.deepEqual(f01Shares.map((x) => x.bookId), [bookB.id]);
  });

  // F02a: a transfer in never rewrites an unrelated purchase of the same size.
  await check('F02a: a transfer in never rewrites an unrelated purchase of the same size.', async () => {
    const buy = await raw(pSavings, "100.00", "GENERAL_MERCHANDISE", "Hardware", "2026-11-03");
    await applyPlaidItem(item.id);
    const buyLedger = (await rawRow(buy.id)).ledgerTransactionId!;
    const tin = await raw(pChecking, "-100.00", "TRANSFER_IN", "Transfer from friend", "2026-11-04");
    await applyPlaidItem(item.id);
    assert.equal((await ledger(buyLedger)).category, "discretionary");
    const tinRow = await ledger((await rawRow(tin.id)).ledgerTransactionId!);
    assert.equal(tinRow.category, "transfer");
    assert.notEqual(tinRow.id, buyLedger);
    assert.equal(tinRow.needsReview, true);
  });

  // F02b: two real legs still make one transfer row.
  await check('F02b: two real legs still make one transfer row.', async () => {
    const out = await raw(pChecking, "300.00", "TRANSFER_OUT", "Online transfer to savings", "2026-11-05");
    const into = await raw(pSavings, "-300.00", "TRANSFER_IN", "Online transfer from checking", "2026-11-05");
    await applyPlaidItem(item.id);
    outRaw = await rawRow(out.id);
    const intoRaw = await rawRow(into.id);
    assert.ok(outRaw.ledgerTransactionId);
    assert.equal(outRaw.ledgerTransactionId, intoRaw.ledgerTransactionId);
    const pair = await ledger(outRaw.ledgerTransactionId!);
    assert.deepEqual([pair.accountId, pair.transferAccountId, pair.category], [checking, savings, "transfer"]);
  });

  // F02c: a refund on the card does not hide a transfer; a card payment still does.
  await check('F02c: a refund on the card does not hide a transfer; a card payment still does.', async () => {
    const x = await raw(pChecking, "75.00", "TRANSFER_OUT", "Transfer to brokerage", "2026-11-06");
    await raw(pCard, "-75.00", "GENERAL_MERCHANDISE", "Store refund", "2026-11-06");
    const y = await raw(pChecking, "80.00", "TRANSFER_OUT", "Transfer to card", "2026-11-07");
    await raw(pCard, "-80.00", "LOAN_PAYMENTS", "Payment Thank You", "2026-11-07");
    await applyPlaidItem(item.id);
    assert.ok((await rawRow(x.id)).ledgerTransactionId, "transfer recorded despite a card refund");
    const yRaw = await rawRow(y.id);
    assert.equal(yRaw.ledgerTransactionId, null);
    assert.ok(yRaw.appliedAt);
  });

  // F02d: a pair already made is not taken by a third leg.
  await check('F02d: a pair already made is not taken by a third leg.', async () => {
    const third = await raw(pBrokerage, "-300.00", "TRANSFER_IN", "Transfer in", "2026-11-06");
    await applyPlaidItem(item.id);
    const pairAfter = await ledger(outRaw.ledgerTransactionId!);
    assert.deepEqual([pairAfter.accountId, pairAfter.transferAccountId], [checking, savings]);
    const thirdLedger = (await rawRow(third.id)).ledgerTransactionId;
    assert.ok(thirdLedger && thirdLedger !== outRaw.ledgerTransactionId);
  });

  // F03 and F05: concurrent splits keep the total; parts keep the other book's share and tag.
  await check('F03 and F05: concurrent splits keep the total; parts keep the other books share and tag.', async () => {
    [m] = await db
      .insert(s.transactions)
      .values({
        groupId: G, bookId: A.id, accountId: checking, postedOn: "2026-11-10", merchant: "Office Mart",
        amount: "100.00", originalAmount: "100.00", category: "discretionary", source: "manual",
      })
      .returning();
    await db.insert(s.transactionShares).values({ transactionId: m.id, bookId: bookB.id, spendCategory: "Office" });
    mBank = await raw(pChecking, "100.00", "GENERAL_MERCHANDISE", "Office Mart", "2026-11-10");
    await db
      .update(s.plaidTransactions)
      .set({ ledgerTransactionId: m.id, appliedAt: new Date() })
      .where(eq(s.plaidTransactions.id, mBank.id));
    const parts = [
      { amount: 60, category: "discretionary" },
      { amount: 40, category: "discretionary", spendCategory: "Paper" },
    ];
    const settled = await Promise.allSettled([
      splitTransactionForBook(A, m.id, parts),
      splitTransactionForBook(A, m.id, parts),
    ]);
    assert.deepEqual(settled.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
    const mRows = await groupRows("Office Mart");
    assert.equal(mRows.reduce((t, r) => t + Number(r.amount), 0), 100);
    assert.equal(mRows.length, 2);
    part = mRows.find((r) => r.id !== m.id)!;
    const partShares = await db.select().from(s.transactionShares).where(eq(s.transactionShares.transactionId, part.id));
    assert.deepEqual(partShares.map((x) => [x.bookId, x.spendCategory]), [[bookB.id, "Office"]]);
    assert.deepEqual((await rawRow(mBank.id)).splitLedgerIds, [part.id]);
  });

  // F03: a failure inside the split changes nothing.
  await check('F03: a failure inside the split changes nothing.', async () => {
    const [m2] = await db
      .insert(s.transactions)
      .values({
        groupId: G, bookId: A.id, accountId: checking, postedOn: "2026-11-11", merchant: "Print Shop",
        amount: "50.00", originalAmount: "50.00", category: "discretionary", source: "manual",
      })
      .returning();
    await db.insert(s.transactionShares).values({ transactionId: m2.id, bookId: bookB.id, spendCategory: "Print" });
    // Only shares into this run's test book fail, never another household's.
    await db.execute(sql.raw(`create trigger ${shareTrigger} before insert on transaction_shares
      for each row when (new.book_id = ${bookB.id}) execute function ${failFn}()`));
    try {
      await assert.rejects(splitTransactionForBook(A, m2.id, [{ amount: 30, category: "discretionary" }, { amount: 20, category: "discretionary" }]));
    } finally {
      await db.execute(sql.raw(`drop trigger ${shareTrigger} on transaction_shares`));
    }
    const m2Rows = await groupRows("Print Shop");
    assert.deepEqual(m2Rows.map((r) => r.amount), ["50.00"]);
  });

  // F06: the remap reads every part of a split.
  await check('F06: the remap reads every part of a split.', async () => {
    const imported = await db
      .select({ id: sql<number>`unnest(${s.plaidTransactions.ledgerTransactionId} || coalesce(${s.plaidTransactions.splitLedgerIds}, '{}'))` })
      .from(s.plaidTransactions)
      .where(and(eq(s.plaidTransactions.id, mBank.id), isNotNull(s.plaidTransactions.ledgerTransactionId)));
    assert.deepEqual(imported.map((r) => r.id).sort(), [m.id, part.id].sort());
  });

  // F04: deleting a part keeps the survivor's amount through the next bank update.
  await check('F04: deleting a part keeps the survivors amount through the next bank update.', async () => {
    await releaseBankLinks(part.id);
    await db.delete(s.transactions).where(eq(s.transactions.id, part.id));
    assert.deepEqual((await rawRow(mBank.id)).splitLedgerIds, []);
    await db.update(s.plaidTransactions).set({ appliedAt: null }).where(eq(s.plaidTransactions.id, mBank.id));
    await applyPlaidItem(item.id);
    assert.equal((await ledger(m.id)).amount, "60.00");
    assert.deepEqual((await rawRow(mBank.id)).splitLedgerIds, []);
  });

  // F07 and F08: deliveries at the same moment save once; another account saves its own.
  await check('F07 and F08: deliveries at the same moment save once; another account saves its own.', async () => {
    const input = { amount: "12.34", merchant: "Corner Cafe", date: "2026-11-12" };
    const [r1, r2] = await Promise.all([ingestStructured(A, input, checking), ingestStructured(A, input, checking)]);
    assert.ok(r1.ok && r2.ok);
    assert.equal(r1.id, r2.id);
    assert.deepEqual([r1.deduped, r2.deduped].sort(), [false, true]);
    const r3 = await ingestStructured(A, input, savings);
    assert.ok(r3.ok && !r3.deduped && r3.id !== r1.id);
    assert.equal((await groupRows("Corner Cafe")).length, 2);
    const text = "Chase: You made a $9.87 transaction with Bagel Barn on Nov 12, 2026 at 8:01 AM ET.";
    const [a1, a2] = await Promise.all([ingestAlert(A, text, checking), ingestAlert(A, text, checking)]);
    assert.ok(a1.ok && a2.ok);
    assert.equal(a1.id, a2.id);
    const supply = await ingestStructured(A, { amount: "5.00", merchant: "SUPPLY CO", date: "2026-11-12" }, checking);
    assert.ok(supply.ok);
    const supplyShares = await db.select().from(s.transactionShares).where(eq(s.transactionShares.transactionId, supply.id));
    assert.deepEqual(supplyShares.map((x) => x.bookId), [bookB.id]);
  });

  // F09: a run releases only its own lease, compared to the microsecond.
  await check('F09: a run releases only its own lease, compared to the microsecond.', async () => {
    const take = () =>
      db
        .update(s.plaidItems)
        .set({ syncLockedUntil: sql`now() + interval '6 minutes'` })
        .where(and(eq(s.plaidItems.id, item.id), sql`(${s.plaidItems.syncLockedUntil} is null or ${s.plaidItems.syncLockedUntil} < now())`))
        .returning({ until: sql<string>`${s.plaidItems.syncLockedUntil}::text` });
    const release = (until: string) =>
      db
        .update(s.plaidItems)
        .set({ syncLockedUntil: null })
        .where(and(eq(s.plaidItems.id, item.id), sql`${s.plaidItems.syncLockedUntil} = ${until}::timestamptz`))
        .returning({ id: s.plaidItems.id });
    const [first] = await take();
    await db.update(s.plaidItems).set({ syncLockedUntil: sql`now() - interval '1 second'` }).where(eq(s.plaidItems.id, item.id));
    const [second] = await take();
    assert.equal((await release(first.until)).length, 0, "an expired run does not clear the new lease");
    assert.equal((await take()).length, 0, "a third run waits");
    assert.equal((await release(second.until)).length, 1, "the holder releases its own lease");
  });

  // Ended bill: a charge after the cancel waits in review; the bill's own month and other charges do not.
  await check("Review P1: two banks syncing at once record one transfer", async () => {
    // Slow every new test-household row, so both syncs read before either saves.
    await db.execute(sql.raw(`create function ${slowTrigger}() returns trigger language plpgsql as $$
      begin perform pg_sleep(1.5); return new; end $$`));
    await db.execute(sql.raw(`create trigger ${slowTrigger} before insert on transactions
      for each row when (new.group_id = ${G}) execute function ${slowTrigger}()`));
    try {
      const out = await raw(pChecking, "500.00", "TRANSFER_OUT", "Transfer to credit union", "2026-11-14");
      const into = await raw(pCreditUnion, "-500.00", "TRANSFER_IN", "Transfer from checking", "2026-11-14");
      await Promise.all([applyPlaidItem(item.id), applyPlaidItem(item2.id)]);
      const rows = await db
        .select()
        .from(s.transactions)
        .where(and(eq(s.transactions.groupId, G), eq(s.transactions.amount, "500.00"), eq(s.transactions.category, "transfer")));
      assert.equal(rows.length, 1, "one transfer row, not two");
      const [outRow, intoRow] = [await rawRow(out.id), await rawRow(into.id)];
      assert.deepEqual([outRow.ledgerTransactionId, intoRow.ledgerTransactionId], [rows[0].id, rows[0].id]);
      assert.deepEqual([rows[0].accountId, rows[0].transferAccountId], [checking, creditUnion.id]);
    } finally {
      await db.execute(sql.raw(`drop trigger ${slowTrigger} on transactions`));
      await db.execute(sql.raw(`drop function ${slowTrigger}()`));
    }
  });

  const transfersOf = (amount: string) =>
    db
      .select()
      .from(s.transactions)
      .where(and(eq(s.transactions.groupId, G), eq(s.transactions.amount, amount), eq(s.transactions.category, "transfer")));
  const recorded = async (
    bookId: number, accountId: number, transferAccountId: number, amount: string, postedOn: string, originalAmount = amount,
  ) =>
    (
      await db
        .insert(s.transactions)
        .values({
          groupId: G, bookId, accountId, transferAccountId, postedOn, merchant: "Transfer", amount, originalAmount,
          category: "transfer", source: "manual",
        })
        .returning()
    )[0];

  await check("Review 2 P1: two new bank legs complete a transfer already recorded, in the same book or another", async () => {
    const same = await recorded(A.id, checking, savings, "900.00", "2026-11-20");
    const out = await raw(pChecking, "900.00", "TRANSFER_OUT", "Online transfer to savings", "2026-11-20");
    const into = await raw(pSavings, "-900.00", "TRANSFER_IN", "Online transfer from checking", "2026-11-20");
    await applyPlaidItem(item.id);
    assert.deepEqual((await transfersOf("900.00")).map((t) => t.id), [same.id], "one transfer, the recorded one");
    assert.deepEqual([(await rawRow(out.id)).ledgerTransactionId, (await rawRow(into.id)).ledgerTransactionId], [same.id, same.id]);

    // Money left the credit union (the other book), so the recorded transfer lives there.
    const cross = await recorded(bookB.id, creditUnion.id, checking, "950.00", "2026-11-21");
    const cuOut = await raw(pCreditUnion, "950.00", "TRANSFER_OUT", "Transfer to checking", "2026-11-21");
    const chIn = await raw(pChecking, "-950.00", "TRANSFER_IN", "Transfer from credit union", "2026-11-21");
    await applyPlaidItem(item.id);
    assert.deepEqual((await transfersOf("950.00")).map((t) => t.id), [cross.id]);
    assert.deepEqual([(await rawRow(cuOut.id)).ledgerTransactionId, (await rawRow(chIn.id)).ledgerTransactionId], [cross.id, cross.id]);
  });

  await check("Review 3 P1: a recorded transfer the household adjusted still takes both bank legs", async () => {
    const adjusted = await recorded(A.id, checking, savings, "1380.00", "2026-11-19", "1400.00");
    const out = await raw(pChecking, "1400.00", "TRANSFER_OUT", "Online transfer to savings", "2026-11-19");
    const into = await raw(pSavings, "-1400.00", "TRANSFER_IN", "Online transfer from checking", "2026-11-19");
    await applyPlaidItem(item.id);
    assert.deepEqual([(await rawRow(out.id)).ledgerTransactionId, (await rawRow(into.id)).ledgerTransactionId], [adjusted.id, adjusted.id]);
    assert.equal((await transfersOf("1400.00")).length, 0, "no second transfer");
    const after = await ledger(adjusted.id);
    assert.deepEqual([after.amount, after.originalAmount], ["1380.00", "1400.00"], "the adjustment stays");
  });

  await check("Review 3 P2: one bank leg takes a hand-entered transfer only on its own side", async () => {
    const manual = await recorded(A.id, checking, savings, "1500.00", "2026-11-27");
    // Money into Checking is not the transfer that left Checking.
    const wrongSide = await raw(pChecking, "-1500.00", "TRANSFER_IN", "Transfer in", "2026-11-27");
    await applyPlaidItem(item.id);
    const wrongRow = (await rawRow(wrongSide.id)).ledgerTransactionId!;
    assert.notEqual(wrongRow, manual.id);
    assert.equal((await ledger(wrongRow)).needsReview, true, "the wrong-side leg waits in review");
    const rightSide = await raw(pSavings, "-1500.00", "TRANSFER_IN", "Transfer in", "2026-11-27");
    await applyPlaidItem(item.id);
    assert.equal((await rawRow(rightSide.id)).ledgerTransactionId, manual.id, "money into Savings takes it");
  });

  await check("Review 3 P2: a household edit made during the sync keeps a hand-entered transfer", async () => {
    const manual = await recorded(A.id, checking, savings, "1600.00", "2026-11-29");
    // An earlier purchase saves slowly, so the household edit lands after the sync read the transfer.
    await raw(pChecking, "16.00", "GENERAL_MERCHANDISE", "Slow Coffee", "2026-11-28");
    const into = await raw(pSavings, "-1600.00", "TRANSFER_IN", "Transfer in", "2026-11-29");
    await db.execute(sql.raw(`create function ${slowTrigger}() returns trigger language plpgsql as $$
      begin perform pg_sleep(1.5); return new; end $$`));
    await db.execute(sql.raw(`create trigger ${slowTrigger} before insert on transactions
      for each row when (new.group_id = ${G}) execute function ${slowTrigger}()`));
    try {
      const sync = applyPlaidItem(item.id);
      await new Promise((done) => setTimeout(done, 500));
      await db.update(s.transactions).set({ transferAccountId: brokerage }).where(eq(s.transactions.id, manual.id));
      await sync;
    } finally {
      await db.execute(sql.raw(`drop trigger ${slowTrigger} on transactions`));
      await db.execute(sql.raw(`drop function ${slowTrigger}()`));
    }
    const intoRow = (await rawRow(into.id)).ledgerTransactionId!;
    assert.notEqual(intoRow, manual.id, "the edited transfer is not taken");
    assert.equal((await ledger(intoRow)).needsReview, true, "the leg waits in review");
    assert.equal((await ledger(manual.id)).transferAccountId, brokerage, "the household edit stays");
  });

  await check("Review 2 P2: a household edit to a one-sided transfer is never overwritten", async () => {
    // Re-filed as spending.
    const lone = await raw(pSavings, "-1000.00", "TRANSFER_IN", "Transfer in", "2026-11-22");
    await applyPlaidItem(item.id);
    const refiled = (await rawRow(lone.id)).ledgerTransactionId!;
    await db.update(s.transactions).set({ category: "discretionary", spendCategory: "Gifts" }).where(eq(s.transactions.id, refiled));
    const later = await raw(pChecking, "1000.00", "TRANSFER_OUT", "Transfer out", "2026-11-22");
    await applyPlaidItem(item.id);
    assert.deepEqual([(await ledger(refiled)).category, (await ledger(refiled)).spendCategory], ["discretionary", "Gifts"]);
    assert.notEqual((await rawRow(later.id)).ledgerTransactionId, refiled);

    // Completed by hand as brokerage → savings.
    const lone2 = await raw(pSavings, "-1100.00", "TRANSFER_IN", "Transfer in", "2026-11-23");
    await applyPlaidItem(item.id);
    const completed = (await rawRow(lone2.id)).ledgerTransactionId!;
    await db.update(s.transactions).set({ accountId: brokerage, needsReview: false }).where(eq(s.transactions.id, completed));
    const later2 = await raw(pChecking, "1100.00", "TRANSFER_OUT", "Transfer out", "2026-11-23");
    await applyPlaidItem(item.id);
    assert.deepEqual([(await ledger(completed)).accountId, (await ledger(completed)).transferAccountId], [brokerage, savings]);
    assert.notEqual((await rawRow(later2.id)).ledgerTransactionId, completed);
  });

  await check("Review 2 P2: a leg skipped as a card payment never pairs later", async () => {
    const pay = await raw(pChecking, "1300.00", "TRANSFER_OUT", "Payment to card", "2026-11-24");
    await raw(pCard, "-1300.00", "LOAN_PAYMENTS", "Payment Thank You", "2026-11-24");
    await applyPlaidItem(item.id);
    assert.equal((await rawRow(pay.id)).ledgerTransactionId, null);
    const deposit = await raw(pSavings, "-1300.00", "TRANSFER_IN", "Transfer in", "2026-11-25");
    await applyPlaidItem(item.id);
    assert.equal((await rawRow(pay.id)).ledgerTransactionId, null, "the card payment stays skipped");
    const row = await ledger((await rawRow(deposit.id)).ledgerTransactionId!);
    assert.deepEqual([row.accountId, row.transferAccountId, row.needsReview], [null, savings, true], "the deposit waits in review");
  });

  await check("Review 2 P2: bank rows deleted while a sync is saving them stay deleted", async () => {
    await db.execute(sql.raw(`create function ${slowTrigger}() returns trigger language plpgsql as $$
      begin perform pg_sleep(1.5); return new; end $$`));
    await db.execute(sql.raw(`create trigger ${slowTrigger} before insert on transactions
      for each row when (new.group_id = ${G}) execute function ${slowTrigger}()`));
    try {
      const out = await raw(pChecking, "1200.00", "TRANSFER_OUT", "Transfer to savings", "2026-11-26");
      const into = await raw(pSavings, "-1200.00", "TRANSFER_IN", "Transfer from checking", "2026-11-26");
      const sync = applyPlaidItem(item.id);
      // While the sync is saving, another sync saved the pair and the household deleted it.
      await new Promise((done) => setTimeout(done, 500));
      await db.update(s.plaidTransactions).set({ dismissedAt: new Date() }).where(inArray(s.plaidTransactions.id, [out.id, into.id]));
      await sync;
      assert.equal((await transfersOf("1200.00")).length, 0, "nothing recreated");
      const [o, i] = [await rawRow(out.id), await rawRow(into.id)];
      assert.deepEqual([o.ledgerTransactionId, i.ledgerTransactionId], [null, null]);
      assert.ok(o.dismissedAt && i.dismissedAt);
    } finally {
      await db.execute(sql.raw(`drop trigger ${slowTrigger} on transactions`));
      await db.execute(sql.raw(`drop function ${slowTrigger}()`));
    }
  });

  await check("Review P2: an ambiguous transfer stays in review in either order", async () => {
    // One out, two in: the out leg has two partners, so nothing pairs.
    const o = await raw(pChecking, "700.00", "TRANSFER_OUT", "Transfer out", "2026-11-16");
    const i1 = await raw(pSavings, "-700.00", "TRANSFER_IN", "Transfer in", "2026-11-16");
    const i2 = await raw(pBrokerage, "-700.00", "TRANSFER_IN", "Transfer in", "2026-11-16");
    await applyPlaidItem(item.id);
    const first = await Promise.all([o, i1, i2].map(async (r) => (await rawRow(r.id)).ledgerTransactionId));
    assert.equal(new Set(first).size, 3, "three separate rows");
    for (const id of first) assert.equal((await ledger(id!)).needsReview, true);
    // The same with the two in legs arriving before the out leg.
    const j1 = await raw(pSavings, "-800.00", "TRANSFER_IN", "Transfer in", "2026-11-17");
    const j2 = await raw(pBrokerage, "-800.00", "TRANSFER_IN", "Transfer in", "2026-11-17");
    const p = await raw(pChecking, "800.00", "TRANSFER_OUT", "Transfer out", "2026-11-18");
    await applyPlaidItem(item.id);
    const second = await Promise.all([j1, j2, p].map(async (r) => (await rawRow(r.id)).ledgerTransactionId));
    assert.equal(new Set(second).size, 3, "three separate rows");
    for (const id of second) assert.equal((await ledger(id!)).needsReview, true);
  });

  await check('Ended bill: a charge after canceling waits in review with a note', async () => {
    await db.insert(s.recurringExpenses).values({
      groupId: G, bookId: A.id, name: "Spectrum", amount: "150.00", paymentsPerYear: 12, merchantPatterns: ["SPECTRUM"],
      category: "Utilities", startDate: "2026-01-01", endDate: "2026-10-20",
    });
    const [nf1] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: A.id, name: "Netflix", amount: "15.49", merchantPatterns: ["NETFLIX"], startDate: "2026-01-01", endDate: "2026-09-30" })
      .returning();
    await db.insert(s.recurringExpenses).values({
      groupId: G, bookId: A.id, name: "Netflix", amount: "17.99", merchantPatterns: ["NETFLIX"], startDate: "2026-10-01", seriesId: nf1.id,
    });
    const onEnd = await raw(pChecking, "150.00", "RENT_AND_UTILITIES", "SPECTRUM", "2026-10-20");
    const after = await raw(pChecking, "150.00", "RENT_AND_UTILITIES", "SPECTRUM", "2026-11-20");
    const small = await raw(pChecking, "9.99", "GENERAL_MERCHANDISE", "SPECTRUM STORE", "2026-11-20");
    const netflix = await raw(pChecking, "17.99", "ENTERTAINMENT", "NETFLIX", "2026-11-05");
    await applyPlaidItem(item.id);
    const row = async (r: Raw) => ledger((await rawRow(r.id)).ledgerTransactionId!);
    const [endRow, afterRow, smallRow, netflixRow] = [await row(onEnd), await row(after), await row(small), await row(netflix)];
    assert.deepEqual([endRow.category, endRow.needsReview], ["fixed", false], "the end day is still the bill");
    assert.equal(afterRow.needsReview, true);
    assert.match(afterRow.note ?? "", /You ended Spectrum on Oct 20, 2026/);
    assert.equal(smallRow.needsReview, false, "a different-size charge is not flagged");
    assert.deepEqual([netflixRow.category, netflixRow.needsReview], ["fixed", false], "a price change is not a cancel");
    const viaShortcut = await ingestStructured(A, { amount: "150.00", merchant: "SPECTRUM", date: "2026-11-21" }, checking);
    assert.ok(viaShortcut.ok && !viaShortcut.deduped && viaShortcut.needsReview);
    const viaAlert = await ingestAlert(A, "Chase: You made a $150.00 transaction with SPECTRUM on Nov 22, 2026 at 8:01 AM ET.", checking);
    assert.ok(viaAlert.ok && !viaAlert.deduped && viaAlert.needsReview && viaAlert.category !== "review", "parsed, then flagged");
    assert.match((await ledger(viaAlert.id)).note ?? "", /You ended Spectrum/);
    const late = await ingestStructured(A, { amount: "150.00", merchant: "SPECTRUM", date: "2027-11-25" }, checking);
    assert.ok(late.ok && !late.deduped && !late.needsReview, "more than a year later is a new purchase");
    // Only the last version counts: $100 through Sep 30, then $200 until the cancel on Oct 20.
    const [cox1] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: A.id, name: "Cox", amount: "100.00", merchantPatterns: ["COX CABLE"], startDate: "2026-01-01", endDate: "2026-09-30" })
      .returning();
    await db.insert(s.recurringExpenses).values({
      groupId: G, bookId: A.id, name: "Cox", amount: "200.00", merchantPatterns: ["COX CABLE"], startDate: "2026-10-01", endDate: "2026-10-20", seriesId: cox1.id,
    });
    const oldPrice = await ingestStructured(A, { amount: "100.00", merchant: "COX CABLE", date: "2026-11-20" }, checking);
    assert.ok(oldPrice.ok && !oldPrice.deduped && !oldPrice.needsReview, "an old price is not the canceled bill");
    const lastPrice = await ingestStructured(A, { amount: "200.00", merchant: "COX CABLE", date: "2026-11-20" }, checking);
    assert.ok(lastPrice.ok && !lastPrice.deduped && lastPrice.needsReview);
    assert.match((await ledger(lastPrice.id)).note ?? "", /You ended Cox on Oct 20, 2026/);
    // A price replacement can start the same day as the version it replaces; the later one is last.
    const [vz1] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: A.id, name: "Verizon", amount: "100.00", merchantPatterns: ["VERIZON"], startDate: "2026-11-01", endDate: "2026-11-01" })
      .returning();
    await db.insert(s.recurringExpenses).values({
      groupId: G, bookId: A.id, name: "Verizon", amount: "200.00", merchantPatterns: ["VERIZON"], startDate: "2026-11-01", endDate: "2026-11-18", seriesId: vz1.id,
    });
    const sameDayOld = await ingestStructured(A, { amount: "100.00", merchant: "VERIZON", date: "2026-12-01" }, checking);
    assert.ok(sameDayOld.ok && !sameDayOld.deduped && !sameDayOld.needsReview, "the replaced same-day price is not the canceled bill");
    const sameDayLast = await ingestStructured(A, { amount: "200.00", merchant: "VERIZON", date: "2026-12-01" }, checking);
    assert.ok(sameDayLast.ok && !sameDayLast.deduped && sameDayLast.needsReview);
    assert.match((await ledger(sameDayLast.id)).note ?? "", /You ended Verizon on Nov 18, 2026/);
  });

  // F11: two adjustments at once both count.
  await check('F11: two adjustments at once both count.', async () => {
    const [fund] = await db.insert(s.funds).values({ groupId: G, bookId: A.id, name: "Trip", startingBalance: "0.00" }).returning();
    const adjust = (amount: string) =>
      db.update(s.funds).set({ startingBalance: sql`${s.funds.startingBalance} + ${amount}` }).where(eq(s.funds.id, fund.id));
    await Promise.all([adjust("100.00"), adjust("100.00"), adjust("-30.00")]);
    assert.equal((await db.select().from(s.funds).where(eq(s.funds.id, fund.id)))[0].startingBalance, "170.00");
  });

} finally {
  await cleanup();
  const left = await db.select({ id: s.groups.id }).from(s.groups).where(eq(s.groups.id, G));
  console.log(left.length ? "CLEANUP FAILED" : "Cleanup done: the test household is gone.");
}
console.log(`\n${passed} passed, ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
