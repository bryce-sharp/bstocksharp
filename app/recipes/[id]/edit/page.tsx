import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FormPage from "@/components/recipes/FormPage";
import { getRecipe, hasRecipeLogs, listRecipeChoices, listRecipeTags } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [recipe, tagOptions, logged, choices] = await Promise.all([getRecipe(id), listRecipeTags(), hasRecipeLogs(id), listRecipeChoices()]);
  if (!recipe) notFound();
  return <FormPage title={`Edit ${recipe.title}`} recipe={recipe} tagOptions={tagOptions} recipeChoices={choices.filter((c) => c.id !== id)} logged={logged} />;
}
