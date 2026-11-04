"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { deleteMeal, logMeal, rateMeal, updateMeal, type MealInput, type MealRatingsInput } from "@/app/actions/recipes";
import type { MealDetail, RecipeChoice } from "@/lib/queries/recipes";
import type { Cook } from "./CookLogDialog";
import { skinScope, skinSx } from "./RecipesSkin";
import StarInput from "./StarInput";
import TagChip from "./TagChip";
import { useSave } from "./useSave";
import { color } from "./tokens";

type Stars = Record<number, number | null>;

/** One person's meal stars and recipe stars, filled from what they saved for this meal before. */
function useMealStars(meal: MealDetail | undefined, cooks: Cook[], defaultCook: number | null) {
  const loggable = cooks.filter((c) => c.canLog);
  const savedFor = (profileId: number) => {
    const whole = meal?.ratings.find((r) => r.profileId === profileId);
    const dishes: Stars = {};
    for (const l of meal?.logs ?? []) if (l.profileId === profileId) dishes[l.recipeId] = l.rating;
    return { rating: whole?.rating ?? null, notes: whole?.notes ?? "", dishes };
  };
  const first = (loggable.find((c) => c.id === defaultCook) ?? loggable[0])?.id ?? 0;
  const [profileId, setProfileId] = React.useState(first);
  const [saved, setSaved] = React.useState(() => savedFor(first));
  const choose = (id: number) => {
    setProfileId(id);
    setSaved(savedFor(id));
  };
  const input = (recipeIds: number[]): MealRatingsInput => ({
    profileId,
    rating: saved.rating,
    notes: saved.notes,
    dishes: recipeIds.map((recipeId) => ({ recipeId, rating: saved.dishes[recipeId] ?? null })),
  });
  return { loggable, profileId, choose, saved, setSaved, input };
}

type MealStarsState = ReturnType<typeof useMealStars>;

