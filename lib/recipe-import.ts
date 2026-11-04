// Reading a recipe out of a web page or pasted text. Pages carry a schema.org Recipe in JSON-LD (the data search
// engines read for recipe cards); pasted text is split on its Ingredients and Steps headings. Pure.

import { RECIPE_LIMITS, cleanTags, splitPasted } from "@/lib/recipes";

/** A recipe read from somewhere, for the form to show before anything is saved. */
export type RecipeDraft = {
  title: string;
  description: string;
  servings: number | null;
  prepMin: number | null;
  cookMin: number | null;
  tags: string[];
  ingredients: DraftIngredient[];
  steps: string[];
  notes: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  /** How it was read: from the page's recipe data, or guessed from its text (worth a closer look). */
  readFrom: "data" | "text";
};

/** An ingredient line with the heading it sits under, if any ("Dough", "For the frosting"). */
export type DraftIngredient = { text: string; group?: string };

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "-", hellip: "…", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };

/** Text with tags removed, entities decoded and spaces tidied. */
export function plainText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
      if (code[0] === "#") {
        const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Minutes in an ISO 8601 duration like PT1H30M or P0DT45M, or null. */
export function isoMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(v.trim());
  if (!m || !m.slice(1).some(Boolean)) return null;
  const [d, h, min, s] = m.slice(1).map((x) => Number(x ?? 0));
  const total = Math.round(d! * 1440 + h! * 60 + min! + s! / 60);
  return total > 0 && total <= 10_000 ? total : null;
}

// A yield of whole things ("1 Loaf", "2 pies") counts batches, not servings. Sites often add the bare count too
// (["1", "1 Loaf"]), which is skipped; a different bare count (["12", "1 loaf"]) is the servings.
const WHOLE_THING = /\b(loaf|loaves|cakes?|pies?|pans?|batch(es)?|tarts?|dish(es)?|pots?|bundts?|trays?|sheets?|rings?|jars?|quarts?|gallons?)\b/i;
const firstInt = (item: unknown) => (typeof item === "number" ? item : Number(/\d+/.exec(String(item))?.[0]));

/** The servings in a yield like "4", "4 servings", "Makes 12 cookies" or ["12", "1 loaf"]; null for "1 Loaf" alone. */
export function yieldServings(v: unknown): number | null {
  const items = asArray(v);
  const wholeCounts = new Set(items.filter((i) => WHOLE_THING.test(String(i))).map(firstInt));
  for (const item of items) {
    if (WHOLE_THING.test(String(item))) continue;
    const n = firstInt(item);
    if (/^\s*\d+\s*$/.test(String(item)) && wholeCounts.has(n)) continue;
    if (Number.isInteger(n) && n >= 1 && n <= 999) return n;
  }
  return null;
}

/** Every JSON-LD object on the page, flattening arrays and @graph lists. */
function jsonLdObjects(html: string): Json[] {
  const out: Json[] = [];
  const visit = (v: unknown) => {
    for (const item of asArray(v)) {
      if (!isObject(item)) continue;
      out.push(item);
      if (item["@graph"]) visit(item["@graph"]);
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1]!.trim().replace(/^<!--|-->$/g, "");
    // Some sites leave raw line breaks inside strings, which JSON forbids; spaces read the same.
    for (const attempt of [raw, raw.replace(/[\u0000-\u001f]+/g, " ")]) {
      try {
        visit(JSON.parse(attempt));
        break;
      } catch {
        // Broken past repair; the page may still have another block, or microdata.
      }
    }
  }
  return out;
}

const VOID_TAGS = /^(meta|img|link|br|hr|input|source)$/i;

/** The whole element starting at `start` (a "<"), matching nested tags of the same name. */
function elementAt(html: string, start: number): string {
  const name = /^<([a-z0-9]+)/i.exec(html.slice(start, start + 20))?.[1];
  const open = html.indexOf(">", start);
  if (!name || open < 0 || VOID_TAGS.test(name) || html[open - 1] === "/") return html.slice(start, open + 1);
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, "gi");
  tags.lastIndex = open + 1;
  let depth = 1;
  for (let m = tags.exec(html); m; m = tags.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];

