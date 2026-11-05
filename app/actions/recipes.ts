"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mealRatings, meals, menus, profiles, recipeFavorites, recipeLogs, recipes } from "@/lib/db/schema";
import { requireEditor, requireEditorFor } from "@/lib/auth";
import { getActiveProfile } from "@/lib/profile";
import { requireGroupId } from "@/lib/session";
import { requireApp } from "@/lib/hub-apps";
import { findRecipeBySource, getMeal, getMenu, getRecipe, getRecipeLog } from "@/lib/queries/recipes";
import { logEvent } from "@/lib/events";
import { SafeFetchError, safeFetchText } from "@/lib/safe-fetch";
import { recipeFromHtml, recipeFromPageText, type RecipeDraft } from "@/lib/recipe-import";
import { isUnitSystem, type UnitSystem } from "@/lib/recipe-units";
import { RECIPE_LIMITS, cleanTags, type RecipeIngredient, type RecipeStep, type RecipeUse, webUrl } from "@/lib/recipes";

// Anyone in the household edits any recipe (docs/recipes/plan.md); favorites are each person's own.

/** What the recipe form sends: the whole recipe, since a recipe is always edited whole. */
export type RecipeInput = {
  title: string;
  description: string;
  servings: string;
  prepMin: string;
  cookMin: string;
  notes: string;
  sourceName: string;
  sourceUrl: string;
  tags: string[];
  ingredients: RecipeIngredient[];
  /** Set when the recipe came from a link: its picture, kept for when recipes show photos. */
  imported?: { imageUrl: string | null };
  steps: RecipeStep[];
};

export type RecipeSaveResult = { error: string } | undefined;

const ID_RE = /^[a-z0-9]{1,24}$/i;

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** A whole number from `min` to `max`, or null when blank; throws on anything else. */
function count(v: unknown, label: string, max: number, min = 0): number | null {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return n;
}

function webAddress(v: unknown): string | null {
  const t = text(v, 2000);
  if (!t) return null;
  const u = webUrl(t);
  if (u) return u;
  throw new Error("The source link must be a web address starting with https://.");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Ingredients kept to their known fields, blank lines dropped, ids unique. */
function parseIngredients(v: unknown): RecipeIngredient[] {
  if (!Array.isArray(v) || v.length > RECIPE_LIMITS.lines) throw new Error(`A recipe can have up to ${RECIPE_LIMITS.lines} ingredients.`);
  const seen = new Set<string>();
  const out: RecipeIngredient[] = [];
  for (const raw of v) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !ID_RE.test(raw.id) || seen.has(raw.id)) throw new Error("Bad ingredient.");
    const line = text(raw.text, RECIPE_LIMITS.line);
    if (!line) continue;
    seen.add(raw.id);
    const item: RecipeIngredient = { id: raw.id, text: line };
    const group = text(raw.group, RECIPE_LIMITS.title);
    if (group) item.group = group;
    if (Number.isInteger(raw.recipeId)) item.recipeId = raw.recipeId as number;
    out.push(item);
  }
  return out;
}

/** Steps kept to their known fields; uses and links that point at nothing are dropped. */
function parseSteps(v: unknown, ingredients: RecipeIngredient[]): RecipeStep[] {
  if (!Array.isArray(v) || v.length > RECIPE_LIMITS.lines) throw new Error(`A recipe can have up to ${RECIPE_LIMITS.lines} steps.`);
  const ingredientIds = new Set(ingredients.map((i) => i.id));
  const seen = new Set<string>();
  const out: RecipeStep[] = [];
  for (const raw of v) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !ID_RE.test(raw.id) || seen.has(raw.id)) throw new Error("Bad step.");
    const body = text(raw.text, RECIPE_LIMITS.step);
    if (!body) continue;
    seen.add(raw.id);
    const step: RecipeStep = { id: raw.id, text: body };
    const label = text(raw.label, 40);
    if (label) step.label = label;
    if (Array.isArray(raw.after)) {
      const after = raw.after.filter((a): a is string => typeof a === "string" && seen.has(a) && a !== raw.id);
      if (after.length) step.after = after;
    }
    if (Array.isArray(raw.uses)) {
      const uses: RecipeUse[] = [];
      for (const u of raw.uses) {
        if (!isRecord(u) || typeof u.ingredientId !== "string" || !ingredientIds.has(u.ingredientId)) continue;
        const use: RecipeUse = { ingredientId: u.ingredientId };
        const amount = text(u.amount, 60);
        const note = text(u.note, 120);
        if (amount) use.amount = amount;
        if (note) use.note = note;
        uses.push(use);
      }
      if (uses.length) step.uses = uses;
    }
    out.push(step);
  }
  return out;
}

