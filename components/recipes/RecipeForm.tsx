"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "@/components/shared/AppLink";
import { addRecipe, deleteRecipe, updateRecipe, type RecipeInput } from "@/app/actions/recipes";
import type { Recipe } from "@/lib/db/schema";
import { cleanTags, newLineId, type RecipeIngredient, type RecipeStep } from "@/lib/recipes";
import LineEditor from "./LineEditor";
import StepLinks, { type UsesByStep } from "./StepLinks";
import { blankLine, ingredientLines, textLines, toIngredients, toSteps, type Line } from "./lines";
import type { RecipeDraft } from "@/lib/recipe-import";
import { skinScope, skinSx } from "./RecipesSkin";
import TagChip from "./TagChip";
import { color } from "./tokens";

/** What a cook follows: the ingredient lines with their groups and the steps, ignoring spacing. */
const cookable = (ingredients: RecipeIngredient[], steps: RecipeStep[]) =>
  JSON.stringify([ingredients.filter((i) => i.text.trim()).map((i) => [i.group ?? "", i.text.trim()]), steps.map((s) => s.text.trim()).filter(Boolean)]);

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 5);
const fieldSx = { "& .MuiOutlinedInput-root": { bgcolor: color.surface } } as const;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box component="section">
      <Typography variant="h5" component="h2" sx={{ fontSize: 22 }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" sx={{ color: color.muted, mb: 1.25 }}>
          {hint}
        </Typography>
      )}
      {children}
    </Box>
  );
}

