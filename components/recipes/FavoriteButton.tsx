"use client";

import * as React from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { setRecipeFavorite } from "@/app/actions/recipes";
import { color } from "./tokens";

/** The person's own heart on a recipe; shows the change at once and puts it back if saving fails. */
export default function FavoriteButton({
  recipeId,
  favorite,
  person,
  canFavorite,
  size = "medium",
}: {
  recipeId: number;
  favorite: boolean;
  person: string | null;
  canFavorite: boolean;
  size?: "small" | "medium";
}) {
  const [optimistic, setOptimistic] = React.useOptimistic(favorite);
  const [, startTransition] = React.useTransition();
  const whose = person ? `${person}'s` : "your";
  const label = !canFavorite
    ? `Only ${person ?? "that person"} can change their favorites`
    : optimistic
      ? `Remove from ${whose} favorites`
      : `Add to ${whose} favorites`;

  const toggle = () =>
    startTransition(async () => {
      setOptimistic(!optimistic);
      try {
        await setRecipeFavorite(recipeId, !optimistic);
      } catch {
        // The heart goes back to how it was when the transition ends.
      }
    });

  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size={size}
          aria-label={label}
          aria-pressed={optimistic}
          disabled={!canFavorite}
          onClick={toggle}
          sx={{ color: optimistic ? color.accent : color.muted, "&.Mui-disabled": { color: optimistic ? color.accent : color.rule } }}
        >
          {optimistic ? <FavoriteIcon fontSize="inherit" /> : <FavoriteBorderIcon fontSize="inherit" />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