function parseRecipe(input: unknown) {
  if (!isRecord(input)) throw new Error("Nothing to save.");
  const title = text(input.title, RECIPE_LIMITS.title);
  if (!title) throw new Error("Give the recipe a name.");
  const ingredients = parseIngredients(input.ingredients);
  return {
    title,
    description: text(input.description, RECIPE_LIMITS.text),
    servings: count(input.servings, "Servings", 999, 1),
    prepMin: count(input.prepMin, "Prep time", 10_000),
    cookMin: count(input.cookMin, "Cook time", 10_000),
    notes: text(input.notes, RECIPE_LIMITS.text),
    sourceName: text(input.sourceName, RECIPE_LIMITS.title),
    sourceUrl: webAddress(input.sourceUrl),
    ...(isRecord(input.imported) ? { sourceKind: "imported", imageUrl: webUrl(input.imported.imageUrl) } : {}),
    tags: cleanTags(Array.isArray(input.tags) ? input.tags.filter((t): t is string => typeof t === "string") : []),
    ingredients,
    steps: parseSteps(input.steps, ingredients),
  };
}

function problem(err: unknown): RecipeSaveResult {
  return { error: err instanceof Error ? err.message : "Could not save the recipe." };
}

/** Recipe links kept only to the household's other recipes; a deleted or foreign one leaves the line as text. */
async function linkable(ingredients: RecipeIngredient[], self: number | null): Promise<RecipeIngredient[]> {
  const ids = [...new Set(ingredients.flatMap((i) => (i.recipeId !== undefined && i.recipeId !== self ? [i.recipeId] : [])))];
  const rows = ids.length ? await db.select({ id: recipes.id }).from(recipes).where(and(eq(recipes.groupId, await requireGroupId()), inArray(recipes.id, ids))) : [];
  const known = new Set(rows.map((r) => r.id));
  return ingredients.map(({ recipeId, ...line }) => (recipeId !== undefined && known.has(recipeId) ? { ...line, recipeId } : line));
}

export async function addRecipe(input: RecipeInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  let id: number;
  try {
    const parsed = parseRecipe(input);
    const data = { ...parsed, ingredients: await linkable(parsed.ingredients, null) };
    const [row] = await db
      .insert(recipes)
      .values({ ...data, groupId: await requireGroupId(), createdByProfileId: (await getActiveProfile())?.id ?? null })
      .returning({ id: recipes.id });
    id = row!.id;
  } catch (err) {
    return problem(err);
  }
  revalidatePath("/recipes");
  redirect(`/recipes/${id}`);
}

/** Saves the recipe; `changed` (a real change, not a small fix) starts a new version, so older ratings stop counting. */
export async function updateRecipe(id: number, input: RecipeInput, changed = false): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  if (!(await getRecipe(id))) return { error: "That recipe is gone." };
  try {
    const parsed = parseRecipe(input);
    const data = { ...parsed, ingredients: await linkable(parsed.ingredients, id) };
    await db
      .update(recipes)
      .set({ ...data, updatedAt: new Date(), ...(changed === true ? { version: sql`${recipes.version} + 1` } : {}) })
      .where(and(eq(recipes.id, id), eq(recipes.groupId, await requireGroupId())));
  } catch (err) {
    return problem(err);
  }
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

