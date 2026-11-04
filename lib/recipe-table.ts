// At a glance (docs/recipes/plan.md): a recipe's step links as a cookingforengineers.com style table, with ingredient
// uses down the left and each step a cell spanning the rows it combines, one column right of what it continues
// from. Pure, so the recipe page and the looks lab draw the same table.

import type { RecipeIngredient, RecipeStep } from "@/lib/recipes";
import { formatMinutes, stepTimers } from "@/lib/recipes";
import { namedIngredients } from "@/lib/recipe-links";

export type TableRow = { ingredientId: string; amount?: string };
/** A cell on the grid: rows are 0-based and end-exclusive; columns are 1-based (column 0 is the ingredients). */
export type TableCell = { stepId: string | null; row: number; rowEnd: number; col: number; colEnd: number };
/** `before` holds the steps with nothing to combine, like heating the oven, shown across the top. */
export type RecipeTable = { before: string[]; rows: TableRow[]; cells: TableCell[]; columns: number; unused: string[] };

// A step that runs alongside the main line ("Meanwhile, toast the nuts").
const SIDE = /^\s*(meanwhile|while)\b/i;
// A step that starts in its own bowl or pan ("In another bowl, whisk the flour").
const VESSEL = /^\s*(in|using)\s+(a|an|another|a separate|a second|a clean)\b[^,.]*\b(bowl|pan|pot|saucepan|skillet|dish|jar|cup|blender|processor|mixer)\b/i;
// Words that bring something already started into this step.
const COMBINE = /\b(add|adding|into the|onto the|over the|combine|fold|(?:stir|beat|whisk|mix|work|knead|blend|cut|pulse) in|toss|return|transfer|pour|spread|top|layer|together|mixture|batter|dough|filling|everything)\b/i;
// Words that point back at a bowl's work without naming what is in it.
const MIXTURE = /\b(mixture|mix|batter|dough|filling|marinade|wet|dry|everything)\b/i;

