"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { formatMonth } from "@/lib/format";
import SnapshotDialog, { type SnapshotAccount } from "./SnapshotDialog";

const listNames = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

// The 1st-of-the-month nudge: last month has closed and is not fully logged yet.
export default function DueMonthBanner({
  month,
  missing,
  accounts,
  balancesByMonth,
  yearOptions,
}: {
  month: string; // YYYY-MM-01
  /** Accounts the month still needs, when it is partly logged. */
  missing: string[];
  accounts: SnapshotAccount[];
  balancesByMonth: Record<string, Record<number, number | null>>;
  yearOptions: number[];
}) {
  const [open, setOpen] = React.useState(false);
  const name = new Date(`${month.slice(0, 7)}-01T12:00:00`).toLocaleDateString("en-US", { month: "long" });

  return (
    <>
      <Alert
        severity="info"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => setOpen(true)}>
            Log {name}
          </Button>
        }
      >
        {missing.length && balancesByMonth[month.slice(0, 7)]
          ? `${formatMonth(month)} still needs ${listNames(missing)}. Log the rest of its ending balances.`
          : `${formatMonth(month)} has closed. Log its ending balances.`}
      </Alert>
      {open ? (
        <SnapshotDialog
          open
          onClose={() => setOpen(false)}
          accounts={accounts}
          month={month.slice(0, 7)}
          balancesByMonth={balancesByMonth}
          yearOptions={yearOptions}
          title={`Log ${formatMonth(month)}`}
        />
      ) : null}
    </>
  );
}
