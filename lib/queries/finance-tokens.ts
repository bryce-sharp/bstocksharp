import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiTokens, financialAccounts, type ApiToken } from "@/lib/db/schema";
import { requireBook, type BookRef } from "@/lib/books";
import { hashApiToken } from "@/lib/finance/tokens";

// Resolve a raw bearer token → its live row, or null. Session-LESS on purpose:
// the API routes have no cookie, the token IS the credential (like invites'
// getJoinableInvite). Returns null uniformly for unknown/revoked (no oracle).
export async function resolveApiToken(
  raw: string,
  scope: "ingest" | "widget",
): Promise<ApiToken | null> {
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.tokenHash, hashApiToken(raw)),
        eq(apiTokens.scope, scope),
        isNull(apiTokens.revokedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Best-effort last-used stamp (never blocks the request path). */
export async function touchApiToken(id: number): Promise<void> {
  try {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
  } catch {
    // A telemetry write failing must never fail an ingest.
  }
}

export type TokenListRow = {
  id: number;
  label: string;
  scope: string;
  accountName: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

/** This group's live tokens for the settings page (secrets never stored). */
export async function listApiTokens(): Promise<TokenListRow[]> {
  const book = await requireBook();
  return db
    .select({
      id: apiTokens.id,
      label: apiTokens.label,
      scope: apiTokens.scope,
      accountName: financialAccounts.name,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .leftJoin(financialAccounts, eq(apiTokens.accountId, financialAccounts.id))
    .where(and(eq(apiTokens.bookId, book.id), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));
}
