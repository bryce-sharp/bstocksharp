"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth";
import { requireBook, type BookRef } from "@/lib/books";
import {
  retagGroupForBook,
  upsertNameForBook,
  removeNameForBook,
  renameGroupForBook,
  deleteGroupForBook,
} from "@/lib/queries/finance-categories";
import type { Flow } from "@/lib/finance/cashflow";
import { requireApp } from "@/lib/hub-apps";

// The Categories page's writes. Each re-derives the book from the session and
// revalidates the spend surfaces so their chips reflect the sweep. `flow` picks
// the spending or income side (anything unexpected is treated as spending).
async function editorBook(): Promise<BookRef> {
  await requireEditor();
  return requireBook();
}
function revalidateSpend(): void {
  revalidatePath("/finance/categories");
  revalidatePath("/finance");
  revalidatePath("/finance/transactions");
}
const clean = (flow: Flow): Flow => (flow === "in" ? "in" : "out");

export async function retagGroupAction(flow: Flow, name: string, category: string): Promise<void> {
  await requireApp("finance");
  await retagGroupForBook(await editorBook(), clean(flow), name, category);
  revalidateSpend();
}

export async function upsertNameAction(
  flow: Flow,
  name: string,
  category: string,
  pattern: string,
): Promise<void> {
  await requireApp("finance");
  await upsertNameForBook(await editorBook(), clean(flow), name, category, pattern);
  revalidateSpend();
}

export async function removeNameAction(ruleId: number): Promise<void> {
  await requireApp("finance");
  await removeNameForBook(await editorBook(), ruleId);
  revalidateSpend();
}

export async function renameGroupAction(flow: Flow, oldName: string, newName: string): Promise<void> {
  await requireApp("finance");
  await renameGroupForBook(await editorBook(), clean(flow), oldName, newName);
  revalidateSpend();
}

export async function deleteGroupAction(flow: Flow, name: string): Promise<void> {
  await requireApp("finance");
  await deleteGroupForBook(await editorBook(), clean(flow), name);
  revalidateSpend();
}
