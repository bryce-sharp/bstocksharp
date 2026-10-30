"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

// A few pleasant accents to pick from for a person's avatar / tile color.
// Shared by the "Add person" and "Edit person" dialogs so both offer the same
// starting palette. All 6-digit hex on purpose — the custom picker below needs
// hex, and the DB column is a short varchar.
export const PROFILE_SWATCHES = [
  "#e0864f",
  "#4caf7d",
  "#5b8def",
  "#c65b7c",
  "#9b6bd6",
  "#d9a441",
];

/**
 * Controlled color chooser: a row of preset swatches plus a "custom" circle that
 * opens the OS color picker, so any color is reachable — not just the presets.
 * `value` is the current hex; `onChange` fires with the chosen hex.
 */
export default function ColorSwatches({
  value,
  onChange,
  label = "Color",
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const isPreset = PROFILE_SWATCHES.includes(value);

  return (
    <Box>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {PROFILE_SWATCHES.map((c) => (
          <Box
            key={c}
            role="radio"
            aria-label={`Color ${c}`}
            aria-checked={c === value}
            onClick={() => onChange(c)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              bgcolor: c,
              cursor: "pointer",
              outline: c === value ? "2px solid" : "none",
              outlineColor: "text.primary",
              outlineOffset: 2,
            }}
          />
        ))}

        {/* Custom color: shows a "+" until a non-preset color is chosen, then
            fills with that color and takes the selected outline. */}
        <Box
          component="label"
          aria-label="Custom color"
          sx={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            cursor: "pointer",
            bgcolor: isPreset ? "transparent" : value,
            border: isPreset ? "1px dashed" : "none",
            borderColor: "divider",
            outline: isPreset ? "none" : "2px solid",
            outlineColor: "text.primary",
            outlineOffset: 2,
          }}
        >
          {isPreset ? (
            <AddIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          ) : null}
          <Box
            component="input"
            type="color"
            value={isPreset ? "#888888" : value}
            onChange={(e) =>
              onChange((e.target as HTMLInputElement).value)
            }
            sx={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
          />
        </Box>
      </Stack>
    </Box>
  );
}
