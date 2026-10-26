import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { APPS } from "@/lib/apps";

// Which apps the signed-in hub has (groups.apps). The hub is the ceiling: a
// games-only sign-up's hub has just games, so its pages and actions for every
// other app are refused here, on the server.

/** The signed-in hub's app slugs; every app for a hub with no list, none when signed out. */
export const hubApps = cache(async (): Promise<string[]> => {
  const session = await getSession();
  if (!session) return [];
  const [row] = await db
    .select({ apps: groups.apps })
    .from(groups)
    .where(eq(groups.id, session.groupId))
    .limit(1);
  return row?.apps ?? APPS.map((a) => a.slug);
});

/** Guard for an app's actions: throws unless the signed-in hub has this app. */
export async function requireApp(slug: string): Promise<void> {
  if (!(await hubApps()).includes(slug)) throw new Error(`This hub does not have ${slug}.`);
}
