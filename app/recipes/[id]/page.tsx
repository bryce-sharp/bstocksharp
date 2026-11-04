import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecipeView from "@/components/recipes/RecipeView";
import { canEditProfile } from "@/lib/auth";
import { getActiveProfile } from "@/lib/profile";
import { getRecipe, listRecipeChoices, listRecipeLogs, recipeToday } from "@/lib/queries/recipes";
import { listProfiles } from "@/lib/queries/profiles";
import { summarizeRatings } from "@/lib/recipe-ratings";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ scale?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await getRecipe(Number((await params).id));
  return { title: recipe?.title ?? "Recipe" };
}

export default async function RecipePage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  // A linked recipe opens at the size the outer one needs ("?scale=2" for 2 batches).
  const asked = Number((await searchParams)?.scale);
  const scale = Number.isFinite(asked) && asked >= 0.1 && asked <= 20 ? asked : 1;
  const person = await getActiveProfile();
  const [recipe, canFavorite, logs, profiles, today] = await Promise.all([
    getRecipe(id, person?.id ?? null),
    canEditProfile(person?.id),
    listRecipeLogs(id),
    listProfiles(),
    recipeToday(),
  ]);
  if (!recipe) notFound();
  const linkedIds = new Set(recipe.ingredients.flatMap((i) => (i.recipeId !== undefined ? [i.recipeId] : [])));
  const linked = linkedIds.size ? Object.fromEntries((await listRecipeChoices()).filter((c) => linkedIds.has(c.id)).map((c) => [c.id, c.title])) : {};
  const cooks = await Promise.all(profiles.map(async (p) => ({ id: p.id, name: p.name, canLog: await canEditProfile(p.id) })));
  return (
    <RecipeView
      key={`${recipe.id}-${person?.id ?? 0}-${scale}`}
      recipe={recipe}
      person={person?.name ?? null}
      canFavorite={canFavorite}
      logs={logs}
      ratings={summarizeRatings(logs, recipe.version, today)}
      cooks={cooks}
      defaultCook={person?.id ?? null}
      today={today}
      units={person?.recipeUnits ?? "written"}
      linked={linked}
      scale={scale}
    />
  );
}
