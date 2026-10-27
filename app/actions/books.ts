"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, bookMembers, books, plaidItems, profiles } from "@/lib/db/schema";
import { requireEditor } from "@/lib/auth";
import { requireApp, currentLogin } from "@/lib/hub-apps";
import { requireGroupId } from "@/lib/session";
import { peopleWithLogins, requireMemberOf, setActiveBookCookie, viewerBooks } from "@/lib/books";

// Money books (docs/finance/money-books.md): any member manages a book, and a
// book always keeps at least one member with a login so it stays reachable.
// A book can also be ticked for the hub's shared login; it never counts as that member.

export type BookFormState = { error: string } | { ok: true } | null;

/** Managing books is for people; the shared login only opens the books ticked for it. */
async function guard(): Promise<void> {
  await requireApp("finance");
  await requireEditor();
  if ((await currentLogin())?.profileId == null) throw new Error("Only a login tied to a person can manage books.");
}

/** Whether the form ticked the shared login, kept only when this hub has one. */
async function hubTicked(formData: FormData): Promise<boolean> {
  if (formData.get("hub") !== "1") return false;
  const [hub] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.groupId, await requireGroupId()), eq(accounts.isHubLogin, true)))
    .limit(1);
  return Boolean(hub);
}

/** The picked people, kept to this hub's active people. */
async function chosenPeople(formData: FormData): Promise<number[]> {
  const groupId = await requireGroupId();
  const hub = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.groupId, groupId), isNull(profiles.archivedAt)));
  const ids = new Set(hub.map((p) => p.id));
  return [...new Set(formData.getAll("members").map(Number))].filter((id) => ids.has(id));
}

async function noLoginLeft(people: number[]): Promise<boolean> {
  return (await peopleWithLogins(people)).size === 0;
}

function cleanName(formData: FormData): string {
  return String(formData.get("name") ?? "").trim().slice(0, 80);
}

function refresh(): void {
  revalidatePath("/finance", "layout");
}

/** Work in another of your books on this device. */
export async function switchBookAction(bookId: number): Promise<void> {
  await requireApp("finance");
  await requireMemberOf(bookId);
  await setActiveBookCookie(bookId);
  refresh();
}

/** A new, empty book; you are always one of its members. */
export async function createBookAction(_prev: BookFormState, formData: FormData): Promise<BookFormState> {
  await guard();
  const me = (await currentLogin())?.profileId ?? null;
  if (me === null) return { error: "Your login is not tied to a person, so it cannot hold a book." };
  const name = cleanName(formData);
  if (!name) return { error: "Give the book a name." };
  const members = [...new Set([me, ...(await chosenPeople(formData))])];
  const [book] = await db
    .insert(books)
    .values({ groupId: await requireGroupId(), name, hubLogin: await hubTicked(formData) })
    .returning({ id: books.id });
  await db.insert(bookMembers).values(members.map((profileId) => ({ bookId: book.id, profileId })));
  await setActiveBookCookie(book.id);
  refresh();
  return { ok: true };
}

export async function renameBookAction(bookId: number, _prev: BookFormState, formData: FormData): Promise<BookFormState> {
  await guard();
  await requireMemberOf(bookId);
  const name = cleanName(formData);
  if (!name) return { error: "Give the book a name." };
  await db.update(books).set({ name }).where(eq(books.id, bookId));
  refresh();
  return { ok: true };
}

/** Replace a book's members. Someone with a login must stay, so the book never becomes unreachable. */
export async function setBookMembersAction(
  bookId: number,
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  await guard();
  await requireMemberOf(bookId);
  const members = await chosenPeople(formData);
  if (!members.length) return { error: "A book needs at least one member." };
  if (await noLoginLeft(members)) return { error: "Keep at least one member who has their own login." };
  await db.delete(bookMembers).where(eq(bookMembers.bookId, bookId));
  await db.insert(bookMembers).values(members.map((profileId) => ({ bookId, profileId })));
  await db.update(books).set({ hubLogin: await hubTicked(formData) }).where(eq(books.id, bookId));
  refresh();
  return { ok: true };
}

/** Erase a book and everything in it, once its name is typed to confirm. A hub keeps at least one book. */
export async function deleteBookAction(bookId: number, _prev: BookFormState, formData: FormData): Promise<BookFormState> {
  await guard();
  const book = await requireMemberOf(bookId);
  if (cleanName(formData) !== book.name) return { error: `Type "${book.name}" to confirm.` };
  const hubBooks = await db.select({ id: books.id }).from(books).where(eq(books.groupId, book.groupId));
  if (hubBooks.length <= 1) return { error: "This is the hub's only book, so it cannot be deleted." };
  const [bank] = await db.select({ id: plaidItems.id }).from(plaidItems).where(eq(plaidItems.bookId, bookId)).limit(1);
  if (bank) return { error: "Disconnect this book's banks on Connections first." };
  await db.delete(books).where(eq(books.id, bookId));
  const left = (await viewerBooks()).filter((b) => b.id !== bookId);
  if (left[0]) await setActiveBookCookie(left[0].id);
  refresh();
  return { ok: true };
}
