"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import { RUN_TIMING } from "@/lib/workout-config";
import { formSig } from "@/components/workout/formSig";
import type { Workout, Profile } from "@/lib/db/schema";

// The builder's workout meta (name / saved-by / rounds), auto-saved: text/number
// fields save on blur, the profile select on change. No Save button.
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

export default function WorkoutMetaAutoSave({
  action,
  workout,
  profiles,
}: {
  action: (formData: FormData) => void | Promise<void>;
  workout: Workout;
  profiles: Profile[];
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastSavedRef = React.useRef<string | null>(null);

  // Auto-save only when a field actually changed — otherwise every blur re-submits
  // and flickers the "Saving…" state.
  const save = () => {
    const form = formRef.current;
    if (!form) return;
    const sig = formSig(form);
    if (sig === lastSavedRef.current) return;
    lastSavedRef.current = sig;
    form.requestSubmit();
  };

  // Snapshot the initial values so an untouched blur is a no-op.
  React.useEffect(() => {
    if (formRef.current) lastSavedRef.current = formSig(formRef.current);
  }, []);

  return (
    <form action={action} ref={formRef}>
      <Stack spacing={2}>
        <TextField
          name="name"
          label="Workout name"
          required
          fullWidth
          defaultValue={workout.name}
          onBlur={save}
        />
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="createdByProfileId"
            label="Saved by"
            select
            fullWidth
            defaultValue={String(workout.createdByProfileId)}
            onChange={save}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </TextField>
          <TextField
            name="rounds"
            label="Main rounds"
            type="number"
            fullWidth
            defaultValue={workout.rounds}
            onBlur={save}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            helperText="Times to rotate the Main circuit"
          />
        </Box>
        <TextField
          name="restBetweenRounds"
          label="Rest between rounds (seconds)"
          type="number"
          fullWidth
          defaultValue={workout.restBetweenRounds}
          onBlur={save}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          helperText={`In auto-advance mode a ${RUN_TIMING.prepSeconds}s 'get ready' is added between exercises; manual mode skips it.`}
        />
        <SaveStatus />
      </Stack>
    </form>
  );
}
