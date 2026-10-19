"use client";

import * as React from "react";
import { LineChart, lineClasses } from "@mui/x-charts/LineChart";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import { formatMoney, formatMoneyCompact, formatMonth } from "@/lib/format";
import type { PriceMonth } from "@/lib/finance/bill-history";

// Hydration-safe "are we on the client yet?" (x-charts measures the DOM).
const noopSubscribe = () => () => {};
function useMounted() {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const shortMonth = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

// What a bill cost each month (its largest payment, held until the next one)
// against the price ATLAS had on record, dashed behind it.
export default function BillPriceChart({ months }: { months: PriceMonth[] }) {
  const theme = useTheme();
  const mounted = useMounted();
  const color = theme.vars?.palette.primary.main ?? theme.palette.primary.main;
  const ghost = theme.vars?.palette.text.secondary ?? theme.palette.text.secondary;
  const step = Math.max(1, Math.ceil(months.length / 6));

  if (!mounted) return <Box sx={{ height: 200 }} aria-hidden />;

  return (
    <LineChart
      height={200}
      series={[
        {
          id: "atlas",
          label: "ATLAS price",
          data: months.map((m) => m.atlas),
          color: ghost,
          showMark: false,
          curve: "stepAfter",
          connectNulls: false,
          valueFormatter: (v: number | null) => (v == null ? "not set" : formatMoney(v)),
        },
        {
          id: "paid",
          label: "Paid",
          data: months.map((m) => m.paid),
          color,
          showMark: true,
          curve: "stepAfter",
          connectNulls: true,
          valueFormatter: (v: number | null) => (v == null ? "no payment" : formatMoney(v)),
        },
      ]}
      xAxis={[
        {
          data: months.map((m) => m.month),
          scaleType: "point",
          valueFormatter: (v: string, ctx: { location: string }) => (ctx.location === "tick" ? shortMonth(v) : formatMonth(v)),
          tickInterval: (_v: string, i: number) => i % step === 0,
        },
      ]}
      yAxis={[{ valueFormatter: (v: number) => formatMoneyCompact(v), width: 56 }]}
      margin={{ top: 10, right: 12, bottom: 4, left: 4 }}
      slotProps={{ tooltip: { trigger: "axis" } }}
      sx={{
        [`& .${lineClasses.line}[data-series="atlas"]`]: { strokeDasharray: "5 4", strokeWidth: 1.5 },
        [`& .${lineClasses.line}[data-series="paid"]`]: { strokeWidth: 2 },
      }}
    />
  );
}
