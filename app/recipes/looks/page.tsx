import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LooksLab } from "@/components/recipes/looks/LooksLab";
import { isDevSite } from "@/lib/dev";

export const metadata: Metadata = { title: "Recipes looks", robots: { index: false } };

// A dev page (lib/dev): only on your own machine.
export default function RecipesLooksPage() {
  if (!isDevSite) notFound();
  return <LooksLab />;
}
