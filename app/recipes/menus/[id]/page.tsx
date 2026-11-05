import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MenuView from "@/components/recipes/MenuView";
import { getActiveProfile } from "@/lib/profile";
import { getMenu, listCooks, listRecipeChoices, recipeToday } from "@/lib/queries/recipes";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const menu = await getMenu(Number((await params).id));
  return { title: menu?.name ?? "Menu" };
}

export default async function MenuPage({ params }: Props) {
  const person = await getActiveProfile();
  const [menu, recipeChoices, cooks, today] = await Promise.all([getMenu(Number((await params).id)), listRecipeChoices(), listCooks(), recipeToday()]);
  if (!menu) notFound();
  return <MenuView menu={menu} recipeChoices={recipeChoices} cooks={cooks} defaultCook={person?.id ?? null} today={today} />;
}
