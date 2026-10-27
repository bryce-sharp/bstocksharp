import { NextRequest, NextResponse } from "next/server";
import { looksLikeApiToken } from "@/lib/finance/tokens";
import { resolveApiToken, touchApiToken } from "@/lib/queries/finance-tokens";
import {
  getBudgetMonthForBook,
  listRecentMonthsForBook,
} from "@/lib/queries/finance-budget";
import { getGroupTimezone } from "@/lib/queries/group";
import { currentMonthISO, todayISO } from "@/lib/finance/parse";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/finance/widget — the data source for the Scriptable lock-screen
// widget (replacing its iCloud-file read). Bearer token (scope=widget) resolves
// the group; returns the current month's engine output as compact JSON. Dollars
// (not cents) on the wire so the widget renders them directly. no-store — a
// widget must never show a cached number.
// ─────────────────────────────────────────────────────────────────────────────

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

const d = (c: number) => Math.round(c) / 100;

export async function GET(req: NextRequest) {
  const token = bearer(req);
  if (!looksLikeApiToken(token)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const auth = await resolveApiToken(token, "widget");
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });
  void touchApiToken(auth.id);

  const tz = await getGroupTimezone(auth.groupId);
  const month = currentMonthISO(tz);
  const today = todayISO(tz);
  const { computation: c } = await getBudgetMonthForBook({ id: auth.bookId, groupId: auth.groupId }, month, today);
  const disc = c.discretionary;
  const recentMonths = await listRecentMonthsForBook({ id: auth.bookId, groupId: auth.groupId }, 3, today);

  // The widget is a DISCRETIONARY story — "how much can I still spend." The bar
  // is discretionary spend vs the discretionary budget; fixed/amortized are
  // committed bills shown only in the tap-detail as context, never on the bar.
  // Dollars on the wire so the widget renders directly.
  return NextResponse.json(
    {
      ok: true,
      version: 2,
      month: month.slice(0, 7),
      day: c.dayOfMonth,
      daysInMonth: c.daysInMonth,
      daysLeft: Math.max(0, c.daysInMonth - c.dayOfMonth),
      discretionary: {
        budget: d(disc.budgetC),
        spent: d(disc.netSpentC),
        remaining: d(disc.remainingC),
        perDay: d(disc.perDayC),
        // + = under pace ("can spend"), − = over pace ("catch up").
        paceDelta: d(disc.paceDeltaC),
        daysToCatchUp: c.analytics.daysToCatchUp,
      },
      // Committed bills that actually posted this month — detail context only.
      billed: { fixed: d(c.fixed.actualC), amortized: d(c.amortized.paidThisMonthC) },
      analytics: {
        today: d(c.analytics.todayC),
        yesterday: d(c.analytics.yesterdayC),
        last7: d(c.analytics.last7C),
      },
      reimbursed: d(disc.reimbursedC),
      savings: d(c.savingsC),
      estimateAdjustment: d(disc.estimateAdjustmentC),
      funds: c.funds.map((f) => ({
        name: f.name,
        balance: d(f.balanceC),
        drawnThisMonth: d(f.drawnThisMonthC),
      })),
      recentMonths, // [{ month, spent, budget }] discretionary, newest first
      needsReview: c.needsReviewCount,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
