import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, recipeFavorites, recipeLogs, recipes } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { getGroupTimezone } from "@/lib/queries/group";
import { todayISO } from "@/lib/finance/parse";
import { summarizeRatings, type RatingSummary } from "@/lib/recipe-ratings";

/** Whether this person starred the recipe, as a select column. */
function favoriteOf(profileId: number | null) {
  if (profileId === null) return sql<boolean>`false`;
  return sql<boolean>`exists (select 1 from ${recipeFavorites} where ${recipeFavorites.recipeId} = ${recipes.id} and ${recipeFavorites.profileId} = ${profileId})`;
}

/** Today in the household's time zone, the day ratings are weighed from. */
export async function recipeToday(): Promise<string> {
  return todayISO(await getGroupTimezone(await requireGroupId()));
}

/** The household's recipes, A to Z, each with its ratings, its log notes for search, and whether `profileId` starred it. */
export async function listRecipes(profileId: number | null) {
  const groupId = await requireGroupId();
  const [rows, logs, today] = await Promise.all([
    db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        servings: recipes.servings,
        prepMin: recipes.prepMin,
        cookMin: recipes.cookMin,
        tags: recipes.tags,
        ingredients: recipes.ingredients,
        version: recipes.version,
        sourceKind: recipes.sourceKind,
        createdAt: recipes.createdAt,
        favorite: favoriteOf(profileId),
      })
      .from(recipes)
      .where(eq(recipes.groupId, groupId))
      .orderBy(asc(sql`lower(${recipes.title})`)),
    db
      .select({
        recipeId: recipeLogs.recipeId,
        profileId: recipeLogs.profileId,
        cookedOn: recipeLogs.cookedOn,
        rating: recipeLogs.rating,
        counted: recipeLogs.counted,
        recipeVersion: recipeLogs.recipeVersion,
        notes: recipeLogs.notes,
      })
      .from(recipeLogs)
      .innerJoin(recipes, eq(recipes.id, recipeLogs.recipeId))
      .where(eq(recipes.groupId, groupId)),
    recipeToday(),
  ]);
  const byRecipe = new Map<number, typeof logs>();
  for (const l of logs) byRecipe.set(l.recipeId, [...(byRecipe.get(l.recipeId) ?? []), l]);
  return rows.map((r) => {
    const mine = byRecipe.get(r.id) ?? [];
    const ratings: RatingSummary = summarizeRatings(mine, r.version, today);
    return { ...r, ratings, logNotes: mine.flatMap((l) => (l.notes ? [l.notes] : [])) };
  });
}

export type RecipeSummary = Awaited<ReturnType<typeof listRecipes>>[number];

/** One of our recipes with who added it and whether `profileId` starred it; null for another household's id. */
export async function getRecipe(id: number, profileId: number | null = null) {
  if (!Number.isInteger(id)) return null;
  const groupId = await requireGroupId();
  const [row] = await db
    .select({ recipe: recipes, addedBy: profiles.name, favorite: favoriteOf(profileId) })
    .from(recipes)
    .leftJoin(profiles, eq(profiles.id, recipes.createdByProfileId))
    .where(and(eq(recipes.id, id), eq(recipes.groupId, groupId)))
    .limit(1);
  return row ? { ...row.recipe, addedBy: row.addedBy, favorite: row.favorite } : null;
}

/** Every tag the household uses, A to Z, for suggestions. */
export async function listRecipeTags(): Promise<string[]> {
  const groupId = await requireGroupId();
  const rows = await db
    .select({ tag: sql<string>`jsonb_array_elements_text(${recipes.tags})` })
    .from(recipes)
    .where(eq(recipes.groupId, groupId));
  return [...new Set(rows.map((r) => r.tag))].sort((a, b) => a.localeCompare(b));
}

/** A recipe's cook log, newest first, with each cook's name and color. */
export async function listRecipeLogs(recipeId: number) {
  const groupId = await requireGroupId();
  return db
    .select({
      id: recipeLogs.id,
      recipeVersion: recipeLogs.recipeVersion,
      profileId: recipeLogs.profileId,
      cookedOn: recipeLogs.cookedOn,
      rating: recipeLogs.rating,
      counted: recipeLogs.counted,
      notes: recipeLogs.notes,
      servings: recipeLogs.servings,
      person: profiles.name,
      color: profiles.color,
    })
    .from(recipeLogs)
    .innerJoin(recipes, eq(recipes.id, recipeLogs.recipeId))
    .innerJoin(profiles, eq(profiles.id, recipeLogs.profileId))
    .where(and(eq(recipeLogs.recipeId, recipeId), eq(recipes.groupId, groupId)))
    .orderBy(desc(recipeLogs.cookedOn), desc(recipeLogs.id));
}

export type RecipeLogEntry = Awaited<ReturnType<typeof listRecipeLogs>>[number];

/** One log entry of ours with its recipe, or null for another household's id. */
export async function getRecipeLog(id: number) {
  if (!Number.isInteger(id)) return null;
  const groupId = await requireGroupId();
  const [row] = await db
    .select({ log: recipeLogs })
    .from(recipeLogs)
    .innerJoin(recipes, eq(recipes.id, recipeLogs.recipeId))
    .where(and(eq(recipeLogs.id, id), eq(recipes.groupId, groupId)))
    .limit(1);
  return row?.log ?? null;
}

/** Whether anyone has logged this recipe, so an edit asks whether it is a new version. */
export async function hasRecipeLogs(recipeId: number): Promise<boolean> {
  const groupId = await requireGroupId();
  const [row] = await db
    .select({ id: recipeLogs.id })
    .from(recipeLogs)
    .innerJoin(recipes, eq(recipes.id, recipeLogs.recipeId))
    .where(and(eq(recipeLogs.recipeId, recipeId), eq(recipes.groupId, groupId)))
    .limit(1);
  return row !== undefined;
}

/** Our recipe saved from this link, if any, so an import can say we already have it. */
export async function findRecipeBySource(sourceUrl: string): Promise<{ id: number; title: string } | null> {
  const groupId = await requireGroupId();
  const [row] = await db
    .select({ id: recipes.id, title: recipes.title })
    .from(recipes)
    .where(and(eq(recipes.groupId, groupId), eq(recipes.sourceUrl, sourceUrl)))
    .limit(1);
  return row ?? null;
}
