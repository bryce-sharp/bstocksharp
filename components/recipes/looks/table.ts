// Lays out a recipe's step links as a cookingforengineers.com style table: ingredient uses down the left, each step
// a cell spanning the rows it combines, placed one column right of what it continues from. Pure.

import type { LookRecipe } from "./featured";

export type TableRow = { ingredientId: string; amount?: string };
/** A cell on the grid: rows are 0-based and end-exclusive; columns are 1-based (column 0 is the ingredients). */
export type TableCell = { stepId: string | null; row: number; rowEnd: number; col: number; colEnd: number };
export type RecipeTable = { rows: TableRow[]; cells: TableCell[]; columns: number };

/** Null when the steps do not form one tree (a step used twice, or none that finishes the recipe). */
export function layoutTable(recipe: LookRecipe): RecipeTable | null {
  const byId = new Map(recipe.steps.map((s) => [s.id, s]));
  const usedBy = new Map<string, number>();
  for (const s of recipe.steps) for (const a of s.after ?? []) usedBy.set(a, (usedBy.get(a) ?? 0) + 1);
  const roots = recipe.steps.filter((s) => !usedBy.has(s.id));
  if (roots.length !== 1 || [...usedBy.values()].some((n) => n > 1)) return null;

  const rows: TableRow[] = [];
  const cells: TableCell[] = [];
  // Returns the step's rows and column; earlier steps come first, then the step's own ingredients.
  const place = (id: string): { row: number; rowEnd: number; col: number } => {
    const step = byId.get(id)!;
    const row = rows.length;
    const inputs: { row: number; rowEnd: number; col: number }[] = [];
    for (const a of step.after ?? []) inputs.push(place(a));
    for (const u of step.uses ?? []) {
      rows.push({ ingredientId: u.ingredientId, amount: u.amount });
      inputs.push({ row: rows.length - 1, rowEnd: rows.length, col: 0 });
    }
    const col = Math.max(0, ...inputs.map((i) => i.col)) + 1;
    // An input that finished earlier leaves empty boxes until this step picks it up.
    for (const i of inputs) if (i.col < col - 1) cells.push({ stepId: null, row: i.row, rowEnd: i.rowEnd, col: i.col + 1, colEnd: col });
    cells.push({ stepId: id, row, rowEnd: rows.length, col, colEnd: col + 1 });
    return { row, rowEnd: rows.length, col };
  };
  const root = place(roots[0]!.id);
  return { rows, cells, columns: root.col };
}
