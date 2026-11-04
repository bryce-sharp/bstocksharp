// Recipe shapes and text helpers, pure: safe for the client and the server.

/** One ingredient line as written, under an optional group heading, optionally another of our recipes. */
export type RecipeIngredient = { id: string; text: string; group?: string; recipeId?: number };
/** A step taking some of an ingredient: "2 eggs" of "4 eggs". */
export type RecipeUse = { ingredientId: string; amount?: string; note?: string };
export type RecipeStep = { id: string; text: string; label?: string; after?: string[]; uses?: RecipeUse[] };

export const RECIPE_LIMITS = { title: 160, line: 600, step: 3000, lines: 200, tags: 20, tag: 40, text: 20000 } as const;

/** A short random id for a new ingredient or step; it never changes after. */
export function newLineId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** "1 hr 15 min" or "40 min". */
export function formatMinutes(n: number): string {
  if (n < 60) return `${n} min`;
  const rest = n % 60;
  return `${Math.floor(n / 60)} hr${rest ? ` ${rest} min` : ""}`;
}

/** The recipe's total time, or null when neither time is known. */
export function totalMinutes(r: { prepMin: number | null; cookMin: number | null }): number | null {
  return r.prepMin === null && r.cookMin === null ? null : (r.prepMin ?? 0) + (r.cookMin ?? 0);
}

/** Tags tidied for saving: trimmed, single-spaced, no repeats ignoring case, within the limits. */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, RECIPE_LIMITS.tag);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out.slice(0, RECIPE_LIMITS.tags);
}

/** Every word of the query appears in the recipe's title, description, tags, ingredients or cook log notes. */
export function matchesSearch(
  r: { title: string; description: string | null; tags: string[]; ingredients: RecipeIngredient[]; logNotes?: string[] },
  query: string,
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [r.title, r.description ?? "", ...r.tags, ...r.ingredients.map((i) => i.text), ...(r.logNotes ?? [])].join(" \n ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

// Scaling and timers.

/** Unicode vulgar fractions as their values. */
const VULGAR: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const AMOUNT = new RegExp(String.raw`^\s*(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?`);

function toNumber(s: string): number {
  const t = s.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const vulgar = /^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(t);
  if (vulgar) return Number(vulgar[1] ?? 0) + VULGAR[vulgar[2]!]!;
  return Number(t);
}

const NICE: [number, string][] = [
  [0, ""],
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [1, ""],
];

/** A cook's way to write an amount: whole numbers with common fractions, else one decimal place. */
export function formatAmount(n: number): string {
  if (n >= 20) return String(Math.round(n));
  const whole = Math.floor(n);
  const part = n - whole;
  const [value, text] = NICE.reduce((a, b) => (Math.abs(b[0] - part) < Math.abs(a[0] - part) ? b : a));
  if (Math.abs(value - part) > 0.04) return String(Math.round(n * 10) / 10);
  if (value === 1) return String(whole + 1);
  if (!text) return String(whole);
  return whole ? `${whole} ${text}` : text;
}

// The same amount in another unit, right after a measuring unit: the "(115 g)" in "1/2 cup (115 g) butter". After
// a count word or none ("1 can (14 oz)", "2 (14 oz) cans") the parenthesis is a package size and stays as it is.
const UNITS = String.raw`cups?|c|tablespoons?|tbsps?|tbs|tb|teaspoons?|tsps?|t|ounces?|oz|fl\.?\s*oz|pounds?|lbs?|grams?|g|kilograms?|kgs?|kg|milliliters?|millilitres?|ml|liters?|litres?|l|pints?|pt|quarts?|qt|gallons?|gal|sticks?`;
const EQUIVALENT = new RegExp(String.raw`^(\s*(?:${UNITS})\.?\s*\(\s*)(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?`, "i");

function scaled(low: string, high: string | undefined, factor: number): string {
  const a = formatAmount(toNumber(low) * factor);
  return high ? `${a} to ${formatAmount(toNumber(high) * factor)}` : a;
}

/** The ingredient line with its leading amount (or range), and the same amount in another unit, multiplied by `factor`. */
export function scaleIngredient(line: string, factor: number): string {
  if (factor === 1) return line;
  const m = AMOUNT.exec(line);
  if (!m) return line;
  const rest = line.slice(m[0].length);
  const e = EQUIVALENT.exec(rest);
  const tail = e ? e[1]! + scaled(e[2]!, e[3], factor) + rest.slice(e[0].length) : rest;
  return scaled(m[1]!, m[2], factor) + tail;
}

export type StepTimer = { label: string; seconds: number };

const DURATION = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

/** Every duration a step mentions ("bake 25 to 30 minutes"), timed to its shorter end so you check early. */
export function stepTimers(step: string): StepTimer[] {
  const out: StepTimer[] = [];
  for (const m of step.matchAll(DURATION)) {
    const unit = m[3]!.toLowerCase();
    const per = unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1;
    const seconds = Math.round(Number(m[1]) * per);
    if (seconds > 0) out.push({ label: m[0].trim(), seconds });
  }
  return out;
}

/** "1:05:00" or "4:30". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Pasted text as one line per ingredient or step, without the bullets, checkboxes or step numbers it was copied with. */
export function splitPasted(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·▢☐□◻]+|step\s*\d+\s*[:.)-]?|\d+\s*[.)](?!\d))\s*/i, "").trim())
    .filter(Boolean);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 28", with the year when it is not this year's: "Oct 28, 2025". Takes YYYY-MM-DD keys. */
export function shortDay(key: string, today: string): string {
  const day = `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;
  return key.slice(0, 4) === today.slice(0, 4) ? day : `${day}, ${key.slice(0, 4)}`;
}
