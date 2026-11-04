// The recipe form's editor lines and how they map to a recipe's ingredients and steps. Pure.

import { newLineId, type RecipeIngredient, type RecipeStep, type RecipeUse } from "@/lib/recipes";

/** One editable line: an ingredient, a step, or a heading over the ingredients below it. */
export type Line = { key: string; text: string; heading?: boolean };

export const blankLine = (heading = false): Line => ({ key: newLineId(), text: "", ...(heading ? { heading } : {}) });

/** Plain lines, such as an imported recipe's, each with a new id; one blank line when there are none. */
export function textLines(texts: string[]): Line[] {
  return texts.length ? texts.map((text) => ({ ...blankLine(), text })) : [blankLine()];
}

/** Ingredients as editor lines, with a heading wherever the group changes; an empty heading ends a group. */
export function ingredientLines(ingredients: RecipeIngredient[]): Line[] {
  const lines: Line[] = [];
  let group: string | undefined;
  for (const ing of ingredients) {
    if (ing.group !== group) lines.push({ ...blankLine(true), text: ing.group ?? "" });
    group = ing.group;
    lines.push({ key: ing.id, text: ing.text });
  }
  return lines.length ? lines : [blankLine()];
}

/** Editor lines back into ingredients: each one under the heading above it, keeping fields the form does not edit. */
export function toIngredients(lines: Line[], before: RecipeIngredient[]): RecipeIngredient[] {
  const old = new Map(before.map((i) => [i.id, i]));
  let group: string | undefined;
  const out: RecipeIngredient[] = [];
  for (const l of lines) {
    if (l.heading) {
      group = l.text.trim() || undefined;
      continue;
    }
    const { group: _oldGroup, ...kept } = old.get(l.key) ?? { id: l.key, text: "" };
    out.push({ ...kept, id: l.key, text: l.text, ...(group ? { group } : {}) });
  }
  return out;
}

/** Editor lines back into steps, with the step links the form holds, keeping fields the form does not edit. */
export function toSteps(lines: Line[], before: RecipeStep[], uses: Record<string, RecipeUse[]>): RecipeStep[] {
  const old = new Map(before.map((s) => [s.id, s]));
  return lines.map((l) => {
    const { uses: _oldUses, ...kept } = old.get(l.key) ?? { id: l.key, text: "" };
    const linked = uses[l.key]?.map(({ amount, ...use }) => (amount?.trim() ? { ...use, amount: amount.trim() } : use));
    return { ...kept, id: l.key, text: l.text, ...(linked?.length ? { uses: linked } : {}) };
  });
}
