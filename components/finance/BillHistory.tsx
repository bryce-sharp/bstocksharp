"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Skeleton from "@mui/material/Skeleton";
import { formatMoney, formatMonth } from "@/lib/format";
import type { PricePoint } from "@/lib/finance/bill-history";
import type { BillHistoryView } from "@/lib/queries/finance-bills";
import {
  acceptBillPriceAction,
  getBillHistoryAction,
  ignoreBillPriceAction,
} from "@/app/actions/finance-atlas";
import BillPriceChart from "./BillPriceChart";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatMoney(Math.abs(n))}`;
const percent = (from: number, to: number) => (from === 0 ? "" : `${to >= from ? "+" : "−"}${Math.abs(Math.round(((to - from) / from) * 100))}%`);

function Tile({ label, value, sub, wide = false }: { label: string; value: string; sub?: string; wide?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 0, gridColumn: wide ? { xs: "1 / -1", sm: "auto" } : undefined }}>
      <Typography variant="caption" sx={{ color: "text.secondary" }} component="div" noWrap>
        {label}
      </Typography>
      <Typography variant="h6" component="div" sx={{ lineHeight: 1.3 }}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }} component="div" noWrap>
          {sub}
        </Typography>
      ) : null}
    </Paper>
  );
}

function change(label: string, from: PricePoint | null, latest: PricePoint, wide = false) {
  if (!from) return <Tile label={label} value="—" sub="no payment then" wide={wide} />;
  return (
    <Tile
      label={label}
      value={signed(latest.amount - from.amount)}
      sub={`${percent(from.amount, latest.amount)} from ${formatMoney(from.amount)}`}
      wide={wide}
    />
  );
}

// A bill's History tab: what it cost over time (from the payments linked to it,
// across every version), its price changes, and, when the latest payment does
// not match ATLAS, a one-tap offer to update the price from that month.
export default function BillHistory({
  billId,
  canEdit,
  onApplied,
}: {
  billId: number;
  canEdit: boolean;
  /** After a new price is applied (the dialog closes so nothing edits a stale version). */
  onApplied: () => void;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<BillHistoryView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const [showAll, setShowAll] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let live = true;
    getBillHistoryAction(billId)
      .then((res) => {
        if (!live) return;
        if ("error" in res) setError(res.error);
        else setView(res);
      })
      .catch(() => live && setError("The history could not load. Try again."));
    return () => {
      live = false;
    };
  }, [billId, reload]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!view) {
    return (
      <Stack spacing={1.5} aria-busy>
        <Skeleton variant="rounded" height={64} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  const h = view.history;
  const suggestion = canEdit ? h.suggestion : null;

  function accept() {
    if (!suggestion) return;
    startTransition(async () => {
      const res = await acceptBillPriceAction(billId, suggestion.amount, suggestion.month);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
      onApplied();
    });
  }

  function ignore() {
    if (!suggestion) return;
    startTransition(async () => {
      const res = await ignoreBillPriceAction(billId, suggestion.amount);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
      setReload((n) => n + 1);
    });
  }

  if (!h.latest) {
    return (
      <Typography sx={{ color: "text.secondary" }}>
        No payments are linked to this bill yet. Once one posts, its price history starts here.
      </Typography>
    );
  }

  const shown = showAll ? h.changes : h.changes.slice(0, 6);
  return (
    <Stack spacing={2}>
      {suggestion ? (
        <Alert severity="info">
          <AlertTitle>Price changed?</AlertTitle>
          The {formatMonth(suggestion.month)} payment was {formatMoney(suggestion.amount)}; ATLAS expects{" "}
          {formatMoney(suggestion.expected)}. Updating keeps the old price for earlier months.
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
            <Button size="small" variant="contained" onClick={accept} disabled={pending}>
              Update to {formatMoney(suggestion.amount)}
            </Button>
            <Button size="small" color="inherit" onClick={ignore} disabled={pending}>
              Keep {formatMoney(suggestion.expected)}
            </Button>
          </Stack>
        </Alert>
      ) : null}

      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
        <Tile label="Latest payment" value={formatMoney(h.latest.amount)} sub={formatMonth(h.latest.month)} />
        {change("Versus a year ago", h.yearAgo, h.latest)}
        {view.isEstimate ? (
          <Tile label="12-month average" value={h.average12 === null ? "—" : formatMoney(h.average12)} wide />
        ) : (
          change(`Since ${h.first ? formatMonth(h.first.month) : "the start"}`, h.first, h.latest, true)
        )}
      </Box>

      <BillPriceChart months={h.months} />

      {view.isEstimate ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          This bill varies month to month, so its changes are not listed.
        </Typography>
      ) : h.changes.length ? (
        <Box>
          <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
            Price changes
          </Typography>
          {shown.map((c) => (
            <Box
              key={c.month}
              sx={{
                display: "grid",
                gridTemplateColumns: "84px minmax(0, 1fr) auto",
                gap: 1,
                py: 0.75,
                borderTop: 1,
                borderColor: "divider",
                fontSize: 14,
              }}
            >
              <Box sx={{ color: "text.secondary" }}>{formatMonth(c.month)}</Box>
              <Box>
                {formatMoney(c.from)} → {formatMoney(c.to)}
              </Box>
              <Box sx={{ color: c.to > c.from ? "warning.main" : "success.main", fontWeight: 600 }}>{signed(c.to - c.from)}</Box>
            </Box>
          ))}
          {h.changes.length > 6 ? (
            <Button size="small" color="inherit" onClick={() => setShowAll((v) => !v)} sx={{ mt: 0.5 }}>
              {showAll ? "Show fewer" : `Show all ${h.changes.length}`}
            </Button>
          ) : null}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          The price has not changed in this history.
        </Typography>
      )}

      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        From the payments linked to this bill. A month counts its largest payment, so a late payment or a small extra
        charge does not read as a price change.
      </Typography>
    </Stack>
  );
}
