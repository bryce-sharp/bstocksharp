"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { sizeLabel, sizeSteps } from "@/lib/recipe-units";
import { color } from "./tokens";

/** A recipe's size, picked with − and +: whole servings, or half batches for a recipe without servings; 2× doubles it. */
export default function SizeStepper({ amount, servings, onChange, name }: { amount: number; servings: number | null; onChange: (amount: number) => void; name?: string }) {
  const { step, max } = sizeSteps(servings);
  const of = name ? ` of ${name}` : "";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <Box sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${color.rule}`, borderRadius: 999, bgcolor: color.surface }}>
        <IconButton size="small" aria-label={`Fewer${of}`} disabled={amount <= step} onClick={() => onChange(Math.max(step, amount - step))}>
          <RemoveIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" aria-live="polite" sx={{ minWidth: 92, textAlign: "center", fontWeight: 600 }}>
          {sizeLabel(amount, servings)}
        </Typography>
        <IconButton size="small" aria-label={`More${of}`} disabled={amount >= max} onClick={() => onChange(Math.min(max, amount + step))}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
      <Button size="small" aria-label={name ? `Double ${name}` : "Double the size"} disabled={amount * 2 > max} onClick={() => onChange(amount * 2)} sx={{ minWidth: 0, px: 1 }}>
        2×
      </Button>
    </Box>
  );
}
