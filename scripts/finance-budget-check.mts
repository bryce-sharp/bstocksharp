// Checks the budget and report rules (ended bills, review rows, deactivated people,
// partly logged months, the month verdict, account income) against the dev database,
// in a throwaway household that is removed at the end.
//
//   node --env-file=.env.local --import ./scripts/node-hooks.mjs scripts/finance-budget-check.mts
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getBudgetMonthForBook } from "@/lib/queries/finance-budget";
import { getAtlasViewForBook } from "@/lib/queries/finance-atlas";
import { getNetWorthDashboardForBook } from "@/lib/queries/finance-networth";
import { buildMonthReport } from "@/lib/finance/month-report";

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
const [group] = await db.insert(s.groups).values({ name: `Finance budget check ${stamp}`, isDemo: true }).returning();
const G = group.id;

try {
  const [bookRow] = await db.insert(s.books).values({ groupId: G, name: "Home" }).returning();
  const book = { id: bookRow.id, groupId: G };
  const [checking] = await db
    .insert(s.financialAccounts)
    .values({ groupId: G, bookId: book.id, name: "Checking", kind: "checking" })
    .returning();
  const [savings] = await db
    .insert(s.financialAccounts)
    .values({ groupId: G, bookId: book.id, name: "Savings", kind: "savings" })
    .returning();
  const txn = (values: Partial<typeof s.transactions.$inferInsert> & { postedOn: string; amount: string; category: string }) =>
    db
      .insert(s.transactions)
      .values({ groupId: G, bookId: book.id, accountId: checking.id, source: "manual", originalAmount: values.amount, ...values })
      .returning();

  await check("F12: an ended bill plans $0 after it ends, and its payment still comes out of spending", async () => {
    const [paid] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: book.id, name: "Spectrum", amount: "100.00", startDate: "2026-01-01", endDate: "2026-11-15" })
      .returning();
    await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: book.id, name: "Gym", amount: "40.00", startDate: "2026-01-01", endDate: "2026-11-15" });
    await txn({ postedOn: "2026-11-05", amount: "100.00", category: "fixed", recurringExpenseId: paid.id, merchant: "SPECTRUM" });

    const nov = await getBudgetMonthForBook(book, "2026-11-01", "2026-11-20");
    const atlasNov = await getAtlasViewForBook(book, "2026-11", "2026-11-20");
    assert.equal(atlasNov.expenses.length, 0, "ATLAS leaves both ended bills out on Nov 20");
    const rows = nov.computation.fixed.rows;
    assert.deepEqual(
      rows.map((r) => [r.name, r.expectedC, r.actualC, r.deltaC]),
      [["Spectrum", 0, 10000, -10000]],
      "the paid ended bill plans $0 and subtracts what was paid; the unpaid one is gone",
    );
    assert.equal(nov.computation.discretionary.budgetC, nov.computation.discretionary.baseBudgetC - 10000);

    const oct = await getBudgetMonthForBook(book, "2026-10-01", "2026-11-20");
    assert.deepEqual(
      oct.computation.fixed.rows.map((r) => [r.name, r.expectedC]).sort(),
      [["Gym", 4000], ["Spectrum", 10000]],
      "a month before the end keeps both bills",
    );
  });

  await check("F13: a row in review never counts in a later month", async () => {
    const [fund] = await db
      .insert(s.funds)
      .values({ groupId: G, bookId: book.id, name: "Trip", startingBalance: "1000.00" })
      .returning();
    await txn({ postedOn: "2026-06-10", amount: "100.00", category: "fund", fundId: fund.id, needsReview: true, merchant: "Hotel" });
    const july = await getBudgetMonthForBook(book, "2026-07-01", "2026-11-20");
    assert.equal(july.computation.funds.find((f) => f.id === fund.id)?.balanceC, 100000);
  });

  await check("F14: a deactivated person's pay stays in past months and leaves later ones", async () => {
    const [person] = await db
      .insert(s.profiles)
      .values({ groupId: G, name: "Casey", archivedAt: new Date("2026-11-10T12:00:00Z") })
      .returning();
    await db.insert(s.compensationPlans).values({
      profileId: person.id, bookId: book.id, payFrequency: "semimonthly", grossPerPaycheck: "1000.00", startDate: "2026-01-01",
    });
    const june = await getAtlasViewForBook(book, "2026-06", "2026-12-05");
    const nov = await getAtlasViewForBook(book, "2026-11", "2026-12-05");
    const dec = await getAtlasViewForBook(book, "2026-12", "2026-12-05");
    assert.ok(june.totals.monthlyNet > 0, "June keeps the pay");
    assert.ok(nov.totals.monthlyNet > 0, "the month of deactivation keeps the pay");
    assert.equal(dec.totals.monthlyNet, 0, "the month after leaves it out");
  });

  await check("F15: a partly logged month carries the last balance, marked, and stays due", async () => {
    await db.insert(s.accountSnapshots).values([
      { accountId: checking.id, month: "2026-10-01", balance: "1000.00" },
      { accountId: savings.id, month: "2026-10-01", balance: "5000.00" },
      { accountId: checking.id, month: "2026-11-01", balance: "1200.00" },
    ]);
    const dash = await getNetWorthDashboardForBook(book, "all", "2026-12-05");
    const nov = dash.months.indexOf("2026-11-01");
    assert.equal(dash.totals[nov], 6200);
    assert.equal(dash.balances[savings.id][nov], 5000);
    assert.equal(dash.carried[savings.id][nov], "2026-10-01");
    assert.equal(dash.carried[checking.id][nov], null);
    assert.deepEqual(dash.stats?.carried, [{ name: "Savings", from: "2026-10-01" }]);
    assert.equal(dash.stats?.lastChange?.value, 200, "the change is the real $200, not a $4,800 loss");
    assert.equal(dash.dueMonth, "2026-11-01");
    assert.deepEqual(dash.dueMissing, ["Savings"]);
    await db.update(s.financialAccounts).set({ archivedAt: new Date("2026-11-03T12:00:00Z") }).where(eq(s.financialAccounts.id, savings.id));
    const after = await getNetWorthDashboardForBook(book, "all", "2026-12-05");
    assert.equal(after.totals[after.months.indexOf("2026-11-01")], 1200, "an account archived that month stops carrying");
    assert.equal(after.dueMonth, null);
    await db.update(s.financialAccounts).set({ archivedAt: null }).where(eq(s.financialAccounts.id, savings.id));
  });

  await check("F16: the verdict judges the whole savings goal and names a paycheck shortfall", async () => {
    const report = buildMonthReport({
      plan: { moneyIn: 3000, bills: 1000, discretionary: 1500, savingsGoal: 500, estimateAdjustment: 0, paycheckSavings: 1000 },
      actual: { income: 3000, reimbursed: 0, discretionary: 1400, bills: 1000, offBudget: 0, funds: 0, paycheckSavings: 0 },
    });
    assert.equal(report.saved.diff, -900);
    assert.match(report.verdict, /^Paycheck savings came in \$1,000\.00 under plan, the main reason you saved \$600\.00 instead of \$1,500\.00\.$/);
    const met = buildMonthReport({
      plan: { moneyIn: 3000, bills: 1000, discretionary: 1500, savingsGoal: 500, estimateAdjustment: 0, paycheckSavings: 1000 },
      actual: { income: 3000, reimbursed: 0, discretionary: 1400, bills: 1000, offBudget: 0, funds: 0, paycheckSavings: 1000 },
    });
    assert.match(met.verdict, /^You saved \$100\.00 more than your goal/);
  });

  await check("F17: income before an account's first logged balance is not new money", async () => {
    const [broker] = await db
      .insert(s.financialAccounts)
      .values({ groupId: G, bookId: book.id, name: "Brokerage", kind: "brokerage" })
      .returning();
    await db.insert(s.accountSnapshots).values([
      { accountId: broker.id, month: "2026-11-01", balance: "1000.00" },
      { accountId: broker.id, month: "2026-12-01", balance: "1100.00" },
    ]);
    await db.insert(s.accountSnapshots).values({ accountId: checking.id, month: "2026-12-01", balance: "1300.00" });
    await txn({ postedOn: "2026-11-12", amount: "500.00", category: "income", accountId: broker.id, merchant: "Dividend" });
    await txn({ postedOn: "2026-12-12", amount: "50.00", category: "income", accountId: broker.id, merchant: "Dividend" });
    const dash = await getNetWorthDashboardForBook(book, "all", "2027-01-05");
    const flows = dash.flows[broker.id];
    assert.equal(flows.landedIn.at(-1), 50, "only December's $50 is new money");
    assert.deepEqual(flows.landed.map((l) => l.amount), [50]);
  });
} finally {
  await db.delete(s.groups).where(eq(s.groups.id, G));
  const left = await db.select({ id: s.groups.id }).from(s.groups).where(eq(s.groups.id, G));
  console.log(left.length ? "CLEANUP FAILED" : "Cleanup done: the test household is gone.");
}
console.log(`\n${passed} passed, ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
