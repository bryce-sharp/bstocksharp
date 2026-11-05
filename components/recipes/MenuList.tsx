"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import Link from "@/components/shared/AppLink";
import type { MenuSummary, RecipeChoice } from "@/lib/queries/recipes";
import BackLink from "./BackLink";
import { MenuDialog } from "./MenuDialogs";
import { madeLine } from "./MenuView";
import { panelSx } from "./RecipeCard";
import Stars from "./Stars";
import { color } from "./tokens";

/** The household's menus, most recently made or added first, with New menu. */
export default function MenuList({ menus, recipeChoices, today }: { menus: MenuSummary[]; recipeChoices: RecipeChoice[]; today: string }) {
  const [adding, setAdding] = React.useState(false);
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <BackLink />
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2, mb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h3" component="h1">
            Menus
          </Typography>
          <Typography sx={{ color: color.muted }}>Recipes that go together, ready to make again</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)} disabled={recipeChoices.length === 0}>
          New menu
        </Button>
      </Box>
      {menus.length === 0 ? (
        <Box sx={{ ...panelSx, p: { xs: 2.5, md: 4 }, textAlign: "center" }}>
          <Typography sx={{ color: color.muted }}>
            {recipeChoices.length === 0 ? "Add a recipe first, then group recipes into menus." : "No menus yet. Make one from recipes that go together, like a burger night."}
          </Typography>
        </Box>
      ) : (
        <Box component="ul" sx={{ ...panelSx, listStyle: "none", m: 0, p: 0, overflow: "hidden" }}>
          {menus.map((m, i) => (
            <Box component="li" key={m.id} sx={{ borderTop: i ? `1px solid ${color.rule}` : "none" }}>
              <Box component={Link} href={`/recipes/menus/${m.id}`} sx={{ display: "block", px: { xs: 2, md: 3 }, py: 1.75, color: "inherit", textDecoration: "none", "&:hover, &:focus-visible": { bgcolor: color.highlight } }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 17, flex: "1 1 auto" }}>{m.name}</Typography>
                  {m.stars !== null && <Stars value={m.stars} size={15} />}
                  <Typography variant="body2" sx={{ color: color.muted }}>
                    {madeLine(m.timesMade, m.lastMade, today)}
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
      {adding && <MenuDialog open onClose={() => setAdding(false)} recipeChoices={recipeChoices} />}
    </Container>
  );
}
