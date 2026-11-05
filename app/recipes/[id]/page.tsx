import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecipeView from "@/components/recipes/RecipeView";
import { canEditProfile } from "@/lib/auth";
import { getActiveProfile } from "@/lib/profile";
import { backTo, getRecipe, listCooks, listRecipeChoices, listRecipeLogs, recipeToday } from "@/lib/queries/recipes";
import { parseOrigin } from "@/lib/recipes";
import { summarizeRatings } from "@/lib/recipe-ratings";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ scale?: string | string[]; from?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await getRecipe(Number((await params).id));
  return { title: recipe?.title ?? "Recipe" };
}

export default async function RecipePage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  // A linked recipe opens at the size the outer one needs ("?scale=2" for 2 batches).
  const query = await searchParams;
  const asked = Number(query?.scale);
  const scale = Number.isFinite(asked) && asked >= 0.1 && asked <= 20 ? asked : 1;
  const person = await getActiveProfile();
  const [recipe, canFavorite, logs, cooks, today, back] = await Promise.all([
    getRecipe(id, person?.id ?? null),
    canEditProfile(person?.id),
    listRecipeLogs(id),
    listCooks(),
    recipeToday(),
    backTo(parseOrigin(query?.from)),
  ]);
  if (!recipe) notFound();
  const linkedIds = new Set(recipe.ingredients.flatMap((i) => (i.recipeId !== undefined ? [i.recipeId] : [])));
  const linked = linkedIds.size ? Object.fromEntries((await listRecipeChoices()).filter((c) => linkedIds.has(c.id)).map((c) => [c.id, c.title])) : {};
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
      back={back}
    />
  );
}
