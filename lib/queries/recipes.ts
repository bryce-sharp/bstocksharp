import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mealRatings, meals, profiles, recipeFavorites, recipeLogs, recipes } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { getGroupTimezone } from "@/lib/queries/group";
import { todayISO } from "@/lib/finance/parse";
import { summarizeRatings, type RatingSummary } from "@/lib/recipe-ratings";
import { canEditProfile } from "@/lib/auth";
import { listProfiles } from "@/lib/queries/profiles";

/** Whether this person starred the recipe, as a select column. */
function favoriteOf(profileId: number | null) {
  if (profileId === null) return sql<boolean>`false`;
  return sql<boolean>`exists (select 1 from ${recipeFavorites} where ${recipeFavorites.recipeId} = ${recipes.id} and ${recipeFavorites.profileId} = ${profileId})`;
}

/** Everyone in the household, and whether this login may log cooks and stars for them. */
export async function listCooks(): Promise<{ id: number; name: string; canLog: boolean }[]> {
  const people = await listProfiles();
  return Promise.all(people.map(async (p) => ({ id: p.id, name: p.name, canLog: await canEditProfile(p.id) })));
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

export type RecipeChoice = { id: number; title: string };

/** The household's recipes by title, for linking one inside another. */
export async function listRecipeChoices(): Promise<RecipeChoice[]> {
  const groupId = await requireGroupId();
  return db.select({ id: recipes.id, title: recipes.title }).from(recipes).where(eq(recipes.groupId, groupId)).orderBy(asc(recipes.title));
}

/** A recipe's cook log, newest version first and newest first within it, so a back-dated cook stays with its version. */
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
      mealId: recipeLogs.mealId,
      meal: meals.name,
    })
    .from(recipeLogs)
    .innerJoin(recipes, eq(recipes.id, recipeLogs.recipeId))
    .innerJoin(profiles, eq(profiles.id, recipeLogs.profileId))
    .leftJoin(meals, eq(meals.id, recipeLogs.mealId))
    .where(and(eq(recipeLogs.recipeId, recipeId), eq(recipes.groupId, groupId)))
    .orderBy(desc(recipeLogs.recipeVersion), desc(recipeLogs.cookedOn), desc(recipeLogs.id));
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

// ── Meals ─────────────────────────────────────────────────────────────────────

/** The household's meals, newest first, with their recipe count and each person's stars for the whole meal. */
export async function listMeals() {
  const groupId = await requireGroupId();
  const [rows, ratings] = await Promise.all([
    db
      .select({ id: meals.id, name: meals.name, cookedOn: meals.cookedOn, recipeIds: meals.recipeIds })
      .from(meals)
      .where(eq(meals.groupId, groupId))
      .orderBy(desc(meals.cookedOn), desc(meals.id)),
    db
      .select({ mealId: mealRatings.mealId, rating: mealRatings.rating })
      .from(mealRatings)
      .innerJoin(meals, eq(meals.id, mealRatings.mealId))
      .where(eq(meals.groupId, groupId)),
  ]);
  const titles = new Map((await listRecipeChoices()).map((c) => [c.id, c.title]));
  return rows.map((m) => {
    const stars = ratings.flatMap((r) => (r.mealId === m.id && r.rating !== null ? [r.rating] : []));
    return {
      id: m.id,
      name: m.name,
      cookedOn: m.cookedOn,
      dishes: m.recipeIds.flatMap((id) => titles.get(id) ?? []),
      stars: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
    };
  });
}

export type MealSummary = Awaited<ReturnType<typeof listMeals>>[number];

/** One of our meals with its recipes in order, everyone's cook log entries for them, and everyone's meal stars. */
export async function getMeal(id: number) {
  if (!Number.isInteger(id)) return null;
  const groupId = await requireGroupId();
  const [meal] = await db
    .select()
    .from(meals)
    .where(and(eq(meals.id, id), eq(meals.groupId, groupId)))
    .limit(1);
  if (!meal) return null;
  const [found, logs, ratings] = await Promise.all([
    meal.recipeIds.length
      ? db
          .select({ id: recipes.id, title: recipes.title, servings: recipes.servings })
          .from(recipes)
          .where(and(eq(recipes.groupId, groupId), inArray(recipes.id, meal.recipeIds)))
      : [],
    db
      .select({ id: recipeLogs.id, recipeId: recipeLogs.recipeId, profileId: recipeLogs.profileId, rating: recipeLogs.rating, counted: recipeLogs.counted, notes: recipeLogs.notes, person: profiles.name, color: profiles.color })
      .from(recipeLogs)
      .innerJoin(profiles, eq(profiles.id, recipeLogs.profileId))
      .where(eq(recipeLogs.mealId, id))
      .orderBy(asc(profiles.name)),
    db
      .select({ profileId: mealRatings.profileId, rating: mealRatings.rating, notes: mealRatings.notes, person: profiles.name, color: profiles.color })
      .from(mealRatings)
      .innerJoin(profiles, eq(profiles.id, mealRatings.profileId))
      .where(eq(mealRatings.mealId, id))
      .orderBy(asc(profiles.name)),
  ]);
  const byId = new Map(found.map((r) => [r.id, r]));
  return { ...meal, dishes: meal.recipeIds.flatMap((r) => byId.get(r) ?? []), logs, ratings };
}

export type MealDetail = NonNullable<Awaited<ReturnType<typeof getMeal>>>;
