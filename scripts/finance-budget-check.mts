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
import { getAtlasViewForBook, payEndWrites } from "@/lib/queries/finance-atlas";
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

  await check("F14: deactivating a person ends their pay with that month, and reactivating never changes the past", async () => {
    const [person] = await db.insert(s.profiles).values({ groupId: G, name: "Casey" }).returning();
    const [plan] = await db
      .insert(s.compensationPlans)
      .values({ profileId: person.id, bookId: book.id, payFrequency: "semimonthly", grossPerPaycheck: "1000.00", startDate: "2026-01-01" })
      .returning();
    const [raise] = await db
      .insert(s.compensationPlans)
      .values({ profileId: person.id, bookId: book.id, payFrequency: "semimonthly", grossPerPaycheck: "1200.00", startDate: "2027-01-01" })
      .returning();
    const [deduction] = await db
      .insert(s.incomeDeductions)
      .values({ profileId: person.id, bookId: book.id, name: "401k", amountPerPaycheck: "100.00", startDate: "2026-01-01" })
      .returning();
    // The same writes deactivateProfile batches with archived_at, on Nov 30 at 7:30 PM in the household's zone.
    await db.batch([
      db.update(s.profiles).set({ archivedAt: new Date("2026-12-01T01:30:00Z") }).where(eq(s.profiles.id, person.id)),
      ...payEndWrites(person.id, "2026-11-30"),
    ]);
    const plans = await db.select().from(s.compensationPlans).where(eq(s.compensationPlans.profileId, person.id));
    assert.deepEqual(plans.map((p) => [p.id, p.endDate]), [[plan.id, "2026-11-30"]], "the open plan ends; the future raise is gone");
    assert.notEqual(plans[0]?.id, raise.id);
    const [ended] = await db.select().from(s.incomeDeductions).where(eq(s.incomeDeductions.id, deduction.id));
    assert.equal(ended.endDate, "2026-11-30");
    const atlas = async (m: string) => (await getAtlasViewForBook(book, m, "2027-04-10")).totals.monthlyNet;
    assert.ok((await atlas("2026-06")) > 0, "June keeps the pay");
    assert.ok((await atlas("2026-11")) > 0, "the month of deactivation keeps the pay");
    assert.equal(await atlas("2026-12"), 0, "the month after leaves it out");
    await db.update(s.profiles).set({ archivedAt: null }).where(eq(s.profiles.id, person.id));
    assert.equal(await atlas("2026-12"), 0, "reactivating does not bring December's pay back");
    assert.ok((await atlas("2026-06")) > 0);
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

  // The review checks below each use their own book, so earlier rows never mix in.
  const newBook = async (name: string) => {
    const [b] = await db.insert(s.books).values({ groupId: G, name }).returning();
    const [acct] = await db.insert(s.financialAccounts).values({ groupId: G, bookId: b.id, name: "Checking", kind: "checking" }).returning();
    return { ref: { id: b.id, groupId: G }, accountId: acct.id };
  };

  await check("F12 review: a payment filed under a bill that ended before the month still comes out once", async () => {
    const { ref, accountId } = await newBook("Late payment");
    const [bill] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: ref.id, name: "Water", amount: "100.00", startDate: "2026-01-01", endDate: "2026-10-15" })
      .returning();
    await db.insert(s.transactions).values({
      groupId: G, bookId: ref.id, accountId, postedOn: "2026-11-04", merchant: "WATER CO", amount: "100.00", originalAmount: "100.00",
      category: "fixed", recurringExpenseId: bill.id, source: "manual",
    });
    const nov = await getBudgetMonthForBook(ref, "2026-11-01", "2026-11-20");
    assert.deepEqual(nov.computation.fixed.rows.map((r) => [r.name, r.expectedC, r.actualC, r.deltaC]), [["Water", 0, 10000, -10000]]);
    assert.equal(nov.computation.discretionary.budgetC, nov.computation.discretionary.baseBudgetC - 10000);
  });

  await check("F12 review: an ended annual bill reserves nothing and still shows its actual payment", async () => {
    const { ref, accountId } = await newBook("Annual bills");
    await db.insert(s.recurringExpenses).values({
      groupId: G, bookId: ref.id, name: "Insurance", amount: "1200.00", paymentsPerYear: 1, startDate: "2026-01-01", endDate: "2026-11-15",
    });
    const [paidBill] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: ref.id, name: "Domain", amount: "24.00", paymentsPerYear: 1, startDate: "2026-01-01", endDate: "2026-11-15" })
      .returning();
    await db.insert(s.transactions).values({
      groupId: G, bookId: ref.id, accountId, postedOn: "2026-11-03", merchant: "DOMAINS", amount: "24.00", originalAmount: "24.00",
      category: "amortized", recurringExpenseId: paidBill.id, source: "manual",
    });
    const nov = await getBudgetMonthForBook(ref, "2026-11-01", "2026-11-20");
    assert.deepEqual(
      nov.computation.amortized.rows.map((r) => [r.name, r.monthlyC, r.accruedC, r.paidThisMonthC]),
      [["Domain", 0, 0, 2400]],
      "the unpaid ended bill is gone; the paid one shows its payment and sets nothing aside",
    );
    assert.equal(nov.computation.amortized.reservedMonthlyC, 0);
    const oct = await getBudgetMonthForBook(ref, "2026-10-01", "2026-11-20");
    assert.equal(oct.computation.amortized.reservedMonthlyC, 10200, "October still sets aside for both");
  });

  await check("F17 review: a range that starts on a carried balance keeps the income after it", async () => {
    const { ref, accountId } = await newBook("Carried start");
    const [broker] = await db.insert(s.financialAccounts).values({ groupId: G, bookId: ref.id, name: "Brokerage", kind: "brokerage" }).returning();
    await db.insert(s.accountSnapshots).values([
      { accountId: broker.id, month: "2025-01-01", balance: "1000.00" },
      { accountId, month: "2025-12-01", balance: "500.00" },
      { accountId: broker.id, month: "2026-02-01", balance: "1100.00" },
      { accountId, month: "2026-02-01", balance: "600.00" },
    ]);
    await db.insert(s.transactions).values({
      groupId: G, bookId: ref.id, accountId: broker.id, postedOn: "2026-01-12", merchant: "Dividend", amount: "100.00",
      originalAmount: "100.00", category: "income", source: "manual",
    });
    const dash = await getNetWorthDashboardForBook(ref, "year", "2026-03-05");
    assert.deepEqual(dash.months, ["2025-12-01", "2026-02-01"]);
    assert.equal(dash.carried[broker.id][0], "2025-01-01", "the year view starts on a carried balance");
    assert.equal(dash.flows[broker.id].landedIn.at(-1), 100, "January's $100 counts");
  });

  await check("F15 review: an account archived on the last evening of a month stops carrying in that month", async () => {
    const { ref, accountId } = await newBook("Archive month");
    const [old] = await db.insert(s.financialAccounts).values({ groupId: G, bookId: ref.id, name: "Old savings", kind: "savings" }).returning();
    await db.insert(s.accountSnapshots).values([
      { accountId, month: "2026-09-01", balance: "1000.00" },
      { accountId: old.id, month: "2026-09-01", balance: "5000.00" },
      { accountId, month: "2026-10-01", balance: "1200.00" },
    ]);
    // Oct 31 at 7:30 PM in America/Chicago (the household's zone) is already November in UTC.
    await db.update(s.financialAccounts).set({ archivedAt: new Date("2026-11-01T00:30:00Z") }).where(eq(s.financialAccounts.id, old.id));
    const dash = await getNetWorthDashboardForBook(ref, "all", "2026-11-20");
    assert.equal(dash.totals[dash.months.indexOf("2026-10-01")], 1200);
  });
  await check("F12 review 2: an annual payment outside the plan, or its refund, changes spending money once", async () => {
    const { ref, accountId } = await newBook("Annual payments");
    const [future] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: ref.id, name: "Insurance", amount: "1200.00", paymentsPerYear: 1, startDate: "2026-12-01" })
      .returning();
    const [gone] = await db
      .insert(s.recurringExpenses)
      .values({ groupId: G, bookId: ref.id, name: "Gym", amount: "300.00", paymentsPerYear: 1, startDate: "2026-01-01", endDate: "2026-10-31" })
      .returning();
    const pay = (postedOn: string, amount: string, recurringExpenseId: number) => ({
      groupId: G, bookId: ref.id, accountId, postedOn, merchant: "Bill", amount, originalAmount: amount,
      category: "amortized", recurringExpenseId, source: "manual",
    });
    // Paid before the bill starts, and a refund from a bill that already ended.
    await db.insert(s.transactions).values([pay("2026-11-10", "1200.00", future.id), pay("2026-11-05", "-30.00", gone.id)]);
    const nov = await getBudgetMonthForBook(ref, "2026-11-01", "2026-11-20");
    const d = nov.computation.discretionary;
    assert.equal(d.budgetC - d.baseBudgetC, -120000 + 3000, "the $1,200 comes out once and the $30 refund goes back");
    assert.equal(d.remainingC, d.budgetC - d.netSpentC);
    assert.equal(nov.computation.amortized.reservedMonthlyC, 0);
  });

  await check("F14 review 2: net worth keeps the last paycheck deduction after deactivation", async () => {
    const { ref } = await newBook("Paycheck savings");
    const hsa = async (name: string) =>
      (await db.insert(s.financialAccounts).values({ groupId: G, bookId: ref.id, name, kind: "hsa" }).returning())[0].id;
    const [monthlyHsa, semiHsa] = [await hsa("HSA monthly"), await hsa("HSA twice a month")];
    const person = async (name: string, payFrequency: string, depositAccountId: number) => {
      const [p] = await db.insert(s.profiles).values({ groupId: G, name }).returning();
      await db.insert(s.compensationPlans).values({ profileId: p.id, bookId: ref.id, payFrequency, grossPerPaycheck: "1000.00", startDate: "2026-01-01" });
      await db.insert(s.incomeDeductions).values({
        profileId: p.id, bookId: ref.id, name: "HSA", type: "health", amountPerPaycheck: "100.00", depositAccountId, startDate: "2026-01-01",
      });
      return p.id;
    };
    const ids = [await person("Morgan", "monthly", monthlyHsa), await person("Riley", "semimonthly", semiHsa)];
    for (const id of [monthlyHsa, semiHsa]) {
      await db.insert(s.accountSnapshots).values(
        ["2026-10-01", "2026-11-01", "2026-12-01"].map((month) => ({ accountId: id, month, balance: "1000.00" })),
      );
    }
    for (const id of ids) await db.batch(payEndWrites(id, "2026-11-20"));
    const dash = await getNetWorthDashboardForBook(ref, "all", "2027-01-05");
    // A month-end payday lands the next month: November gets Oct 31's, December gets Nov 30's.
    assert.deepEqual(dash.contributions[monthlyHsa].cumulative, [0, 100, 200]);
    // Twice a month: November gets Oct 31 and Nov 15; December gets Nov 30 only.
    assert.deepEqual(dash.contributions[semiHsa].cumulative, [0, 200, 300]);
  });

} finally {
  await db.delete(s.groups).where(eq(s.groups.id, G));
  const left = await db.select({ id: s.groups.id }).from(s.groups).where(eq(s.groups.id, G));
  console.log(left.length ? "CLEANUP FAILED" : "Cleanup done: the test household is gone.");
}
console.log(`\n${passed} passed, ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