/** Whose stars, the meal's stars and notes, then each recipe's stars; recipe stars are optional and stay the recipe's own. */
function MealStarsFields({ stars, dishes }: { stars: MealStarsState; dishes: RecipeChoice[] }) {
  const { loggable, profileId, choose, saved, setSaved } = stars;
  return (
    <Stack spacing={2}>
      {loggable.length === 0 && <Alert severity="info">This login can only rate for its own person.</Alert>}
      <TextField select label="Whose stars" value={String(profileId)} onChange={(e) => choose(Number(e.target.value))} slotProps={{ select: { native: true } }} sx={{ maxWidth: 240 }}>
        {loggable.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </TextField>
      <Box>
        <Typography component="legend" variant="body2" sx={{ color: color.muted, mb: 0.25 }}>
          The whole meal: did it all go together?
        </Typography>
        <StarInput name="meal-stars" value={saved.rating} onChange={(rating) => setSaved((s) => ({ ...s, rating }))} />
      </Box>
      <TextField
        label="Your notes"
        multiline
        minRows={2}
        value={saved.notes}
        onChange={(e) => setSaved((s) => ({ ...s, notes: e.target.value }))}
        placeholder="What worked together, what to pair differently"
      />
      {dishes.length > 0 && (
        <Box>
          <Typography component="legend" variant="body2" sx={{ color: color.muted, mb: 0.5 }}>
            Each recipe on its own, if you want to rate it
          </Typography>
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}>
            {dishes.map((d) => (
              <Box component="li" key={d.id} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 2 }}>
                <Typography sx={{ fontWeight: 600, flex: "1 1 160px", minWidth: 0 }}>{d.title}</Typography>
                <StarInput
                  name={`dish-${d.id}`}
                  label={`Stars for ${d.title}`}
                  size="medium"
                  value={saved.dishes[d.id] ?? null}
                  onChange={(rating) => setSaved((s) => ({ ...s, dishes: { ...s.dishes, [d.id]: rating } }))}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}

function MealShell({ open, onClose, busy, title, onSubmit, children, actions }: { open: boolean; onClose: () => void; busy: boolean; title: string; onSubmit: () => void; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" className={skinScope.className} style={skinScope.style} sx={skinSx}>
      <Box
        component="form"
        noValidate
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <DialogTitle component="h2" variant="h5">
          {title}
        </DialogTitle>
        <DialogContent>{children}</DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>{actions}</DialogActions>
      </Box>
    </Dialog>
  );
}

/** Log a new meal with your stars, or change a meal's name, day, notes and recipes. */
export default function MealDialog({
  open,
  onClose,
  meal,
  recipeChoices,
  cooks,
  defaultCook,
  today,
}: {
  open: boolean;
  onClose: () => void;
  meal?: MealDetail;
  recipeChoices: RecipeChoice[];
  cooks: Cook[];
  defaultCook: number | null;
  today: string;
}) {
  const [name, setName] = React.useState(meal?.name ?? "");
  const [cookedOn, setCookedOn] = React.useState(meal?.cookedOn ?? today);
  const [notes, setNotes] = React.useState(meal?.notes ?? "");
  const [dishes, setDishes] = React.useState<RecipeChoice[]>(meal?.dishes.map((d) => ({ id: d.id, title: d.title })) ?? []);
  const stars = useMealStars(undefined, cooks, defaultCook);
  const { error, busy, run } = useSave(onClose);

  const save = () => {
    const input: MealInput = { name, cookedOn, notes, recipeIds: dishes.map((d) => d.id) };
    run(() => (meal ? updateMeal(meal.id, input) : logMeal(input, stars.input(input.recipeIds))));
  };
  const remove = () => {
    if (meal && window.confirm(`Delete ${meal.name}? Everyone's stars for it and its cook log entries go with it.`)) run(() => deleteMeal(meal.id).then(() => undefined));
  };
  const dropped = meal ? meal.dishes.filter((d) => !dishes.some((x) => x.id === d.id) && meal.logs.some((l) => l.recipeId === d.id)) : [];

  return (
    <MealShell
      open={open}
      onClose={onClose}
      busy={busy}
      title={meal ? "Change this meal" : "Log a meal"}
      onSubmit={save}
      actions={
        <>
          {meal && (
            <Button color="error" onClick={remove} disabled={busy} sx={{ mr: "auto" }}>
              Delete
            </Button>
          )}
          <Button color="inherit" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy || (!meal && stars.loggable.length === 0)}>
            {busy ? "Saving…" : meal ? "Save" : "Log it"}
          </Button>
        </>
      }
    >
      <Stack spacing={2.25} sx={{ pt: 0.5 }}>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" } }}>
          <TextField label="Meal" value={name} onChange={(e) => setName(e.target.value)} placeholder="Thanksgiving 2026" autoFocus={!meal} />
          <TextField label="When" type="date" value={cookedOn} onChange={(e) => setCookedOn(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }} />
        </Box>
        <Autocomplete
          multiple
          options={recipeChoices}
          value={dishes}
          onChange={(_, v) => setDishes(v)}
          getOptionLabel={(c) => c.title}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterSelectedOptions
          renderValue={(value, getItemProps) =>
            value.map((c, index) => {
              const { key, ...item } = getItemProps({ index });
              return <TagChip key={key} label={c.title} {...item} />;
            })
          }
          renderInput={(params) => <TextField {...params} label="Recipes" placeholder={dishes.length ? "Add another" : "Which recipes were in it?"} />}
        />
        {dropped.length > 0 && <Alert severity="warning">Removing {dropped.map((d) => d.title).join(", ")} also removes the stars given to it in this meal.</Alert>}
        <TextField label="About the meal" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="The occasion, who came" />
        {!meal && (
          <Box sx={{ pt: 1, borderTop: `1px solid ${color.rule}` }}>
            <Typography variant="h6" component="h3" sx={{ fontSize: 18, mb: 1 }}>
              How did it go?
            </Typography>
            <MealStarsFields stars={stars} dishes={dishes} />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </MealShell>
  );
}

/** One person's stars for a meal they were at: the whole meal, then each recipe. */
export function RateMealDialog({ open, onClose, meal, cooks, defaultCook }: { open: boolean; onClose: () => void; meal: MealDetail; cooks: Cook[]; defaultCook: number | null }) {
  const stars = useMealStars(meal, cooks, defaultCook);
  const { error, busy, run } = useSave(onClose);
  const dishes = meal.dishes.map((d) => ({ id: d.id, title: d.title }));
  return (
    <MealShell
      open={open}
      onClose={onClose}
      busy={busy}
      title={`Rate ${meal.name}`}
      onSubmit={() => run(() => rateMeal(meal.id, stars.input(dishes.map((d) => d.id))))}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy || stars.loggable.length === 0}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <Box sx={{ pt: 0.5 }}>
        <MealStarsFields stars={stars} dishes={dishes} />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
    </MealShell>
  );
}
