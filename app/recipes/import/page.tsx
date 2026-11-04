import type { Metadata } from "next";
import ImportFlow from "@/components/recipes/ImportFlow";
import { listRecipeChoices, listRecipeTags } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "Import a recipe" };

export default async function ImportRecipePage() {
  const [tagOptions, recipeChoices] = await Promise.all([listRecipeTags(), listRecipeChoices()]);
  return <ImportFlow tagOptions={tagOptions} recipeChoices={recipeChoices} />;
}
