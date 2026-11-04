import type { Metadata } from "next";
import RecipeList from "@/components/recipes/RecipeList";
import { canEditProfile } from "@/lib/auth";
import { getActiveProfile } from "@/lib/profile";
import { listRecipes, recipeToday } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "Recipes" };

export default async function RecipesPage() {
  const person = await getActiveProfile();
  const [recipes, canFavorite, today] = await Promise.all([listRecipes(person?.id ?? null), canEditProfile(person?.id), recipeToday()]);
  return <RecipeList recipes={recipes} person={person?.name ?? null} canFavorite={canFavorite} today={today} />;
}
