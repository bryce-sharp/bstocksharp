import * as React from "react";
import AppShell from "@/components/shared/AppShell";
import RecipesSkin from "@/components/recipes/RecipesSkin";

export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RecipesSkin>
      <AppShell current="recipes">{children}</AppShell>
    </RecipesSkin>
  );
}
