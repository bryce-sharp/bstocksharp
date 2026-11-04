import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecipeView from "@/components/recipes/RecipeView";
import { canEditProfile } from "@/lib/auth";
import { getActiveProfile } from "@/lib/profile";
import { getRecipe, listRecipeLogs, recipeToday } from "@/lib/queries/recipes";
import { listProfiles } from "@/lib/queries/profiles";
import { summarizeRatings } from "@/lib/recipe-ratings";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await getRecipe(Number((await params).id));
  return { title: recipe?.title ?? "Recipe" };
}

export default async function RecipePage({ params }: Props) {
  const id = Number((await params).id);
  const person = await getActiveProfile();
  const [recipe, canFavorite, logs, profiles, today] = await Promise.all([
    getRecipe(id, person?.id ?? null),
    canEditProfile(person?.id),
    listRecipeLogs(id),
    listProfiles(),
    recipeToday(),
  ]);
  if (!recipe) notFound();
  const cooks = await Promise.all(profiles.map(async (p) => ({ id: p.id, name: p.name, canLog: await canEditProfile(p.id) })));
  return (
    <RecipeView
      key={person?.id ?? 0}
      recipe={recipe}
      person={person?.name ?? null}
      canFavorite={canFavorite}
      logs={logs}
      ratings={summarizeRatings(logs, recipe.version, today)}
      cooks={cooks}
      defaultCook={person?.id ?? null}
      today={today}
      units={person?.recipeUnits ?? "written"}
    />
  );
}
