// What a month's paychecks have saved so far (401k, HSA). Pure, all cents.
//
// Twice-a-month and monthly pay count a paycheck once its deposit arrives: an
// income deposit within 10% of the take-home a paycheck deposits. Same-day
// deposits from one payer are added together first (a paycheck split across
// accounts), and one of them can match alone (a bonus paid beside the
// paycheck); each deposit counts once, closest match first, so two people
// paid together each get their own. A deposit of another size, like a bonus,
// adds no paycheck savings: the deposit cannot say what was withheld from it.
// A month with no income recorded falls back to the calendar (the 15th and
// the last day).
// Weekly and every-two-weeks pay land a varying number of times a month
// against an averaged plan, so they accrue evenly by date instead.

export type PaycheckPlan = { payFrequency: string; perCheckC: number; netPerCheckC: number };
export type IncomeDeposit = { postedOn: string; merchant: string | null; amountC: number };

const CHECKS_PER_MONTH: Record<string, number> = { semimonthly: 2, monthly: 1 };
const PER_YEAR: Record<string, number> = { weekly: 52, biweekly: 26 };
const CLOSE = 0.1;

function calendarChecks(payFrequency: string, day: number, daysInMonth: number): number {
  const last = day >= daysInMonth ? 1 : 0;
  return payFrequency === "semimonthly" ? (day >= 15 ? 1 : 0) + last : last;
}

export function paycheckSavedSoFarC(
  plans: PaycheckPlan[],
  deposits: IncomeDeposit[],
  planC: number,
  day: number,
  daysInMonth: number,
): number {
  const valid = deposits.filter((d) => d.amountC > 0);
  // A paycheck is one deposit, or a payer's whole day of deposits (a split check).
  const candidates = valid.map((d, i) => ({ ids: [i], amountC: d.amountC, at: d.postedOn }));
  const groups = new Map<string, number[]>();
  valid.forEach((d, i) => {
    const key = `${d.postedOn}|${(d.merchant ?? "").trim().toUpperCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  for (const ids of groups.values()) {
    if (ids.length > 1) candidates.push({ ids, amountC: ids.reduce((s, i) => s + valid[i]!.amountC, 0), at: valid[ids[0]!]!.postedOn });
  }

  // Closest match first, so who claims a deposit never depends on list order.
  const pairs: { plan: number; cand: number; off: number }[] = [];
  plans.forEach((p, plan) => {
    if (CHECKS_PER_MONTH[p.payFrequency] === undefined || p.netPerCheckC <= 0) return;
    candidates.forEach((x, cand) => {
      const off = Math.abs(x.amountC - p.netPerCheckC) / p.netPerCheckC;
      if (off <= CLOSE) pairs.push({ plan, cand, off });
    });
  });
  pairs.sort((a, b) => a.off - b.off || candidates[a.cand]!.at.localeCompare(candidates[b.cand]!.at) || a.plan - b.plan || a.cand - b.cand);
  const used = new Set<number>();
  const checks = plans.map(() => 0);
  for (const { plan, cand } of pairs) {
    const x = candidates[cand]!;
    if (checks[plan]! >= CHECKS_PER_MONTH[plans[plan]!.payFrequency]! || x.ids.some((i) => used.has(i))) continue;
    x.ids.forEach((i) => used.add(i));
    checks[plan]!++;
  }

  let c = 0;
  plans.forEach((p, plan) => {
    if (CHECKS_PER_MONTH[p.payFrequency] === undefined) {
      c += Math.round((p.perCheckC * (PER_YEAR[p.payFrequency] ?? 26) * day) / 12 / daysInMonth);
    } else if (valid.length === 0) {
      c += calendarChecks(p.payFrequency, day, daysInMonth) * p.perCheckC;
    } else {
      c += checks[plan]! * p.perCheckC;
    }
  });
  return Math.min(c, planC);
}
