// What a month's paychecks have saved so far (401k, HSA). Pure, all cents.
//
// Twice-a-month and monthly pay count a paycheck once its deposit arrives: an
// income deposit within 10% of the take-home a paycheck deposits. Same-day
// deposits from one payer are added together first (a paycheck split across
// accounts), and one of them can match alone (a bonus paid beside the
// paycheck). A deposit of another size, like a bonus, adds no paycheck
// savings: the deposit cannot say what was withheld from it. A month with no
// income recorded falls back to the calendar (the 15th and the last day).
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
  const groups = new Map<string, number[]>();
  for (const d of deposits) {
    if (d.amountC <= 0) continue;
    const key = `${d.postedOn}|${(d.merchant ?? "").trim().toUpperCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), d.amountC]);
  }
  const counted = new Set<string>();

  let c = 0;
  for (const p of plans) {
    const slots = CHECKS_PER_MONTH[p.payFrequency];
    if (slots === undefined) {
      c += Math.round((p.perCheckC * (PER_YEAR[p.payFrequency] ?? 26) * day) / 12 / daysInMonth);
      continue;
    }
    if (groups.size === 0) {
      c += calendarChecks(p.payFrequency, day, daysInMonth) * p.perCheckC;
      continue;
    }
    const close = (a: number) => p.netPerCheckC > 0 && Math.abs(a - p.netPerCheckC) <= p.netPerCheckC * CLOSE;
    let checks = 0;
    for (const [key, amounts] of groups) {
      if (checks >= slots) break;
      if (counted.has(key)) continue;
      const total = amounts.reduce((s, a) => s + a, 0);
      if (close(total) || amounts.some(close)) {
        counted.add(key);
        checks++;
      }
    }
    c += checks * p.perCheckC;
  }
  return Math.min(c, planC);
}
