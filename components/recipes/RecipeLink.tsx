"use client";

import Box from "@mui/material/Box";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Link from "@/components/shared/AppLink";
import { color } from "./tokens";

/** The way into a recipe an ingredient line uses, opened at the size this one needs. */
export default function RecipeLink({ id, title, scale, newTab = false }: { id: number; title: string; scale: number; newTab?: boolean }) {
  const size = Math.round(scale * 1000) / 1000;
  return (
    <Box
      component={Link}
      href={`/recipes/${id}${size !== 1 ? `?scale=${size}` : ""}`}
      {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, ml: 4, mb: 0.75, fontSize: 13.5, fontWeight: 700, color: color.accent, textDecoration: "underline", textUnderlineOffset: 3 }}
    >
      Open the {title} recipe
      <ArrowForwardIcon sx={{ fontSize: 15 }} />
    </Box>
  );
}
