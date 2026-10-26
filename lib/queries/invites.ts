import "server-only";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, groups, invites } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";

// An invite is LIVE while it's unrevoked, unexpired, and has uses left
// (maxUses null = reusable). Dead rows are kept as the audit trail of who was
// let in; every read here computes liveness rather than trusting a flag.
const live = () =>
  and(
    isNull(invites.revokedAt),
    gt(invites.expiresAt, new Date()),
    or(isNull(invites.maxUses), lt(invites.usedCount, invites.maxUses)),
  );

export type PendingInvite = {
  id: number;
  token: string;
  note: string | null;
  groupId: number | null; // null = "their own new hub"
  maxUses: number | null; // null = reusable
  usedCount: number;
  expiresAt: Date;
  createdByUsername: string;
};

/** Live invites minted by this group's accounts (the /group pending list). */
export async function listPendingInvites(): Promise<PendingInvite[]> {
  const groupId = await requireGroupId();
  return db
    .select({
      id: invites.id,
      token: invites.token,
      note: invites.note,
      groupId: invites.groupId,
      maxUses: invites.maxUses,
      usedCount: invites.usedCount,
      expiresAt: invites.expiresAt,
      createdByUsername: accounts.username,
    })
    .from(invites)
    .innerJoin(accounts, eq(invites.createdByAccountId, accounts.id))
    .where(and(eq(accounts.groupId, groupId), live()))
    .orderBy(desc(invites.id));
}

export type JoinableInvite = {
  id: number;
  groupId: number | null; // null = mint a fresh hub
  groupName: string | null; // the household's name, for the /join greeting
  createdByAccountId: number | null; // an own-hub invite copies this login's hub apps
};

/**
 * Look up a LIVE invite by its token — the one PUBLIC read in lib/queries
 * (deliberately no session: the /join visitor doesn't have a login yet; the
 * unguessable token is the credential). Returns null for unknown, revoked,
 * expired, and used-up alike — /join shows one generic message, no oracle.
 */
export async function getJoinableInvite(
  token: string,
): Promise<JoinableInvite | null> {
  if (!token || token.length > 64) return null;
  const [row] = await db
    .select({
      id: invites.id,
      groupId: invites.groupId,
      groupName: groups.name,
      createdByAccountId: invites.createdByAccountId,
    })
    .from(invites)
    .leftJoin(groups, eq(invites.groupId, groups.id))
    .where(and(eq(invites.token, token), live()))
    .limit(1);
  return row ?? null;
}
