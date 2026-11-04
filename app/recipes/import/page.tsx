import type { Metadata } from "next";
import ImportFlow from "@/components/recipes/ImportFlow";
import { listRecipeTags } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "Import a recipe" };

export default async function ImportRecipePage() {
  return <ImportFlow tagOptions={await listRecipeTags()} />;
}
