"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LinkIcon from "@mui/icons-material/Link";
import Link from "@/components/shared/AppLink";
import { readRecipeLink } from "@/app/actions/recipes";
import { recipeFromText, type RecipeDraft } from "@/lib/recipe-import";
import BackLink from "./BackLink";
import { panelSx } from "./RecipeCard";
import RecipeForm from "./RecipeForm";
import type { RecipeChoice } from "@/lib/queries/recipes";
import { color } from "./tokens";

type Found = { draft: RecipeDraft; existing: { id: number; title: string } | null; from: "link" | "text" };

/** Paste a link (or the recipe's text), check what was read in the usual form, then save it as a new recipe. */
export default function ImportFlow({ tagOptions, recipeChoices }: { tagOptions: string[]; recipeChoices: RecipeChoice[] }) {
  const [link, setLink] = React.useState("");
  const [text, setText] = React.useState("");
  const [pasting, setPasting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [found, setFound] = React.useState<Found | null>(null);
  const [reading, startReading] = React.useTransition();

  const read = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startReading(async () => {
      const result = await readRecipeLink(link);
      if ("draft" in result) setFound({ ...result, from: "link" });
      else {
        setError(result.error);
        if (result.paste) setPasting(true);
      }
    });
  };

  const readText = () => {
    const draft = recipeFromText(text);
    if (!draft.title && !draft.ingredients.length && !draft.steps.length) return setError("There is nothing to read in that text yet.");
    setError(null);
    setFound({ draft: { ...draft, sourceUrl: URL.canParse(link) ? link : "" }, existing: null, from: "text" });
  };

  if (found) {
    const { draft, existing } = found;
    return (
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <BackLink />
        <Typography variant="h3" component="h1" sx={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
          Check it over
        </Typography>
        <Typography sx={{ color: color.muted, mt: 0.5, mb: 2 }}>
          {found.from === "text"
            ? "Read from the pasted text. Check the lines landed in the right places, then save."
            : draft.readFrom === "text"
              ? `${draft.sourceName} has no recipe data on that page, so this was read from the page's text: ${draft.ingredients.length} ingredients and ${draft.steps.length} steps. Check it carefully, then save.`
              : `Read from ${draft.sourceName}: ${draft.ingredients.length} ingredients and ${draft.steps.length} steps. Fix anything that came through oddly, then save.`}
        </Typography>
        {existing && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You already saved this one as{" "}
            <Box component={Link} href={`/recipes/${existing.id}`} sx={{ fontWeight: 700, textDecoration: "underline" }}>
              {existing.title}
            </Box>
            . Saving again makes a second copy.
          </Alert>
        )}
        <Box sx={{ ...panelSx, p: { xs: 2, md: 4 } }}>
          <RecipeForm draft={draft} tagOptions={tagOptions} recipeChoices={recipeChoices} />
        </Box>
        <Button
          onClick={() => {
            setFound(null);
            setLink("");
            setText("");
            setPasting(false);
          }}
          sx={{ mt: 2 }}
        >
          Start over with another link
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <BackLink />
      <Typography variant="h3" component="h1" sx={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
        Import a recipe
      </Typography>
      <Typography sx={{ color: color.muted, mt: 0.5, mb: 2.5 }}>
        Paste a link from a recipe site. Most sites carry the recipe as data we can read; you check it over before anything is saved.
      </Typography>
      <Box sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
        <Box component="form" onSubmit={read} sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
          <TextField
            fullWidth
            autoFocus
            label="Recipe link"
            placeholder="https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            slotProps={{ htmlInput: { inputMode: "url", autoCapitalize: "none", spellCheck: false }, input: { startAdornment: <InputAdornment position="start"><LinkIcon sx={{ color: color.muted }} /></InputAdornment> } }}
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: color.surface } }}
          />
          <Button type="submit" variant="contained" size="large" disabled={reading || !link.trim()} startIcon={reading ? <CircularProgress size={16} color="inherit" /> : null} sx={{ flex: "none" }}>
            {reading ? "Reading…" : "Read recipe"}
          </Button>
        </Box>
        {error && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {pasting ? (
          <Box sx={{ mt: 2.5 }}>
            <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
              Paste the recipe
            </Typography>
            <Typography variant="body2" sx={{ color: color.muted, mb: 1.25 }}>
              Copy the whole recipe from the page. The first line becomes the name; lines under Ingredients and Instructions headings go where they belong.
            </Typography>
            <TextField fullWidth multiline minRows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Grandma's pancakes\nServes 4\n\nIngredients\n1 cup flour\n1 egg\n\nInstructions\nWhisk everything.\nFry 2 minutes a side."} slotProps={{ htmlInput: { "aria-label": "Recipe text" } }} sx={{ "& .MuiOutlinedInput-root": { bgcolor: color.surface } }} />
            <Button variant="contained" onClick={readText} disabled={!text.trim()} sx={{ mt: 1.5 }}>
              Read the text
            </Button>
          </Box>
        ) : (
          <Button onClick={() => setPasting(true)} sx={{ mt: 1.5, px: 1 }}>
            Or paste the recipe&apos;s text
          </Button>
        )}
      </Box>
      <Button component={Link} href="/recipes/new" color="inherit" sx={{ mt: 2 }}>
        Type one in instead
      </Button>
    </Container>
  );
}