export async function deleteRecipe(id: number): Promise<void> {
  await requireApp("recipes");
  await requireEditor();
  await db.delete(recipes).where(and(eq(recipes.id, id), eq(recipes.groupId, await requireGroupId())));
  revalidatePath("/recipes");
  redirect("/recipes");
}

/** Star or unstar a recipe for the person picked in the header. */
export async function setRecipeFavorite(recipeId: number, favorite: boolean): Promise<void> {
  await requireApp("recipes");
  const person = await getActiveProfile();
  if (!person) throw new Error("Pick a person first.");
  await requireEditorFor(person.id);
  if (!(await getRecipe(recipeId))) throw new Error("That recipe is gone.");
  if (favorite) {
    await db.insert(recipeFavorites).values({ profileId: person.id, recipeId }).onConflictDoNothing();
  } else {
    await db.delete(recipeFavorites).where(and(eq(recipeFavorites.profileId, person.id), eq(recipeFavorites.recipeId, recipeId)));
  }
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

/** How Recipes shows amounts for the person picked in the Viewing menu: As written, US or Metric. */
export async function setRecipeUnits(units: UnitSystem): Promise<void> {
  await requireApp("recipes");
  if (!isUnitSystem(units)) throw new Error("Pick As written, US or Metric.");
  const person = await getActiveProfile();
  if (!person) throw new Error("Pick a person first.");
  await requireEditorFor(person.id);
  await db.update(profiles).set({ recipeUnits: units }).where(eq(profiles.id, person.id));
  revalidatePath("/recipes", "layout");
}

// ── Cook log ──────────────────────────────────────────────────────────────────

/** What the log form sends: who cooked it, when, and how it went. */
export type CookLogInput = {
  profileId: number;
  cookedOn: string;
  rating: number | null;
  wentWrong: boolean;
  notes: string;
  servings: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function day(v: unknown): string {
  if (typeof v !== "string" || !DATE_RE.test(v) || Number.isNaN(Date.parse(v))) throw new Error("Pick the day it was cooked.");
  return v;
}

/** 1 to 5 stars, or null for none. */
function stars(v: unknown): number | null {
  const rating = v === null || v === undefined ? null : Number(v);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) throw new Error("Stars go from 1 to 5.");
  return rating;
}

function parseLog(input: unknown) {
  if (!isRecord(input)) throw new Error("Nothing to save.");
  if (!Number.isInteger(input.profileId)) throw new Error("Pick who cooked it.");
  return {
    profileId: input.profileId as number,
    cookedOn: day(input.cookedOn),
    rating: stars(input.rating),
    counted: input.wentWrong !== true,
    notes: text(input.notes, RECIPE_LIMITS.text),
    servings: count(input.servings, "Servings made", 999, 1),
  };
}

function refreshRecipe(recipeId: number) {
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

/** Logs one cook of the recipe's current version, for someone this login may log for. */
export async function logCook(recipeId: number, input: CookLogInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  const recipe = await getRecipe(recipeId);
  if (!recipe) return { error: "That recipe is gone." };
  try {
    const data = parseLog(input);
    await requireEditorFor(data.profileId);
    await db.insert(recipeLogs).values({ ...data, recipeId, recipeVersion: recipe.version });
  } catch (err) {
    return problem(err);
  }
  refreshRecipe(recipeId);
}

/** Changes a log entry; it keeps the version it was cooked on. Both the old and the new cook must be ours to edit. */
export async function updateCookLog(logId: number, input: CookLogInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  const log = await getRecipeLog(logId);
  if (!log) return { error: "That log entry is gone." };
  try {
    const data = parseLog(input);
    await requireEditorFor(log.profileId);
    if (log.mealId === null) await requireEditorFor(data.profileId);
    // A meal's cook takes its person and day from the meal, so only the rest is saved here.
    const { profileId, cookedOn, ...rest } = data;
    await db.update(recipeLogs).set(log.mealId === null ? { ...rest, profileId, cookedOn } : rest).where(eq(recipeLogs.id, logId));
  } catch (err) {
    return problem(err);
  }
  refreshRecipe(log.recipeId);
}

export async function deleteCookLog(logId: number): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  const log = await getRecipeLog(logId);
  if (!log) return { error: "That log entry is gone." };
  try {
    await requireEditorFor(log.profileId);
    await db.delete(recipeLogs).where(eq(recipeLogs.id, logId));
  } catch (err) {
    return problem(err);
  }
  refreshRecipe(log.recipeId);
}

// ── Menus ─────────────────────────────────────────────────────────────────────

/** What the menu form sends: its name, notes and recipes in order. */
export type MenuInput = { name: string; notes: string; recipeIds: number[] };

/** What the made-it form sends: the day, notes about that time, and the recipes actually made. */
export type MealInput = { cookedOn: string; notes: string; recipeIds: number[] };

/** One person's stars for a time the menu was made: the whole meal, and each recipe in it. */
export type MealRatingsInput = { profileId: number; rating: number | null; notes: string; dishes: { recipeId: number; rating: number | null }[] };

/** A list of our recipes, in order, without repeats. */
async function parseRecipeIds(raw: unknown): Promise<number[]> {
  if (!Array.isArray(raw) || !raw.every((id) => Number.isInteger(id))) throw new Error("Pick the recipes.");
  const recipeIds = [...new Set(raw as number[])];
  if (!recipeIds.length) throw new Error("Pick at least one recipe.");
  if (recipeIds.length > RECIPE_LIMITS.dishes) throw new Error(`A menu can have up to ${RECIPE_LIMITS.dishes} recipes.`);
  const found = await db.select({ id: recipes.id }).from(recipes).where(and(eq(recipes.groupId, await requireGroupId()), inArray(recipes.id, recipeIds)));
  if (found.length !== recipeIds.length) throw new Error("One of those recipes is gone.");
  return recipeIds;
}

async function parseMenu(input: unknown) {
  if (!isRecord(input)) throw new Error("Nothing to save.");
  const name = text(input.name, RECIPE_LIMITS.title);
  if (!name) throw new Error("Give the menu a name.");
  return { name, notes: text(input.notes, RECIPE_LIMITS.text), recipeIds: await parseRecipeIds(input.recipeIds) };
}

async function parseMeal(input: unknown) {
  if (!isRecord(input)) throw new Error("Nothing to save.");
  return { cookedOn: day(input.cookedOn), notes: text(input.notes, RECIPE_LIMITS.text), recipeIds: await parseRecipeIds(input.recipeIds) };
}

function refreshMenu(id: number, recipeIds: number[]) {
  revalidatePath("/recipes");
  revalidatePath("/recipes/menus");
  revalidatePath(`/recipes/menus/${id}`);
  for (const r of recipeIds) revalidatePath(`/recipes/${r}`);
}

/** Saves a new menu, then opens it. */
export async function createMenu(input: MenuInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  let id: number;
  try {
    const data = await parseMenu(input);
    const [row] = await db
      .insert(menus)
      .values({ ...data, groupId: await requireGroupId(), createdByProfileId: (await getActiveProfile())?.id ?? null })
      .returning({ id: menus.id });
    id = row!.id;
    refreshMenu(id, data.recipeIds);
  } catch (err) {
    return problem(err);
  }
  redirect(`/recipes/menus/${id}`);
}

/** Changes a menu; the times it was made keep the recipes they had. */
export async function updateMenu(id: number, input: MenuInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  const menu = await getMenu(id);
  if (!menu) return { error: "That menu is gone." };
  try {
    const data = await parseMenu(input);
    await db.update(menus).set(data).where(eq(menus.id, id));
    refreshMenu(id, [...new Set([...menu.recipeIds, ...data.recipeIds])]);
  } catch (err) {
    return problem(err);
  }
}

/** Deletes a menu with every time it was made, their stars and the cook log entries they made. */
export async function deleteMenu(id: number): Promise<void> {
  await requireApp("recipes");
  await requireEditor();
  const menu = await getMenu(id);
  if (!menu) return;
  await db.delete(menus).where(and(eq(menus.id, id), eq(menus.groupId, await requireGroupId())));
  refreshMenu(id, [...new Set([...menu.recipeIds, ...menu.meals.flatMap((m) => m.recipeIds)])]);
  redirect("/recipes/menus");
}

type MealStars = { profileId: number; rating: number | null; notes: string | null; dishes: { recipe_id: number; rating: number | null }[] };

/** One person's stars for a meal, checked, for someone this login may rate for. */
async function parseMealStars(input: unknown): Promise<MealStars> {
  if (!isRecord(input) || !Number.isInteger(input.profileId)) throw new Error("Pick whose stars these are.");
  const profileId = input.profileId as number;
  await requireEditorFor(profileId);
  const dishes = (Array.isArray(input.dishes) ? input.dishes : []).flatMap((d: unknown) =>
    isRecord(d) && Number.isInteger(d.recipeId) ? [{ recipe_id: d.recipeId as number, rating: stars(d.rating) }] : [],
  );
  return { profileId, rating: stars(input.rating), notes: text(input.notes, RECIPE_LIMITS.text), dishes: dishes.slice(0, RECIPE_LIMITS.dishes) };
}

/** One person's meal stars as one batch: lock the meal, save its stars, then an entry per recipe it holds now, on its day. */
function mealStarWrites(mealId: number, s: MealStars) {
  const lock = db.select({ id: meals.id }).from(meals).where(eq(meals.id, mealId)).for("update");
  const whole =
    s.rating === null && s.notes === null
      ? db.delete(mealRatings).where(and(eq(mealRatings.mealId, mealId), eq(mealRatings.profileId, s.profileId)))
      : db
          .insert(mealRatings)
          .values({ mealId, profileId: s.profileId, rating: s.rating, notes: s.notes })
          .onConflictDoUpdate({ target: [mealRatings.mealId, mealRatings.profileId], set: { rating: s.rating, notes: s.notes } });
  const dishes = db.execute(sql`
    INSERT INTO recipe_logs (recipe_id, recipe_version, profile_id, cooked_on, rating, meal_id)
    SELECT r.id, r.version, ${s.profileId}, m.cooked_on, d.rating, m.id
    FROM meals m
    CROSS JOIN LATERAL jsonb_array_elements_text(m.recipe_ids) AS e(recipe_id)
    JOIN recipes r ON r.id = e.recipe_id::int AND r.group_id = m.group_id
    LEFT JOIN jsonb_to_recordset(${JSON.stringify(s.dishes)}::jsonb) AS d(recipe_id int, rating int) ON d.recipe_id = r.id
    WHERE m.id = ${mealId}
    ON CONFLICT (meal_id, profile_id, recipe_id) WHERE meal_id IS NOT NULL DO UPDATE SET rating = EXCLUDED.rating`);
  return [lock, whole, dishes] as const;
}

/** Logs a time the menu was made with the logger's stars, in one batch. */
export async function logMeal(menuId: number, input: MealInput, ratings: MealRatingsInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  const menu = await getMenu(menuId);
  if (!menu) return { error: "That menu is gone." };
  try {
    const data = await parseMeal(input);
    const starsFor = await parseMealStars(ratings);
    // The id comes first so the meal and its stars save together; a failure saves neither.
    const next = await db.execute<{ id: number }>(sql`SELECT nextval(pg_get_serial_sequence('meals', 'id'))::int AS id`);
    const id = next.rows[0]!.id;
    await db.batch([
      db.insert(meals).values({ ...data, id, menuId, groupId: menu.groupId, createdByProfileId: (await getActiveProfile())?.id ?? null }),
      ...mealStarWrites(id, starsFor),
    ]);
    refreshMenu(menuId, data.recipeIds);
  } catch (err) {
    return problem(err);
  }
}

/** Changes one time the menu was made; its cook log entries move to its new day, and a removed recipe's entries go with it. */
export async function updateMeal(id: number, input: MealInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  const meal = await getMeal(id);
  if (!meal) return { error: "That time is gone." };
  try {
    const data = await parseMeal(input);
    await db.batch([
      db.update(meals).set(data).where(eq(meals.id, id)),
      db.update(recipeLogs).set({ cookedOn: data.cookedOn }).where(eq(recipeLogs.mealId, id)),
      db.delete(recipeLogs).where(and(eq(recipeLogs.mealId, id), notInArray(recipeLogs.recipeId, data.recipeIds))),
    ]);
    refreshMenu(meal.menuId, [...new Set([...meal.recipeIds, ...data.recipeIds])]);
  } catch (err) {
    return problem(err);
  }
}

/** Deletes one time the menu was made with its stars and the cook log entries it made; the menu stays. */
export async function deleteMeal(id: number): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  const meal = await getMeal(id);
  if (!meal) return;
  try {
    await db.delete(meals).where(eq(meals.id, id));
  } catch (err) {
    return problem(err);
  }
  refreshMenu(meal.menuId, meal.recipeIds);
}

