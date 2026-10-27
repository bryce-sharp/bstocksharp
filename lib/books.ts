import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, bookMembers, books, financialAccounts, groups, profiles } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { currentLogin } from "@/lib/hub-apps";

// Money books (docs/finance/money-books.md): every finance row belongs to a
// book, and only the book's members can see it. The viewer is the person the
// login is tied to. The hub's shared login opens only books ticked for it,
// and a login tied to no one sees none (except the demo's shared login).

/** A book a finance read or write is for, and the hub it lives in (timezone; finance rows keep the hub id too). */
export type BookRef = { id: number; groupId: number };

export type BookSummary = BookRef & { name: string };

const ACTIVE_BOOK_COOKIE = "active_book";

/**
 * A hub's first book, made the first time Finance is opened, with every active
 * person in it. Only a hub with no books gets one, so deleting a book never
 * brings a Family book back. Safe to race: one starter per hub.
 */
export async function ensureStarterBook(groupId: number): Promise<BookRef> {
  const [existing] = await db
    .select({ id: books.id, groupId: books.groupId })
    .from(books)
    .where(eq(books.groupId, groupId))
    .orderBy(asc(books.id))
    .limit(1);
  if (existing) return existing;
  const [made] = await db
    .insert(books)
    .values({ groupId, name: "Family", starter: true })
    .onConflictDoNothing()
    .returning({ id: books.id, groupId: books.groupId });
  if (!made) return ensureStarterBook(groupId);
  const people = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.groupId, groupId), isNull(profiles.archivedAt)));
  if (people.length) {
    await db
      .insert(bookMembers)
      .values(people.map((p) => ({ bookId: made.id, profileId: p.id })))
      .onConflictDoNothing();
  }
  return made;
}

/** The books the signed-in login can see, oldest first, without making a first book (for views outside Finance). */
export const readViewerBooks = cache(async (): Promise<BookSummary[]> => {
  const groupId = await requireGroupId();
  const login = await currentLogin();
  const viewer = login?.profileId ?? null;
  const columns = { id: books.id, groupId: books.groupId, name: books.name };
  if (login?.isHubLogin) {
    // The shared login opens the books its members ticked it on.
    return db
      .select(columns)
      .from(books)
      .where(and(eq(books.groupId, groupId), eq(books.hubLogin, true)))
      .orderBy(asc(books.id));
  }
  if (viewer === null) {
    // The demo's shared login has no person; it sees the demo's first book.
    const [hub] = await db.select({ isDemo: groups.isDemo }).from(groups).where(eq(groups.id, groupId)).limit(1);
    if (!hub?.isDemo) return [];
    return db.select(columns).from(books).where(eq(books.groupId, groupId)).orderBy(asc(books.id)).limit(1);
  }
  return db
    .select(columns)
    .from(books)
    .innerJoin(bookMembers, eq(bookMembers.bookId, books.id))
    .where(and(eq(books.groupId, groupId), eq(bookMembers.profileId, viewer)))
    .orderBy(asc(books.id));
});

/** The books the signed-in login can see in Finance, making the hub's first book on first use. */
export const viewerBooks = cache(async (): Promise<BookSummary[]> => {
  await ensureStarterBook(await requireGroupId());
  return readViewerBooks();
});

/** The book the signed-in login is working in: the one picked on this device, else its first. Null when it has none. */
export const viewerBook = cache(async (): Promise<BookSummary | null> => {
  const mine = await viewerBooks();
  const picked = Number((await cookies()).get(ACTIVE_BOOK_COOKIE)?.value);
  return mine.find((b) => b.id === picked) ?? mine[0] ?? null;
});

/** Guard for every finance read and write in a session: the viewer's book, or a throw. */
export async function requireBook(): Promise<BookRef> {
  const book = await viewerBook();
  if (!book) throw new Error("You are not in any money book.");
  return { id: book.id, groupId: book.groupId };
}

