import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecipesMock } from "@/components/recipes/mock/RecipesMock";
import { isDevSite } from "@/lib/dev";

export const metadata: Metadata = { title: "Recipes mockup", robots: { index: false } };

// A dev page (lib/dev): only on your own machine.
export default function RecipesMockPage() {
  if (!isDevSite) notFound();
  return <RecipesMock />;
}
