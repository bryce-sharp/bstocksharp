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
import { createMenu, deleteMeal, deleteMenu, logMeal, rateMeal, updateMeal, updateMenu, type MealInput, type MealRatingsInput, type MenuInput } from "@/app/actions/recipes";
import type { MealDetail, MenuDetail, RecipeChoice } from "@/lib/queries/recipes";
import { servingsOf } from "@/lib/recipe-units";
import type { Cook } from "./CookLogDialog";
import { skinScope, skinSx } from "./RecipesSkin";
import SizeStepper from "./SizeStepper";
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
function MealStarsFields({ stars, dishes }: { stars: MealStarsState; dishes: { id: number; title: string }[] }) {
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

function FormShell({ open, onClose, busy, title, onSubmit, children, actions }: { open: boolean; onClose: () => void; busy: boolean; title: string; onSubmit: () => void; children: React.ReactNode; actions: React.ReactNode }) {
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

/** The recipes picker both forms share; the order picked is the order shown. */
function RecipePicker({ choices, value, onChange, label, placeholder }: { choices: RecipeChoice[]; value: RecipeChoice[]; onChange: (v: RecipeChoice[]) => void; label: string; placeholder: string }) {
  return (
    <Autocomplete
      multiple
      options={choices}
      value={value}
      onChange={(_, v) => onChange(v)}
      getOptionLabel={(c) => c.title}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterSelectedOptions
      renderValue={(picked, getItemProps) =>
        picked.map((c, index) => {
          const { key, ...item } = getItemProps({ index });
          return <TagChip key={key} label={c.title} {...item} />;
        })
      }
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? "Add another" : placeholder} />}
    />
  );
}

const choicesOf = (dishes: RecipeChoice[]): RecipeChoice[] => dishes.map((d) => ({ id: d.id, title: d.title, servings: d.servings }));

type Amounts = Record<number, number>;

/** Each picked recipe's size, filled from the dishes' saved amounts. */
function useAmounts(dishes: { id: number; amount: number }[]) {
  const [amounts, setAmounts] = React.useState<Amounts>(() => Object.fromEntries(dishes.map((d) => [d.id, d.amount])));
  const sizesOf = (picked: RecipeChoice[]): Amounts => Object.fromEntries(picked.flatMap((d) => (amounts[d.id] !== undefined ? [[d.id, amounts[d.id]!]] : [])));
  return { amounts, setAmounts, sizesOf };
}