/** One of the viewer's books by id, or a throw: the guard for managing a book. */
export async function requireMemberOf(bookId: number): Promise<BookSummary> {
  const book = (await viewerBooks()).find((b) => b.id === bookId);
  if (!book) throw new Error("That money book is not one of yours.");
  return book;
}

/** Remember which book this device works in. Call from a Server Action. */
export async function setActiveBookCookie(id: number): Promise<void> {
  (await cookies()).set(ACTIVE_BOOK_COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** A book's members, in the hub's person order. */
export async function listBookMembers(bookId: number) {
  return db
    .select({ id: profiles.id, name: profiles.name, color: profiles.color })
    .from(bookMembers)
    .innerJoin(profiles, eq(profiles.id, bookMembers.profileId))
    .where(eq(bookMembers.bookId, bookId))
    .orderBy(asc(profiles.sortOrder), asc(profiles.id));
}

/** Which of these people have a login of their own (a book always keeps one, so it stays reachable). */
export async function peopleWithLogins(profileIds: number[]): Promise<Set<number>> {
  if (!profileIds.length) return new Set();
  const rows = await db
    .select({ profileId: accounts.profileId })
    .from(accounts)
    .where(and(inArray(accounts.profileId, profileIds), isNotNull(accounts.profileId)));
  return new Set(rows.map((r) => r.profileId!));
}

/** Would removing this person leave one of their books with no member who has a login? */
export async function wouldStrandBook(profileId: number): Promise<boolean> {
  const theirs = await db
    .select({ bookId: bookMembers.bookId })
    .from(bookMembers)
    .where(eq(bookMembers.profileId, profileId));
  for (const { bookId } of theirs) {
    const others = (await listBookMembers(bookId)).map((m) => m.id).filter((id) => id !== profileId);
    if ((await peopleWithLogins(others)).size === 0) return true;
  }
  return false;
}

/** The viewer's books and the one this device works in, for the app menu. Makes no book. */
export async function bookMenu(): Promise<{ books: { id: number; name: string }[]; activeId: number | null }> {
  const mine = await readViewerBooks();
  const picked = Number((await cookies()).get(ACTIVE_BOOK_COOKIE)?.value);
  const active = mine.find((b) => b.id === picked) ?? mine[0] ?? null;
  return { books: mine.map((b) => ({ id: b.id, name: b.name })), activeId: active?.id ?? null };
}

/** Every book in a hub with who can open it, for Hub settings, Access. */
export async function hubBookAccess(groupId: number) {
  const rows = await db
    .select({ id: books.id, name: books.name, hubLogin: books.hubLogin })
    .from(books)
    .where(eq(books.groupId, groupId))
    .orderBy(asc(books.id));
  const members = rows.length
    ? await db
        .select({ bookId: bookMembers.bookId, profileId: bookMembers.profileId })
        .from(bookMembers)
        .where(inArray(bookMembers.bookId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({ ...r, members: members.filter((m) => m.bookId === r.id).map((m) => m.profileId) }));
}

/** The viewer's other books and their open accounts, for "Also count for" and transfers between books. */
export async function otherBooksForViewer(): Promise<{
  books: { id: number; name: string }[];
  accounts: { id: number; name: string; kind: string; book: string }[];
}> {
  const [mine, current] = await Promise.all([viewerBooks(), viewerBook()]);
  const others = mine.filter((b) => b.id !== current?.id);
  if (!others.length) return { books: [], accounts: [] };
  const rows = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name, kind: financialAccounts.kind, bookId: financialAccounts.bookId })
    .from(financialAccounts)
    .where(and(inArray(financialAccounts.bookId, others.map((b) => b.id)), isNull(financialAccounts.archivedAt)))
    .orderBy(asc(financialAccounts.sortOrder), asc(financialAccounts.id));
  return {
    books: others.map((b) => ({ id: b.id, name: b.name })),
    accounts: rows.map((a) => ({ id: a.id, name: a.name, kind: a.kind, book: others.find((b) => b.id === a.bookId)!.name })),
  };
}
