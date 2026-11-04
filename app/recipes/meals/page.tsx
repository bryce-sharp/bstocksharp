import type { Metadata } from "next";
import MealList from "@/components/recipes/MealList";
import { getActiveProfile } from "@/lib/profile";
import { listCooks, listMeals, listRecipeChoices, recipeToday } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "Meals" };

export default async function MealsPage() {
  const person = await getActiveProfile();
  const [meals, recipeChoices, cooks, today] = await Promise.all([listMeals(), listRecipeChoices(), listCooks(), recipeToday()]);
  return <MealList meals={meals} recipeChoices={recipeChoices} cooks={cooks} defaultCook={person?.id ?? null} today={today} />;
}
