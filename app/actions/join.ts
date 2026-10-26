"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, groups, invites } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";
import { createOwnHub, newLoginError } from "@/lib/own-hub";
import { createSession } from "@/lib/session";
import { setActiveProfileCookie } from "@/lib/profile";
import { getJoinableInvite } from "@/lib/queries/invites";

// Invite redemption (Phase E): signing up from an invite link, one of the
// actions that deliberately run with NO session: the visitor doesn't have a
// login yet, and the unguessable invite token is their credential (the proxy
// allowlists /join/*).
// Everything is re-validated server-side; the token in the form is checked
// against the live-invite rules on every submit, so a revoked/expired link
// fails here even if the page was already open.

export type JoinState = { error: string } | null;

export async function redeemInviteAction(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const invalid = newLoginError(username, password, confirm);
  if (invalid) return { error: invalid };

  // Re-validate the invite NOW (not when the page rendered).
  const invite = await getJoinableInvite(token);
  if (!invite) {
    return { error: "This invite link is no longer valid — ask for a fresh one." };
  }

  // Own hub: a fresh hub with the same apps as the inviter's, so a games-only
  // hub's invites never mint a full one. Household: join the existing group,
  // which must still exist and never be the demo group (wiped on every tour).
  let accountId: number;
  let groupId: number;
  let ownProfileId: number | null = null;
  if (invite.groupId === null) {
    const [inviter] = invite.createdByAccountId
      ? await db
          .select({ apps: groups.apps })
          .from(accounts)
          .innerJoin(groups, eq(accounts.groupId, groups.id))
          .where(eq(accounts.id, invite.createdByAccountId))
          .limit(1)
      : [];
    const hub = await createOwnHub(username, password, inviter?.apps ?? null);
    if ("error" in hub) return hub;
    ({ accountId, groupId, profileId: ownProfileId } = hub);
  } else {
    const [group] = await db
      .select({ id: groups.id, isDemo: groups.isDemo })
      .from(groups)
      .where(eq(groups.id, invite.groupId))
      .limit(1);
    if (!group || group.isDemo) {
      return { error: "This invite link is no longer valid — ask for a fresh one." };
    }
    groupId = group.id;
    // The unique index on username is the real arbiter; the catch turns a
    // taken name (including a race) into a friendly form error.
    try {
      const [account] = await db
        .insert(accounts)
        .values({ username, passwordHash: hashPassword(password), groupId })
        .returning({ id: accounts.id });
      accountId = account.id;
    } catch {
      return { error: "That username is taken, try another." };
    }
  }

  // Burn the use AFTER the account exists — a failed signup never eats a
  // single-use link. (New account first, increment second: the harmless order.)
  await db
    .update(invites)
    .set({ usedCount: sql`${invites.usedCount} + 1` })
    .where(eq(invites.id, invite.id));

  await createSession(accountId, groupId);
  if (ownProfileId !== null) await setActiveProfileCookie(ownProfileId);

  // Household joiners land on /group to claim their person; own-hub owners on
  // their fresh (empty but working) hub.
  redirect(invite.groupId !== null ? "/group" : "/");
}
