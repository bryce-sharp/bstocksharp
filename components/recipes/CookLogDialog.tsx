"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { deleteCookLog, logCook, updateCookLog, type CookLogInput } from "@/app/actions/recipes";
import type { RecipeLogEntry } from "@/lib/queries/recipes";
import { skinScope, skinSx } from "./RecipesSkin";
import StarInput from "./StarInput";
import { useSave } from "./useSave";
import { color } from "./tokens";

/** Someone in the household, and whether this login may log for them. */
export type Cook = { id: number; name: string; canLog: boolean };

/** Log a cook, or change one: who, when, the stars, and whether something went wrong. */
export default function CookLogDialog({
  open,
  onClose,
  recipeId,
  entry,
  cooks,
  defaultCook,
  today,
  servings,
  made: madeDefault,
}: {
  open: boolean;
  onClose: () => void;
  recipeId: number;
  entry?: RecipeLogEntry;
  cooks: Cook[];
  defaultCook: number | null;
  today: string;
  servings: number | null;
  /** Servings just cooked, when cook mode ran at another amount than the recipe's. */
  made?: number;
}) {
  const loggable = cooks.filter((c) => c.canLog || c.id === entry?.profileId);
  const [profileId, setProfileId] = React.useState(entry?.profileId ?? (loggable.find((c) => c.id === defaultCook) ?? loggable[0])?.id ?? 0);
  const [cookedOn, setCookedOn] = React.useState(entry?.cookedOn ?? today);
  const [rating, setRating] = React.useState<number | null>(entry?.rating ?? null);
  const [wentWrong, setWentWrong] = React.useState(entry ? !entry.counted : false);
  const [notes, setNotes] = React.useState(entry?.notes ?? "");
  const [made, setMade] = React.useState(entry?.servings?.toString() ?? madeDefault?.toString() ?? "");
  const { error, busy, run } = useSave(onClose);
  const inMeal = entry ? entry.mealId !== null : false;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CookLogInput = { profileId, cookedOn, rating, wentWrong, notes, servings: made };
    run(() => (entry ? updateCookLog(entry.id, input) : logCook(recipeId, input)));
  };

  const remove = () => {
    if (entry && window.confirm("Delete this log entry?")) run(() => deleteCookLog(entry.id));
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" className={skinScope.className} style={skinScope.style} sx={skinSx}>
      <Box component="form" onSubmit={save} noValidate>
        <DialogTitle component="h2" variant="h5">
          {entry ? "Change this cook" : "How did it go?"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 0.5 }}>
            {loggable.length === 0 && <Alert severity="info">This login can only log for its own person.</Alert>}
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
              <TextField select label="Who cooked" value={String(profileId)} onChange={(e) => setProfileId(Number(e.target.value))} disabled={inMeal} slotProps={{ select: { native: true } }}>
                {loggable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </TextField>
              <TextField label="When" type="date" value={cookedOn} onChange={(e) => setCookedOn(e.target.value)} disabled={inMeal} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }} />
            </Box>
            {inMeal && (
              <Typography variant="body2" sx={{ color: color.muted, mt: -1 }}>
                Part of making {entry?.menu}: its day is that time&apos;s.
              </Typography>
            )}

            <Box>
              <Typography component="legend" variant="body2" sx={{ color: color.muted, mb: 0.25 }}>
                Stars, if you want to rate it
              </Typography>
              <StarInput name="stars" value={rating} onChange={setRating} />
            </Box>

            <Box>
              <FormControlLabel
                control={<Checkbox checked={wentWrong} onChange={(e) => setWentWrong(e.target.checked)} />}
                label="Something went wrong"
              />
              <Typography variant="body2" sx={{ color: color.muted, mt: -0.5, ml: 4 }}>
                A burnt batch or a missing ingredient: the stars stay out of the rating, and the notes stay here.
              </Typography>
            </Box>

            <TextField label="Notes" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you changed, what to try next time" />
            <TextField
              label="Servings made"
              value={made}
              onChange={(e) => setMade(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder={servings ? String(servings) : ""}
              slotProps={{ htmlInput: { inputMode: "numeric" } }}
              sx={{ maxWidth: 160 }}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {entry && (
            <Button color="error" onClick={remove} disabled={busy} sx={{ mr: "auto" }}>
              Delete
            </Button>
          )}
          <Button color="inherit" onClick={onClose} disabled={busy}>
            {entry ? "Cancel" : "Later"}
          </Button>
          <Button type="submit" variant="contained" disabled={busy || loggable.length === 0}>
            {busy ? "Saving…" : entry ? "Save" : "Log it"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