/**
 * A recipe marked up with schema.org microdata (itemprop attributes on the page itself), as older blogs do,
 * read into the same shape as JSON-LD. Properties of nested items (the author's name) are left out.
 */
function microdataRecipe(html: string): Json | null {
  const at = html.search(/itemtype\s*=\s*["'][^"']*schema\.org\/Recipe["']/i);
  if (at < 0) return null;
  const scope = elementAt(html, html.lastIndexOf("<", at));
  const nested: [number, number][] = [];
  for (const m of scope.matchAll(/<[a-z0-9]+\b[^>]*\bitemscope\b[^>]*>/gi)) {
    if (m.index! > 0) nested.push([m.index!, m.index! + elementAt(scope, m.index!).length]);
  }
  const props: Record<string, string[]> = {};
  for (const m of scope.matchAll(/<([a-z0-9]+)\b[^>]*\bitemprop\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const i = m.index!;
    if (nested.some(([a, b]) => i > a && i < b)) continue;
    const tag = m[0];
    const value =
      attr(tag, "content") ??
      attr(tag, "datetime") ??
      (/^img$/i.test(m[1]!) ? attr(tag, "src") : undefined) ??
      elementAt(scope, i).replace(/^<[^>]*>/, "").replace(/<\/(p|li|div|h\d)>/gi, "\n");
    for (const name of m[2]!.split(/\s+/)) (props[name] ??= []).push(value);
  }
  const one = (k: string) => props[k]?.[0];
  // Jetpack's recipe card (and the h-recipe microformat) marks its steps by class instead of itemprop.
  const block = /<[a-z0-9]+\b[^>]*class\s*=\s*["'][^"']*\b(jetpack-recipe-directions|e-instructions)\b[^>]*>/i.exec(scope);
  const directions = block ? elementAt(scope, block.index).replace(/^<[^>]*>/, "").replace(/<\/(p|li|div|h\d)>/gi, "\n") : "";
  return {
    "@type": "Recipe",
    name: one("name"),
    description: one("description"),
    recipeYield: props.recipeYield ?? props.yield,
    prepTime: one("prepTime"),
    cookTime: one("cookTime"),
    totalTime: one("totalTime"),
    recipeIngredient: props.recipeIngredient ?? props.ingredients,
    recipeInstructions: props.recipeInstructions ? props.recipeInstructions.join("\n") : directions,
    recipeCategory: props.recipeCategory,
    recipeCuisine: props.recipeCuisine,
    image: props.image,
  };
}

const isRecipe = (o: Json) => asArray(o["@type"]).some((t) => typeof t === "string" && t.toLowerCase() === "recipe");

/** The steps of recipeInstructions, which may be text, a list of strings, HowToSteps, or HowToSections of them. */
function instructions(v: unknown): string[] {
  if (typeof v === "string") return splitPasted(plainText(v));
  const out: string[] = [];
  for (const item of asArray(v)) {
    if (typeof item === "string") out.push(...splitPasted(plainText(item)));
    else if (isObject(item)) {
      const list = item.itemListElement;
      if (list !== undefined) out.push(...instructions(list));
      else {
        const text = plainText(item.text) || plainText(item.name);
        if (text) out.push(text);
      }
    }
  }
  return out;
}

function imageOf(v: unknown): string | null {
  for (const item of asArray(v)) {
    const url = typeof item === "string" ? item : isObject(item) ? item.url : null;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

function nameOf(v: unknown): string {
  for (const item of asArray(v)) {
    const name = typeof item === "string" ? item : isObject(item) ? item.name : null;
    if (typeof name === "string" && name.trim()) return plainText(name);
  }
  return "";
}

/** The site's own name: the recipe's publisher, the page's og:site_name, or the host without www. */
function siteName(recipe: Json, html: string, pageUrl: string): string {
  const og = /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
  const name = nameOf(recipe.publisher) || plainText(og) || new URL(pageUrl).hostname.replace(/^www\./, "");
  return name.split(/\s+[-|–:]\s+/)[0]!;
}

const lines = (xs: string[], max: number) => xs.map((x) => x.slice(0, max)).filter(Boolean).slice(0, RECIPE_LIMITS.lines);

/** Doubled or padded parentheses tidied: "1 cup milk ((115 degrees F) )" reads "1 cup milk (115 degrees F)". */
export function tidyLine(line: string): string {
  return line.replace(/\(\s*\(/g, "(").replace(/\)\s*\)/g, ")").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s{2,}/g, " ").trim();
}

/** A line without its notes in parentheses, stars and spacing, for matching "2 large eggs" to "2 large eggs (room temperature)". */
const bare = (line: string) => line.replace(/\([^)]*\)/g, "").replace(/[*†]+/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Some recipe cards repeat each step's ingredients at its end ("Mix until combined. 2 large eggs, 1/2 cup sugar").
 * A last sentence made only of the recipe's own ingredient lines is taken off.
 */
export function withoutIngredientEcho(step: string, ingredients: string[]): string {
  const known = new Set(ingredients.map(bare).filter(Boolean));
  const end = step.search(/[.!?)]\s+[^.!?]*$/);
  if (end < 0) return step;
  const tail = step.slice(end + 1).trim().replace(/[-–]+$/, "");
  const parts = tail.split(/,\s*/).map(bare).filter(Boolean);
  return parts.length && parts.every((p) => known.has(p)) ? step.slice(0, end + 1).trim() : step;
}

/** A heading among ingredient lines: no amounts, and either all capitals ("DOUGH") or ending in a colon ("For the glaze:"). */
function headingOf(line: string): string | null {
  const t = line.trim();
  if (!t || t.length > 60 || /\d|[¼½¾⅓⅔⅛]/.test(t)) return null;
  const letters = t.replace(/[^a-z]/gi, "");
  if (t.endsWith(":") || (letters.length >= 3 && letters === letters.toUpperCase())) {
    const name = t.replace(/:$/, "").trim().toLowerCase();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return null;
}

/** Ingredient lines with their headings taken out and given to the lines below them. */
function grouped(texts: string[]): DraftIngredient[] {
  const out: DraftIngredient[] = [];
  let group: string | undefined;
  for (const text of texts) {
    const heading = headingOf(text);
    if (heading) group = heading;
    else if (text.trim()) out.push({ text: text.slice(0, RECIPE_LIMITS.line), ...(group ? { group } : {}) });
  }
  return out.slice(0, RECIPE_LIMITS.lines);
}

type CardGroup = { name: string | null; count: number };

/** The part of the page between the first match of `start` and the next match of `end`. */
function between(html: string, start: RegExp, end: RegExp): string | null {
  const a = html.search(start);
  if (a < 0) return null;
  const b = html.slice(a + 1).search(end);
  return html.slice(a, b < 0 ? undefined : a + 1 + b);
}

/**
 * The ingredient headings on the page's own recipe card, with how many lines sit under each. Recipe data has no
 * headings, but the two plugins most food blogs use (WP Recipe Maker, Tasty Recipes) mark them in the card.
 */
function cardGroups(html: string): CardGroup[] | null {
  const wprm = between(html, /<div[^>]*class="[^"]*wprm-recipe-ingredients-container/, /<div[^>]*class="[^"]*wprm-recipe-instructions-container/);
  if (wprm) {
    return wprm
      .split(/<div[^>]*class="[^"]*wprm-recipe-ingredient-group[\s"]/)
      .slice(1)
      .map((chunk) => ({
        name: plainText(/class="[^"]*wprm-recipe-group-name[^"]*"[^>]*>([\s\S]*?)<\/(?:h\d|div|span)>/.exec(chunk)?.[1] ?? "") || null,
        count: (chunk.match(/<li[^>]*class="[^"]*wprm-recipe-ingredient[\s"]/g) ?? []).length,
      }));
  }
  const tasty = between(html, /<div[^>]*class="[^"]*tasty-recipes-ingredients(?:-body)?[\s"]/, /<div[^>]*class="[^"]*tasty-recipes-instructions[\s"]/);
  if (tasty) {
    const groups: CardGroup[] = [{ name: null, count: 0 }];
    for (const m of tasty.matchAll(/<(h[2-6])[^>]*>([\s\S]*?)<\/\1>|<p[^>]*>\s*<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>\s*<\/p>|<li\b/gi)) {
      if (m[0].toLowerCase().startsWith("<li")) groups[groups.length - 1]!.count++;
      else {
        const name = plainText(m[2] ?? m[3]);
        if (name && !/^ingredients?$/i.test(name)) groups.push({ name, count: 0 });
      }
    }
    return groups.filter((g) => g.count > 0);
  }
  return null;
}

/** The card's headings given to the recipe data's ingredient lines, when the card has exactly as many lines. */
function withCardGroups(ingredients: DraftIngredient[], html: string): DraftIngredient[] {
  if (ingredients.some((i) => i.group)) return ingredients;
  const groups = cardGroups(html);
  if (!groups || !groups.some((g) => g.name) || groups.reduce((n, g) => n + g.count, 0) !== ingredients.length) return ingredients;
  const out: DraftIngredient[] = [];
  let at = 0;
  for (const g of groups) {
    const name = g.name ? tidyLine(g.name.replace(/:\s*$/, "")) : null;
    for (let k = 0; k < g.count; k++, at++) out.push({ ...ingredients[at]!, ...(name ? { group: name } : {}) });
  }
  return out;
}

/** The page's recipe, or null when it carries no recipe data. */
export function recipeFromHtml(html: string, pageUrl: string): RecipeDraft | null {
  const recipe = jsonLdObjects(html).find(isRecipe) ?? microdataRecipe(html);
  if (!recipe) return null;
  const ingredients = asArray(recipe.recipeIngredient ?? recipe.ingredients).map((i) => tidyLine(plainText(i)));
  const steps = instructions(recipe.recipeInstructions).map((st) => withoutIngredientEcho(st, ingredients));
  const title = plainText(recipe.name) || plainText(recipe.headline);
  if (!title && !ingredients.length) return null;

  const total = isoMinutes(recipe.totalTime);
  const prep = isoMinutes(recipe.prepTime);
  const cook = isoMinutes(recipe.cookTime) ?? (total !== null && prep !== null && total > prep ? total - prep : null);
  const keywords = typeof recipe.keywords === "string" ? [] : asArray(recipe.keywords);
  const named = [...asArray(recipe.recipeCategory), ...asArray(recipe.recipeCuisine), ...keywords].flatMap((t) => plainText(t).split(","));
  const tags = cleanTags(named.filter((t) => t.trim().length <= 24)).slice(0, 4);
  const canonical = typeof recipe.url === "string" && /^https?:\/\//i.test(recipe.url) ? recipe.url : pageUrl;

  return {
    title: title.slice(0, RECIPE_LIMITS.title),
    description: plainText(recipe.description).slice(0, 2000),
    servings: yieldServings(recipe.recipeYield),
    prepMin: prep,
    cookMin: cook ?? (prep === null ? total : null),
    tags,
    ingredients: withCardGroups(grouped(ingredients), html),
    steps: lines(steps, RECIPE_LIMITS.step),
    notes: "",
    sourceName: siteName(recipe, html, pageUrl).slice(0, RECIPE_LIMITS.title),
    sourceUrl: canonical,
    imageUrl: imageOf(recipe.image),
    readFrom: "data",
  };
}

const INGREDIENTS_HEADING = /^\s*(ingredients?|what you(?:'|’)?ll need|you(?:'|’)?ll need)\s*:?\s*$/i;
const STEPS_HEADING = /^\s*(instructions?|directions?|method|steps?|preparation|how to make (it|them))\s*:?\s*$/i;
const NOTES_HEADING = /^\s*(recipe notes?|notes?|tips|cook(?:'|’)?s notes?|baker(?:'|’)?s notes?)\s*:?\s*$/i;
const END_HEADING = /^\s*(nutrition( facts| information)?|did you make this|share this|related recipes|more recipes|recipe by\b|shop this post|explore more|leave a (comment|review))/i;
const META = /^\s*(prep(?:aration)? time|cook(?:ing)? time|bake time|total time|servings|serves|yield|makes)\s*:?\s*(.*)$/i;
// Recipe-card buttons and labels that come along when a whole page is copied.
const JUNK = /^\s*(\d+x(\s+\d+x)*|us customary|us|metric|scale|print( recipe)?|pin( recipe)?|jump to recipe|rate this recipe|leave a review|save|cook mode|prevent your screen from going dark)\s*$/i;
const QUANTITY = /^\s*([-*•▢☐□◻]\s*)?(\d|[¼½¾⅓⅔⅛]|a |an |one |two |pinch|dash|handful)/i;
const DATE_LINE = /^\s*(\w+ \d{1,2}, \d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/;

/** Minutes in "2 hours 20 mins", "1 hr", "45 minutes" or "1h 30m", or null. */
export function textMinutes(v: string): number | null {
  const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i.exec(v);
  const m = /(\d+)\s*(?:m|min|mins|minutes?)\b/i.exec(v);
  if (!h && !m) return null;
  const total = Math.round(Number(h?.[1] ?? 0) * 60 + Number(m?.[1] ?? 0));
  return total > 0 && total <= 10_000 ? total : null;
}

const ATTRIBUTION = /^\s*(adapted|inspired|from|source|recipe (by|from)|via|serves|makes|yield)\b/i;
const STOP = /^\s*(share this|print|related|leave a (comment|reply)|comments?|posted in|filed under|tags?:)/i;

/**
 * An older post's recipe with no Ingredients heading: its name, a block of amount lines, then the method. The
 * block is the longest run of lines that are amounts or short ("Freshly ground pepper"), with blank lines between.
 */
function headinglessRecipe(all: string[]): { title: string; ingredients: string[]; steps: string[]; servingsText: string | null; prepMin: number | null; cookMin: number | null } | null {
  // An amount line, not a numbered step ("1. Mix"), a rating ("5 from 27 votes") or a time ("7 minutes").
  const isAmount = (l: string) =>
    QUANTITY.test(l) && l.length <= 120 && !/^\s*\d+\s*[.)]\s/.test(l) && !/^\s*\d+(\.\d+)?\s*(from|stars?|votes?|reviews?|minutes?|mins?|hours?|hrs?)\b/i.test(l);
  const isFiller = (l: string) => !l || (l.length <= 50 && !/[.!?]$/.test(l) && !STOP.test(l) && !META.test(l));
  let best: { start: number; end: number; amounts: number } | null = null;
  for (let i = 0; i < all.length; i++) {
    if (!isAmount(all[i]!)) continue;
    let j = i;
    let amounts = 0;
    let others = 0;
    while (j < all.length && (isAmount(all[j]!) || isFiller(all[j]!))) {
      if (isAmount(all[j]!)) amounts++;
      else if (all[j]) others++;
      j++;
    }
    while (j > i && !all[j - 1]) j--;
    if (amounts >= 3 && amounts >= others * 2 && (!best || amounts > best.amounts)) best = { start: i, end: j, amounts };
    i = j;
  }
  if (!best) return null;
  let title = "";
  let servingsText: string | null = null;
  let prepMin: number | null = null;
  let cookMin: number | null = null;
  for (let i = best.start - 1; i >= Math.max(0, best.start - 10) && !title; i--) {
    const l = all[i]!;
    if (!l) continue;
    const meta = META.exec(l);
    if (meta) {
      const label = meta[1]!.toLowerCase();
      if (label.startsWith("prep")) prepMin ??= textMinutes(meta[2] ?? "");
      else if (label.startsWith("cook") || label.startsWith("bake")) cookMin ??= textMinutes(meta[2] ?? "");
      else if (/serv|yield|makes/.test(label)) servingsText ??= l;
      continue;
    }
    if (ATTRIBUTION.test(l)) {
      if (/serves|makes|yield/i.test(l)) servingsText = l;
      continue;
    }
    if (l.length <= 80 && !/[.!?]$/.test(l)) title = l;
    else break;
  }
  const steps: string[] = [];
  for (let i = best.end; i < all.length; i++) {
    const l = all[i]!;
    if (!l) continue;
    if (STOP.test(l) || END_HEADING.test(l) || (steps.length && l.length < 30 && !/[.!?]$/.test(l))) break;
    // Numbered steps end at the first line without a number.
    const numbered = /^\s*\d+\s*[.)]\s/;
    if (steps.length && numbered.test(steps[0]!) && !numbered.test(l)) break;
    steps.push(l);
  }
  if (!steps.length) return null;
  return { title, ingredients: all.slice(best.start, best.end).filter(Boolean), steps, servingsText, prepMin, cookMin };
}

/**
 * A recipe from pasted text, which may be a whole copied page. It finds the Ingredients heading with the most
 * amounts under it, the recipe card's name, description, times and servings just above it, the steps after it,
 * and any Notes after the steps.
 */
export function recipeFromText(text: string): RecipeDraft {
  const all = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => !JUNK.test(l));
  const amountsAfter = (i: number) => {
    let n = 0;
    for (let j = i + 1; j < all.length && !STEPS_HEADING.test(all[j]!); j++) if (QUANTITY.test(all[j]!)) n++;
    return n;
  };
  const candidates = all.flatMap((l, i) => (INGREDIENTS_HEADING.test(l) ? [i] : []));
  const ingAt = candidates.reduce((best, i) => (best === -1 || amountsAfter(i) > amountsAfter(best) ? i : best), -1);
  const plainDraft = (plain: NonNullable<ReturnType<typeof headinglessRecipe>>): RecipeDraft => ({
    title: plain.title.slice(0, RECIPE_LIMITS.title),
    description: "",
    servings: yieldServings(plain.servingsText),
    prepMin: plain.prepMin,
    cookMin: plain.cookMin,
    tags: [],
    ingredients: grouped(plain.ingredients.map(tidyLine)),
    steps: lines(splitPasted(plain.steps.join("\n")), RECIPE_LIMITS.step),
    notes: "",
    sourceName: "",
    sourceUrl: "",
    imageUrl: null,
    readFrom: "text",
  });
  const stepAt = all.findIndex((l, i) => i > ingAt && STEPS_HEADING.test(l));
  const notesAt = all.findIndex((l, i) => i > Math.max(ingAt, stepAt) && NOTES_HEADING.test(l));
  const endAt = all.findIndex((l, i) => i > Math.max(ingAt, stepAt, notesAt) && END_HEADING.test(l));
  const until = (from: number, ...stops: number[]) => all.slice(from, Math.min(...stops.filter((x) => x > from), all.length));

  // The recipe card sits just above its ingredients: its name, its times and servings (a label, then its value on
  // the same line or the next few: "PREP TIME / 2 / hours"), and a description before or after them.
  const top = ingAt >= 0 ? ingAt : stepAt >= 0 ? stepAt : all.length;
  const valueAfter = (i: number, inline: string) => {
    const parts = [inline];
    for (let j = i + 1; j < Math.min(top, i + 6) && !META.test(all[j]!) && all[j]!.length <= 30; j++) parts.push(all[j]!);
    return parts.join(" ");
  };
  let prepMin: number | null = null;
  let cookMin: number | null = null;
  let servingsText: string | null = null;
  let cardStart = top;
  let metaEnd = -1;
  for (let i = top - 1; i >= Math.max(0, top - 30); i--) {
    const m = META.exec(all[i]!);
    // Above the card's times, the first longer line is its name; the scan stops there.
    if (!m && metaEnd !== -1 && all[i]!.length > 30) break;
    if (!m) continue;
    cardStart = i;
    if (metaEnd === -1) metaEnd = i;
    const value = valueAfter(i, m[2] ?? "");
    const label = m[1]!.toLowerCase();
    if (label.startsWith("prep") && prepMin === null) prepMin = textMinutes(value);
    else if ((label.startsWith("cook") || label.startsWith("bake")) && cookMin === null) cookMin = textMinutes(value);
    else if (/serv|yield|makes/.test(label) && servingsText === null && /\d/.test(value)) servingsText = `${label} ${value}`;
  }
  const isProse = (l: string) => l.length > 90 || /[.!?]$/.test(l);
  const below = metaEnd >= 0 ? all.slice(metaEnd + 1, top).filter((l) => isProse(l)) : [];
  // The name is a short line above the times. Photo captions sit there too ("the best cinnamon rolls"), so a line
  // that starts with a capital and also appears elsewhere on the page (the post's own title) wins.
  const described: string[] = [];
  const names: string[] = [];
  for (let i = cardStart - 1; i >= Math.max(0, cardStart - 12) && names.length < 3; i--) {
    const l = all[i]!;
    if (!l || DATE_LINE.test(l) || META.test(l) || (textMinutes(l) !== null && l.length < 24) || /^\d+(\.\d+)?\s*(from|stars?|\()/i.test(l)) continue;
    if (isProse(l)) {
      if (!names.length) described.unshift(l);
    } else names.push(l);
  }
  const same = (a: string) => a.toLowerCase().replace(/[’‘]/g, "'");
  const score = (l: string) => (/^[A-Z0-9]/.test(l) ? 1 : 0) + (all.filter((x) => same(x) === same(l)).length > 1 ? 2 : 0);
  let title = names.reduce((best, l) => (best === "" || score(l) > score(best) ? l : best), "");
  if (!title) title = all.find((l) => l && !DATE_LINE.test(l)) ?? "";
  const description = (below.length ? below : described.slice(-2)).join("\n");

  const ingredients = ingAt >= 0 ? grouped(splitPasted(until(ingAt + 1, stepAt, notesAt, endAt).join("\n")).map(tidyLine)) : [];
  const stepLines = stepAt >= 0 ? until(stepAt + 1, notesAt, endAt) : ingAt >= 0 ? [] : until(all.indexOf(title) + 1, notesAt, endAt);
  // Notes run to the first blank line, where a copied page moves on to its byline and footer.
  const noteLines = notesAt >= 0 ? until(notesAt + 1, endAt) : [];
  const blank = noteLines.findIndex((l, i) => !l && i > 0);
  const notes = (blank >= 0 ? noteLines.slice(0, blank) : noteLines).filter(Boolean).join("\n");

  // A stray "Ingredients" (a menu, a sidebar) with almost nothing under it: an older post may still read without it.
  const plain = ingAt < 0 || ingredients.length < 3 ? headinglessRecipe(all) : null;
  if (plain) return plainDraft(plain);

  return {
    title: title.slice(0, RECIPE_LIMITS.title),
    description: description.slice(0, 2000),
    servings: yieldServings(servingsText ?? /(?:serves|servings|makes|yield)\D{0,12}(\d+[^\n]*)/i.exec(text)?.[1] ?? null),
    prepMin,
    cookMin,
    tags: [],
    ingredients,
    steps: lines(splitPasted(stepLines.join("\n")).map((st) => withoutIngredientEcho(st, ingredients.map((i) => i.text))), RECIPE_LIMITS.step),
    notes: notes.slice(0, RECIPE_LIMITS.text),
    sourceName: "",
    sourceUrl: "",
    imageUrl: null,
    readFrom: "text",
  };
}

/** The page's visible text, one block per line, as a copy of the page would give it. */
export function pageText(html: string): string {
  const body = /<body\b[\s\S]*$/i.exec(html)?.[0] ?? html;
  return plainText(
    body
      .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|form)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/?(p|div|li|ul|ol|h[1-6]|br|tr|section|article|header|aside|blockquote|figure|figcaption|table|dd|dt)\b[^>]*>/gi, "\n"),
  ).replace(/\n{3,}/g, "\n\n");
}

/** A recipe guessed from a page without recipe data, the way a pasted copy is read; null unless it looks real. */
export function recipeFromPageText(html: string, pageUrl: string): RecipeDraft | null {
  const d = recipeFromText(pageText(html));
  if (d.ingredients.length < 3 || d.steps.length < 1) return null;
  const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
  const title = d.title || plainText(og) || plainText(/<title>([^<]*)<\/title>/i.exec(html)?.[1]);
  return { ...d, title: title.split(/\s+[-|–]\s+/)[0]!.slice(0, RECIPE_LIMITS.title), sourceName: siteName({}, html, pageUrl), sourceUrl: pageUrl };
}
