import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MealView from "@/components/recipes/MealView";
import { getActiveProfile } from "@/lib/profile";
import { getMeal, listCooks, listRecipeChoices, recipeToday } from "@/lib/queries/recipes";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meal = await getMeal(Number((await params).id));
  return { title: meal?.name ?? "Meal" };
}

export default async function MealPage({ params }: Props) {
  const person = await getActiveProfile();
  const [meal, recipeChoices, cooks, today] = await Promise.all([getMeal(Number((await params).id)), listRecipeChoices(), listCooks(), recipeToday()]);
  if (!meal) notFound();
  return <MealView meal={meal} recipeChoices={recipeChoices} cooks={cooks} defaultCook={person?.id ?? null} today={today} />;
}
