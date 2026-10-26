import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, groups, profiles } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";

// A new login with its own hub: the shared path for "own hub" invites and
// self sign-up. The hub is furnished so it works at once: the login owns it
// (it can invite its own people) and has a person named after it, claimed.

// Same spirit as create-account.mjs (lowercase, at least 3 characters) plus a
// tight charset: usernames end up in chips and greetings, keep them boring.
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,79}$/;

/** The form error for a new login's details, or null when they are fine. */
export function newLoginError(username: string, password: string, confirm: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "Username must be at least 3 characters: lowercase letters, numbers, dots, dashes.";
  }
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords don't match.";
  return null;
}

export type OwnHub = { accountId: number; groupId: number; profileId: number };

/** Creates the hub, its owning login and that login's person; `apps` null = every app. */
export async function createOwnHub(
  username: string,
  password: string,
  apps: string[] | null,
): Promise<OwnHub | { error: string }> {
  const [group] = await db
    .insert(groups)
    .values({ name: `${username}'s hub`, apps })
    .returning({ id: groups.id });

  // The unique index on username is the real arbiter; a taken name (including
  // a race) removes the hub just made and becomes a form error.
  let accountId: number;
  try {
    const [account] = await db
      .insert(accounts)
      .values({ username, passwordHash: hashPassword(password), groupId: group.id })
      .returning({ id: accounts.id });
    accountId = account.id;
  } catch {
    await db.delete(groups).where(eq(groups.id, group.id));
    return { error: "That username is taken, try another." };
  }

  await db.update(groups).set({ ownerAccountId: accountId }).where(eq(groups.id, group.id));
  const display = username.charAt(0).toUpperCase() + username.slice(1);
  const [profile] = await db
    .insert(profiles)
    .values({ groupId: group.id, name: display })
    .returning({ id: profiles.id });
  await db.update(accounts).set({ profileId: profile.id }).where(eq(accounts.id, accountId));
  return { accountId, groupId: group.id, profileId: profile.id };
}
