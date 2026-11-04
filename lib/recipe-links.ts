// Step links: which ingredients each step uses, the suggestions edit mode offers, and how an ingredient's
// shares read (docs/recipes/plan.md, "Step links, splits and highlighting"). Pure.

import type { RecipeIngredient, RecipeStep, RecipeUse } from "@/lib/recipes";
import { withAmount, withoutAmount } from "@/lib/recipe-units";

// Words that describe an ingredient without naming it.
const STOP = new Set(
  "a an the of and or for to with plus more about approx extra fresh large small medium big chopped diced minced sliced grated shredded crushed cubed halved quartered peeled finely roughly thinly coarsely freshly packed lightly softened melted room temperature cold warm hot taste divided optional virgin whole unsalted salted boneless skinless ripe raw cooked uncooked dried frozen canned can cans package packages jar jars bunch bunches clove cloves sprig sprigs pinch dash handful stick sticks piece pieces slice slices cup cups tbsp tsp oz lb lbs pound pounds gram grams g kg ml pure good quality store bought homemade low sodium reduced fat".split(" "),
);

/** A word in its singular form, so "eggs" in a step finds "1 egg". */
function singular(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(oes|ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const words = (text: string) => (text.toLowerCase().match(/\p{L}[\p{L}'-]*/gu) ?? []).map((w) => singular(w.replace(/'s$/, "")));

/** The ingredient's name as a chip shows it: no amount, parenthesis, leading describing words or anything after a comma. */
export function shortName(line: string): string {
  const parts = withoutAmount(line).replace(/\([^)]*\)/g, " ").split(",")[0]!.trim().split(/\s+/);
  while (parts.length > 1 && STOP.has(singular(parts[0]!.toLowerCase()))) parts.shift();
  const name = parts.join(" ");
  return (name || line.trim()).slice(0, 40);
}

/** The words that name an ingredient, one list per thing it names ("salt and pepper" names two). */
function names(line: string): string[][] {
  return shortName(line)
    .toLowerCase()
    .split(/\s+(?:and|or)\s+|\s*\/\s*/)
    .map((part) => words(part).filter((w) => w.length > 2 && !STOP.has(w)))
    .filter((n) => n.length > 0);
}

/**
 * For each step, the ingredients its words name that it does not use. A step names an ingredient by its last word
 * ("flour"); when two ingredients share that word ("brown sugar", "white sugar"), it takes the word before too.
 */
export function namedIngredients(ingredients: RecipeIngredient[], steps: RecipeStep[]): Map<string, string[]> {
  const named = ingredients.filter((i) => i.text.trim()).map((i) => ({ id: i.id, names: names(i.text) }));
  const lastWords = new Map<string, number>();
  for (const n of named) for (const w of new Set(n.names.map((x) => x.at(-1)!))) lastWords.set(w, (lastWords.get(w) ?? 0) + 1);
  const out = new Map<string, string[]>();
  for (const step of steps) {
    const said = words(step.text);
    const pairs = new Set(said.slice(1).map((w, i) => `${said[i]} ${w}`));
    const used = new Set((step.uses ?? []).map((u) => u.ingredientId));
    const found = named
      .filter((n) => !used.has(n.id))
      .filter((n) =>
        n.names.some((name) => {
          const last = name.at(-1)!;
          if (!said.includes(last)) return false;
          return (lastWords.get(last) ?? 0) < 2 || name.length < 2 || pairs.has(`${name.at(-2)} ${last}`);
        }),
      )
      .map((n) => n.id);
    if (found.length) out.set(step.id, found);
  }
  return out;
}

/** The links edit mode suggests: each ingredient at the first step that names it, not again at later mentions. */
export function suggestUses(ingredients: RecipeIngredient[], steps: RecipeStep[]): Map<string, string[]> {
  const named = namedIngredients(ingredients, steps);
  const taken = new Set<string>();
  const out = new Map<string, string[]>();
  for (const step of steps) {
    const fresh = (named.get(step.id) ?? []).filter((id) => !taken.has(id));
    if (fresh.length) out.set(step.id, fresh);
    for (const id of fresh) taken.add(id);
    for (const u of step.uses ?? []) if (!u.amount) taken.add(u.ingredientId);
  }
  return out;
}

export type Share = { step: number; amount?: string };

/** Where an ingredient goes: each step that uses it, in order, with that step's amount when only part is used. */
export function sharesOf(ingredientId: string, steps: RecipeStep[]): Share[] {
  return steps.flatMap((s, i) => (s.uses ?? []).filter((u) => u.ingredientId === ingredientId).map((u) => ({ step: i + 1, ...(u.amount ? { amount: u.amount } : {}) })));
}

/** The line a step's use reads as: its share, the rest when another step takes a share, or the whole line. */
export function lineForUse(ingredient: RecipeIngredient, amount: string | undefined, steps: RecipeStep[]): string {
  if (amount) return withAmount(ingredient.text, amount);
  if (!sharesOf(ingredient.id, steps).some((s) => s.amount)) return ingredient.text;
  const name = withoutAmount(ingredient.text);
  return `Rest of the ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

/** The uses that still point at an ingredient of the recipe. */
export function liveUses(uses: RecipeUse[] | undefined, ingredients: RecipeIngredient[]): RecipeUse[] {
  const ids = new Set(ingredients.map((i) => i.id));
  return (uses ?? []).filter((u) => ids.has(u.ingredientId));
}
