import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, groups } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { APPS } from "@/lib/apps";

// Which apps the signed-in login may open: the hub's apps (groups.apps, the
// ceiling: a games-only sign-up's hub has just games) narrowed by the login's
// own list (accounts.apps, set by the owner: a kitchen screen gets chores and
// games). Pages and actions for any other app are refused here, on the server.

/** The signed-in login's hub apps, its own limits, its person, and whether it is the hub login. */
export const currentLogin = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const [row] = await db
    .select({
      hubApps: groups.apps,
      loginApps: accounts.apps,
      isHubLogin: accounts.isHubLogin,
      profileId: accounts.profileId,
    })
    .from(accounts)
    .innerJoin(groups, eq(accounts.groupId, groups.id))
    .where(eq(accounts.id, session.accountId))
    .limit(1);
  return row ?? null;
});

/** Every app the signed-in hub has, before any login's limits; none when signed out. */
export const allHubApps = cache(async (): Promise<string[]> => {
  const login = await currentLogin();
  if (!login) return [];
  return login.hubApps ?? APPS.map((a) => a.slug);
});

/** The apps the signed-in login may open; none when signed out. */
export const hubApps = cache(async (): Promise<string[]> => {
  const login = await currentLogin();
  if (!login) return [];
  const hub = login.hubApps ?? APPS.map((a) => a.slug);
  return login.loginApps ? hub.filter((slug) => login.loginApps!.includes(slug)) : hub;
});

/** Guard for an app's actions: throws unless the signed-in login may open this app. */
export async function requireApp(slug: string): Promise<void> {
  if (!(await hubApps()).includes(slug)) throw new Error(`This login can't open ${slug}.`);
}
