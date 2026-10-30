"use client";

import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import SubmitButton from "@/components/shared/SubmitButton";
import NumberField from "@/components/shared/NumberField";

// Set / edit / start a plan.
//   • Editing (isNew=false) → savePlan on the active plan, mode locked.
//   • Starting new (isNew=true) → startPlan (ends the old one), mode toggle shown.
// LOSE: define by weekly pace OR target date (deadline → pace derived).
// MAINTAIN: hold weight (goalWeight) ± a range band; pace handled server-side.
export default function PlanDialog({
  open,
  onClose,
  action,
  isNew,
  initialMode = "lose",
  startWeight,
  startDate,
  goalWeight,
  perWeekPace,
  endDate,
  rangeLb,
}: {
  open: boolean;
  onClose: () => void;
  action: (formData: FormData) => Promise<void>;
  isNew: boolean;
  initialMode?: "lose" | "maintain";
  startWeight?: number | null;
  startDate?: string | null;
  goalWeight?: number | null;
  perWeekPace?: number | null;
  endDate?: string | null;
  rangeLb?: number | null;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"lose" | "maintain">(initialMode);
  // Target date is the default way to define a lose plan (Bryce's preference).
  const [paceMode, setPaceMode] = React.useState<"pace" | "date">("date");
  // New plans are ready to save immediately; edits enable Save only once changed.
  const [dirty, setDirty] = React.useState(isNew);

  async function handle(formData: FormData) {
    setError(null);
    try {
      await action(formData);
      onClose();
    } catch {
      setError("Couldn't save the plan — check the fields and try again.");
    }
  }

  const title = isNew ? "Start a new plan" : "Edit plan";
  const submitLabel = isNew ? "Start plan" : "Save plan";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <form action={handle} onChange={() => setDirty(true)}>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="paceMode" value={paceMode} />
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.5}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            {isNew ? (
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                  Plan type
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  fullWidth
                  value={mode}
                  onChange={(_, v) => {
                    if (v) {
                      setMode(v);
                      setDirty(true);
                    }
                  }}
                >
                  <ToggleButton value="lose">Lose</ToggleButton>
                  <ToggleButton value="maintain">Maintain</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            ) : null}

            <TextField
              name="startDate"
              label={mode === "maintain" ? "Maintaining since" : "Start date"}
              type="date"
              required
              fullWidth
              defaultValue={startDate ?? ""}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {mode === "maintain" ? (
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr" }}>
                <NumberField
                  name="goalWeight"
                  label="Hold weight (lb)"
                  decimalScale={1}
                  defaultValue={goalWeight}
                />
                <NumberField
                  name="rangeLb"
                  label="Range ± (lb)"
                  decimalScale={1}
                  defaultValue={rangeLb ?? 3}
                />
              </Box>
            ) : (
              <>
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr" }}>
                  <NumberField
                    name="startWeight"
                    label="Start weight (lb)"
                    decimalScale={1}
                    defaultValue={startWeight}
                  />
                  <NumberField
                    name="goalWeight"
                    label="Goal weight (lb)"
                    decimalScale={1}
                    defaultValue={goalWeight}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                    Define the target by…
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    fullWidth
                    value={paceMode}
                    onChange={(_, v) => {
                      if (v) {
                        setPaceMode(v);
                        setDirty(true);
                      }
                    }}
                  >
                    <ToggleButton value="date">Target date</ToggleButton>
                    <ToggleButton value="pace">Weekly pace</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {paceMode === "pace" ? (
                  <NumberField
                    name="perWeekPace"
                    label="Pace (lb / week)"
                    decimalScale={3}
                    defaultValue={perWeekPace}
                  />
                ) : (
                  <TextField
                    name="targetDate"
                    label="Hit goal by"
                    type="date"
                    fullWidth
                    defaultValue={endDate ?? ""}
                    helperText="Pace is figured out for you."
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <SubmitButton variant="contained" pendingLabel="Saving…" disabled={!dirty}>
            {submitLabel}
          </SubmitButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
