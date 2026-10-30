"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import LoopIcon from "@mui/icons-material/Loop";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import AddIcon from "@mui/icons-material/Add";
import SubmitButton from "@/components/shared/SubmitButton";
import ExercisePicker from "@/components/workout/ExercisePicker";
import { SECTIONS, formatTarget, type Section } from "@/lib/workout";
import { RUN_TIMING } from "@/lib/workout-config";
import type { Exercise, Profile } from "@/lib/db/schema";

// The one-page create flow: the whole workout — meta + exercises + per-item
// tweaks — is a DRAFT held in client state. Nothing touches the database until
// "Create workout" posts it all to createWorkoutWithItems in one shot. (The
// EDIT builder is the opposite by design: every change auto-saves, because
// there the workout already exists.)

type Draft = {
  key: number; // stable client-side identity for React lists
  exercise: Exercise;
  section: Section;
  // Effective values as shown, mirroring the edit builder's item form. The
  // server diffs them against the catalog defaults so unchanged fields keep
  // inheriting (only real overrides persist).
  reps: string;
  duration: string; // input string; server coerces
  weight: string;
  holdLast: boolean;
  note: string;
};

export default function WorkoutDraftBuilder({
  action,
  profiles,
  defaultProfileId,
  assignWeekday,
  exercises,
  ownedEquipment,
}: {
  action: (formData: FormData) => void | Promise<void>;
  profiles: Profile[];
  defaultProfileId?: number;
  assignWeekday?: number;
  exercises: Exercise[];
  ownedEquipment: string[];
}) {
  const nextKey = React.useRef(1);
  const [items, setItems] = React.useState<Draft[]>([]);
  const [openKey, setOpenKey] = React.useState<number | null>(null);
  // Controlled only to live-update the "N rounds" chip on the Main section.
  const [rounds, setRounds] = React.useState(3);

  const add = (exercise: Exercise, section: Section) =>
    setItems((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        exercise,
        section,
        reps: exercise.defaultReps ?? "",
        duration:
          exercise.defaultDuration != null ? String(exercise.defaultDuration) : "",
        weight: exercise.defaultWeight ?? "",
        holdLast: exercise.holdLast,
        note: "",
      },
    ]);

  const remove = (key: number) =>
    setItems((prev) => prev.filter((d) => d.key !== key));

  const update = (key: number, patch: Partial<Draft>) =>
    setItems((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  /** Swap with the neighbor within the same section (mirrors moveWorkoutItem). */
  const move = (key: number, dir: "up" | "down") =>
    setItems((prev) => {
      const target = prev.find((d) => d.key === key);
      if (!target) return prev;
      const sectionKeys = prev
        .filter((d) => d.section === target.section)
        .map((d) => d.key);
      const i = sectionKeys.indexOf(key);
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= sectionKeys.length) return prev;
      const a = prev.findIndex((d) => d.key === sectionKeys[i]);
      const b = prev.findIndex((d) => d.key === sectionKeys[j]);
      const copy = [...prev];
      [copy[a], copy[b]] = [copy[b], copy[a]];
      return copy;
    });

  // What actually gets posted: display order (warmup → main → cooldown),
  // effective values; the server diffs against catalog defaults.
  const payload = JSON.stringify(
    SECTIONS.flatMap((s) => items.filter((d) => d.section === s.value)).map(
      (d) => ({
        exerciseId: d.exercise.id,
        section: d.section,
        reps: d.reps.trim() || null,
        duration: d.duration.trim() === "" ? null : Number.parseInt(d.duration, 10),
        weight: d.weight.trim() || null,
        holdLast: d.holdLast,
        note: d.note.trim() || null,
      }),
    ),
  );

  // The whole draft lives inside ONE form, so Enter in any text field would
  // submit it and create the workout mid-edit. Only the Create button submits.
  const blockEnterSubmit = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const t = e.target as HTMLElement;
    if (e.key === "Enter" && t.tagName === "INPUT") e.preventDefault();
  };

  return (
    <form action={action} onKeyDown={blockEnterSubmit}>
      {assignWeekday != null ? (
        <input type="hidden" name="assignWeekday" value={assignWeekday} />
      ) : null}
      <input type="hidden" name="items" value={payload} />

      <Stack spacing={4}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={2.5}>
            <TextField
              name="name"
              label="Workout name"
              required
              fullWidth
              placeholder="e.g. Push + Legs"
            />
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
              }}
            >
              <TextField
                name="createdByProfileId"
                label="Saved by"
                select
                fullWidth
                defaultValue={String(defaultProfileId ?? "")}
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
                value={rounds}
                onChange={(e) =>
                  setRounds(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                }
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                helperText="Times to rotate the Main circuit"
              />
              <TextField
                name="restBetweenRounds"
                label="Rest between rounds (s)"
                type="number"
                fullWidth
                defaultValue={RUN_TIMING.defaultRestBetweenRounds}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            </Box>
          </Stack>
        </Paper>

        {SECTIONS.map((s) => {
          const sectionItems = items.filter((d) => d.section === s.value);
          const isCircuit = s.value === "main" && rounds > 1;
          return (
            <Box key={s.value}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
                <Typography variant="h5" component="h2">
                  {s.label}
                </Typography>
                {isCircuit ? (
                  <Chip
                    color="primary"
                    variant="filled"
                    icon={<LoopIcon />}
                    label={`${rounds} rounds`}
                  />
                ) : null}
              </Stack>

              <Stack spacing={1} sx={{ mb: 1.5 }}>
                {sectionItems.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Nothing here yet.
                  </Typography>
                ) : (
                  sectionItems.map((d, i) => (
                    <DraftItemRow
                      key={d.key}
                      draft={d}
                      isFirst={i === 0}
                      isLast={i === sectionItems.length - 1}
                      open={openKey === d.key}
                      onToggle={() =>
                        setOpenKey((k) => (k === d.key ? null : d.key))
                      }
                      onMove={(dir) => move(d.key, dir)}
                      onRemove={() => remove(d.key)}
                      onChange={(patch) => update(d.key, patch)}
                    />
                  ))
                )}
              </Stack>

              <ExercisePicker
                exercises={exercises}
                ownedEquipment={ownedEquipment}
                onPick={(e) => add(e, s.value)}
              />
            </Box>
          );
        })}

        <Box>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
            Nothing is saved until you create it — close this page and the draft
            just disappears.
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <SubmitButton
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              pendingLabel="Creating…"
            >
              Create workout
            </SubmitButton>
            <Button
              component={Link}
              href="/workout"
              variant="text"
              size="large"
              color="inherit"
            >
              Cancel
            </Button>
          </Stack>
        </Box>
      </Stack>
    </form>
  );
}