/** A size stepper for each picked recipe; a recipe just added starts at its own size. */
function SizesField({ dishes, amounts, onChange }: { dishes: RecipeChoice[]; amounts: Amounts; onChange: React.Dispatch<React.SetStateAction<Amounts>> }) {
  if (!dishes.length) return null;
  return (
    <Box>
      <Typography component="legend" variant="body2" sx={{ color: color.muted, mb: 0.5 }}>
        How much of each
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}>
        {dishes.map((d) => {
          const servings = servingsOf(d.servings);
          return (
            <Box component="li" key={d.id} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 2, rowGap: 0.5 }}>
              <Typography sx={{ fontWeight: 600, flex: "1 1 160px", minWidth: 0 }}>{d.title}</Typography>
              <SizeStepper amount={amounts[d.id] ?? servings ?? 1} servings={servings} name={d.title} onChange={(a) => onChange((m) => ({ ...m, [d.id]: a }))} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** Make a menu, or change its name, notes and recipes; the times it was made keep theirs. */
export function MenuDialog({ open, onClose, menu, recipeChoices }: { open: boolean; onClose: () => void; menu?: MenuDetail; recipeChoices: RecipeChoice[] }) {
  const [name, setName] = React.useState(menu?.name ?? "");
  const [notes, setNotes] = React.useState(menu?.notes ?? "");
  const [dishes, setDishes] = React.useState<RecipeChoice[]>(menu ? choicesOf(menu.dishes) : []);
  const { amounts, setAmounts, sizesOf } = useAmounts(menu?.dishes ?? []);
  const { error, busy, run } = useSave(onClose);
  const save = () => {
    const input: MenuInput = { name, notes, recipeIds: dishes.map((d) => d.id), sizes: sizesOf(dishes) };
    run(() => (menu ? updateMenu(menu.id, input) : createMenu(input)));
  };
  const remove = () => {
    if (!menu) return;
    const made = menu.meals.length ? ` The ${menu.meals.length === 1 ? "time" : `${menu.meals.length} times`} you made it, with everyone's stars and cook log entries, go with it.` : "";
    if (window.confirm(`Delete ${menu.name}?${made}`)) run(() => deleteMenu(menu.id).then(() => undefined));
  };
  return (
    <FormShell
      open={open}
      onClose={onClose}
      busy={busy}
      title={menu ? "Change this menu" : "New menu"}
      onSubmit={save}
      actions={
        <>
          {menu && (
            <Button color="error" onClick={remove} disabled={busy} sx={{ mr: "auto" }}>
              Delete
            </Button>
          )}
          <Button color="inherit" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <Stack spacing={2.25} sx={{ pt: 0.5 }}>
        <TextField label="Menu" value={name} onChange={(e) => setName(e.target.value)} placeholder="Burger night" autoFocus={!menu} />
        <RecipePicker choices={recipeChoices} value={dishes} onChange={setDishes} label="Recipes" placeholder="Which recipes go together?" />
        <SizesField dishes={dishes} amounts={amounts} onChange={setAmounts} />
        <TextField label="About the menu" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="When it works, what to make ahead" />
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </FormShell>
  );
}

/** Log a time the menu was made with your stars, or change that time's day, notes and recipes. */
export function MealDialog({
  open,
  onClose,
  menu,
  meal,
  recipeChoices,
  cooks,
  defaultCook,
  today,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuDetail;
  meal?: MealDetail;
  recipeChoices: RecipeChoice[];
  cooks: Cook[];
  defaultCook: number | null;
  today: string;
}) {
  const [cookedOn, setCookedOn] = React.useState(meal?.cookedOn ?? today);
  const [notes, setNotes] = React.useState(meal?.notes ?? "");
  const [dishes, setDishes] = React.useState<RecipeChoice[]>(choicesOf(meal?.dishes ?? menu.dishes));
  const { amounts, setAmounts, sizesOf } = useAmounts(meal?.dishes ?? menu.dishes);
  const stars = useMealStars(undefined, cooks, defaultCook);
  const { error, busy, run } = useSave(onClose);

  const save = () => {
    const input: MealInput = { cookedOn, notes, recipeIds: dishes.map((d) => d.id), sizes: sizesOf(dishes) };
    run(() => (meal ? updateMeal(meal.id, input) : logMeal(menu.id, input, stars.input(input.recipeIds))));
  };
  const remove = () => {
    if (meal && window.confirm("Delete this time? Everyone's stars for it and its cook log entries go with it; the menu stays.")) run(() => deleteMeal(meal.id));
  };
  const dropped = meal ? meal.dishes.filter((d) => !dishes.some((x) => x.id === d.id) && meal.logs.some((l) => l.recipeId === d.id)) : [];

  return (
    <FormShell
      open={open}
      onClose={onClose}
      busy={busy}
      title={meal ? "Change this time" : `We made ${menu.name}`}
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
        <TextField label="When" type="date" value={cookedOn} onChange={(e) => setCookedOn(e.target.value)} autoFocus={!meal} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }} sx={{ maxWidth: 240 }} />
        <RecipePicker choices={recipeChoices} value={dishes} onChange={setDishes} label="Recipes made" placeholder="Which recipes did you make?" />
        {dropped.length > 0 && <Alert severity="warning">Removing {dropped.map((d) => d.title).join(", ")} also removes the stars given to it this time.</Alert>}
        <SizesField dishes={dishes} amounts={amounts} onChange={setAmounts} />
        <TextField label="About this time" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="The occasion, who came" />
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
    </FormShell>
  );
}

/** One person's stars for a time they were at: the whole meal, then each recipe. */
export function RateMealDialog({ open, onClose, meal, cooks, defaultCook }: { open: boolean; onClose: () => void; meal: MealDetail; cooks: Cook[]; defaultCook: number | null }) {
  const stars = useMealStars(meal, cooks, defaultCook);
  const { error, busy, run } = useSave(onClose);
  const dishes = meal.dishes.map((d) => ({ id: d.id, title: d.title }));
  return (
    <FormShell
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
    </FormShell>
  );
}
