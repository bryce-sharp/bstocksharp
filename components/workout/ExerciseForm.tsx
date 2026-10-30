import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import SubmitButton from "@/components/shared/SubmitButton";
import EquipmentPicker from "@/components/workout/EquipmentPicker";
import { CATEGORIES } from "@/lib/workout";
import type { Exercise } from "@/lib/db/schema";

// Server component. Reps and Time are BOTH shown: an exercise can have reps
// (manual, tap when done), a time (a plain countdown when there are no reps),
// or both (reps where auto mode times each rep for `time` seconds).
export default function ExerciseForm({
  action,
  exercise,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  exercise?: Exercise | null;
  submitLabel: string;
  cancelHref: string;
}) {
  const e = exercise ?? null;

  return (
    <form action={action}>
      <Stack spacing={2.5}>
        <TextField
          name="name"
          label="Exercise name"
          required
          fullWidth
          defaultValue={e?.name ?? ""}
          placeholder="e.g. Goblet Squats"
        />

        <TextField
          name="category"
          label="Category"
          select
          fullWidth
          defaultValue={e?.category ?? ""}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        >
          <option value="">Uncategorized</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
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
            name="defaultReps"
            label="Reps"
            fullWidth
            defaultValue={e?.defaultReps ?? ""}
            placeholder="e.g. 10-12, 8 each leg"
            helperText="Leave blank for a pure timer"
          />
          <TextField
            name="defaultDuration"
            label="Time (seconds)"
            type="number"
            fullWidth
            defaultValue={e?.defaultDuration ?? ""}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            helperText="Per rep if reps are set, else total hold"
          />
          <TextField
            name="defaultWeight"
            label="Weight"
            fullWidth
            defaultValue={e?.defaultWeight ?? ""}
            placeholder="e.g. 25 lb, 15s, bodyweight"
          />
        </Box>

        <Box>
          <FormControlLabel
            control={
              <Checkbox
                name="holdLast"
                value="1"
                defaultChecked={e?.holdLast ?? false}
              />
            }
            label="Hold the last rep (super-set finish)"
          />
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            Only kicks in when both Reps and a per-rep Time are set — the final
            rep gets a longer HOLD.
          </Typography>
        </Box>

        <Box>
          <FormControlLabel
            control={
              <Checkbox
                name="perSide"
                value="1"
                defaultChecked={(e?.sides ?? 1) > 1}
              />
            }
            label="Performed per side (do both sides)"
          />
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            For split squats, planks each side, etc. — the runner plays the set
            once per side with a short switch between. Put the <strong>per-side</strong>{" "}
            amount in Reps/Time (e.g. <code>8</code>, not <code>8 each leg</code>).
          </Typography>
        </Box>

        <EquipmentPicker
          name="equipment"
          defaultValue={e?.equipment ?? []}
          label="Equipment needed"
          helperText="What this move requires. Leave all unchecked for bodyweight — those always show up for everyone."
        />

        <TextField
          name="description"
          label="Description (how to do it)"
          multiline
          minRows={2}
          fullWidth
          defaultValue={e?.description ?? ""}
          helperText="Shown behind the ⓘ during a workout."
        />

        <TextField
          name="tips"
          label="Tips (one per line)"
          multiline
          minRows={3}
          fullWidth
          defaultValue={e?.tips ?? ""}
          helperText="One tip per line — the live workout shows a random one."
        />

        <Stack direction="row" spacing={1.5}>
          <SubmitButton variant="contained" size="large" pendingLabel="Saving…">
            {submitLabel}
          </SubmitButton>
          <Button
            component={Link}
            href={cancelHref}
            variant="text"
            size="large"
            color="inherit"
          >
            Cancel
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