/** Saves one person's stars for a time the menu was made and its recipes. */
export async function rateMeal(id: number, ratings: MealRatingsInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  const meal = await getMeal(id);
  if (!meal) return { error: "That time is gone." };
  try {
    await db.batch([...mealStarWrites(id, await parseMealStars(ratings))]);
  } catch (err) {
    return problem(err);
  }
  refreshMenu(meal.menuId, meal.recipeIds);
}

// ── Import from a link ────────────────────────────────────────────────────────

export type ReadLinkResult =
  | { draft: RecipeDraft; existing: { id: number; title: string } | null }
  | { error: string; paste: boolean };

/** Reads the recipe on a web page for the form to show; nothing is saved here. Failures go to the event log. */
export async function readRecipeLink(link: string): Promise<ReadLinkResult> {
  await requireApp("recipes");
  await requireEditor();
  const groupId = await requireGroupId();
  const host = URL.canParse(link) ? new URL(link).hostname : null;
  try {
    const page = await safeFetchText(String(link).trim());
    const draft = recipeFromHtml(page.body, page.url) ?? recipeFromPageText(page.body, page.url);
    if (!draft) {
      await logEvent({ groupId, source: "recipes", kind: "recipe_import_failed", message: "No recipe data on the page", data: { host, reason: "no_recipe" } });
      return { error: "That page has no recipe data we can read. Paste the recipe instead.", paste: true };
    }
    await logEvent({ groupId, source: "recipes", kind: "recipe_import_read", data: { host, ok: true, readFrom: draft.readFrom, ingredients: draft.ingredients.length, steps: draft.steps.length } });
    return { draft, existing: await findRecipeBySource(draft.sourceUrl) };
  } catch (err) {
    const reason = err instanceof SafeFetchError ? err.reason : "unknown";
    await logEvent({ groupId, source: "recipes", kind: "recipe_import_failed", message: err instanceof Error ? err.message : null, data: { host, reason } });
    const message = err instanceof SafeFetchError ? err.message : "That page could not be read.";
    return { error: reason === "address" || reason === "blocked" ? message : `${message} You can paste the recipe instead.`, paste: reason !== "address" && reason !== "blocked" };
  }
}
