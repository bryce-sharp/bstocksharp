import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, groups, type Group } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";

/** The session's group row (name etc. for the /group page). */
export async function getMyGroup(): Promise<Group | null> {
  const groupId = await requireGroupId();
  const [row] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return row ?? null;
}

export type GroupMember = {
  id: number;
  username: string;
  profileId: number | null; // the profile this account claims, if any
  apps: string[] | null; // the apps this login may open; null = all the hub's
  isHubLogin: boolean; // the hub's shared, person-less login
};

/** All accounts (logins) in the session's group, with their claims. */
export async function listGroupMembers(): Promise<GroupMember[]> {
  const groupId = await requireGroupId();
  return db
    .select({
      id: accounts.id,
      username: accounts.username,
      profileId: accounts.profileId,
      apps: accounts.apps,
      isHubLogin: accounts.isHubLogin,
    })
    .from(accounts)
    .where(eq(accounts.groupId, groupId))
    .orderBy(asc(accounts.id));
}
