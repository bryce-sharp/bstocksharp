"use client";

import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import SubmitButton from "@/components/shared/SubmitButton";
import NumberField from "@/components/shared/NumberField";
import SuggestField from "@/components/shared/SuggestField";
import { splitTransactionAction } from "@/app/actions/finance-budget";
import { MAX_SPLIT_PARTS, SPLIT_LANES, splitProblem } from "@/lib/finance/split";
import { formatMoney } from "@/lib/format";
import { CATEGORY_OPTIONS, billsActiveOn, type TxnBill, type TxnFund, type TxnRowData } from "./TransactionRow";

/** One part being edited; `key` keeps each part's tag field its own when another is removed. */
export type SplitDraft = {
  key: number;
  amount: string;
  category: string;
  fundId: number | null;
  recurringExpenseId: number | null;
  spendCategory: string;
};

const LANES = CATEGORY_OPTIONS.filter((c) => SPLIT_LANES.includes(c.value));

let nextKey = 0;

/** A part with these details; the key is filled in. */
export function draftPart(part: Partial<Omit<SplitDraft, "key">> = {}): SplitDraft {
  return {
    key: nextKey++,
    amount: "",
    category: "discretionary",
    fundId: null,
    recurringExpenseId: null,
    spendCategory: "",
    ...part,
  };
}

// Split one purchase into parts that add up to it: groceries and clothes from
// one Target run, or a fund covering what it can of a price. The first part
// takes whatever the others leave, so the parts always add up to the purchase.
export default function SplitDialog({
  txn,
  funds,
  bills,
  categories,
  initial,
  onSplit,
  onClose,
}: {
  txn: TxnRowData;
  funds: TxnFund[];
  bills: TxnBill[];
  categories: string[]; // spending tags
  /** Parts to start from; by default the row as it is, plus an empty second part. */
  initial?: SplitDraft[];
  onSplit: (rows: TxnRowData[]) => void;
  onClose: () => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [parts, setParts] = React.useState<SplitDraft[]>(
    () =>
      initial ?? [
        draftPart({
          category: SPLIT_LANES.includes(txn.category) ? txn.category : "discretionary",
          fundId: txn.fundId,
          recurringExpenseId: txn.recurringExpenseId,
          spendCategory: txn.spendCategory ?? "",
        }),
        draftPart(),
      ],
  );
  const [error, setError] = React.useState<string | null>(null);

  const restC =
    Math.round(txn.amount * 100) - parts.slice(1).reduce((s, p) => s + Math.round((Number(p.amount) || 0) * 100), 0);
  const amounts = [restC / 100, ...parts.slice(1).map((p) => Number(p.amount) || 0)];
  const problem = splitProblem(txn.amount, amounts.map((amount) => ({ amount })));
  const missing = parts.some((p) => p.category === "fund" && p.fundId === null)
    ? "Pick the fund for each Fund part."
    : null;

  const update = (key: number, patch: Partial<SplitDraft>) =>
    setParts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function handle(formData: FormData) {
    setError(null);
    try {
      onSplit(
        await splitTransactionAction(
          txn.id,
          parts.map((p, i) => ({
            amount: amounts[i],
            category: p.category,
            fundId: p.category === "fund" ? p.fundId : null,
            recurringExpenseId: p.category === "fixed" || p.category === "amortized" ? p.recurringExpenseId : null,
            spendCategory: String(formData.get(`spendCategory-${p.key}`) ?? ""),
          })),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't split it.");
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>
        Split {txn.merchant ?? "this purchase"} · {formatMoney(txn.amount)}
      </DialogTitle>
      <form action={handle}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {parts.map((p, i) => {
              const billChoices = billsActiveOn(bills, txn.postedOn).filter((b) =>
                p.category === "fixed" ? b.paymentsPerYear === 12 : b.paymentsPerYear !== 12,
              );
              return (
                <Box key={p.key} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
                  <Stack direction="row" sx={{ alignItems: "center", mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                      Part {i + 1}
                      {i === 0 ? " · the rest" : ""}
                    </Typography>
                    {i > 0 && parts.length > 2 ? (
                      <IconButton
                        size="small"
                        aria-label={`Remove part ${i + 1}`}
                        onClick={() => setParts((prev) => prev.filter((q) => q.key !== p.key))}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>
                  <Stack spacing={2}>
                    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr" }}>
                      {i === 0 ? (
                        <TextField
                          label="Amount"
                          value={formatMoney(amounts[0])}
                          error={amounts[0] <= 0}
                          slotProps={{ input: { readOnly: true } }}
                          helperText="What the others leave"
                        />
                      ) : (
                        <NumberField
                          name={`amount-${p.key}`}
                          label="Amount"
                          prefix="$"
                          decimalScale={2}
                          defaultValue={p.amount}
                          onValueChange={(amount) => update(p.key, { amount })}
                        />
                      )}
                      <TextField
                        label="Category"
                        select
                        value={p.category}
                        onChange={(e) => update(p.key, { category: e.target.value })}
                      >
                        {LANES.map((c) => (
                          <MenuItem key={c.value} value={c.value}>
                            {c.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                    {p.category === "fund" ? (
                      <TextField
                        label="Which fund"
                        select
                        value={p.fundId ?? ""}
                        onChange={(e) => update(p.key, { fundId: Number(e.target.value) || null })}
                        helperText={funds.length === 0 ? "No funds yet — create one first." : undefined}
                      >
                        {funds.map((f) => (
                          <MenuItem key={f.id} value={f.id}>
                            {f.name}
                            {f.balance != null ? ` · ${formatMoney(f.balance)}` : ""}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : null}
                    {p.category === "fixed" || p.category === "amortized" ? (
                      <TextField
                        label="Which bill"
                        select
                        value={p.recurringExpenseId ?? ""}
                        onChange={(e) => update(p.key, { recurringExpenseId: Number(e.target.value) || null })}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {billChoices.map((b) => (
                          <MenuItem key={b.id} value={b.id}>
                            {b.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : null}
                    <SuggestField
                      name={`spendCategory-${p.key}`}
                      label="Tag"
                      options={categories}
                      defaultValue={p.spendCategory}
                      placeholder="Groceries, Clothes…"
                    />
                  </Stack>
                </Box>
              );
            })}
            {parts.length < MAX_SPLIT_PARTS ? (
              <Button
                startIcon={<AddIcon />}
                onClick={() => setParts((prev) => [...prev, draftPart()])}
                sx={{ alignSelf: "flex-start" }}
              >
                Add a part
              </Button>
            ) : null}
            <Typography variant="body2" sx={{ color: problem || missing ? "warning.main" : "text.secondary" }}>
              {problem ?? missing ?? `${parts.length} parts adding up to ${formatMoney(txn.amount)}.`}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <SubmitButton variant="contained" pendingLabel="Splitting…" disabled={Boolean(problem || missing)}>
            Split
          </SubmitButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