/** New and edit share this form; it holds the whole recipe and sends it in one save. */
export default function RecipeForm({
  recipe,
  draft,
  tagOptions,
  logged = false,
}: {
  recipe?: Recipe;
  /** A recipe read from a link or pasted text, shown for review as a new recipe. */
  draft?: RecipeDraft;
  tagOptions: string[];
  logged?: boolean;
}) {
  const start = recipe ?? draft;
  const [title, setTitle] = React.useState(start?.title ?? "");
  const [description, setDescription] = React.useState(start?.description ?? "");
  const [servings, setServings] = React.useState(start?.servings?.toString() ?? "");
  const [prepMin, setPrepMin] = React.useState(start?.prepMin?.toString() ?? "");
  const [cookMin, setCookMin] = React.useState(start?.cookMin?.toString() ?? "");
  const [tags, setTags] = React.useState<string[]>(start?.tags ?? []);
  const [ingredients, setIngredients] = React.useState<Line[]>(() => (draft ? ingredientLines(draft.ingredients.map((i) => ({ ...i, id: newLineId() }))) : ingredientLines(recipe?.ingredients ?? [])));
  const [steps, setSteps] = React.useState<Line[]>(() =>
    draft ? textLines(draft.steps) : recipe?.steps.length ? recipe.steps.map((s) => ({ key: s.id, text: s.text })) : [blankLine()],
  );
  const [uses, setUses] = React.useState<UsesByStep>(() => Object.fromEntries((recipe?.steps ?? []).filter((s) => s.uses?.length).map((s) => [s.id, s.uses!])));
  const [notes, setNotes] = React.useState(recipe?.notes ?? draft?.notes ?? "");
  const [sourceName, setSourceName] = React.useState(start?.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = React.useState(start?.sourceUrl ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  const [deleting, startDeleting] = React.useTransition();
  const [asking, setAsking] = React.useState<RecipeInput | null>(null);

  const touched = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  React.useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  // A typed tag takes the household's spelling when it matches one ignoring case.
  const spell = (t: string) => tagOptions.find((o) => o.toLowerCase() === t.trim().toLowerCase()) ?? t;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: RecipeInput = {
      title,
      description,
      servings,
      prepMin,
      cookMin,
      notes,
      sourceName,
      sourceUrl,
      tags: cleanTags(tags),
      ingredients: toIngredients(ingredients, recipe?.ingredients ?? []),
      steps: toSteps(steps, recipe?.steps ?? [], uses),
      ...(draft?.sourceUrl && sourceUrl === draft.sourceUrl ? { imported: { imageUrl: draft.imageUrl } } : {}),
    };
    // Once someone has cooked it, a change to what you cook asks whether it is a new version.
    if (recipe && logged && cookable(input.ingredients, input.steps) !== cookable(recipe.ingredients, recipe.steps)) {
      setAsking(input);
      return;
    }
    send(input, false);
  };

  const send = (input: RecipeInput, changed: boolean) => {
    setAsking(null);
    startSaving(async () => {
      const result = recipe ? await updateRecipe(recipe.id, input, changed) : await addRecipe(input);
      if (result?.error) setError(result.error);
    });
  };

  const remove = () => {
    if (!recipe || !window.confirm(`Delete ${recipe.title}? This cannot be undone.`)) return;
    setDirty(false);
    startDeleting(() => deleteRecipe(recipe.id));
  };

  return (
    <Box component="form" onSubmit={save} noValidate>
      <Stack spacing={3.5}>
        <Stack spacing={2}>
          <TextField
            label="Name"
            required
            fullWidth
            autoFocus={!recipe}
            value={title}
            onChange={(e) => touched(setTitle)(e.target.value)}
            placeholder="Grandma's banana bread"
            slotProps={{ htmlInput: { maxLength: 160 } }}
            sx={fieldSx}
          />
          <TextField
            label="About it"
            fullWidth
            multiline
            minRows={2}
            value={description}
            onChange={(e) => touched(setDescription)(e.target.value)}
            placeholder="A line or two: what it is, when you make it"
            sx={fieldSx}
          />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" } }}>
            <TextField label="Servings" value={servings} onChange={(e) => touched(setServings)(digits(e.target.value))} slotProps={{ htmlInput: { inputMode: "numeric" } }} sx={fieldSx} />
            <TextField label="Prep minutes" value={prepMin} onChange={(e) => touched(setPrepMin)(digits(e.target.value))} slotProps={{ htmlInput: { inputMode: "numeric" } }} sx={fieldSx} />
            <TextField label="Cook minutes" value={cookMin} onChange={(e) => touched(setCookMin)(digits(e.target.value))} slotProps={{ htmlInput: { inputMode: "numeric" } }} sx={fieldSx} />
          </Box>
          <Autocomplete
            multiple
            freeSolo
            autoSelect
            options={tagOptions}
            value={tags}
            onChange={(_, v) => touched(setTags)(cleanTags(v.map(spell)))}
            renderValue={(value, getItemProps) =>
              value.map((t, index) => {
                const { key, ...item } = getItemProps({ index });
                return <TagChip key={key} label={t} {...item} />;
              })
            }
            slotProps={{ popper: { disablePortal: true } }}
            renderInput={(params) => <TextField {...params} label="Tags" placeholder={tags.length ? "" : "Dinner, Baking, Fried chicken"} helperText="Press Enter after each tag" sx={fieldSx} />}
          />
        </Stack>

        <Section title="Ingredients" hint="One per line, as written. Enter starts the next line; pasting a list splits it into lines.">
          <LineEditor kind="ingredient" lines={ingredients} onChange={touched(setIngredients)} />
        </Section>

        <Section title="Steps" hint="One step per box. Shift and Enter starts a new line inside a step.">
          <LineEditor kind="step" lines={steps} onChange={touched(setSteps)} />
        </Section>

        <Section title="Step links" hint="Which ingredients each step uses, so the recipe can highlight them. Tap a suggestion to link it; tap a linked one to give the amount when a step uses only part.">
          <StepLinks ingredients={ingredients} steps={steps} uses={uses} onChange={touched(setUses)} />
        </Section>

        <Section title="Notes">
          <TextField fullWidth multiline minRows={2} value={notes} onChange={(e) => touched(setNotes)(e.target.value)} placeholder="Swaps, tips, what to serve it with" slotProps={{ htmlInput: { "aria-label": "Notes" } }} sx={fieldSx} />
        </Section>

        <Section title="Where it came from">
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" } }}>
            <TextField label="Source" value={sourceName} onChange={(e) => touched(setSourceName)(e.target.value)} placeholder="Grandma's card" sx={fieldSx} />
            <TextField label="Link" value={sourceUrl} onChange={(e) => touched(setSourceUrl)(e.target.value)} placeholder="https://" slotProps={{ htmlInput: { inputMode: "url" } }} sx={fieldSx} />
          </Box>
        </Section>

        {error && <Alert severity="error">{error}</Alert>}

        <Dialog open={asking !== null} onClose={() => setAsking(null)} maxWidth="xs" className={skinScope.className} style={skinScope.style} sx={skinSx}>
          <DialogTitle component="h2" variant="h5">
            What kind of change?
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.25}>
              {[
                { changed: false, title: "Small fix", about: "A typo or a clearer step. The ratings stay as they are." },
                { changed: true, title: "Changed the recipe", about: "New amounts, ingredients or method. Ratings start fresh; the old ones stay in the cook log." },
              ].map((o) => (
                <Button
                  key={o.title}
                  variant={o.changed ? "contained" : "outlined"}
                  onClick={() => asking && send(asking, o.changed)}
                  sx={{ display: "block", textAlign: "left", py: 1.25 }}
                >
                  <Box component="span" sx={{ display: "block", fontWeight: 700 }}>{o.title}</Box>
                  <Box component="span" sx={{ display: "block", fontWeight: 400, fontSize: 13.5, opacity: 0.9 }}>{o.about}</Box>
                </Button>
              ))}
              <Button color="inherit" onClick={() => setAsking(null)}>
                Keep editing
              </Button>
            </Stack>
          </DialogContent>
        </Dialog>

        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
          <Button type="submit" variant="contained" size="large" disabled={saving || deleting} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {saving ? "Saving…" : recipe ? "Save changes" : "Add recipe"}
          </Button>
          <Button component={Link} href={recipe ? `/recipes/${recipe.id}` : "/recipes"} size="large" color="inherit">
            Cancel
          </Button>
          {recipe && (
            <Button onClick={remove} color="error" disabled={saving || deleting} sx={{ ml: "auto" }}>
              {deleting ? "Deleting…" : "Delete recipe"}
            </Button>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
