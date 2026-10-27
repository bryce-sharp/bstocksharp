"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiTokens, financialAccounts } from "@/lib/db/schema";
import { requireEditor } from "@/lib/auth";
import { requireBook } from "@/lib/books";
import { mintApiToken } from "@/lib/finance/tokens";
import { parseInt as parseBoundedInt, parseStr } from "@/lib/finance/parse";
import { requireApp } from "@/lib/hub-apps";

const SETTINGS = "/finance/settings";

/**
 * Mint a token and return the RAW secret ONCE — the DB only ever holds its
 * sha256. The caller must surface it immediately (it's unrecoverable after).
 */
export async function mintTokenAction(
  _prev: { token: string } | { error: string } | null,
  formData: FormData,
): Promise<{ token: string } | { error: string }> {
  await requireApp("finance");
  await requireEditor();
  const book = await requireBook();

  const label = parseStr(formData.get("label"));
  if (!label) return { error: "Give the token a label (which device/feed)." };
  const scope = formData.get("scope") === "widget" ? "widget" : "ingest";

  // Optional account binding (ingest only) — stamps ingested txns with the card.
  let accountId: number | null = null;
  if (scope === "ingest") {
    accountId = parseBoundedInt(formData.get("accountId"), 1, 2 ** 31);
    if (accountId !== null) {
      const [acct] = await db
        .select({ id: financialAccounts.id })
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.id, accountId),
            eq(financialAccounts.bookId, book.id),
          ),
        )
        .limit(1);
      if (!acct) accountId = null;
    }
  }

  const { token, tokenHash } = mintApiToken();
  await db.insert(apiTokens).values({ groupId: book.groupId, bookId: book.id, tokenHash, label, scope, accountId });
  revalidatePath(SETTINGS);
  return { token };
}

/** Revoke a token (breaks that one device/feed; nothing else). */
export async function revokeTokenAction(
  id: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("finance");
  await requireEditor();
  const book = await requireBook();
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.bookId, book.id)));
  revalidatePath(SETTINGS);
}
