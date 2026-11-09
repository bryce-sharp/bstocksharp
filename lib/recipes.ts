// Recipe shapes and text helpers, pure: safe for the client and the server.

/** One ingredient line as written, under an optional group heading, optionally another of our recipes. */
export type RecipeIngredient = { id: string; text: string; group?: string; recipeId?: number };
/** A step taking some of an ingredient: "2 eggs" of "4 eggs". */
export type RecipeUse = { ingredientId: string; amount?: string; note?: string };
export type RecipeStep = { id: string; text: string; label?: string; after?: string[]; uses?: RecipeUse[] };

export const RECIPE_LIMITS = { title: 160, line: 600, step: 3000, lines: 200, tags: 20, tag: 40, text: 20000, dishes: 30 } as const;

/** A complete http or https address, normalized, or null. */
export function webUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > 2000 || !URL.canParse(t)) return null;
  const u = new URL(t);
  return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
}

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

// Timers.

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

/** The page a recipe was opened from, so its back button returns there; it rides in the link as "?from=menu-5". */
export type RecipeOrigin = { kind: "menu" | "recipe"; id: number };

/** A recipe page's address, at a size and with where it was opened from. */
export function recipeHref(id: number, { scale = 1, from }: { scale?: number; from?: RecipeOrigin } = {}): string {
  const size = Math.round(scale * 1000) / 1000;
  const query = new URLSearchParams({ ...(size !== 1 ? { scale: String(size) } : {}), ...(from ? { from: `${from.kind}-${from.id}` } : {}) }).toString();
  return `/recipes/${id}${query ? `?${query}` : ""}`;
}

/** A `from` query value; anything but one "menu-N" or "recipe-N" string, such as a repeated parameter, is null. */
export function parseOrigin(value: unknown): RecipeOrigin | null {
  const m = typeof value === "string" ? value.match(/^(menu|recipe)-(\d{1,9})$/) : null;
  return m ? { kind: m[1] as RecipeOrigin["kind"], id: Number(m[2]) } : null;
}

/** Titles of the recipes these ingredient lines link to; a deleted one is left out, so its line stays text. */
export function linkedTitles(ingredients: RecipeIngredient[], choices: { id: number; title: string }[]): Record<number, string> {
  const ids = new Set(ingredients.flatMap((i) => (i.recipeId !== undefined ? [i.recipeId] : [])));
  return Object.fromEntries(choices.filter((c) => ids.has(c.id)).map((c) => [c.id, c.title]));
}

/** In cook mode for several recipes, the next one not yet finished after `from`, wrapping around; null when none is left. */
export function nextDish(count: number, from: number, finished: ReadonlySet<number>): number | null {
  for (let k = 1; k < count; k++) {
    const d = (from + k) % count;
    if (!finished.has(d)) return d;
  }
  return null;
}