/** What each step continues from, guessed from order and words when the recipe does not say (plan.md, "At a glance"). */
export function guessAfter(ingredients: RecipeIngredient[], steps: RecipeStep[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (steps.some((s) => s.after?.length)) {
    for (const s of steps) out.set(s.id, s.after ?? []);
    return out;
  }
  const named = namedIngredients(ingredients, steps);
  const order = new Map(steps.map((s, i) => [s.id, i]));
  const holds = new Map<string, Set<string>>();
  const side = new Set<string>();
  const fresh = new Set<string>();
  const vessel = new Set<string>();
  const open: string[] = [];
  for (const s of steps) {
    const uses = new Set((s.uses ?? []).map((u) => u.ingredientId));
    const names = new Set(named.get(s.id) ?? []);
    const mentioned = open.filter((tip) => [...holds.get(tip)!].some((i) => names.has(i) && !uses.has(i)));
    const main = [...open].reverse().find((tip) => !side.has(tip)) ?? open.at(-1);
    const starts = open.length === 0 || SIDE.test(s.text) || VESSEL.test(s.text) || (uses.size > 0 && mentioned.length === 0 && !COMBINE.test(s.text));
    // A setup step with nothing in it ("Meanwhile, heat the grill") sits across the top instead.
    if (starts && uses.size === 0 && mentioned.length === 0) {
      out.set(s.id, []);
      continue;
    }
    let after: string[];
    if (starts) after = mentioned;
    // A step naming the butter does not also take the separate flour bowl unless it says "mixture" or the like.
    else if (mentioned.length) after = [...new Set([...(vessel.has(main!) && !MIXTURE.test(s.text) ? [] : [main!]), ...mentioned])];
    else {
      after = [main!];
      // "Fold the dry mix into the wet": a step bringing a fresh bowl's work in takes the main line too.
      if (fresh.has(main!) && COMBINE.test(s.text)) {
        const other = [...open].reverse().find((tip) => tip !== main && !side.has(tip));
        if (other) after.push(other);
      }
    }
    after.sort((a, b) => order.get(a)! - order.get(b)!);
    out.set(s.id, after);
    const held = new Set(uses);
    for (const a of after) for (const i of holds.get(a)!) held.add(i);
    holds.set(s.id, held);
    if (SIDE.test(s.text)) side.add(s.id);
    if (starts && after.length === 0) fresh.add(s.id);
    if (VESSEL.test(s.text)) vessel.add(s.id);
    for (const a of after) open.splice(open.indexOf(a), 1);
    open.push(s.id);
  }
  const last = steps.at(-1);
  if (last && open.length > 1) out.set(last.id, [...out.get(last.id)!, ...open.filter((tip) => tip !== last.id)].sort((a, b) => order.get(a)! - order.get(b)!));
  return out;
}

// Opening phrases before the action word: "In a large bowl, whisk" reads as "Whisk".
const LEAD = /^\s*(?:(?:meanwhile|then|next|finally|first|now|once [^,]*|when [^,]*|while [^,]*|after [^,]*|(?:in|using|on|with) [^,]*)\s*,\s*)+/i;
const PARTICLE = new Set(["in", "together", "up", "down", "out", "over", "off", "through"]);
const TIMED = new Set(["bake", "roast", "simmer", "cook", "boil", "rest", "chill", "cool", "fry", "grill", "broil", "steam", "braise", "marinate", "refrigerate", "freeze", "rise", "proof"]);

/** The short action word a cell shows: the step's own label, or its first verb ("Stir in", "Bake 55 min"). */
export function stepLabel(step: RecipeStep): string {
  if (step.label?.trim()) return step.label.trim();
  const said = step.text.replace(LEAD, "").match(/\p{L}[\p{L}'-]*/gu) ?? [];
  // "Lightly season" reads as "Season".
  while (said.length > 1 && /ly$/i.test(said[0]!) && !/^(apply|fly|rely|reply|ply)$/i.test(said[0]!)) said.shift();
  const verb = said[0];
  if (!verb) return step.text.slice(0, 24);
  const word = verb[0]!.toUpperCase() + verb.slice(1).toLowerCase();
  const timed = TIMED.has(verb.toLowerCase());
  // "Stir in" keeps its particle; a timed verb's "in" is a place ("Cool in the pan").
  const label = !timed && said[1] && PARTICLE.has(said[1].toLowerCase()) ? `${word} ${said[1].toLowerCase()}` : word;
  const timer = timed ? stepTimers(step.text)[0] : undefined;
  return timer ? `${label} ${formatMinutes(Math.max(1, Math.round(timer.seconds / 60)))}` : label;
}

/** The table, or null when no step uses an ingredient (the recipe has no step links yet). */
export function layoutTable(ingredients: RecipeIngredient[], steps: RecipeStep[]): RecipeTable | null {
  const known = new Set(ingredients.map((i) => i.id));
  const live = steps.map((s) => ({ ...s, uses: (s.uses ?? []).filter((u) => known.has(u.ingredientId)) }));
  if (!live.some((s) => s.uses.length)) return null;
  const lead = live.findIndex((s) => s.uses.length > 0);
  const guessed = guessAfter(ingredients, live.slice(lead));
  const after = new Map([...live.slice(0, lead).map((s): [string, string[]] => [s.id, s.after ?? []]), ...guessed]);
  const setup = (s: RecipeStep) => !s.uses?.length && !(after.get(s.id) ?? []).length;
  const before = live.filter(setup).map((s) => s.id);
  const rest = live.filter((s) => !setup(s));
  const byId = new Map(rest.map((s) => [s.id, s]));
  const usedBy = new Map<string, number>();
  for (const s of rest) for (const a of after.get(s.id) ?? []) if (byId.has(a)) usedBy.set(a, (usedBy.get(a) ?? 0) + 1);
  const roots = rest.filter((s) => !usedBy.has(s.id));
  if (roots.length !== 1 || [...usedBy.values()].some((n) => n > 1)) return null;

  const rows: TableRow[] = [];
  const cells: TableCell[] = [];
  const seen = new Set<string>();
  // Places a step after the steps it continues from and its own ingredients; returns its rows and column.
  const place = (id: string): { row: number; rowEnd: number; col: number } | null => {
    if (seen.has(id)) return null;
    seen.add(id);
    const step = byId.get(id)!;
    const row = rows.length;
    const inputs: { row: number; rowEnd: number; col: number }[] = [];
    for (const a of after.get(id) ?? []) {
      if (!byId.has(a)) continue;
      const placed = place(a);
      if (!placed) return null;
      inputs.push(placed);
    }
    for (const u of step.uses) {
      rows.push({ ingredientId: u.ingredientId, ...(u.amount ? { amount: u.amount } : {}) });
      inputs.push({ row: rows.length - 1, rowEnd: rows.length, col: 0 });
    }
    if (rows.length === row) return null;
    const col = Math.max(0, ...inputs.map((i) => i.col)) + 1;
    // An input that finished earlier leaves empty boxes until this step picks it up.
    for (const i of inputs) if (i.col < col - 1) cells.push({ stepId: null, row: i.row, rowEnd: i.rowEnd, col: i.col + 1, colEnd: col });
    cells.push({ stepId: id, row, rowEnd: rows.length, col, colEnd: col + 1 });
    return { row, rowEnd: rows.length, col };
  };
  const root = place(roots[0]!.id);
  if (!root || seen.size !== rest.length) return null;
  const used = new Set(rows.map((r) => r.ingredientId));
  return { before, rows, cells, columns: root.col, unused: ingredients.filter((i) => i.text.trim() && !used.has(i.id)).map((i) => i.id) };
}
