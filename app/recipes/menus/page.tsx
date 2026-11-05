import type { Metadata } from "next";
import MenuList from "@/components/recipes/MenuList";
import { listMenus, listRecipeChoices, recipeToday } from "@/lib/queries/recipes";

export const metadata: Metadata = { title: "Menus" };

export default async function MenusPage() {
  const [menus, recipeChoices, today] = await Promise.all([listMenus(), listRecipeChoices(), recipeToday()]);
  return <MenuList menus={menus} recipeChoices={recipeChoices} today={today} />;
}
