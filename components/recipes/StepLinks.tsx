"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { shortName, suggestUses } from "@/lib/recipe-links";
import type { RecipeUse } from "@/lib/recipes";
import type { Line } from "./lines";
import TagChip from "./TagChip";
import { color } from "./tokens";

export type UsesByStep = Record<string, RecipeUse[]>;

/**
 * Which ingredients each step uses, for highlighting and split amounts. Words in a step suggest its ingredients;
 * nothing links until the cook taps a suggestion. A linked ingredient takes an amount when a step uses only part.
 */
export default function StepLinks({ ingredients, steps, uses, onChange }: { ingredients: Line[]; steps: Line[]; uses: UsesByStep; onChange: (next: UsesByStep) => void }) {
  const [editing, setEditing] = React.useState<{ step: string; ingredient: string } | null>(null);
  const ings = ingredients.filter((l) => !l.heading && l.text.trim()).map((l) => ({ id: l.key, text: l.text }));
  const live = steps.filter((l) => l.text.trim());
  const known = new Set(ings.map((i) => i.id));
  const usesOf = (step: string) => (uses[step] ?? []).filter((u) => known.has(u.ingredientId));
  const suggested = suggestUses(
    ings,
    live.map((l) => ({ id: l.key, text: l.text, uses: usesOf(l.key) })),
  );
  const waiting = [...suggested.values()].reduce((n, ids) => n + ids.length, 0);
  const name = (id: string) => shortName(ings.find((i) => i.id === id)?.text ?? "");

  const set = (step: string, next: RecipeUse[]) => onChange({ ...uses, [step]: next });
  const link = (step: string, ids: string[]) => set(step, [...usesOf(step), ...ids.map((ingredientId) => ({ ingredientId }))]);
  const linkAll = () => {
    const next = { ...uses };
    for (const [step, ids] of suggested) next[step] = [...usesOf(step), ...ids.map((ingredientId) => ({ ingredientId }))];
    onChange(next);
  };

  if (!ings.length || !live.length) return <Typography sx={{ color: color.muted }}>Add ingredients and steps first.</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {waiting > 0 && (
        <Box>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={linkAll}>
            Link all {waiting} {waiting === 1 ? "suggestion" : "suggestions"}
          </Button>
        </Box>
      )}
      {live.map((step, i) => {
        const linked = usesOf(step.key);
        const offered = suggested.get(step.key) ?? [];
        const others = ings.filter((ing) => !linked.some((u) => u.ingredientId === ing.id) && !offered.includes(ing.id));
        const open = editing?.step === step.key ? linked.find((u) => u.ingredientId === editing.ingredient) : undefined;
        return (
          <Box key={step.key} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${color.rule}`, bgcolor: color.surface }}>
            <Typography variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 1 }}>
              <Box component="span" sx={{ fontWeight: 700, color: color.accent }}>
                Step {i + 1}.{" "}
              </Box>
              {step.text}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
              {linked.map((u) => (
                <TagChip
                  key={u.ingredientId}
                  selected
                  size="small"
                  label={u.amount ? `${name(u.ingredientId)} · ${u.amount}` : name(u.ingredientId)}
                  onClick={() => setEditing(open?.ingredientId === u.ingredientId ? null : { step: step.key, ingredient: u.ingredientId })}
                  onDelete={() => set(step.key, linked.filter((x) => x.ingredientId !== u.ingredientId))}
                  aria-label={`${name(u.ingredientId)}, linked${u.amount ? `, ${u.amount}` : ""}. Change the amount`}
                />
              ))}
              {offered.map((id) => (
                <TagChip key={id} size="small" variant="outlined" icon={<AddIcon />} label={name(id)} onClick={() => link(step.key, [id])} sx={{ borderStyle: "dashed" }} aria-label={`Link ${name(id)}`} />
              ))}
              {others.length > 0 && (
                <TextField
                  select
                  size="small"
                  value=""
                  onChange={(e) => e.target.value && link(step.key, [e.target.value])}
                  slotProps={{ select: { native: true }, htmlInput: { "aria-label": `Link another ingredient to step ${i + 1}` } }}
                  sx={{ minWidth: 150, "& .MuiNativeSelect-select": { py: 0.5, fontSize: 13 } }}
                >
                  <option value="">Add another…</option>
                  {others.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {shortName(ing.text)}
                    </option>
                  ))}
                </TextField>
              )}
            </Box>
            {open && (
              <TextField
                autoFocus
                size="small"
                label={`How much ${name(open.ingredientId)} in this step`}
                placeholder="All of it"
                value={open.amount ?? ""}
                onChange={(e) => {
                  const amount = e.target.value.slice(0, 40);
                  set(step.key, linked.map((x) => (x.ingredientId === open.ingredientId ? { ingredientId: x.ingredientId, ...(amount.trim() ? { amount } : {}) } : x)));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setEditing(null);
                  }
                }}
                onBlur={() => setEditing(null)}
                helperText="Only when the step uses part of it, like 2 of 4 eggs"
                sx={{ mt: 1.25, maxWidth: 320, display: "flex" }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
