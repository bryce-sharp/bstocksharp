import "server-only";
import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookMembers, books, groups, profiles } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { currentLogin } from "@/lib/hub-apps";

// Money books (docs/finance/money-books.md): every finance row belongs to a
// book, and only the book's members can see it. The viewer is the person the
// login is tied to, so the hub login and logins with no person see no books
// (except the demo hub's shared login, which sees the demo's book).

/** A book a finance read or write is for, and the hub it lives in (timezone; finance rows keep the hub id too). */
export type BookRef = { id: number; groupId: number };

/** The hub's starter book, made on first use with every active person in it. Safe to race: one starter per hub. */
export async function ensureStarterBook(groupId: number): Promise<BookRef> {
  const [made] = await db
    .insert(books)
    .values({ groupId, name: "Family", starter: true })
    .onConflictDoNothing()
    .returning({ id: books.id, groupId: books.groupId });
  if (made) {
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
  const [starter] = await db
    .select({ id: books.id, groupId: books.groupId })
    .from(books)
    .where(and(eq(books.groupId, groupId), eq(books.starter, true)))
    .limit(1);
  return starter;
}

/** The book the signed-in login is working in, or null when its person is in no book. */
export const viewerBook = cache(async (): Promise<BookRef | null> => {
  const groupId = await requireGroupId();
  const starter = await ensureStarterBook(groupId);
  const viewer = (await currentLogin())?.profileId ?? null;
  if (viewer === null) {
    // The demo's shared login has no person; it sees the demo's own book.
    const [hub] = await db.select({ isDemo: groups.isDemo }).from(groups).where(eq(groups.id, groupId)).limit(1);
    return hub?.isDemo ? starter : null;
  }
  const [row] = await db
    .select({ id: books.id, groupId: books.groupId })
    .from(books)
    .innerJoin(bookMembers, eq(bookMembers.bookId, books.id))
    .where(and(eq(books.groupId, groupId), eq(bookMembers.profileId, viewer)))
    .orderBy(asc(books.id))
    .limit(1);
  return row ?? null;
});

/** Guard for every finance read and write in a session: the viewer's book, or a throw. */
export async function requireBook(): Promise<BookRef> {
  const book = await viewerBook();
  if (!book) throw new Error("You are not in any money book.");
  return book;
}
