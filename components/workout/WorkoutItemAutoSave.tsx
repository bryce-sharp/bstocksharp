"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import { SECTIONS } from "@/lib/workout";
import { formSig } from "@/components/workout/formSig";
import type { WorkoutItem, Exercise } from "@/lib/db/schema";

// Inline item editor for the builder — auto-saves like the rest of the builder.
// Text/number fields save on blur; selects/checkbox on change. No Save button.
// Fields are prefilled with the EFFECTIVE value (item override ?? catalog default).
function SaveStatus() {
  const { pending } = useFormStatus();
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minHeight: 20 }}>
      {pending ? (
        <>
          <CircularProgress size={14} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Saving…
          </Typography>
        </>
      ) : (
        <>
          <CheckCircleOutlineIcon sx={{ fontSize: 16 }} color="success" />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Saved automatically
          </Typography>
        </>
      )}
    </Stack>
  );
}

// A small "restore to catalog default" button for an overridden field's endAdornment; the label names the default.
function RevertAdornment({ onClick, defaultText }: { onClick: () => void; defaultText: string }) {
  return (
    <InputAdornment position="end">
      <Tooltip title={`Revert to catalog default${defaultText ? ` (${defaultText})` : ""}`}>
        <IconButton
          size="small"
          edge="end"
          aria-label="Revert to catalog default"
          // Keep the input from blurring (which would fire an extra save).
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
        >
          <SettingsBackupRestoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );
}

export default function WorkoutItemAutoSave({
  action,
  item,
  exercise,
}: {
  action: (formData: FormData) => void | Promise<void>;
  item: WorkoutItem;
  exercise: Exercise;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastSavedRef = React.useRef<string | null>(null);

  // Auto-save, but only when a field actually changed. Without this, every blur
  // (even just tabbing through) re-submits → revalidate → the row flickers.
  const save = () => {
    const form = formRef.current;
    if (!form) return;
    const sig = formSig(form);
    if (sig === lastSavedRef.current) return; // nothing changed → skip the save
    lastSavedRef.current = sig;
    form.requestSubmit();
  };

  // Snapshot the initial (prefilled) values so an untouched blur is a no-op.
  React.useEffect(() => {
    if (formRef.current) lastSavedRef.current = formSig(formRef.current);
  }, []);

  const reps = item.reps ?? exercise.defaultReps ?? "";
  const duration = item.duration ?? exercise.defaultDuration ?? "";
  const weight = item.weight ?? exercise.defaultWeight ?? "";
  const holdLast = item.holdLast ?? exercise.holdLast ?? false;

  // A field is "overridden" when the item has its own value (not inheriting the
  // catalog). The revert control resets the input to the catalog default and
  // saves — the save action then stores null (inherit) since it matches.
  const repsRef = React.useRef<HTMLInputElement>(null);
  const durationRef = React.useRef<HTMLInputElement>(null);
  const weightRef = React.useRef<HTMLInputElement>(null);
  const holdLastRef = React.useRef<HTMLInputElement>(null);

  const revertReps = () => {
    if (repsRef.current) repsRef.current.value = exercise.defaultReps ?? "";
    save();
  };
  const revertDuration = () => {
    if (durationRef.current)
      durationRef.current.value =
        exercise.defaultDuration != null ? String(exercise.defaultDuration) : "";
    save();
  };
  const revertWeight = () => {
    if (weightRef.current) weightRef.current.value = exercise.defaultWeight ?? "";
    save();
  };
  const revertHoldLast = () => {
    if (holdLastRef.current) holdLastRef.current.checked = exercise.holdLast;
    save();
  };

  return (
    <form action={action} ref={formRef}>
      <Stack spacing={2}>
        <TextField
          name="section"
          label="Section"
          select
          fullWidth
          defaultValue={item.section ?? "main"}
          onChange={save}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        >
          {SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </TextField>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="reps"
            label="Reps"
            fullWidth
            defaultValue={reps}
            inputRef={repsRef}
            onBlur={save}
            placeholder="e.g. 10-12, 8 each leg"
            helperText="Blank = pure timer"
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                endAdornment:
                  item.reps != null ? (
                    <RevertAdornment onClick={revertReps} defaultText={exercise.defaultReps ?? "none"} />
                  ) : undefined,
              },
            }}
          />
          <TextField
            name="duration"
            label="Time (seconds)"
            type="number"
            fullWidth
            defaultValue={duration}
            inputRef={durationRef}
            onBlur={save}
            helperText="Per rep if reps set, else total hold"
            slotProps={{
              htmlInput: { min: 0, step: 1 },
              inputLabel: { shrink: true },
              input: {
                endAdornment:
                  item.duration != null ? (
                    <RevertAdornment
                      onClick={revertDuration}
                      defaultText={exercise.defaultDuration != null ? `${exercise.defaultDuration}s` : "none"}
                    />
                  ) : undefined,
              },
            }}
          />
          <TextField
            name="weight"
            label="Weight"
            fullWidth
            defaultValue={weight}
            inputRef={weightRef}
            onBlur={save}
            placeholder="e.g. 25 lb, 15s, bodyweight"
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                endAdornment:
                  item.weight != null ? (
                    <RevertAdornment onClick={revertWeight} defaultText={exercise.defaultWeight ?? "none"} />
                  ) : undefined,
              },
            }}
          />
        </Box>

        <Box>
          <Stack direction="row" sx={{ alignItems: "center" }}>
            <FormControlLabel
              control={
                <Checkbox
                  name="holdLast"
                  value="1"
                  defaultChecked={holdLast}
                  slotProps={{ input: { ref: holdLastRef } }}
                  onChange={save}
                />
              }
              label="Hold the last rep"
            />
            {item.holdLast != null ? (
              <Tooltip
                title={`Revert to catalog default (${exercise.holdLast ? "on" : "off"})`}
              >
                <IconButton
                  size="small"
                  aria-label="Revert to catalog default"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={revertHoldLast}
                >
                  <SettingsBackupRestoreIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            Only kicks in when both Reps and a per-rep Time are set above.
          </Typography>
        </Box>

        <TextField
          name="note"
          label="Note (optional)"
          multiline
          minRows={2}
          fullWidth
          defaultValue={item.note ?? ""}
          onBlur={save}
          helperText="Extra context just for this workout (e.g. 'go heavier today')."
        />

        <SaveStatus />
      </Stack>
    </form>
  );
}
