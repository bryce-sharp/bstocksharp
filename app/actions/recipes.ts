"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { recipeFavorites, recipeLogs, recipes } from "@/lib/db/schema";
import { requireEditor, requireEditorFor } from "@/lib/auth";
import { getActiveProfile } from "@/lib/profile";
import { requireGroupId } from "@/lib/session";
import { requireApp } from "@/lib/hub-apps";
import { getRecipe, getRecipeLog } from "@/lib/queries/recipes";
import { RECIPE_LIMITS, cleanTags, type RecipeIngredient, type RecipeStep, type RecipeUse } from "@/lib/recipes";

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
  steps: RecipeStep[];
};

export type RecipeSaveResult = { error: string } | undefined;

const ID_RE = /^[a-z0-9]{1,24}$/i;

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** A whole number from 0 to `max`, or null when blank; throws on anything else. */
function count(v: unknown, label: string, max: number): number | null {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`${label} must be a whole number from 0 to ${max}.`);
  return n;
}

function webAddress(v: unknown): string | null {
  const t = text(v, 2000);
  if (!t) return null;
  const u = URL.canParse(t) ? new URL(t) : null;
  if (u && (u.protocol === "https:" || u.protocol === "http:")) return u.toString();
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
    servings: count(input.servings, "Servings", 999),
    prepMin: count(input.prepMin, "Prep time", 10_000),
    cookMin: count(input.cookMin, "Cook time", 10_000),
    notes: text(input.notes, RECIPE_LIMITS.text),
    sourceName: text(input.sourceName, RECIPE_LIMITS.title),
    sourceUrl: webAddress(input.sourceUrl),
    tags: cleanTags(Array.isArray(input.tags) ? input.tags.filter((t): t is string => typeof t === "string") : []),
    ingredients,
    steps: parseSteps(input.steps, ingredients),
  };
}

function problem(err: unknown): RecipeSaveResult {
  return { error: err instanceof Error ? err.message : "Could not save the recipe." };
}

export async function addRecipe(input: RecipeInput): Promise<RecipeSaveResult> {
  await requireApp("recipes");
  await requireEditor();
  let id: number;
  try {
    const data = parseRecipe(input);
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
    const data = parseRecipe(input);
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

function parseLog(input: unknown) {
  if (!isRecord(input)) throw new Error("Nothing to save.");
  if (!Number.isInteger(input.profileId)) throw new Error("Pick who cooked it.");
  if (typeof input.cookedOn !== "string" || !DATE_RE.test(input.cookedOn) || Number.isNaN(Date.parse(input.cookedOn))) {
    throw new Error("Pick the day it was cooked.");
  }
  const rating = input.rating === null || input.rating === undefined ? null : Number(input.rating);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) throw new Error("Stars go from 1 to 5.");
  return {
    profileId: input.profileId as number,
    cookedOn: input.cookedOn,
    rating,
    counted: input.wentWrong !== true,
    notes: text(input.notes, RECIPE_LIMITS.text),
    servings: count(input.servings, "Servings", 999),
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
    await requireEditorFor(data.profileId);
    await db.update(recipeLogs).set(data).where(eq(recipeLogs.id, logId));
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
