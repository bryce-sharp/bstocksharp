"use client";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Link from "@/components/shared/AppLink";
import { recipeHref } from "@/lib/recipes";
import { color } from "./tokens";

/** The way into a recipe an ingredient line uses, opened at the size this one needs; `from` is the recipe linking to it. */
export default function RecipeLink({ id, title, scale, from, newTab = false, sx }: { id: number; title: string; scale: number; from?: number; newTab?: boolean; sx?: SxProps<Theme> }) {
  return (
    <Box
      component={Link}
      href={recipeHref(id, { scale, ...(from !== undefined ? { from: { kind: "recipe", id: from } } : {}) })}
      {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
      sx={[{ display: "inline-flex", alignItems: "center", gap: 0.5, ml: 4, mb: 0.75, fontSize: 13.5, fontWeight: 700, color: color.accent, textDecoration: "underline", textUnderlineOffset: 3 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      Open the {title} recipe
      <ArrowForwardIcon sx={{ fontSize: 15 }} />
    </Box>
  );
}
