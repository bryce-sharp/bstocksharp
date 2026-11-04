"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
import { color } from "./tokens";

const STAR_WORDS = ["", "Not again", "It was okay", "Good", "Really good", "A favorite"];

/** Pick 1 to 5 stars, or none, with the word for the stars pointed at or picked. */
export default function StarInput({
  name,
  value,
  onChange,
  size = "large",
  label,
}: {
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
  size?: "medium" | "large";
  /** The accessible name when no visible legend names the stars. */
  label?: string;
}) {
  const [hover, setHover] = React.useState(-1);
  const shown = hover !== -1 ? hover : (value ?? 0);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Rating
        name={name}
        value={value}
        onChange={(_, v) => onChange(v)}
        onChangeActive={(_, v) => setHover(v)}
        size={size}
        aria-label={label}
        sx={{ color: color.star, "& .MuiRating-iconEmpty": { color: color.rule } }}
      />
      <Typography variant="body2" sx={{ color: color.muted, minWidth: 90 }}>
        {STAR_WORDS[shown] ?? ""}
      </Typography>
    </Box>
  );
}
