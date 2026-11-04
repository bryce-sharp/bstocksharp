import type { Metadata } from "next";
import FormPage from "@/components/recipes/FormPage";
import { listRecipeTags } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  return <FormPage title="New recipe" tagOptions={await listRecipeTags()} />;
}
