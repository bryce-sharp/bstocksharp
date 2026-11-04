"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import Link from "@/components/shared/AppLink";
import type { MealSummary, RecipeChoice } from "@/lib/queries/recipes";
import { shortDay } from "@/lib/recipes";
import BackLink from "./BackLink";
import type { Cook } from "./CookLogDialog";
import MealDialog from "./MealDialog";
import { panelSx } from "./RecipeCard";
import Stars from "./Stars";
import { color } from "./tokens";

/** The household's meals, newest first, with Log a meal. */
export default function MealList({ meals, recipeChoices, cooks, defaultCook, today }: { meals: MealSummary[]; recipeChoices: RecipeChoice[]; cooks: Cook[]; defaultCook: number | null; today: string }) {
  const [logging, setLogging] = React.useState(false);
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <BackLink />
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2, mb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h3" component="h1">
            Meals
          </Typography>
          <Typography sx={{ color: color.muted }}>Dinners and occasions, with how the recipes went together</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLogging(true)} disabled={recipeChoices.length === 0}>
          Log a meal
        </Button>
      </Box>
      {meals.length === 0 ? (
        <Box sx={{ ...panelSx, p: { xs: 2.5, md: 4 }, textAlign: "center" }}>
          <Typography sx={{ color: color.muted }}>
            {recipeChoices.length === 0 ? "Add a recipe first, then log the meals it was part of." : "No meals yet. Log one after a dinner with a few recipes."}
          </Typography>
        </Box>
      ) : (
        <Box component="ul" sx={{ ...panelSx, listStyle: "none", m: 0, p: 0, overflow: "hidden" }}>
          {meals.map((m, i) => (
            <Box component="li" key={m.id} sx={{ borderTop: i ? `1px solid ${color.rule}` : "none" }}>
              <Box component={Link} href={`/recipes/meals/${m.id}`} sx={{ display: "block", px: { xs: 2, md: 3 }, py: 1.75, color: "inherit", textDecoration: "none", "&:hover, &:focus-visible": { bgcolor: color.highlight } }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 17, flex: "1 1 auto" }}>{m.name}</Typography>
                  {m.stars !== null && <Stars value={m.stars} size={15} />}
                  <Typography variant="body2" sx={{ color: color.muted }}>
                    {shortDay(m.cookedOn, today)}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: color.muted, mt: 0.25 }}>
                  {m.dishes.join(" · ") || "Its recipes are gone"}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {logging && <MealDialog open onClose={() => setLogging(false)} recipeChoices={recipeChoices} cooks={cooks} defaultCook={defaultCook} today={today} />}
    </Container>
  );
}
