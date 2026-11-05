"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { RecipeIngredient, RecipeStep } from "@/lib/recipes";
import { stepLabel, type RecipeTable } from "@/lib/recipe-table";
import { lineForUse } from "@/lib/recipe-links";
import { batchesOf, showIngredient, showTemperatures, type UnitSystem } from "@/lib/recipe-units";
import RecipeLink from "./RecipeLink";
import { color } from "./tokens";

/** The At a glance table: ingredient uses down the left, each step a cell spanning what it combines; a tap reads the step. */
export default function GlanceTable({
  recipeId,
  table,
  ingredients,
  steps,
  factor,
  units,
  linked,
}: {
  recipeId: number;
  table: RecipeTable;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  factor: number;
  units: UnitSystem;
  linked: Record<number, string>;
}) {
  const [picked, setPicked] = React.useState<string | null>(null);
  const [pointed, setPointed] = React.useState<string | null>(null);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const number = new Map(steps.map((s, i) => [s.id, i + 1]));
  const stepOf = new Map(steps.map((s) => [s.id, s]));
  const focus = pointed ?? picked;
  const span = table.cells.find((c) => c.stepId !== null && c.stepId === focus);
  const lit = (row: number) => span !== undefined && span.row <= row && row < span.rowEnd;
  const top = table.before.length;
  const chosen = picked ? stepOf.get(picked) : undefined;
  const box = { bgcolor: color.surface, px: 1, py: 0.75, fontSize: 14, lineHeight: 1.35, display: "flex", alignItems: "center" } as const;

  return (
    <Box>
      <Box sx={{ overflowX: "auto", mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 } }}>
        <Box
          role="group"
          aria-label="The recipe at a glance"
          sx={{
            display: "grid",
            gridTemplateColumns: `minmax(170px, 1.5fr) repeat(${table.columns}, minmax(88px, 1fr))`,
            gap: "1px",
            bgcolor: color.rule,
            border: `1px solid ${color.rule}`,
            minWidth: 170 + table.columns * 90,
          }}
        >
          {table.before.map((id, i) => (
            <Box key={id} sx={{ ...box, justifyContent: "center", textAlign: "center", gridColumn: `1 / ${table.columns + 2}`, gridRow: i + 1, color: color.muted }}>
              {showTemperatures(stepOf.get(id)?.text ?? "", units)}
            </Box>
          ))}
          {table.rows.map((r, i) => {
            const ing = byId.get(r.ingredientId)!;
            const inner = ing.recipeId !== undefined ? linked[ing.recipeId] : undefined;
            return (
              <Box key={`row-${i}`} sx={{ ...box, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gridColumn: 1, gridRow: top + i + 1, ...(lit(i) ? { bgcolor: color.highlight } : {}) }}>
                {showIngredient(lineForUse(ing, r.amount, steps), factor, units)}
                {inner && <RecipeLink id={ing.recipeId!} title={inner} scale={batchesOf(ing.text) * factor} from={recipeId} sx={{ ml: 0, mb: 0, mt: 0.25 }} />}
              </Box>
            );
          })}
          {table.cells.map((c, i) => {
            const place = { gridRow: `${top + c.row + 1} / ${top + c.rowEnd + 1}`, gridColumn: `${c.col + 1} / ${c.colEnd + 1}` };
            const step = c.stepId ? stepOf.get(c.stepId) : undefined;
            if (!step) return <Box key={`gap-${i}`} aria-hidden sx={{ ...box, ...place }} />;
            const on = focus === step.id;
            return (
              <ButtonBase
                key={step.id}
                aria-pressed={picked === step.id}
                aria-label={`Step ${number.get(step.id)}: ${step.text}`}
                title={step.text}
                onClick={() => setPicked((p) => (p === step.id ? null : step.id))}
                onMouseEnter={() => setPointed(step.id)}
                onMouseLeave={() => setPointed(null)}
                onFocus={() => setPointed(step.id)}
                onBlur={() => setPointed(null)}
                sx={{
                  ...box,
                  ...place,
                  justifyContent: "center",
                  textAlign: "center",
                  font: "inherit",
                  fontWeight: 700,
                  fontSize: 14,
                  flexDirection: "column",
                  gap: 0.25,
                  bgcolor: on ? color.highlight : color.surface,
                  outline: picked === step.id ? `2px solid ${color.accent}` : "none",
                  outlineOffset: -3,
                  "&:focus-visible": { outline: `2px solid ${color.accent}`, outlineOffset: -3 },
                }}
              >
                <Box component="span" aria-hidden sx={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, color: color.accent, fontSize: 13 }}>
                  {number.get(step.id)}
                </Box>
                {showTemperatures(stepLabel(step), units)}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
      <Box aria-live="polite" sx={{ mt: 1.5, minHeight: 48 }}>
        {chosen ? (
          <Box sx={{ display: "flex", gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: color.highlight }}>
            <Box component="span" sx={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, color: color.accent, fontSize: 20, lineHeight: 1.25 }}>
              {number.get(chosen.id)}
            </Box>
            <Typography sx={{ whiteSpace: "pre-line" }}>{showTemperatures(chosen.text, units)}</Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: color.muted }}>
            Tap a step to read it.
          </Typography>
        )}
      </Box>
      {table.unused.length > 0 && (
        <Typography variant="body2" sx={{ color: color.muted, mt: 1 }}>
          Not linked to a step: {table.unused.map((id) => showIngredient(byId.get(id)?.text ?? "", factor, units)).join(" · ")}
        </Typography>
      )}
    </Box>
  );
}
