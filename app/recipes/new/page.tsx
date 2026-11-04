import type { Metadata } from "next";
import FormPage from "@/components/recipes/FormPage";
import { listRecipeChoices, listRecipeTags } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  const [tagOptions, recipeChoices] = await Promise.all([listRecipeTags(), listRecipeChoices()]);
  return <FormPage title="New recipe" tagOptions={tagOptions} recipeChoices={recipeChoices} />;
}