// A draft row: summary + reorder + delete, with the same inline (accordion)
// tweak form as the edit builder's BuilderItemRow — except everything is local
// state, no name attributes, so none of it posts except via the items JSON.
function DraftItemRow({
  draft: d,
  isFirst,
  isLast,
  open,
  onToggle,
  onMove,
  onRemove,
  onChange,
}: {
  draft: Draft;
  isFirst: boolean;
  isLast: boolean;
  open: boolean;
  onToggle: () => void;
  onMove: (dir: "up" | "down") => void;
  onRemove: () => void;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const arrowSx = { border: 1, borderColor: "divider", borderRadius: 1.5 };
  const duration =
    d.duration.trim() === "" ? null : Number.parseInt(d.duration, 10);
  const target = formatTarget({
    reps: d.reps.trim() || null,
    duration: duration != null && Number.isInteger(duration) ? duration : null,
  });
  const mode = d.reps.trim() ? "reps" : "timed";

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
        <Stack sx={{ flexShrink: 0 }} spacing={0.75}>
          <IconButton
            aria-label="Move up"
            disabled={isFirst}
            onClick={() => onMove("up")}
            sx={arrowSx}
          >
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            aria-label="Move down"
            disabled={isLast}
            onClick={() => onMove("down")}
            sx={arrowSx}
          >
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {d.exercise.name}
            </Typography>
            {target ? (
              <Chip
                icon={
                  mode === "timed" ? <TimerOutlinedIcon /> : <RepeatOutlinedIcon />
                }
                label={target}
              />
            ) : null}
            {d.weight.trim() ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {d.weight}
              </Typography>
            ) : null}
          </Stack>
          {d.note.trim() ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {d.note}
            </Typography>
          ) : null}
        </Box>

        <Tooltip title={open ? "Close" : "Edit"}>
          <IconButton
            onClick={onToggle}
            size="small"
            aria-label={`Edit ${d.exercise.name}`}
            color={open ? "primary" : "default"}
            sx={{ flexShrink: 0 }}
          >
            {open ? <CloseIcon fontSize="small" /> : <EditOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={`Remove ${d.exercise.name}`}>
          <IconButton
            onClick={onRemove}
            size="small"
            aria-label={`Remove ${d.exercise.name}`}
            sx={{ flexShrink: 0 }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Collapse in={open}>
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Stack spacing={2}>
            <TextField
              label="Section"
              select
              fullWidth
              value={d.section}
              onChange={(e) => onChange({ section: e.target.value as Section })}
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
                label="Reps"
                fullWidth
                value={d.reps}
                onChange={(e) => onChange({ reps: e.target.value })}
                placeholder="e.g. 10-12, 8 each leg"
                helperText="Blank = pure timer"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Time (seconds)"
                type="number"
                fullWidth
                value={d.duration}
                onChange={(e) => onChange({ duration: e.target.value })}
                helperText="Per rep if reps set, else total hold"
                slotProps={{
                  htmlInput: { min: 0, step: 1 },
                  inputLabel: { shrink: true },
                }}
              />
              <TextField
                label="Weight"
                fullWidth
                value={d.weight}
                onChange={(e) => onChange({ weight: e.target.value })}
                placeholder="e.g. 25 lb, 15s, bodyweight"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={d.holdLast}
                    onChange={(e) => onChange({ holdLast: e.target.checked })}
                  />
                }
                label="Hold the last rep"
              />
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                Only kicks in when both Reps and a per-rep Time are set above.
              </Typography>
            </Box>

            <TextField
              label="Note (optional)"
              multiline
              minRows={2}
              fullWidth
              value={d.note}
              onChange={(e) => onChange({ note: e.target.value })}
              helperText="Extra context just for this workout (e.g. 'go heavier today')."
            />
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
